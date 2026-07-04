import re
from fastapi import APIRouter, Query
from app.database import products_col

router = APIRouter(tags=["Storefront"])

# Allowed characters for category filter — prevents ReDoS via $regex
_SAFE_CATEGORY = re.compile(r"^[\w\s\-؀-ۿ]{1,50}$")


@router.get("/api/v1/products")
async def get_storefront_products(category: str = None):
    query: dict = {"visible": True, "image_status": "ready"}
    if category:
        if not _SAFE_CATEGORY.match(category):
            # Reject values that could cause ReDoS or injection
            query["category"] = "__no_match__"
        else:
            query["category"] = {"$regex": re.escape(category), "$options": "i"}
    col  = products_col()
    docs = await col.find(query).to_list(60)
    out  = []
    for d in docs:
        out.append({
            "id":             str(d.get("_id", "")),
            "name":           d.get("name_fr", ""),
            "name_fr":        d.get("name_fr", ""),
            "name_ar":        d.get("name_ar", ""),
            "category":       d.get("category", ""),
            "image_url":      d.get("image_url", ""),
            "image_status":   d.get("image_status", ""),
            "visible":        d.get("visible", False),
            "price_per_unit": float(d.get("price_mad") or d.get("price_per_unit") or 0.0),
            "unit":           d.get("unit", "kg"),
            "available":      d.get("in_stock", True),
            "step":           d.get("step"),
        })
    return out
