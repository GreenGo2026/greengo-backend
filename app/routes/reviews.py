# app/routes/reviews.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import reviews_col

router = APIRouter(prefix="/api/v1/reviews", tags=["Reviews"])


class ReviewCreate(BaseModel):
    customer_name: str
    neighborhood:  str = ""
    rating:        int = Field(default=5, ge=1, le=5)
    text:          str
    text_fr:       str = ""
    product_names: list[str] = []
    verified:      bool = True
    visible:       bool = True


def _serialize(r: dict) -> dict[str, Any]:
    created = r.get("created_at")
    return {
        "id":            str(r["_id"]),
        "customer_name": r.get("customer_name", ""),
        "neighborhood":  r.get("neighborhood", ""),
        "rating":        r.get("rating", 5),
        "text":          r.get("text", ""),
        "text_fr":       r.get("text_fr", ""),
        "product_names": r.get("product_names", []),
        "verified":      r.get("verified", True),
        "created_at":    created.isoformat() if isinstance(created, datetime) else str(created or ""),
    }


def _matches(review: dict, product_l: str, category_l: str) -> bool:
    """
    Bidirectional, case-insensitive substring match -- done in Python (not a
    Mongo $regex on user input, which would both be an injection risk and get
    the match direction wrong: reviews reference base product names like
    "Miel de thym" while real catalog entries are weight-suffixed, e.g.
    "Miel de thym 250g". Category terms (e.g. "Fruits", "Épices") match
    against the product's category as a fallback for reviews that only
    reference a general category rather than one specific item.
    """
    names = [n.lower() for n in review.get("product_names", [])]
    if product_l:
        for n in names:
            if n and (n in product_l or product_l in n):
                return True
    if category_l and category_l in names:
        return True
    return False


@router.get("", summary="List visible reviews, optionally filtered by product or category")
async def get_reviews(product: Optional[str] = None, category: Optional[str] = None) -> list[dict[str, Any]]:
    col = reviews_col()
    docs = await col.find({"visible": True}).sort("created_at", -1).to_list(length=200)

    if not product and not category:
        return [_serialize(d) for d in docs]

    product_l  = (product or "").lower()
    category_l = (category or "").lower()
    return [_serialize(d) for d in docs if _matches(d, product_l, category_l)]


@router.post("", status_code=201, summary="Add a review (admin only)")
async def create_review(payload: ReviewCreate, _: None = Depends(require_admin)) -> dict[str, Any]:
    col = reviews_col()
    doc = payload.model_dump()
    doc["created_at"] = datetime.now(tz=timezone.utc)
    result = await col.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Review created."}
