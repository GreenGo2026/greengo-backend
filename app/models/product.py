# app/models/product.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class ProductResponse(BaseModel):
    """Shape returned to the frontend â€” exactly matches the DB schema."""
    id:          str
    name_ar:     str
    name_fr:     Optional[str]  = None
    category:    str
    price_mad:   float
    unit:        str
    in_stock:    bool
    created_at:   Optional[datetime] = None
    image_url:    str  = ""
    image_status: str  = ""
    visible:      bool = False
    on_sale:      bool  = False
    discount_pct: int   = 0
    description_fr: str = ""
    step:         Optional[float] = None


class UpdateProductRequest(BaseModel):
    """
    Payload accepted by PATCH /api/v1/products/{product_id}.
    All fields optional â€” send only what you want to change.
    """
    price_mad:   Optional[float] = Field(default=None, ge=0)
    in_stock:    Optional[bool]  = None
    name_ar:     Optional[str]   = None
    name_fr:     Optional[str]   = None
    unit:        Optional[str]   = None
    category:    Optional[str]   = None
    on_sale:        Optional[bool]  = None
    discount_pct:   Optional[int]   = None
    description_fr: Optional[str]   = None
    step:           Optional[float] = None
    # Legacy aliases so existing frontend calls still work
    price_per_unit: Optional[float] = Field(default=None, ge=0)
    available:      Optional[bool]  = None
    is_available:   Optional[bool]  = None
