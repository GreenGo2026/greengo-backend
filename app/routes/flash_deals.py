"""
Flash Deals ("Offres Express") -- time-boxed discounts.

Single source of truth: on_sale + discount_pct on the product doc (the same
fields the existing product editor / catalog grid / "En promo" filter already
read). This module is a *scheduler* on top of those fields, plus the admin
list and the public carousel data source -- it never introduces a second,
independently-displayed discount.

Invariant: a flash deal only ever touches a product that was NOT already
manually on_sale before the deal was created (checked at creation; enforced
by never turning on_sale off on expiry unless this deal is what turned it on
and no other active deal on the same product remains).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId, errors as bson_errors
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import flash_deals_col, products_col

router = APIRouter(tags=["Flash Deals"])


def _safe_oid(id_: str) -> ObjectId:
    try:
        return ObjectId(id_)
    except (bson_errors.InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="ID invalide.")


def _iso(v: Any) -> str:
    return v.isoformat() if isinstance(v, datetime) else str(v or "")


def _serialize(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id":                 str(doc["_id"]),
        "product_name_ar":    doc.get("product_name_ar", ""),
        "product_name_fr":    doc.get("product_name_fr", ""),
        "unit":               doc.get("unit", ""),
        "image_url":          doc.get("image_url", ""),
        "discount_pct":       doc.get("discount_pct", 0),
        "original_price_mad": doc.get("original_price_mad", 0),
        "deal_price_mad":     doc.get("deal_price_mad", 0),
        "starts_at":          _iso(doc.get("starts_at")),
        "expires_at":         _iso(doc.get("expires_at")),
        "active":             doc.get("active", True),
        "in_stock":           doc.get("in_stock", True),
        "created_at":         _iso(doc.get("created_at")),
    }


# ── Public ────────────────────────────────────────────────────────────────────

@router.get("/api/v1/flash-deals", summary="Active flash deals (public)")
async def list_active_deals() -> list[dict[str, Any]]:
    now = datetime.now(tz=timezone.utc)
    docs = await flash_deals_col().find({
        "active":     True,
        "starts_at":  {"$lte": now},
        "expires_at": {"$gt":  now},
    }).sort("expires_at", 1).to_list(length=20)

    names = list({d["product_name_ar"] for d in docs})
    prods = await products_col().find(
        {"name_ar": {"$in": names}},
        {"name_ar": 1, "in_stock": 1, "image_url": 1},
    ).to_list(length=len(names)) if names else []
    prod_map = {p["name_ar"]: p for p in prods}

    result: list[dict[str, Any]] = []
    for doc in docs:
        s = _serialize(doc)
        p = prod_map.get(doc["product_name_ar"], {})
        s["in_stock"] = p.get("in_stock", True)
        s["image_url"] = doc.get("image_url") or p.get("image_url", "")
        result.append(s)
    return result


# ── Admin ─────────────────────────────────────────────────────────────────────

class CreateDealPayload(BaseModel):
    product_name_ar: str = Field(min_length=1)
    discount_pct:    float = Field(gt=0, lt=100, description="e.g. 30 for -30%")
    starts_at:       datetime
    expires_at:      datetime


@router.post("/api/v1/admin/flash-deals", status_code=201, summary="Create a flash deal (admin)")
async def create_deal(payload: CreateDealPayload, _: None = Depends(require_admin)) -> dict[str, Any]:
    if payload.expires_at <= payload.starts_at:
        raise HTTPException(status_code=400, detail="expires_at doit être après starts_at.")

    product = await products_col().find_one({"name_ar": payload.product_name_ar})
    if not product:
        raise HTTPException(status_code=404, detail=f"Produit introuvable: {payload.product_name_ar}")

    # Dual-discount guard: refuse if the product is already manually on_sale
    # and this isn't just re-touching an existing active deal on it.
    if product.get("on_sale"):
        existing_deal = await flash_deals_col().find_one(
            {"product_name_ar": payload.product_name_ar, "active": True}
        )
        if not existing_deal:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Ce produit est déjà en promotion manuelle. "
                    "Désactivez d'abord la promo permanente dans l'onglet Produits."
                ),
            )

    original = float(product.get("price_mad", 0))
    if original <= 0:
        raise HTTPException(status_code=400, detail="Prix produit invalide.")

    deal_price = round(original * (1 - payload.discount_pct / 100), 2)
    now = datetime.now(tz=timezone.utc)

    doc = {
        "product_name_ar":    payload.product_name_ar,
        "product_name_fr":    product.get("name_fr", ""),
        "unit":               product.get("unit", ""),
        "image_url":          product.get("image_url", ""),
        "discount_pct":       payload.discount_pct,
        "original_price_mad": original,
        "deal_price_mad":     deal_price,
        "starts_at":          payload.starts_at,
        "expires_at":         payload.expires_at,
        "active":             True,
        "created_at":         now,
    }
    result = await flash_deals_col().insert_one(doc)
    doc["_id"] = result.inserted_id

    if payload.starts_at <= now:
        await products_col().update_one(
            {"name_ar": payload.product_name_ar},
            {"$set": {"on_sale": True, "discount_pct": payload.discount_pct}},
        )

    return _serialize(doc)


@router.get("/api/v1/admin/flash-deals", summary="List all deals (admin)")
async def admin_list_deals(_: None = Depends(require_admin)) -> list[dict[str, Any]]:
    docs = await flash_deals_col().find({}).sort("created_at", -1).to_list(length=100)
    return [_serialize(d) for d in docs]


@router.delete("/api/v1/admin/flash-deals/{deal_id}", status_code=204, summary="Cancel a deal immediately (admin)")
async def cancel_deal(deal_id: str, _: None = Depends(require_admin)) -> None:
    doc = await flash_deals_col().find_one_and_update(
        {"_id": _safe_oid(deal_id)},
        {"$set": {"active": False}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Deal introuvable.")

    # Only restore on_sale=False if no other active deal still covers this product.
    other = await flash_deals_col().find_one(
        {"product_name_ar": doc["product_name_ar"], "active": True}
    )
    if not other:
        await products_col().update_one(
            {"name_ar": doc["product_name_ar"]},
            {"$set": {"on_sale": False, "discount_pct": 0}},
        )


# ── Scheduler sweep (registered in main.py, same site as the other jobs) ──────

async def expire_flash_deals() -> dict[str, Any]:
    """
    Runs every 5 minutes.
      1. Deactivates deals past expires_at, restoring on_sale=False on the
         product -- but only if no other active deal still covers it.
      2. Activates deals whose starts_at has now arrived (on_sale=True) if the
         product isn't already on_sale (avoids clobbering a deal that somehow
         raced ahead, or a manual toggle set in between).
    """
    now = datetime.now(tz=timezone.utc)
    col = flash_deals_col()

    expired = await col.find({"active": True, "expires_at": {"$lte": now}}).to_list(length=200)
    expired_count = 0
    for deal in expired:
        await col.update_one({"_id": deal["_id"]}, {"$set": {"active": False}})
        expired_count += 1
        other = await col.find_one({"product_name_ar": deal["product_name_ar"], "active": True})
        if not other:
            await products_col().update_one(
                {"name_ar": deal["product_name_ar"]},
                {"$set": {"on_sale": False, "discount_pct": 0}},
            )

    pending = await col.find({
        "active": True,
        "starts_at": {"$lte": now},
        "expires_at": {"$gt": now},
    }).to_list(length=200)
    activated_count = 0
    for deal in pending:
        product = await products_col().find_one({"name_ar": deal["product_name_ar"]}, {"on_sale": 1})
        if product and not product.get("on_sale"):
            await products_col().update_one(
                {"name_ar": deal["product_name_ar"]},
                {"$set": {"on_sale": True, "discount_pct": deal["discount_pct"]}},
            )
            activated_count += 1

    summary = {"expired": expired_count, "activated": activated_count}
    print(f"[FLASH-DEALS] sweep: {summary}")
    return summary
