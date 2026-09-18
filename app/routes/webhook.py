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

from fastapi import APIRouter, BackgroundTasks, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse

from app.database import saved_baskets_col, customers_col, whatsapp_orders_col, orders_col
from app.services.whatsapp import async_send_whatsapp_message

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/webhook", tags=["Webhook"])

META_VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "")

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
SUPPORT_PHONE = "212664500789"

AUTO_REPLY = (
    "مرحباً بك في GreenGo Market 🥬\n\n"
    "شكراً على تواصلك معنا! 🌿\n"
    "هذا الرقم مخصص للإشعارات الآلية للطلبات فقط.\n\n"
    "لتقديم طلب جديد أو للدعم الفني، يرجى التواصل معنا على:\n"
    f"📞 +{SUPPORT_PHONE}\n\n"
    "فريق GreenGo Market يرحب بك دائماً! 💚"
)

_replied_recently: set[str] = set()

# ── Basket confirmation ("Panier Hebdomadaire") ───────────────────────────────
# A driver-style reply -- "1" / "oui" / "نعم" -- to today's basket reminder
# places that basket as a real order via the same validation/fee/loyalty path
# as the checkout form. See app/routes/baskets.py for the reminder sweep and
# app/routes/orders.py's _create_order_internal for the shared order logic.
_BASKET_CONFIRM = {"1", "oui", "yes", "نعم", "واه", "ايه", "ok", "okay"}


def _to_e164(raw_digits: str) -> str:
    """Green-API's chatId gives bare digits ("212612345678"), no '+'. Every
    other collection (customers, saved_baskets) keys on +212... -- normalize
    before querying either."""
    raw = raw_digits.strip()
    return raw if raw.startswith("+") else "+" + raw


_REVIEW_SCORES = {"1", "2", "3", "4", "5"}


async def _try_review_reply(phone: str, body_text: str, background_tasks: BackgroundTasks) -> bool:
    """Returns True if the message was a 1-5 review-score reply (handled --
    score stored, product ratings recomputed, thank-you sent). Checked
    before _try_basket_confirmation since "1" also appears in
    _BASKET_CONFIRM -- only intercepted here if this phone actually has a
    pending review request, so a real basket "1" reply isn't swallowed.

    The reply itself is scheduled via background_tasks (not awaited inline)
    so the anti-ban queue's 3-8s pacing can't delay the webhook's own HTTP
    response -- Green-API expects < 2s or it may consider the webhook dead
    and retry."""
    score_str = body_text.strip()
    if score_str not in _REVIEW_SCORES:
        return False

    score = int(score_str)
    now = datetime.now(tz=timezone.utc)

    order = await orders_col().find_one(
        {"phone": phone, "review_sent_at": {"$ne": None}, "review_score": None},
        sort=[("review_sent_at", -1)],
    )
    if not order:
        return False

    await orders_col().update_one(
        {"_id": order["_id"]},
        {"$set": {"review_score": score, "review_received_at": now}},
    )

    from app.services.review_requests import _update_product_rating
    for item in order.get("items", []):
        name = item.get("name", "")
        if name:
            await _update_product_rating(name)

    stars = "⭐" * score
    message = (
        f"شكراً {order.get('customer_name','')} على تقييمك {stars}\n\n"
        f"رأيك يساعدنا نحسّنو خدمتنا لك \U0001F49A\n"
        f"نتلاقاو في الطلبية الجاية! \U0001F6D2"
    )
    background_tasks.add_task(async_send_whatsapp_message, phone, message)
    return True


async def _try_basket_confirmation(sender_phone_raw: str, body_text: str, background_tasks: BackgroundTasks) -> bool:
    """Returns True if the message was a basket confirmation (handled --
    order created or a failure reply sent). False means "not a basket
    reply, keep processing normally" (falls through to the existing
    order-keyword / logging / auto-reply flow below). Reply sends are
    scheduled via background_tasks -- see _try_review_reply's docstring for
    why they aren't awaited inline."""
    if body_text.strip().lower() not in _BASKET_CONFIRM:
        return False

    phone = _to_e164(sender_phone_raw)
    today_start = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    basket = await saved_baskets_col().find_one(
        {"phone": phone, "active": True, "reminder_sent_at": {"$gte": today_start}},
        sort=[("reminder_sent_at", -1)],
    )
    if not basket:
        return False  # no reminder sent today -- not a basket reply, don't swallow it

    from app.routes.orders import _create_order_internal, CreateOrderPayload

    customer = await customers_col().find_one({"phone": phone})
    address = (
        basket.get("delivery_address")
        or (customer or {}).get("last_address", "")
        or "Via WhatsApp"
    )

    try:
        payload = CreateOrderPayload(
            customer_name=(customer or {}).get("name", ""),
            phone=phone,
            address=address,
            items=basket["items"],
            total_price=sum(
                i.get("price_per_unit", 0) * i.get("quantity", 1) for i in basket["items"]
            ),
            use_points=False,  # never auto-redeem loyalty points from a WhatsApp reply
        )
        result = await _create_order_internal(payload)
    except Exception as exc:
        logger.warning("[Webhook] basket confirmation order failed for %s: %s", phone, exc)
        background_tasks.add_task(
            async_send_whatsapp_message, phone,
            "❌ لم نتمكن من إنشاء طلبك. زور الموقع من فضلك: https://www.mygreengoo.com",
        )
        return True

    order_id = result.order_id
    background_tasks.add_task(
        async_send_whatsapp_message, phone,
        f"✅ طلبك من سلة *{basket.get('name', '')}* وصلنا!\n"
        f"رقم الطلب: #{order_id[-6:].upper()}\n"
        f"تتبع طلبك: https://www.mygreengoo.com/orders/{order_id}/track",
    )
    return True


