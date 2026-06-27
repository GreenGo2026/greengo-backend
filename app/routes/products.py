# app/routes/products.py
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import require_admin
from app.database import products_col
from app.models.product import CreateProductRequest, ProductResponse, UpdateProductRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/products", tags=["Products v2"])


def _serialize(doc: dict[str, Any]) -> ProductResponse:
    """
    Map a raw MongoDB document to ProductResponse.
    Handles both the canonical schema (name_ar, price_mad, in_stock)
    and any legacy field names written by older scripts.
    Uses `or` fallbacks instead of dict.get defaults so that explicit null
    values in MongoDB documents are treated the same as missing keys.
    """
    # price: canonical field is price_mad; fall back to price_per_unit
    price_raw = doc.get("price_mad")
    if price_raw is None:
        price_raw = doc.get("price_per_unit")

    # availability: canonical field is in_stock; fall back to is_available / available
    stock = doc.get("in_stock")
    if stock is None:
        stock = doc.get("is_available")
    if stock is None:
        stock = doc.get("available", True)

    # display name: canonical is name_ar; fall back to arabic_name / name
    name_ar = doc.get("name_ar") or doc.get("arabic_name") or doc.get("name", "")
    step_val = doc.get("step")
    disc_raw = doc.get("discount_pct")

    return ProductResponse(
        id             = str(doc["_id"]),
        name_ar        = name_ar,
        name_fr        = doc.get("name_fr") or doc.get("name"),
        category       = doc.get("category") or "Other",
        price_mad      = float(price_raw) if price_raw is not None else 0.0,
        unit           = doc.get("unit") or "kg",
        in_stock       = bool(stock),
        created_at     = doc.get("created_at"),
        image_url      = doc.get("image_url") or "",
        image_status   = doc.get("image_status") or "",
        visible        = bool(doc.get("visible") or False),
        on_sale        = bool(doc.get("on_sale") or False),
        discount_pct   = int(disc_raw) if disc_raw is not None else 0,
        description_fr = str(doc.get("description_fr") or ""),
        step           = float(step_val) if step_val is not None else None,
    )


@router.get("", response_model=list[ProductResponse], summary="List all products")
async def list_products(
    available_only: bool          = Query(default=False),
    category:       Optional[str] = Query(default=None),
) -> list[ProductResponse]:
    """
    Returns all products sorted: in-stock first, then by arabic name.
    ?available_only=true  -- exclude out-of-stock items.
    ?category=Vegetables  -- filter by category.
    """
    query: dict[str, Any] = {}

    if available_only:
        # Match any of the three boolean field names used across schema versions
        query["$or"] = [
            {"in_stock":     True},
            {"is_available": True},
            {"available":    True},
        ]
    if category:
        query["category"] = category

    try:
        docs = await products_col().find(query).sort([
            ("in_stock",  -1),
            ("name_ar",    1),
        ]).to_list(length=500)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch products.")

    return [_serialize(d) for d in docs]


@router.get("/{product_id}", response_model=ProductResponse, summary="Get single product")
async def get_product(product_id: str) -> ProductResponse:
    try:
        oid = ObjectId(product_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail=f"'{product_id}' is not a valid ObjectId.")

    doc = await products_col().find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
    return _serialize(doc)


@router.post("", response_model=ProductResponse, status_code=201, summary="Create product")
async def create_product(
    payload: CreateProductRequest,
    _: None = Depends(require_admin),
) -> ProductResponse:
    doc: dict[str, Any] = {
        "name_fr":       payload.name_fr.strip(),
        "name_ar":       (payload.name_ar or "").strip(),
        "category":      payload.category,
        "price_mad":     round(payload.price_mad, 2),
        "unit":          payload.unit,
        "in_stock":      payload.in_stock,
        "description_fr": (payload.description_fr or "").strip(),
        "on_sale":       payload.on_sale,
        "discount_pct":  payload.discount_pct,
        "image_url":     (payload.image_url or "").strip(),
        "image_status":  "manual" if payload.image_url else "pending",
        "visible":       payload.visible,
        "step":          payload.step,
        "created_at":    datetime.now(timezone.utc),
        "updated_at":    datetime.now(timezone.utc),
    }
    try:
        result = await products_col().insert_one(doc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DB insert failed: {type(exc).__name__}: {exc}")
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.patch("/{product_id}", response_model=ProductResponse, summary="Update product")
async def update_product(
    product_id: str,
    payload:    UpdateProductRequest,
    _: None = Depends(require_admin),
) -> ProductResponse:
    """
    Update one or more fields.  Accepts both canonical and legacy field names.
    Always writes the canonical field name to normalise the document.
    """
    try:
        return await _do_update(product_id, payload)
    except HTTPException:
        raise
    except Exception:
        logger.exception("update_product crashed -- product_id=%s payload=%r", product_id, payload)
        raise HTTPException(status_code=500, detail="Unexpected server error -- check Railway logs")


async def _do_update(product_id: str, payload: UpdateProductRequest) -> ProductResponse:
    try:
        oid = ObjectId(product_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail=f"'{product_id}' is not a valid ObjectId.")

    # Resolve price from canonical then legacy alias
    resolved_price = payload.price_mad \
        if payload.price_mad is not None \
        else payload.price_per_unit

    # Resolve availability from canonical then legacy aliases
    resolved_stock = payload.in_stock
    if resolved_stock is None:
        resolved_stock = payload.is_available
    if resolved_stock is None:
        resolved_stock = payload.available

    updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}

    if resolved_price is not None:
        updates["price_mad"] = round(resolved_price, 2)
    if resolved_stock is not None:
        updates["in_stock"] = resolved_stock
    if payload.name_ar is not None:
        updates["name_ar"] = payload.name_ar
    if payload.name_fr is not None:
        updates["name_fr"] = payload.name_fr
    if payload.unit is not None:
        updates["unit"] = payload.unit
    if payload.category is not None:
        updates["category"] = payload.category
    if payload.step is not None:
        updates["step"] = float(payload.step)
    if payload.description_fr is not None:
        updates["description_fr"] = payload.description_fr.strip()
    if payload.on_sale is not None:
        updates["on_sale"] = payload.on_sale
    if payload.discount_pct is not None:
        updates["discount_pct"] = payload.discount_pct
    if payload.image_url is not None:
        updates["image_url"] = payload.image_url.strip()
        if payload.image_status is None:
            updates["image_status"] = "ready" if payload.image_url.strip() else "pending"
    if payload.image_status is not None:
        updates["image_status"] = payload.image_status

    if len(updates) == 1:  # only updated_at -- nothing useful provided
        raise HTTPException(status_code=400, detail="Provide at least one field to update.")

    try:
        result = await products_col().update_one({"_id": oid}, {"$set": updates})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DB update failed: {type(exc).__name__}: {exc}")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")

    try:
        doc = await products_col().find_one({"_id": oid})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"find_one failed: {type(exc).__name__}: {exc}")
    if doc is None:
        raise HTTPException(status_code=404, detail="Product disappeared after update.")
    try:
        return _serialize(doc)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"serialize failed: {type(exc).__name__}: {exc} -- doc keys: {list(doc.keys())}",
        )
