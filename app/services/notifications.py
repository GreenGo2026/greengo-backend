# app/services/notifications.py
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime
from typing import Any, Optional

import httpx
from bson import ObjectId

from app.database import notifications_col

logger = logging.getLogger(__name__)


class NotifStatus:
    PENDING  = "pending"
    SENT     = "sent"
    FAILED   = "failed"


async def log_notification(
    recipient_phone: str,
    message: str,
    notification_type: str,  # "order_status" | "order_confirm" | "admin_alert"
    order_id: Optional[str] = None,
    order_ref: Optional[str] = None,
    status: str = NotifStatus.PENDING,
) -> str:
    """Insert a notification record. Returns the inserted document ID (or "" on failure)."""
    try:
        result = await notifications_col().insert_one({
            "recipient_phone":    recipient_phone,
            "message":            message[:200],
            "notification_type":  notification_type,
            "order_id":           order_id,
            "order_ref":          order_ref,
            "status":             status,
            "error":              None,
            "attempts":           1 if status == NotifStatus.SENT else 0,
            "created_at":         datetime.utcnow(),
            "updated_at":         datetime.utcnow(),
        })
        return str(result.inserted_id)
    except Exception as exc:
        logger.error("Failed to log notification: %s", exc)
        return ""


async def update_notification_status(
    notif_id: str,
    status: str,
    error: Optional[str] = None,
    increment_attempts: bool = True,
) -> None:
    """Update status of an existing notification. No-op if notif_id is empty."""
    if not notif_id:
        return
    try:
        update: dict[str, Any] = {"$set": {"status": status, "updated_at": datetime.utcnow(), "error": error}}
        if increment_attempts:
            update["$inc"] = {"attempts": 1}
        await notifications_col().update_one({"_id": ObjectId(notif_id)}, update)
    except Exception as exc:
        logger.error("Failed to update notification %s: %s", notif_id, exc)


# ── Sync wrappers for use with FastAPI BackgroundTasks ──────────────────────
# whatsapp.py's send functions are synchronous by design (never raise, return
# bool) -- these wrappers log + send + update status from within the same
# background-task execution. BackgroundTasks runs sync callables in a worker
# thread with no event loop of its own, so asyncio.run() here is safe (this
# is NOT called from inside an already-running event loop).

def _run_and_log(
    sender: Any,
    sender_args: tuple,
    recipient_phone: str,
    message: str,
    notification_type: str,
    order_id: Optional[str],
    order_ref: Optional[str],
) -> None:
    async def _do() -> None:
        notif_id = await log_notification(recipient_phone, message, notification_type, order_id, order_ref)
        try:
            ok = sender(*sender_args)
            await update_notification_status(
                notif_id,
                NotifStatus.SENT if ok else NotifStatus.FAILED,
                error=None if ok else "Green-API returned failure",
            )
        except Exception as exc:
            await update_notification_status(notif_id, NotifStatus.FAILED, error=str(exc))

    try:
        asyncio.run(_do())
    except Exception as exc:
        logger.error("Notification send/log crashed: %s", exc)


def send_and_log(
    phone: str,
    message: str,
    notification_type: str,
    order_id: Optional[str] = None,
    order_ref: Optional[str] = None,
) -> None:
    """Background-task-safe replacement for send_whatsapp_message(phone, message)."""
    from app.services.whatsapp import send_whatsapp_message
    _run_and_log(send_whatsapp_message, (phone, message), phone, message, notification_type, order_id, order_ref)


def notify_customer_and_log(_log_order_id: str, _log_order_ref: str, **kwargs: Any) -> None:
    """
    Background-task-safe replacement for notify_customer_order(**kwargs).
    The leading params are prefixed (_log_*) so they can't collide with the
    order_id kwarg that must also be forwarded to notify_customer_order().
    """
    from app.services.whatsapp import notify_customer_order
    summary = f"Order confirmation #{_log_order_ref}"
    _run_and_log(
        lambda: notify_customer_order(**kwargs),
        (),
        kwargs.get("phone", ""),
        summary,
        "order_confirm",
        _log_order_id,
        _log_order_ref,
    )


def notify_admin_and_log(_log_order_id: str, _log_order_ref: str, **kwargs: Any) -> None:
    """Background-task-safe replacement for notify_admin_new_order(**kwargs)."""
    from app.services.whatsapp import notify_admin_new_order
    summary = f"Admin alert #{_log_order_ref}"
    _run_and_log(
        lambda: notify_admin_new_order(**kwargs),
        (),
        os.getenv("ADMIN_WHATSAPP_PHONE", ""),
        summary,
        "admin_alert",
        _log_order_id,
        _log_order_ref,
    )


# ── Green-API status check ───────────────────────────────────────────────────
# Uses the same env var names (and legacy fallbacks) as whatsapp.py itself --
# GREENAPI_API_TOKEN (as a plausible-sounding guess) does not exist anywhere
# in this codebase; the real vars are GREENAPI_INSTANCE_ID / GREENAPI_TOKEN.

async def check_greenapi_status() -> dict:
    instance_id = os.getenv("GREENAPI_INSTANCE_ID") or os.getenv("GREEN_API_ID_INSTANCE") or ""
    api_token   = os.getenv("GREENAPI_TOKEN") or os.getenv("GREEN_API_TOKEN_INSTANCE") or ""
    base        = (os.getenv("GREEN_API_URL") or "https://api.green-api.com").rstrip("/")

    if not instance_id or not api_token:
        return {
            "status":  "unknown",
            "color":   "gray",
            "message": "Green-API credentials not configured",
        }

    url = f"{base}/waInstance{instance_id}/getStateInstance/{api_token}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            data = r.json()
    except Exception as exc:
        return {
            "status":  "error",
            "color":   "red",
            "message": f"Erreur Green-API: {str(exc)[:100]}",
        }

    state = data.get("stateInstance", "unknown")
    if state == "authorized":
        return {"status": "authorized", "color": "green", "message": "WhatsApp connecté ✅"}
    if state == "notAuthorized":
        return {"status": "notAuthorized", "color": "red", "message": "WhatsApp déconnecté — scanner le QR code"}
    return {"status": state, "color": "yellow", "message": f"Status: {state}"}