async def _send_reply_task(sender_phone: str) -> None:
    """Background task — fires after HTTP 200 is returned to Green-API.
    Already deferred (BackgroundTasks), so routing through the anti-ban
    queue here adds no response-time risk."""
    if sender_phone in _replied_recently:
        logger.info("[Webhook] Skipping duplicate reply to %s", sender_phone)
        return
    _replied_recently.add(sender_phone)
    if len(_replied_recently) > 500:
        _replied_recently.clear()
    success = await async_send_whatsapp_message(sender_phone, AUTO_REPLY)
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

        # ── Review score reply / basket confirmation -- both short-circuit
        # before order-keyword logging and the generic auto-reply, since
        # these are handled actions, not inquiries. Review check goes first:
        # "1" is a valid value in both _REVIEW_SCORES and _BASKET_CONFIRM,
        # disambiguated by whether this phone actually has a pending review
        # request. ─────────────────────────────────────────────────────────
        if message_text and await _try_review_reply(_to_e164(sender_phone), message_text, background_tasks):
            return JSONResponse(status_code=200, content={"ok": True, "handled": "review_recorded"})
        if message_text and await _try_basket_confirmation(sender_phone, message_text, background_tasks):
            return JSONResponse(status_code=200, content={"ok": True, "handled": "basket_confirmation"})

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


# ── Meta Cloud API webhook — coexists with the Green-API handler above while
# the Meta cutover is being tested. Router already carries
# prefix="/api/v1/webhook", so these register at /api/v1/webhook/meta. ────────

@router.get("/meta", summary="Meta webhook verification (GET)")
async def meta_webhook_verify(request: Request):
    """
    Meta calls this when the webhook URL is registered in Meta Business
    Manager. Must echo back hub.challenge as plain text.
    """
    params    = request.query_params
    mode      = params.get("hub.mode", "")
    token     = params.get("hub.verify_token", "")
    challenge = params.get("hub.challenge", "")

    if mode == "subscribe" and token == META_VERIFY_TOKEN:
        logger.info("[meta-webhook] verification successful")
        return PlainTextResponse(challenge)

    logger.warning("[meta-webhook] verification failed mode=%s token_match=%s", mode, token == META_VERIFY_TOKEN)
    return Response(status_code=403)


@router.post("/meta", summary="Meta webhook inbound messages (POST)")
async def meta_webhook_inbound(request: Request, background_tasks: BackgroundTasks):
    """
    Receives inbound WhatsApp messages from Meta Cloud API. Fans out to the
    same basket-confirmation handler as the Green-API path. Anything not
    handled here falls through -- Chatwoot receives it directly from Meta
    if/when configured as a second webhook target, no forwarding needed.
    """
    try:
        body  = await request.json()
        entry = (body.get("entry") or [{}])[0]
        value = (entry.get("changes") or [{}])[0].get("value", {})
        msgs  = value.get("messages", [])

        if not msgs:
            return {"status": "no_message"}

        msg   = msgs[0]
        phone = "+" + msg.get("from", "")
        text  = msg.get("text", {}).get("body", "").strip()

        logger.info("[meta-webhook] inbound from=%s text=%s", phone, text[:50])

        if text and await _try_review_reply(phone, text, background_tasks):
            return {"status": "review_recorded"}
        if text and await _try_basket_confirmation(phone, text, background_tasks):
            return {"status": "basket_confirmed"}

        return {"status": "ok"}

    except Exception as exc:
        logger.error("[meta-webhook] error: %s", exc)
        return {"status": "error"}
