# app/models.py
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field
from pydantic.functional_validators import BeforeValidator


# ---------------------------------------------------------------------------
# PyObjectId helper — converts MongoDB ObjectId <-> str for Pydantic V2
# ---------------------------------------------------------------------------

def _validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str) and ObjectId.is_valid(v):
        return v
    raise ValueError(f"Invalid ObjectId: {v!r}")


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, Enum):
    customer = "customer"
    driver   = "driver"
    admin    = "admin"


class OrderStatus(str, Enum):
    pending          = "pending"
    preparing        = "preparing"
    out_for_delivery = "out_for_delivery"
    delivered        = "delivered"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id           : Optional[PyObjectId] = Field(default=None, alias="_id")
    phone_number : str
    name         : str
    role         : UserRole = UserRole.customer
    created_at   : datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreateModel(BaseModel):
    """Payload for creating a new user — no id/created_at."""
    phone_number : str
    name         : str
    role         : UserRole = UserRole.customer


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class ProductModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id               : Optional[PyObjectId] = Field(default=None, alias="_id")
    name             : str
    price            : float
    category         : str
    stock            : int
    image_url        : Optional[str] = None
    is_vacuum_sealed : bool = False
    created_at       : datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductCreateModel(BaseModel):
    name             : str
    price            : float
    category         : str
    stock            : int
    image_url        : Optional[str] = None
    is_vacuum_sealed : bool = False


# ---------------------------------------------------------------------------
# Order — structured items from Kanban / PWA
# ---------------------------------------------------------------------------

class OrderItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id : PyObjectId
    quantity   : int = Field(ge=1)


class OrderModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id                    : Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id               : PyObjectId
    items                 : list[OrderItem]
    total_price           : float
    status                : OrderStatus = OrderStatus.pending
    delivery_address      : str
    whatsapp_phone_number : str
    created_at            : datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at            : datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderCreateModel(BaseModel):
    user_id               : PyObjectId
    items                 : list[OrderItem]
    total_price           : float
    delivery_address      : str
    whatsapp_phone_number : str


class OrderUpdateStatusModel(BaseModel):
    status     : OrderStatus
    updated_at : datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# WhatsApp / Gemini NLP — unstructured orders from webhook
# ---------------------------------------------------------------------------

class WhatsAppOrderItem(BaseModel):
    """
    A single item parsed from free-text Darija by Gemini.
    Uses item_name (string) instead of a product_id FK because the
    product catalogue lookup happens in a separate enrichment step.
    """
    item_name : str
    quantity  : float
    unit      : str   # e.g. "kilo", "piece", "bunch"


class WhatsAppOrderCreate(BaseModel):
    """
    Persisted immediately after the Gemini NLP call inside the webhook.
    Kept separate from OrderCreateModel so the two flows (PWA vs WhatsApp)
    can evolve independently without schema conflicts.
    """
    customer_phone : str
    raw_message    : str
    parsed_items   : list[WhatsAppOrderItem] = []
    status         : OrderStatus             = OrderStatus.pending
    created_at     : datetime                = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class WhatsAppOrderInDB(WhatsAppOrderCreate):
    """Read model — includes the MongoDB _id as a string."""
    id : Optional[PyObjectId] = Field(default=None, alias="_id")

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


# ---------------------------------------------------------------------------
# Admin Dashboard — Order response model
# ---------------------------------------------------------------------------

class OrderResponseModel(BaseModel):
    """
    Serialisation model for the Admin Dashboard GET /api/v1/orders endpoint.

    Designed to be constructed directly from a raw MongoDB document:

        doc["_id"] is coerced to str via PyObjectId
        doc["customer_phone"] maps to whatsapp_sender
        doc["parsed_items"]   maps to items (list[WhatsAppOrderItem])
        doc["status"]         maps to OrderStatus enum
        doc["created_at"]     is a timezone-aware UTC datetime

    Usage in a route:
        OrderResponseModel(
            id=str(doc["_id"]),
            whatsapp_sender=doc["customer_phone"],
            items=doc.get("parsed_items", []),
            status=doc["status"],
            created_at=doc["created_at"],
        )
    """

    model_config = ConfigDict(
        populate_by_name=True,      # accept both "id" and "_id"
        arbitrary_types_allowed=True,
    )

    id              : str                    = Field(..., description="Stringified MongoDB ObjectId")
    whatsapp_sender : str                    = Field(..., description="Customer WhatsApp phone number")
    items           : list[WhatsAppOrderItem] = Field(default_factory=list, description="Parsed order items")
    status          : OrderStatus            = Field(..., description="Current order status")
    created_at      : datetime               = Field(..., description="UTC timestamp of order creation")


# ---------------------------------------------------------------------------
# Gemini JSON parsing utility (lives here to stay close to the schema)
# ---------------------------------------------------------------------------

def parse_whatsapp_items(gemini_json: str) -> list[WhatsAppOrderItem]:
    """
    Safely deserialise Gemini's JSON output into WhatsAppOrderItem instances.
    Strips ```json fences if present. Returns [] on any malformed input.
    """
    try:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", gemini_json.strip(), flags=re.MULTILINE)
        data    = json.loads(cleaned)
        return [WhatsAppOrderItem(**item) for item in data.get("items", [])]
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        print(f"⚠️ [PARSE] Could not parse order items: {exc} | raw: {gemini_json!r}")
        return []