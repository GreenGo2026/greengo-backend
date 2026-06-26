# app/routes/webhook.py
"""
Green-API incoming message webhook.
Receives customer WhatsApp messages, saves them to MongoDB,
and sends an auto-reply in the background.
Returns HTTP 200 in < 2s to avoid Green-API timeout.
"""
from __future__ import annotations

import ipaddress
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import JSONResponse

from app.database import whatsapp_orders_col
from app.services.whatsapp import send_whatsapp_message

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/webhook", tags=["Webhook"])

# ── Known Green-API IP ranges (informational — token is the primary gate) ─────
_ALLOWED_NETWORKS: list[ipaddress.IPv4Network] = [
    ipaddress.IPv4Network("54.37.0.0/16"),    # Green-API production
    ipaddress.IPv4Network("51.75.0.0/16"),    # Green-API production
    ipaddress.IPv4Network("116.203.0.0/16"),  # Hetzner (observed historically)
]


def _is_allowed_ip(ip_str: str) -> bool:
    try:
        addr = ipaddress.IPv4Address(ip_str)
        return any(addr in net for net in _ALLOWED_NETWORKS)
    except ValueError:
        return False


def _webhook_token() -> str:
    return os.getenv("GREENAPI_WEBHOOK_TOKEN", "")


# ── Order keyword detection ───────────────────────────────────────────────────
_ORDER_KEYWORDS = (
    "commande", "je veux", "livraison", "commander", "prix",
    "كيلو", "كمية", "عندك", "بغيت",
)

def _looks_like_order(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in _ORDER_KEYWORDS)


# ── Auto-reply message ────────────────────────────────────────────────────────
SUPPORT_PHONE = "212664397031"

AUTO_REPLY = (
    "مرحباً بك في GreenGo Market 🥬\n\n"
    "شكراً على تواصلك معنا! 🌿\n"
    "هذا الرقم مخصص للإشعارات الآلية للطلبات فقط.\n\n"
    "لتقديم طلب جديد أو للدعم الفني، يرجى التواصل معنا على:\n"
    f"📞 +{SUPPORT_PHONE}\n\n"
    "فريق GreenGo Market يرحب بك دائماً! 💚"
)

_replied_recently: set[str] = set()


def _send_reply_task(sender_phone: str) -> None:
    """Background task — fires after HTTP 200 is returned to Green-API."""
    if sender_phone in _replied_recently:
        logger.info("[Webhook] Skipping duplicate reply to %s", sender_phone)
        return
    _replied_recently.add(sender_phone)
    if len(_replied_recently) > 500:
        _replied_recently.clear()
    success = send_whatsapp_message(sender_phone, AUTO_REPLY)
    if success:
        logger.info("[Webhook] Auto-reply sent to %s", sender_phone)
    else:
        logger.warning("[Webhook] Auto-reply failed for %s", sender_phone)


@router.post("/whatsapp", summary="Green-API incoming message webhook")
async def whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> JSONResponse:
    """
    Receives webhook events from Green-API.

    Authentication priority:
    1. If GREENAPI_WEBHOOK_TOKEN is set: validate token from
       X-Webhook-Token header OR ?t= query param. Accept from any IP.
    2. If no token configured: fall back to IP allowlist.

    Set webhook URL in Green-API dashboard to:
      https://<your-host>/api/v1/webhook/whatsapp?t=<GREENAPI_WEBHOOK_TOKEN>
    """
    # ── Resolve real client IP (Railway proxy passes X-Forwarded-For) ─────────
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    client_ip = (
        forwarded_for.split(",")[0].strip()
        if forwarded_for
        else (request.client.host if request.client else "unknown")
    )

    known_ip = _is_allowed_ip(client_ip)
    if not known_ip:
        logger.info("[Webhook] Request from non-allowlisted IP: %s", client_ip)

    # ── Authentication ────────────────────────────────────────────────────────
    expected_token = _webhook_token()
    if expected_token:
        # Token configured: accept any IP that presents the correct token
        # (from header OR from ?t= query param in webhook URL)
        received_token = (
            request.headers.get("X-Webhook-Token", "")
            or request.query_params.get("t", "")
        )
        if not received_token or not secrets.compare_digest(
            received_token.encode(), expected_token.encode()
        ):
            logger.warning("[Webhook] Token mismatch from IP: %s", client_ip)
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    elif not known_ip:
        # No token configured AND unknown IP — block
        logger.warning("[Webhook] Rejected: unknown IP %s, no token configured", client_ip)
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})

    # ── Parse body ────────────────────────────────────────────────────────────
    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse(status_code=200, content={"ok": True})

    logger.debug("[Webhook] Received: %s", body)

    event_type = body.get("typeWebhook", "")
    if event_type != "incomingMessageReceived":
        return JSONResponse(status_code=200, content={"ok": True, "ignored": event_type})

    # ── Extract sender and message ────────────────────────────────────────────
    try:
        sender_data  = body.get("senderData", {})
        chat_id      = sender_data.get("chatId", "")
        sender_phone = chat_id.replace("@c.us", "").replace("@g.us", "")
        sender_name  = sender_data.get("senderName", "")

        if not sender_phone or "@g.us" in chat_id:
            return JSONResponse(status_code=200, content={"ok": True, "ignored": "group"})

        if sender_phone == SUPPORT_PHONE or sender_phone.endswith(SUPPORT_PHONE[-9:]):
            return JSONResponse(status_code=200, content={"ok": True, "ignored": "self"})

        message_data = body.get("messageData", {})
        msg_type     = message_data.get("typeMessage", "")
        message_text = ""
        if msg_type == "textMessage":
            message_text = message_data.get("textMessageData", {}).get("textMessage", "")
        elif msg_type == "extendedTextMessage":
            message_text = message_data.get("extendedTextMessageData", {}).get("text", "")

        # ── Save to MongoDB ───────────────────────────────────────────────────
        looks_like_order = _looks_like_order(message_text)
        try:
            await whatsapp_orders_col().insert_one({
                "source":          "whatsapp",
                "customer_phone":  sender_phone,
                "customer_name":   sender_name,
                "raw_message":     message_text,
                "message_type":    msg_type,
                "status":          "pending_review" if looks_like_order else "inquiry",
                "created_at":      datetime.now(timezone.utc),
            })
            logger.info(
                "[Webhook] Saved %s message from %s (order_like=%s)",
                msg_type, sender_phone, looks_like_order,
            )
        except Exception as db_exc:
            logger.warning("[Webhook] MongoDB save failed: %s", db_exc)

        # ── Queue auto-reply (runs after 200 is returned) ─────────────────────
        background_tasks.add_task(_send_reply_task, sender_phone)

    except Exception as exc:
        logger.warning("[Webhook] Error processing webhook body: %s", exc)

    return JSONResponse(status_code=200, content={"ok": True})
