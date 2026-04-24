from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, AliasChoices

import io
from fastapi.responses import StreamingResponse
from app.services.pdf_generator import generate_invoice_pdf
from app.database import orders_col, customers_col
from app.services.whatsapp import send_whatsapp_message

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])

# ── Pydantic models ───────────────────────────────────────────────────────────

class GPSCoordinates(BaseModel):
    lat: float
    lng: float

class OrderItem(BaseModel):
    name: str
    quantity: float
    unit: str = "kg"
    price_per_unit: float

class CreateOrderPayload(BaseModel):
    model_config = {"populate_by_name": True}
    customer_name: str
    phone: str = Field(validation_alias=AliasChoices("phone", "customer_phone"))
    customer_phone: str | None = None
    address: str
    gps_coordinates: GPSCoordinates | None = None
    items: list[OrderItem]
    total_price: float

class OrderResponse(BaseModel):
    order_id: str
    status: str
    created_at: str
    message: str

# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_items(items: list[OrderItem]) -> str:
    return ", ".join(f"{i.quantity}{i.unit} x {i.name}" for i in items)

def _calculate_points(total_price: float) -> int:
    """10 MAD = 1 Point. Truncated (no rounding up)."""
    return int(total_price // 10)

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=OrderResponse, status_code=201, summary="Place a new order")
async def create_order(payload: CreateOrderPayload) -> OrderResponse:

    col      = orders_col()
    cust_col = customers_col()
    now      = datetime.now(tz=timezone.utc)

    # ── 1. Build order document ───────────────────────────────────────────────
    doc: dict[str, Any] = {
        "customer_name": payload.customer_name.strip(),
        "phone":         payload.phone.strip(),
        "address":       payload.address.strip(),
        "gps_coordinates": (
            {"lat": payload.gps_coordinates.lat, "lng": payload.gps_coordinates.lng}
            if payload.gps_coordinates else None
        ),
        "items": [
            {
                "name":           item.name,
                "quantity":       item.quantity,
                "unit":           item.unit,
                "price_per_unit": item.price_per_unit,
                "line_total":     round(item.quantity * item.price_per_unit, 2),
            }
            for item in payload.items
        ],
        "total_price": round(payload.total_price, 2),
        "status":      "Pending",
        "created_at":  now,
        "updated_at":  now,
    }

    try:
        result   = await col.insert_one(doc)
        order_id = str(result.inserted_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DB insert failed: {exc}")

    # ── 2. Loyalty — upsert customer & accumulate points ──────────────────────
    earned_points = _calculate_points(payload.total_price)
    phone_key     = payload.phone.strip()

    try:
        update_result = await cust_col.find_one_and_update(
            {"phone": phone_key},
            {
                "$setOnInsert": {
                    "phone":       phone_key,
                    "name":        payload.customer_name.strip(),
                    "created_at":  now,
                },
                "$inc":  {"total_points": earned_points},
                "$set":  {
                    "last_order_id": order_id,
                    "updated_at":    now,
                },
                "$push": {
                    "orders": {
                        "order_id":     order_id,
                        "total_price":  round(payload.total_price, 2),
                        "points_earned": earned_points,
                        "date":         now,
                    }
                },
            },
            upsert=True,
            return_document=True,  # returns the document AFTER the update
        )
        total_points = update_result.get("total_points", earned_points) if update_result else earned_points
    except Exception as exc:
        # Loyalty failure must NOT block the order confirmation
        total_points = earned_points

    # ── 3. WhatsApp notification (with loyalty info) ──────────────────────────
    msg = (
        f"🟢 مرحباً {payload.customer_name}!\n\n"
        f"شكراً لاختيارك GreenGo Market 🛒\n"
        f"لقد توصلنا بطلبك (رقم: {order_id[-6:]}) بنجاح.\n\n"
        f"إجمالي الطلب: {payload.total_price:.2f} درهم\n"
        f"الحالة: قيد الانتظار (Pending) ⏳\n\n"
        f"⭐ نقاط الولاء المكتسبة: +{earned_points} نقطة\n"
        f"💰 رصيد نقاطك الإجمالي: {total_points} نقطة\n"
        f"   (كل 10 درهم = نقطة واحدة)\n\n"
        f"سنتواصل معك قريباً للتوصيل. بالصحة والراحة!"
    )

    send_whatsapp_message(payload.phone, msg)

    return OrderResponse(
        order_id=order_id,
        status="Pending",
        created_at=now.isoformat(),
        message=f"Order {order_id} created successfully.",
    )


@router.get("", summary="List all orders (admin)")
async def list_orders(limit: int = 50) -> list[dict[str, Any]]:
    col  = orders_col()
    docs = await col.find().sort("created_at", -1).limit(limit).to_list(length=limit)
    for d in docs:
        d["_id"] = str(d["_id"])
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
        if isinstance(d.get("updated_at"), datetime):
            d["updated_at"] = d["updated_at"].isoformat()
    return docs


@router.patch("/{order_id}/status", summary="Update order status")
async def update_order_status(
    order_id: str,
    status:   str,
) -> dict[str, Any]:
    allowed = {"Pending", "Preparing", "Out for Delivery", "Delivered", "Cancelled", "Completed"}
    if status.lower() not in [s.lower() for s in allowed]:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")

    final_status = next(s for s in allowed if s.lower() == status.lower())

    col   = orders_col()
    order = await col.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await col.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": final_status, "updated_at": datetime.now(tz=timezone.utc)}},
    )

    customer_phone = order.get("phone")
    customer_name  = order.get("customer_name", "الزبون الكريم")

    if customer_phone:
        status_messages = {
            "Preparing":        f"🔵 مرحباً {customer_name}، بدأنا في تحضير طلبك الآن! 📦",
            "Out for Delivery": f"🚚 مرحباً {customer_name}، الطلب ديالك خرج دابا مع الليفرور! المرجو البقاء قريباً من الهاتف.",
            "Delivered":        f"✅ مرحباً {customer_name}، تم توصيل طلبك بنجاح. بالصحة والراحة وشكراً لاختيارك GreenGo!",
            "Completed":        f"✅ مرحباً {customer_name}، تم إغلاق الطلب. نتمناو نشوفوك مرة أخرى في GreenGo!",
            "Cancelled":        f"❌ عذراً {customer_name}، تم إلغاء طلبك. إذا كان هناك خطأ، المرجو التواصل معنا.",
        }
        if final_status in status_messages:
            send_whatsapp_message(customer_phone, status_messages[final_status])

    return {"order_id": order_id, "status": final_status, "updated": True}


@router.get("/{order_id}/invoice", summary="Download PDF invoice for an order")
async def download_invoice(order_id: str):
    from app.database import whatsapp_orders_col
    col = whatsapp_orders_col()

    doc = None
    try:
        doc = await col.find_one({"_id": ObjectId(order_id)})
    except Exception:
        pass
    if doc is None:
        doc = await col.find_one({"_id": order_id})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found in whatsapp_orders.")

    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()

    try:
        pdf_bytes = generate_invoice_pdf(doc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    short_id = order_id[-8:].upper()
    filename = f"GreenGo_Invoice_{short_id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
