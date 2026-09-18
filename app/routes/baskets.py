"""
Saved baskets -- weekly subscription reorder via WhatsApp.

Pass 1 (this file): CRUD + reminder sweep only. The reminder message asks the
customer to reply "1"/"oui"/"نعم"; actually turning that reply into an order
is Pass 2 -- it needs to reuse create_order()'s full validation/fee/loyalty
path (see the PR discussion), not a second hand-rolled insert.

send_basket_reminders lives here rather than in services/scheduler.py,
mirroring send_cart_recovery_reminders in cart_sessions.py -- the scheduler
module only holds the generic run-loop, each domain owns its own job.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from bson import ObjectId, errors as bson_errors
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.routes.auth_customer import require_customer
from app.database import saved_baskets_col

router = APIRouter(prefix="/api/v1/baskets", tags=["Baskets"])

REMINDER_DAYS = Literal[
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
]


class BasketItem(BaseModel):
    name:           str
    price_per_unit: float
    unit:           str
    quantity:       float = Field(default=1.0, gt=0)


class SaveBasketPayload(BaseModel):
    name:             str = Field(min_length=1, max_length=60)
    items:            list[BasketItem] = Field(min_length=1)
    delivery_address: str = ""
    reminder_day:     REMINDER_DAYS = "friday"
    active:           bool = True


def _serialize(doc: dict[str, Any]) -> dict[str, Any]:
    sent_at = doc.get("reminder_sent_at")
    return {
        "id":               str(doc.get("_id", "")),
        "phone":            doc.get("phone", ""),
        "name":             doc.get("name", ""),
        "items":            doc.get("items", []),
        "active":           doc.get("active", True),
        "delivery_address": doc.get("delivery_address", ""),
        "reminder_day":     doc.get("reminder_day", "friday"),
        "reminder_sent_at": sent_at.isoformat() if isinstance(sent_at, datetime) else "",
        "created_at":       (doc["created_at"].isoformat()
                              if isinstance(doc.get("created_at"), datetime) else ""),
    }


def _safe_oid(basket_id: str) -> ObjectId:
    try:
        return ObjectId(basket_id)
    except (bson_errors.InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="ID invalide.")


@router.get("", summary="List the authenticated customer's saved baskets")
async def list_baskets(phone: str = Depends(require_customer)) -> list[dict[str, Any]]:
    docs = await saved_baskets_col().find({"phone": phone}).sort("created_at", -1).to_list(length=20)
    return [_serialize(d) for d in docs]


@router.post("", status_code=201, summary="Save a basket for weekly WhatsApp reminders")
async def create_basket(
    payload: SaveBasketPayload,
    phone: str = Depends(require_customer),
) -> dict[str, Any]:
    now = datetime.now(tz=timezone.utc)
    doc = {
        "phone":            phone,
        "name":             payload.name.strip(),
        "items":            [i.model_dump() for i in payload.items],
        "active":           payload.active,
        "delivery_address": payload.delivery_address.strip(),
        "reminder_day":     payload.reminder_day,
        "reminder_sent_at": None,
        "created_at":       now,
        "updated_at":       now,
    }
    result = await saved_baskets_col().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.patch("/{basket_id}", summary="Update a saved basket")
async def update_basket(
    basket_id: str,
    payload: SaveBasketPayload,
    phone: str = Depends(require_customer),
) -> dict[str, Any]:
    now = datetime.now(tz=timezone.utc)
    result = await saved_baskets_col().find_one_and_update(
        {"_id": _safe_oid(basket_id), "phone": phone},
        {"$set": {
            "name":             payload.name.strip(),
            "items":            [i.model_dump() for i in payload.items],
            "active":           payload.active,
            "delivery_address": payload.delivery_address.strip(),
            "reminder_day":     payload.reminder_day,
            "updated_at":       now,
        }},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Panier introuvable.")
    return _serialize(result)


@router.delete("/{basket_id}", status_code=204, summary="Delete a saved basket")
async def delete_basket(basket_id: str, phone: str = Depends(require_customer)) -> None:
    result = await saved_baskets_col().delete_one({"_id": _safe_oid(basket_id), "phone": phone})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Panier introuvable.")


# ── Weekly reminder sweep ─────────────────────────────────────────────────────

async def send_basket_reminders() -> dict[str, Any]:
    """
    Hourly job (registered in main.py's lifespan, same site as loyalty-expiry
    and cart-recovery). Sends a WhatsApp reminder to every active basket whose
    reminder_day matches today and hasn't already been sent today.
    """
    from app.services.whatsapp import async_send_whatsapp_message

    now = datetime.now(tz=timezone.utc)
    today = now.strftime("%A").lower()  # "friday"
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    col = saved_baskets_col()
    baskets = await col.find({
        "active":       True,
        "reminder_day": today,
        "$or": [
            {"reminder_sent_at": None},
            {"reminder_sent_at": {"$lt": today_start}},
        ],
    }).to_list(length=500)

    sent = failed = 0
    for basket in baskets:
        phone = basket.get("phone", "")
        name = basket.get("name", "")
        items = basket.get("items", [])
        bid = str(basket["_id"])

        summary = "، ".join(f"{i.get('name', '')} ×{i.get('quantity', 1)}" for i in items[:3])
        if len(items) > 3:
            summary += f" +{len(items) - 3} autres"

        message = (
            f"سلام! 👋 باسلك الأسبوعي *{name}* جاهز:\n"
            f"🛒 {summary}\n\n"
            f"ردّ بـ *1* أو *نعم* أو *oui* باش نأمرو ليك دابا 🚀\n"
            f"أو زور الموقع: https://www.mygreengoo.com\n\n"
            f"رقم السلة: `{bid}`"
        )
        try:
            # Anti-ban queued send -- paces this loop over many customers
            # instead of firing them back-to-back.
            ok = await async_send_whatsapp_message(phone, message)
        except Exception:
            ok = False

        if ok:
            sent += 1
            await col.update_one({"_id": basket["_id"]}, {"$set": {"reminder_sent_at": now}})
        else:
            failed += 1

    summary_out = {"considered": len(baskets), "sent": sent, "failed": failed}
    print(f"[BASKET-REMINDER] sweep: {summary_out}")
    return summary_out
