# app/routes/paniers.py — shared panier compositions, stored in MongoDB
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_admin
from app.database import paniers_col

router = APIRouter(prefix="/api/v1/paniers", tags=["Paniers"])

# ── Default basket definitions (seeded on first GET if collection is empty) ──

DEFAULT_BASKETS: list[dict[str, Any]] = [
    {
        "id": "famille", "order": 1,
        "title": "Panier Famille", "persons": 4, "accent": "#2E8B57",
        "items": [
            {"label": "Tomate",         "qty": 2, "unit": "kg"},
            {"label": "Pomme de terre", "qty": 2, "unit": "kg"},
            {"label": "Carotte",        "qty": 1, "unit": "kg"},
            {"label": "Oignon rouge",   "qty": 1, "unit": "kg"},
            {"label": "Courgette",      "qty": 1, "unit": "kg"},
            {"label": "Poulet",         "qty": 1, "unit": "piece"},
            {"label": "Oeufs beldi",    "qty": 1, "unit": "boite"},
        ],
    },
    {
        "id": "couple", "order": 2,
        "title": "Panier Duo", "persons": 2, "accent": "#C9A96E",
        "items": [
            {"label": "Tomate",         "qty": 1, "unit": "kg"},
            {"label": "Pomme de terre", "qty": 1, "unit": "kg"},
            {"label": "Carotte",        "qty": 1, "unit": "kg"},
            {"label": "Oeufs beldi",    "qty": 1, "unit": "boite"},
        ],
    },
    {
        "id": "legumes", "order": 3,
        "title": "Panier Légumes", "persons": 4, "accent": "#16a34a",
        "items": [
            {"label": "Pomme de terre", "qty": 2, "unit": "kg"},
            {"label": "Carotte",        "qty": 1, "unit": "kg"},
            {"label": "Oignon rouge",   "qty": 1, "unit": "kg"},
            {"label": "Courgette",      "qty": 1, "unit": "kg"},
            {"label": "Poivron",        "qty": 1, "unit": "kg"},
            {"label": "Brocoli",        "qty": 1, "unit": "kg"},
        ],
    },
    {
        "id": "tajine", "order": 4,
        "title": "Panier Tajine", "persons": 4, "accent": "#f97316",
        "items": [
            {"label": "Poulet",         "qty": 1, "unit": "piece"},
            {"label": "Pomme de terre", "qty": 1, "unit": "kg"},
            {"label": "Carotte",        "qty": 1, "unit": "kg"},
            {"label": "Oignon rouge",   "qty": 1, "unit": "kg"},
            {"label": "Cumin moulu",    "qty": 1, "unit": "100g"},
            {"label": "Ras el hanout",  "qty": 1, "unit": "100g"},
        ],
    },
    {
        "id": "fruits", "order": 5,
        "title": "Panier Fruits", "persons": 4, "accent": "#a855f7",
        "items": [
            {"label": "Orange",  "qty": 2, "unit": "kg"},
            {"label": "Banane",  "qty": 1, "unit": "kg"},
            {"label": "Pomme jaune", "qty": 1, "unit": "kg"},
        ],
    },
]


# ── Pydantic models ────────────────────────────────────────────────────────────

class BasketItem(BaseModel):
    label: str
    qty: float
    unit: str = "kg"


class BasketUpdate(BaseModel):
    title: str
    persons: int
    accent: str
    items: list[BasketItem]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", summary="List all paniers (admin)")
async def list_paniers(_: None = Depends(require_admin)) -> list[dict[str, Any]]:
    col = paniers_col()
    docs = await col.find({}, {"_id": 0}).sort("order", 1).to_list(length=20)
    if not docs:
        # First run: seed defaults and return them
        to_insert = [dict(b) for b in DEFAULT_BASKETS]
        await col.insert_many(to_insert)
        return DEFAULT_BASKETS
    return docs


@router.put("/{panier_id}", summary="Update a panier (admin)")
async def update_panier(
    panier_id: str,
    payload: BasketUpdate,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    col = paniers_col()
    result = await col.update_one(
        {"id": panier_id},
        {
            "$set": {
                **payload.model_dump(),
                "updated_at": datetime.now(tz=timezone.utc),
            }
        },
        upsert=True,
    )
    if result.matched_count == 0 and result.upserted_id is None:
        raise HTTPException(status_code=404, detail=f"Panier '{panier_id}' not found.")
    return {"ok": True, "id": panier_id}
