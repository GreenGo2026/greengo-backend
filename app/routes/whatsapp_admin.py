# app/routes/whatsapp_admin.py — admin endpoint to broadcast product catalog via Green-API
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query

from app.auth import require_admin
from app.database import products_col
from app.services.whatsapp import send_file_by_url, send_whatsapp_message

router = APIRouter(prefix="/api/v1/admin/whatsapp", tags=["WhatsApp Admin"])


# ── Background task ───────────────────────────────────────────────────────────

def _broadcast_catalog(phone: str, products: list[dict[str, Any]]) -> None:
    """
    Sync background task — runs in FastAPI's thread pool.
    Sends each product to `phone` via Green-API:
      • Products with image  → sendFileByUrl (image + name + price caption)
      • Products without image → collected in a text summary at the end
    Rate-limited to 1 message per 1.5 s to avoid Green-API throttle.
    """
    with_img    = [p for p in products if (p.get("image_url") or "").strip()]
    without_img = [p for p in products if not (p.get("image_url") or "").strip()]

    # 1. Products with images
    for p in with_img:
        name  = p.get("name_fr") or p.get("name_ar") or "Produit"
        price = float(p.get("price_mad") or 0)
        unit  = p.get("unit") or "kg"
        url   = (p.get("image_url") or "").strip()
        caption = f"🌿 *{name}*\n💰 {price:.2f} MAD / {unit}"
        send_file_by_url(phone, url, f"{name}.jpg", caption)
        time.sleep(1.5)

    # 2. Products without images — one grouped text message
    if without_img:
        lines: list[str] = ["📋 *Produits (sans image):*\n"]
        current_cat = ""
        for p in sorted(without_img, key=lambda x: x.get("category", "")):
            cat = p.get("category") or ""
            if cat != current_cat:
                current_cat = cat
                lines.append(f"\n*{cat}*")
            name  = p.get("name_fr") or p.get("name_ar") or "?"
            price = float(p.get("price_mad") or 0)
            unit  = p.get("unit") or ""
            lines.append(f"  ▪ {name} — {price:.2f} MAD/{unit}")
        send_whatsapp_message(phone, "\n".join(lines))


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/send-catalog", summary="Broadcast product catalog to a WhatsApp number (admin)")
async def send_catalog(
    background_tasks: BackgroundTasks,
    phone:          str  = Query(...,        description="Destination WhatsApp number, e.g. 0612345678"),
    category:       str  = Query("all",      description="Category filter — 'all' or exact category name"),
    in_stock_only:  bool = Query(True,       description="Only send in-stock products"),
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    """
    Fetches matching products from MongoDB and fires a background task that sends
    each one to `phone` via Green-API (image + caption if available, text fallback).
    Returns immediately — the actual sending runs in the background.
    """
    col   = products_col()
    query: dict[str, Any] = {"visible": True}
    if in_stock_only:
        query["in_stock"] = True
    if category != "all":
        query["category"] = category

    docs = await col.find(
        query,
        {"_id": 0, "name_fr": 1, "name_ar": 1, "price_mad": 1, "unit": 1, "image_url": 1, "category": 1},
    ).sort([("category", 1), ("name_fr", 1)]).to_list(length=500)

    if not docs:
        return {"ok": False, "message": "Aucun produit trouvé pour ces critères.", "count": 0}

    with_img    = sum(1 for p in docs if (p.get("image_url") or "").strip())
    without_img = len(docs) - with_img

    background_tasks.add_task(_broadcast_catalog, phone, docs)

    return {
        "ok":            True,
        "count":         len(docs),
        "with_images":   with_img,
        "without_images": without_img,
        "estimated_minutes": round(len(docs) * 1.5 / 60, 1),
        "message": f"{len(docs)} produits en cours d'envoi vers {phone} ({with_img} avec image).",
    }
