# app/models/product.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class ProductResponse(BaseModel):
    """Shape returned to the frontend — exactly matches the DB schema."""
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


class UpdateProductRequest(BaseModel):
    """
    Payload accepted by PATCH /api/v1/products/{product_id}.
    All fields optional — send only what you want to change.
    """
    price_mad:   Optional[float] = Field(default=None, ge=0)
    in_stock:    Optional[bool]  = None
    name_ar:     Optional[str]   = None
    name_fr:     Optional[str]   = None
    unit:        Optional[str]   = None
    category:    Optional[str]   = None
    # Legacy aliases so existing frontend calls still work
    price_per_unit: Optional[float] = Field(default=None, ge=0)
    available:      Optional[bool]  = None
    is_available:   Optional[bool]  = None