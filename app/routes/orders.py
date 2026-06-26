from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, AliasChoices

import io
from fastapi.responses import StreamingResponse
from app.auth import require_admin
from app.services.pdf_generator import generate_invoice_pdf
from app.database import orders_col, customers_col, products_col
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
    use_points:    bool = False
    points_used:   int  = 0
    address: str = Field(validation_alias=AliasChoices("address", "delivery_address"))
    gps_coordinates: GPSCoordinates | None = None
    items: list[OrderItem]
    total_price: float

class OrderResponse(BaseModel):
    order_id: str
    status: str
    created_at: str
    message: str

class AssignDriverPayload(BaseModel):
    driver_name: str
    driver_phone: str

class UpdateStatusPayload(BaseModel):
    status: str

# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_items(items: list[OrderItem]) -> str:
    return ", ".join(f"{i.quantity}{i.unit} x {i.name}" for i in items)

def _calculate_points(total_price: float) -> int:
    """10 MAD = 1 Point. Truncated (no rounding up)."""
    return int(total_price // 10)

async def _server_price(name: str, client_fallback: float) -> float:
    """Look up the authoritative price from MongoDB; fall back to client value if not found.
    This prevents price manipulation: the client cannot lower prices by sending a fake price_per_unit."""
    col = products_col()
    doc = await col.find_one(
        {"$or": [{"name_fr": name}, {"name_ar": name}]},
        {"price_mad": 1},
    )
    if doc and doc.get("price_mad"):
        return float(doc["price_mad"])
    return client_fallback

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=OrderResponse, status_code=201, summary="Place a new order")
async def create_order(payload: CreateOrderPayload) -> OrderResponse:

    col      = orders_col()
    cust_col = customers_col()
    now      = datetime.now(tz=timezone.utc)

    # ── 1. Resolve authoritative prices from DB (prevents price manipulation) ──
    validated_items: list[dict[str, Any]] = []
    for item in payload.items:
        real_price = await _server_price(item.name, item.price_per_unit)
        validated_items.append({
            "name":           item.name,
            "quantity":       item.quantity,
            "unit":           item.unit,
            "price_per_unit": real_price,
            "line_total":     round(item.quantity * real_price, 2),
        })
    server_total = round(sum(i["line_total"] for i in validated_items), 2)

    # ── 2. Build order document ───────────────────────────────────────────────
    doc: dict[str, Any] = {
        "customer_name": payload.customer_name.strip(),
        "phone":         payload.phone.strip(),
        "address":       payload.address.strip(),
        "gps_coordinates": (
            {"lat": payload.gps_coordinates.lat, "lng": payload.gps_coordinates.lng}
            if payload.gps_coordinates else None
        ),
        "items": validated_items,
        "total_price": server_total,
        "status":      "Pending",
        "created_at":  now,
        "updated_at":  now,
    }

    try:
        result   = await col.insert_one(doc)
        order_id = str(result.inserted_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to create order. Please try again.")

    # ── 3. Loyalty — upsert customer & accumulate points ──────────────────────
    earned_points = _calculate_points(server_total)
    points_to_deduct = payload.points_used if payload.use_points and payload.points_used > 0 else 0
    net_points_delta  = earned_points - points_to_deduct
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
                "$inc":  {"total_points": net_points_delta},
                "$set":  {
                    "last_order_id": order_id,
                    "updated_at":    now,
                },
                "$push": {
                    "orders": {
                        "order_id":      order_id,
                        "total_price":   server_total,
                        "points_earned": earned_points,
                        "points_used":   points_to_deduct,
                        "date":          now,
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

    # ── 4. WhatsApp notification (with loyalty info) ──────────────────────────
    msg = (
        f"🟢 مرحباً {payload.customer_name}!\n\n"
        f"شكراً لاختيارك GreenGo Market 🛒\n"
        f"لقد توصلنا بطلبك (رقم: {order_id[-6:]}) بنجاح.\n\n"
        f"إجمالي الطلب: {server_total:.2f} درهم\n"
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
async def list_orders(limit: int = 50, phone: str | None = None, _: None = Depends(require_admin)) -> list[dict[str, Any]]:
    col  = orders_col()
    query: dict = {}
    if phone:
        p = phone.strip()
        if p.startswith("0") and len(p) == 10:
            p = "+212" + p[1:]
        query = {"$or": [{"phone": p}, {"phone": phone.strip()}]}
    docs = await col.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
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
    payload: UpdateStatusPayload,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    status = payload.status
    # Normalize: accept "out_for_delivery", "Out for Delivery", etc.
    status_map = {
        "pending":          "Pending",
        "preparing":        "Preparing",
        "out_for_delivery": "Out for Delivery",
        "out for delivery": "Out for Delivery",
        "delivered":        "Delivered",
        "cancelled":        "Cancelled",
        "canceled":         "Cancelled",
        "completed":        "Completed",
    }
    final_status = status_map.get(status.lower().strip())
    if not final_status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {status}. Must be one of: {list(status_map.keys())}",
        )

    col   = orders_col()
    order = await col.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await col.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": final_status, "updated_at": datetime.now(tz=timezone.utc)}},
    )

    customer_phone = order.get("phone")
    customer_name  = order.get("customer_name", "عزيزنا الزبون")
    short_id       = order_id[-6:].upper()

    if customer_phone:
        status_messages = {
            "Preparing": (
                f"🔵 مرحباً {customer_name}، بدأنا في تحضير طلبك الآن! 📦\n"
                f"En préparation — commande #{short_id}"
            ),
            "Out for Delivery": (
                f"🚚 Votre commande #{short_id} est en route!\n"
                f"Votre livreur vous contactera bientôt.\n\n"
                f"🛵 {customer_name}، طلبك خرج مع الليفرور!"
            ),
            "Delivered": (
                f"✅ Votre commande #{short_id} a été livrée.\n"
                f"Merci de votre confiance! 🌿 GreenGo Market\n\n"
                f"بالصحة والراحة {customer_name}! 💚"
            ),
            "Completed": (
                f"✅ مرحباً {customer_name}، تم إغلاق الطلب.\n"
                f"نتمناو نشوفوك مرة أخرى في GreenGo! 🌿"
            ),
            "Cancelled": (
                f"❌ عذراً {customer_name}، تم إلغاء طلبك #{short_id}.\n"
                f"للاستفسار تواصل معنا على واتساب."
            ),
        }
        msg = status_messages.get(final_status)
        if msg:
            send_whatsapp_message(customer_phone, msg)

    return {"order_id": order_id, "status": final_status, "updated": True}



@router.get("/{order_id}", summary="Get single order by ID")
async def get_order(order_id: str, _: None = Depends(require_admin)) -> dict[str, Any]:
    col = orders_col()
    doc = None
    # Try ObjectId first
    try:
        doc = await col.find_one({"_id": ObjectId(order_id)})
    except Exception:
        pass
    # Fallback: string _id
    if doc is None:
        doc = await col.find_one({"_id": order_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Order not found")
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    if isinstance(doc.get("updated_at"), datetime):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return doc

@router.get("/{order_id}/invoice", summary="Download PDF invoice for an order")
async def download_invoice(order_id: str, lang: str = "fr"):
    from app.database import whatsapp_orders_col

    doc = None

    # 1. Search orders_col first (new orders from website)
    try:
        col = orders_col()
        doc = await col.find_one({"_id": ObjectId(order_id)})
    except Exception:
        pass

    # 2. Fall back to whatsapp_orders_col (legacy WhatsApp orders)
    if doc is None:
        try:
            wa_col = whatsapp_orders_col()
            doc = await wa_col.find_one({"_id": ObjectId(order_id)})
        except Exception:
            pass
        if doc is None:
            try:
                wa_col = whatsapp_orders_col()
                doc = await wa_col.find_one({"_id": order_id})
            except Exception:
                pass

    if doc is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found.")

    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()

    try:
        pdf_bytes = generate_invoice_pdf(doc, lang)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    short_id = order_id[-8:].upper()
    filename = f"GreenGo_Facture_{short_id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.patch("/{order_id}/driver", summary="Assign driver to an order")
async def assign_driver(
    order_id: str,
    payload: AssignDriverPayload,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    col = orders_col()
    try:
        result = await col.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {
                "driver_name":  payload.driver_name.strip(),
                "driver_phone": payload.driver_phone.strip(),
                "updated_at":   datetime.now(tz=timezone.utc),
            }},
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    return {
        "order_id":     order_id,
        "driver_name":  payload.driver_name.strip(),
        "driver_phone": payload.driver_phone.strip(),
    }


@router.get("/{order_id}/tracking", summary="Public order tracking — no auth required")
async def track_order(order_id: str) -> dict[str, Any]:
    col = orders_col()
    doc = None
    try:
        doc = await col.find_one({"_id": ObjectId(order_id)})
    except Exception:
        pass
    if doc is None:
        try:
            doc = await col.find_one({"_id": order_id})
        except Exception:
            pass
    if doc is None:
        raise HTTPException(status_code=404, detail="Order not found")

    created_at = doc.get("created_at")
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()

    raw_status = str(doc.get("status", "pending"))
    normalized_status = raw_status.lower().replace(" ", "_")

    return {
        "order_id":           str(doc["_id"]),
        "status":             normalized_status,
        "driver_name":        doc.get("driver_name") or None,
        "driver_phone":       doc.get("driver_phone") or None,
        "estimated_delivery": doc.get("estimated_delivery") or None,
        "created_at":         created_at or "",
    }
