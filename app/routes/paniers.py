# app/routes/paniers.py — shared panier compositions, stored in MongoDB
from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_admin
from app.database import paniers_col, products_col

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

def _serialize_panier(doc: dict[str, Any]) -> dict[str, Any]:
    """Defensive defaults -- covers any doc written before a field existed."""
    return {
        "id":         doc.get("id", ""),
        "order":      doc.get("order", 99),
        "title":      doc.get("title", ""),
        "persons":    doc.get("persons", 0),
        "accent":     doc.get("accent", "#2E8B57"),
        "items":      doc.get("items", []),
        "updated_at": str(doc.get("updated_at", "")) if doc.get("updated_at") else None,
    }


@router.get("", summary="List all paniers (public -- basket composition has no sensitive data)")
async def list_paniers() -> list[dict[str, Any]]:
    col = paniers_col()
    docs = await col.find({}, {"_id": 0}).sort("order", 1).to_list(length=20)
    if not docs:
        # First run: seed defaults and return them
        to_insert = [dict(b) for b in DEFAULT_BASKETS]
        await col.insert_many(to_insert)
        return DEFAULT_BASKETS
    return [_serialize_panier(d) for d in docs]


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


# ── Helpers ────────────────────────────────────────────────────────────────────

def _normalize(s: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    nfd = unicodedata.normalize("NFD", s.lower().strip())
    ascii_only = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", ascii_only).strip()


@router.post("/fix-labels", summary="Auto-fix panier item labels to match catalog name_fr (admin)")
async def fix_labels(_: None = Depends(require_admin)) -> dict[str, Any]:
    """
    For every panier item, finds a catalog product whose name_fr matches the label
    (normalized, accent-insensitive). Updates the label to the exact name_fr stored
    in MongoDB so live price resolution works and 'Produit introuvable' disappears.

    Only exact normalized matches are auto-applied — ambiguous / partial matches are
    reported but NOT changed, so nothing gets silently mis-mapped.
    """
    prod_col = products_col()
    pan_col  = paniers_col()

    # Build lookup: normalized_name → exact name_fr
    all_prods = await prod_col.find({}, {"_id": 0, "name_fr": 1}).to_list(length=1000)
    norm_map: dict[str, str] = {}
    for p in all_prods:
        nf = (p.get("name_fr") or "").strip()
        if nf:
            norm_map[_normalize(nf)] = nf

    # Process all paniers
    all_paniers = await pan_col.find({}, {"_id": 0}).to_list(length=20)

    total_fixed  = 0
    total_unfixed = 0
    report: list[dict[str, Any]] = []

    for panier in all_paniers:
        pan_id   = panier.get("id")
        new_items: list[dict[str, Any]] = []
        changes:  list[dict[str, Any]] = []

        for item in panier.get("items", []):
            label     = item.get("label", "")
            norm_lbl  = _normalize(label)

            if norm_lbl in norm_map:
                # Exact normalized match — apply
                correct = norm_map[norm_lbl]
                if correct != label:
                    changes.append({"from": label, "to": correct})
                    item = {**item, "label": correct}
            else:
                # No exact match — report only, do NOT guess
                changes.append({"label": label, "status": "not_found"})
                total_unfixed += 1

            new_items.append(item)

        if any("to" in c for c in changes):
            await pan_col.update_one(
                {"id": pan_id},
                {"$set": {"items": new_items, "updated_at": datetime.now(tz=timezone.utc)}},
            )
            fixed_count = sum(1 for c in changes if "to" in c)
            total_fixed += fixed_count

        if changes:
            report.append({"panier": pan_id, "changes": changes})

    return {
        "ok":           True,
        "total_fixed":  total_fixed,
        "total_unfixed": total_unfixed,
        "report":       report,
    }
