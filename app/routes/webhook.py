# app/routes/webhook.py
"""
Green-API incoming message webhook.
Receives customer messages and replies with a support redirect message.
Responds in < 2s to avoid Green-API timeout.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import JSONResponse

from app.services.whatsapp import send_whatsapp_message

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/webhook", tags=["Webhook"])

# ── Auto-reply message ────────────────────────────────────────────────────────
SUPPORT_PHONE = "212664397031"   # Update to your real support number

AUTO_REPLY = (
    "مرحباً بك في GreenGo Market 🥬\n\n"
    "شكراً على تواصلك معنا! 🌿\n"
    "هذا الرقم مخصص للإشعارات الآلية للطلبات فقط.\n\n"
    "لتقديم طلب جديد أو للدعم الفني، يرجى التواصل معنا على:\n"
    f"📞 +{SUPPORT_PHONE}\n\n"
    "فريق GreenGo Market يرحب بك دائماً! 💚"
)

# Track replied senders to avoid spam loops (in-memory, resets on restart)
_replied_recently: set[str] = set()


def _send_reply_task(sender_phone: str) -> None:
    """Background task — runs after HTTP 200 is returned to Green-API."""
    if sender_phone in _replied_recently:
        logger.info("[Webhook] Skipping duplicate reply to %s", sender_phone)
        return
    _replied_recently.add(sender_phone)
    # Limit set size to avoid unbounded growth
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
    Returns 200 immediately, sends auto-reply in background.
    """
    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        # Malformed body — still return 200 so Green-API doesn't retry
        return JSONResponse(status_code=200, content={"ok": True})

    logger.debug("[Webhook] Received: %s", body)

    # Green-API event types we care about: incomingMessageReceived
    event_type = body.get("typeWebhook", "")
    if event_type != "incomingMessageReceived":
        return JSONResponse(status_code=200, content={"ok": True, "ignored": event_type})

    # Extract sender phone from chatId (format: "212XXXXXXXXX@c.us")
    try:
        sender_data  = body.get("senderData", {})
        chat_id      = sender_data.get("chatId", "")          # "212664XXXXXX@c.us"
        sender_phone = chat_id.replace("@c.us", "").replace("@g.us", "")

        # Ignore group messages and empty senders
        if not sender_phone or "@g.us" in chat_id:
            return JSONResponse(status_code=200, content={"ok": True, "ignored": "group"})

        # Ignore messages from our own support number (avoid loop)
        if sender_phone == SUPPORT_PHONE or sender_phone.endswith(SUPPORT_PHONE[-9:]):
            return JSONResponse(status_code=200, content={"ok": True, "ignored": "self"})

        # Queue auto-reply in background — response returns immediately
        background_tasks.add_task(_send_reply_task, sender_phone)

    except Exception as exc:
        logger.warning("[Webhook] Error parsing webhook body: %s", exc)

    # Always return 200 fast — Green-API expects response within 5s
    return JSONResponse(status_code=200, content={"ok": True})
