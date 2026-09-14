"""
Frequently Bought Together -- rule-based product bundle suggestions.

Rules keyed on product category -> list of complement product name_ar
values (admin-editable, no code deploy needed). At current catalog scale
(~200 products) a static category->complements table is faster to ship and
more predictable than co-occurrence analysis.

Falls back to same-category products when no rule exists or a rule's
complements resolve to fewer than 2 in-stock matches.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId, errors as bson_errors
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import bundle_rules_col, products_col

router = APIRouter(tags=["bundles"])


def _safe_oid(id_: str) -> ObjectId:
    try:
        return ObjectId(id_)
    except (bson_errors.InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="ID invalide.")


def _serialize_product(p: dict[str, Any]) -> dict[str, Any]:
    return {
        "id":        str(p["_id"]),
        "name_ar":   p.get("name_ar", ""),
        "name_fr":   p.get("name_fr", ""),
        "price_mad": p.get("price_mad", 0),
        "unit":      p.get("unit", ""),
        "image_url": p.get("image_url", ""),
        "in_stock":  p.get("in_stock", True),
        "category":  p.get("category", ""),
    }


# ── Public ────────────────────────────────────────────────────────────────────

@router.get("/api/v1/products/{product_id}/bundle", summary="Complement products for a given product")
async def get_bundle(product_id: str) -> dict[str, Any] | list[Any]:
    """
    Returns up to 4 complement products for a given product.
    Looks up: product -> category -> bundle_rule -> complement products.
    Falls back to same-category products if no rule exists or the rule
    resolves to fewer than 2 in-stock matches.
    """
    oid = _safe_oid(product_id)
    product = await products_col().find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable.")

    category = product.get("category", "")

    rule = await bundle_rules_col().find_one({"trigger_category": category, "active": True})

    complement_products: list[dict[str, Any]] = []
    if rule and rule.get("complement_names_ar"):
        names = rule["complement_names_ar"]
        docs = await products_col().find(
            {"name_ar": {"$in": names}, "in_stock": True, "_id": {"$ne": oid}}
        ).to_list(length=len(names))
        # Preserve rule order.
        name_map = {d["name_ar"]: d for d in docs}
        complement_products = [name_map[n] for n in names if n in name_map][:4]

    if len(complement_products) < 2:
        fallback = await products_col().find(
            {"category": category, "in_stock": True, "_id": {"$ne": oid}}
        ).limit(4).to_list(length=4)
        complement_products = fallback

    if not complement_products:
        return []

    return {
        "label_fr": rule.get("label_fr", "Souvent commandé avec") if rule else "Vous aimerez aussi",
        "complements": [_serialize_product(p) for p in complement_products],
    }


# ── Admin -- seed / manage rules ────────────────────────────────────────────────

class BundleRulePayload(BaseModel):
    trigger_category:    str = Field(min_length=1)
    complement_names_ar: list[str] = Field(min_length=1)
    label_fr:            str = "Souvent commandé avec"
    active:               bool = True


@router.get("/api/v1/admin/bundle-rules", summary="List bundle rules (admin)")
async def list_rules(_: None = Depends(require_admin)) -> list[dict[str, Any]]:
    docs = await bundle_rules_col().find({}).to_list(length=100)
    return [{"id": str(d["_id"]), **{k: v for k, v in d.items() if k != "_id"}} for d in docs]


@router.post("/api/v1/admin/bundle-rules", status_code=201, summary="Create a bundle rule (admin)")
async def create_rule(payload: BundleRulePayload, _: None = Depends(require_admin)) -> dict[str, Any]:
    doc = {**payload.model_dump(), "created_at": datetime.now(tz=timezone.utc)}
    result = await bundle_rules_col().insert_one(doc)
    # insert_one mutates `doc` in place, adding a non-JSON-serializable
    # ObjectId "_id" -- exclude it from the response.
    return {"id": str(result.inserted_id), **{k: v for k, v in doc.items() if k != "_id"}}


@router.delete("/api/v1/admin/bundle-rules/{rule_id}", status_code=204, summary="Delete a bundle rule (admin)")
async def delete_rule(rule_id: str, _: None = Depends(require_admin)) -> None:
    oid = _safe_oid(rule_id)
    result = await bundle_rules_col().delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Règle introuvable.")
