from fastapi import APIRouter, Query
from app.database import products_col

router = APIRouter(tags=["Storefront"])


@router.get("/api/v1/products")
async def get_storefront_products(category: str = None):
    import os
    print("[DEBUG storefront_v5] " + os.path.abspath(__file__))
    query = {"visible": True, "image_status": "ready"}
    if category:
        query["category"] = {chr(36)+"regex": category, chr(36)+"options": "i"}
    col  = products_col()
    docs = await col.find(query).to_list(200)
    print("[DEBUG] matched " + str(len(docs)))
    out  = []
    for d in docs:
        out.append({
            "debug_source":   "storefront_v5",
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
        })
    return out
