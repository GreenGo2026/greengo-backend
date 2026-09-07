"""
Abandoned cart sessions + WhatsApp recovery.

A session is created when a customer types their phone into the cart but has
not checked out. If it is still unconverted after CART_RECOVERY_DELAY_HOURS,
the sweep sends exactly one WhatsApp reminder.

Guards against messaging people who shouldn't be messaged, in order:
  * converted sessions are excluded (set on checkout)
  * reminder_sent is set the moment a message is dispatched -- one per session,
    ever, as the brief requires
  * a session whose phone has ANY order created after the session started is
    treated as converted, even if the PATCH never arrived (order placed over
    WhatsApp, browser closed before the request, request failed)
  * carts older than CART_RECOVERY_MAX_AGE_HOURS are skipped as stale
  * with CART_RECOVERY_ENABLED false (the default) the sweep logs the exact
    message and marks nothing
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.database import cart_sessions_col, orders_col

router = APIRouter(prefix="/api/v1/cart-sessions", tags=["Cart Sessions"])


# ── Payloads ──────────────────────────────────────────────────────────────────

class CartSnapshotItem(BaseModel):
    name:           str
    quantity:       float = 1
    unit:           str   = "kg"
    price_per_unit: float = 0
    variant_label:  str | None = None


class CreateCartSessionPayload(BaseModel):
    phone:         str = Field(min_length=6, max_length=20)
    items_summary: str = Field(default="", max_length=300)
    cart_snapshot: list[CartSnapshotItem] = Field(default_factory=list)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", summary="Create or refresh the cart session for a phone")
async def upsert_cart_session(payload: CreateCartSessionPayload) -> dict[str, Any]:
    """
    Public -- called from the cart before checkout, so it cannot require auth.

    Upserts on phone: one live session per customer. A returning customer
    editing their cart refreshes the snapshot and restarts the delay window,
    and resets reminder_sent so a *new* abandonment can be reminded again
    later (the one-message rule is per session, not per phone forever).
    """
    now   = datetime.now(timezone.utc)
    phone = payload.phone.strip()

    doc = await cart_sessions_col().find_one_and_update(
        {"phone": phone},
        {
            "$set": {
                "items_summary": payload.items_summary.strip(),
                "cart_snapshot": [i.model_dump() for i in payload.cart_snapshot],
                "created_at":    now,
                "updated_at":    now,
                "converted":     False,
                "reminder_sent": False,
            },
            "$setOnInsert": {"phone": phone},
        },
        upsert=True,
        return_document=True,
    )
    return {"session_id": str(doc["_id"]), "phone": phone, "created_at": now.isoformat()}


@router.patch("/{session_id}/convert", summary="Mark a cart session as converted")
async def convert_cart_session(session_id: str) -> dict[str, Any]:
    """
    Public, same reason as the POST -- called right after a successful order.

    Idempotent: converting an already-converted session is a no-op success, so
    a retried checkout can't 404 or error the customer's success screen.
    """
    try:
        oid = ObjectId(session_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid session id.")

    result = await cart_sessions_col().update_one(
        {"_id": oid},
        {"$set": {"converted": True, "converted_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cart session not found.")
    return {"session_id": session_id, "converted": True}


# ── Recovery sweep ────────────────────────────────────────────────────────────

def build_cart_recovery_message(site_url: str) -> str:
    """Darija reminder, per the sprint brief."""
    return (
        "سلام! 👋 سلتك في GreenGo مازالت كاتسناك 🛒\n"
        "كمّل الطلب دابا وتوصّل طازج 🍅🥕\n"
        f"{site_url.rstrip('/')}/cart"
    )


async def _already_ordered_since(phone: str, since: datetime) -> bool:
    """
    True if this phone has any order created since the session started.

    Covers the case where the PATCH never arrived -- order placed over
    WhatsApp, browser closed mid-request, request failed. Without this, a
    customer who ordered successfully could still be nagged about their cart.
    """
    found = await orders_col().find_one(
        {"phone": phone, "created_at": {"$gte": since}}, {"_id": 1}
    )
    return found is not None


async def send_cart_recovery_reminders() -> dict[str, Any]:
    """
    Registered as a periodic job in main.py. Returns a summary for the logs.

    Never raises for a single bad session -- the scheduler logs and retries the
    whole job, so one malformed document must not stall the rest.
    """
    cfg     = get_settings()
    now     = datetime.now(timezone.utc)
    cutoff  = now - timedelta(hours=cfg.CART_RECOVERY_DELAY_HOURS)
    too_old = now - timedelta(hours=cfg.CART_RECOVERY_MAX_AGE_HOURS)

    col = cart_sessions_col()
    cursor = col.find({
        "converted":     False,
        "reminder_sent": False,
        "created_at":    {"$lt": cutoff, "$gte": too_old},
    })

    considered = sent = skipped_ordered = failed = 0
    message = build_cart_recovery_message(cfg.SITE_URL)

    async for session in cursor:
        considered += 1
        phone      = (session.get("phone") or "").strip()
        created_at = session.get("created_at")
        if not phone:
            continue

        if isinstance(created_at, datetime):
            since = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
            if await _already_ordered_since(phone, since):
                skipped_ordered += 1
                # Reconcile the record so it's never reconsidered.
                await col.update_one(
                    {"_id": session["_id"]},
                    {"$set": {"converted": True, "converted_at": now,
                              "converted_via": "order_backfill"}},
                )
                continue

        if not cfg.CART_RECOVERY_ENABLED:
            print(
                f"[CART-RECOVERY] DRY RUN would send to {phone} "
                f"(cart: {session.get('items_summary') or 'n/a'}):\n{message}"
            )
            continue

        # Claim the send BEFORE dispatching. If the send throws, the reminder is
        # not retried -- one unsent reminder beats a crash-loop messaging a
        # customer repeatedly, which the one-message-ever rule forbids.
        claimed = await col.update_one(
            {"_id": session["_id"], "reminder_sent": False},
            {"$set": {"reminder_sent": True, "reminder_sent_at": now}},
        )
        if claimed.modified_count == 0:
            continue  # another worker took it

        try:
            # send_and_log calls asyncio.run internally (it's built for FastAPI
            # BackgroundTasks, which run in a threadpool). Calling it directly
            # from this coroutine would raise "asyncio.run() cannot be called
            # from a running event loop", so it goes to a worker thread -- which
            # also keeps its blocking requests call off the event loop.
            from app.services.notifications import send_and_log
            await asyncio.to_thread(send_and_log, phone, message, "cart_recovery")
            sent += 1
        except Exception as exc:
            failed += 1
            print(f"[CART-RECOVERY] send failed for {phone}: {exc}")
            await col.update_one(
                {"_id": session["_id"]},
                {"$set": {"reminder_error": str(exc)[:300]}},
            )

    summary = {
        "ran_at":          now.isoformat(),
        "enabled":         cfg.CART_RECOVERY_ENABLED,
        "delay_hours":     cfg.CART_RECOVERY_DELAY_HOURS,
        "considered":      considered,
        "sent":            sent,
        "skipped_ordered": skipped_ordered,
        "failed":          failed,
    }
    print(
        f"[CART-RECOVERY] sweep{'' if cfg.CART_RECOVERY_ENABLED else ' (DRY RUN)'}: "
        f"considered={considered} sent={sent} skipped_ordered={skipped_ordered} failed={failed}"
    )
    return summary
