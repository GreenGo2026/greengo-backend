# app/routes/shared_carts.py
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import shared_carts_col

router = APIRouter(prefix="/api/v1/cart/share", tags=["Shared Carts"])

SHARE_TTL_DAYS = 7


# ── Schemas ──────────────────────────────────────────────────────────────────
# Mirrors the frontend's actual CartItem shape (src/services/api.ts Product +
# cartQuantity) -- that type has no id/name_fr/image_url, only what's here.
class CartItemInput(BaseModel):
    name: str
    price_per_unit: float
    unit: str
    cartQuantity: float
    variant_label: str | None = None


class ShareCartPayload(BaseModel):
    items: list[CartItemInput]
    shared_by_name: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _generate_share_id() -> str:
    """8-char URL-safe share ID, unique against shared_carts_col. Retries on
    the rare collision (same pattern as the referral code generator)."""
    col = shared_carts_col()
    for _ in range(10):
        share_id = secrets.token_urlsafe(6)[:8]
        if not await col.find_one({"share_id": share_id}, {"_id": 1}):
            return share_id
    raise RuntimeError("Could not generate a unique share ID after 10 attempts.")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", summary="Create a shareable snapshot of a cart (public, no auth)")
async def create_shared_cart(payload: ShareCartPayload) -> dict[str, Any]:
    if not payload.items:
        raise HTTPException(status_code=400, detail="Panier vide")
    if len(payload.items) > 50:
        raise HTTPException(status_code=400, detail="Trop d'articles (max 50)")

    share_id = await _generate_share_id()
    now = datetime.now(tz=timezone.utc)
    expires_at = now + timedelta(days=SHARE_TTL_DAYS)
    total_price = round(sum(i.price_per_unit * i.cartQuantity for i in payload.items), 2)

    doc = {
        "share_id":       share_id,
        "items":          [item.model_dump() for item in payload.items],
        "shared_by_name": payload.shared_by_name,
        "item_count":     len(payload.items),
        "total_price":    total_price,
        "created_at":     now,
        "expires_at":     expires_at,
        "view_count":     0,
    }
    await shared_carts_col().insert_one(doc)

    return {
        "share_id":    share_id,
        "share_url":   f"https://www.mygreengoo.com/panier/{share_id}",
        "expires_at":  expires_at.isoformat(),
        "item_count":  len(payload.items),
        "total_price": total_price,
    }


@router.get("/{share_id}", summary="Retrieve a shared cart snapshot (public, no auth)")
async def get_shared_cart(share_id: str) -> dict[str, Any]:
    col = shared_carts_col()
    cart = await col.find_one({"share_id": share_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Ce panier n'existe plus ou le lien a expiré.")

    await col.update_one({"share_id": share_id}, {"$inc": {"view_count": 1}})

    return {
        "share_id":       share_id,
        "items":          cart.get("items", []),
        "shared_by_name": cart.get("shared_by_name"),
        "item_count":     cart.get("item_count", 0),
        "total_price":    cart.get("total_price", 0),
        "created_at":     str(cart.get("created_at", "")),
        "expires_at":     str(cart.get("expires_at", "")),
    }
