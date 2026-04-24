# app/models/order.py
"""
Order data models for GreenGo Market.

Supports decimal quantities (e.g. 1.5 kg of tomatoes) and the full
Moroccan e-grocery order lifecycle:
    pending -> preparing -> out_for_delivery -> delivered -> completed
                         -> cancelled  (from any active state)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Order lifecycle enum ──────────────────────────────────────────────────────

class OrderStatus(str, Enum):
    """
    Maps to the six lifecycle stages shown in the AdminPage timeline.
    String-based so values are stored as plain strings in MongoDB and
    serialised cleanly to JSON without extra conversion.
    """
    PENDING          = "pending"
    PREPARING        = "preparing"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED        = "delivered"
    COMPLETED        = "completed"
    CANCELLED        = "cancelled"

    # Convenience helpers
    @property
    def is_terminal(self) -> bool:
        """True when no further status transition is permitted."""
        return self in {OrderStatus.COMPLETED, OrderStatus.CANCELLED}

    @property
    def allowed_next(self) -> list[OrderStatus]:
        """Returns the valid next states from this state."""
        transitions: dict[OrderStatus, list[OrderStatus]] = {
            OrderStatus.PENDING:          [OrderStatus.PREPARING,        OrderStatus.CANCELLED],
            OrderStatus.PREPARING:        [OrderStatus.OUT_FOR_DELIVERY,  OrderStatus.CANCELLED],
            OrderStatus.OUT_FOR_DELIVERY: [OrderStatus.DELIVERED,         OrderStatus.CANCELLED],
            OrderStatus.DELIVERED:        [OrderStatus.COMPLETED],
            OrderStatus.COMPLETED:        [],
            OrderStatus.CANCELLED:        [],
        }
        return transitions.get(self, [])


# ── Embedded item ─────────────────────────────────────────────────────────────

class OrderItem(BaseModel):
    """
    A single line in an order.
    quantity is a float so customers can order 1.5 kg, 0.5 kg, etc.
    line_total is computed automatically on save.
    """
    name:           str   = Field(..., min_length=1, description="Arabic product name, e.g. طماطم")
    item_name:      str   = Field("",  description="Alias kept for WhatsApp-webhook compatibility")
    quantity:       float = Field(..., gt=0, description="Weight or count, supports decimals (1.5 kg)")
    unit:           str   = Field("kg", description="kg | g | piece | bundle | box | dozen")
    price_per_unit: float = Field(..., ge=0, description="Price in MAD at time of order")
    line_total:     float = Field(0.0, description="Computed: quantity × price_per_unit")

    @model_validator(mode="after")
    def compute_line_total(self) -> OrderItem:
        self.line_total = round(self.quantity * self.price_per_unit, 2)
        # Keep item_name in sync with name for legacy webhook consumers
        if not self.item_name:
            self.item_name = self.name
        return self

    model_config = {"populate_by_name": True}


# ── Main order document ───────────────────────────────────────────────────────

class OrderModel(BaseModel):
    """
    Full order document as stored in MongoDB collection 'orders'.

    MongoDB '_id' is mapped to 'id' via alias so the frontend always
    receives a plain string 'id' field.
    """
    id:               str        = Field(
                                       default_factory=lambda: str(uuid.uuid4()),
                                       alias="_id",
                                       description="MongoDB document ID (UUID string)",
                                   )
    customer_name:    str        = Field("",  description="Full name supplied at checkout")
    customer_phone:   str        = Field(..., min_length=8, description="Moroccan phone, e.g. 0661234567")
    delivery_address: str        = Field("",  description="Delivery address in Salé")
    items:            list[OrderItem] = Field(default_factory=list)
    total_price:      float      = Field(0.0, ge=0, description="Sum of all line totals in MAD")
    status:           OrderStatus = Field(default=OrderStatus.PENDING)
    created_at:       datetime   = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at:       datetime   = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Optional metadata
    notes:            str        = Field("",  description="Internal admin note")
    livreur_name:     str        = Field("",  description="Name of the delivery person")
    payment_method:   str        = Field("cash", description="cash | card | transfer")
    payment_confirmed: bool      = Field(False, description="True once livreur confirms cash received")

    @model_validator(mode="after")
    def compute_total(self) -> OrderModel:
        """Recompute total_price from items whenever the model is instantiated."""
        if self.items:
            self.total_price = round(sum(i.line_total for i in self.items), 2)
        return self

    @field_validator("customer_phone")
    @classmethod
    def normalise_phone(cls, v: str) -> str:
        """Strip spaces and ensure the number is not empty."""
        cleaned = v.strip().replace(" ", "").replace("-", "")
        if not cleaned:
            raise ValueError("customer_phone must not be empty")
        return cleaned

    def to_mongo(self) -> dict[str, Any]:
        """
        Serialise to a dict ready for Motor / PyMongo insertion.
        Uses '_id' key, converts datetimes to UTC-aware, and dumps enums
        as plain strings so MongoDB stores them without extra wrapping.
        """
        data = self.model_dump(by_alias=True, mode="python")
        data["status"] = self.status.value
        return data

    @classmethod
    def from_mongo(cls, doc: dict[str, Any]) -> OrderModel:
        """
        Deserialise a raw MongoDB document back into an OrderModel.
        Handles both ObjectId and plain-string _id values.
        """
        if doc is None:
            raise ValueError("Cannot build OrderModel from None")
        doc = dict(doc)
        # Normalise _id to string
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        # Normalise item_name <-> name aliases
        for item in doc.get("items", []):
            if "item_name" in item and "name" not in item:
                item["name"] = item["item_name"]
            elif "name" in item and "item_name" not in item:
                item["item_name"] = item["name"]
        return cls.model_validate(doc)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "_id":              "3f2a1b4c-...",
                "customer_name":    "Fatima Zahra",
                "customer_phone":   "0661234567",
                "delivery_address": "حي المسيرة، زنقة 5، رقم 12، سلا",
                "items": [
                    {
                        "name":           "طماطم",
                        "item_name":      "طماطم",
                        "quantity":       2.5,
                        "unit":           "kg",
                        "price_per_unit": 5.00,
                        "line_total":     12.50,
                    },
                    {
                        "name":           "بصل",
                        "item_name":      "بصل",
                        "quantity":       1.0,
                        "unit":           "kg",
                        "price_per_unit": 3.50,
                        "line_total":     3.50,
                    },
                ],
                "total_price":       16.00,
                "status":            "pending",
                "created_at":        "2025-01-15T08:30:00Z",
                "updated_at":        "2025-01-15T08:30:00Z",
                "notes":             "",
                "livreur_name":      "",
                "payment_method":    "cash",
                "payment_confirmed": False,
            }
        },
    }


# ── Request / response schemas ────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    """
    Payload sent by CartPage when the customer confirms their order.
    total_price is optional here — the backend recomputes it from items
    to prevent client-side tampering.
    """
    customer_name:    str             = Field("",  description="Optional — supplied at checkout")
    customer_phone:   str             = Field(..., min_length=8)
    delivery_address: str             = Field("",  description="Salé delivery address")
    items:            list[OrderItem] = Field(..., min_length=1, description="At least one item required")
    total_price:      float           = Field(0.0, description="Client hint; backend overwrites from items")
    notes:            str             = Field("",  description="Optional customer note")
    payment_method:   str             = Field("cash")


class UpdateOrderStatusRequest(BaseModel):
    """
    Payload for PATCH /api/v1/orders/{id}/status.
    Optionally carry extra metadata used at specific lifecycle stages.
    """
    status:        OrderStatus = Field(..., description="Target status — must be a valid next state")
    livreur_name:  str         = Field("",    description="Set when transitioning to out_for_delivery")
    notes:         str         = Field("",    description="Admin note appended to the order")
    payment_confirmed: bool    = Field(False, description="Set True when transitioning to delivered/completed")


class OrderResponse(BaseModel):
    """
    Lightweight response returned after creating or updating an order.
    The frontend uses order_id and status to update local UI state.
    """
    message:     str         = "OK"
    order_id:    str
    status:      OrderStatus
    total_price: float
    created_at:  datetime