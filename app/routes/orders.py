from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field, AliasChoices

import io
from fastapi.responses import StreamingResponse
from app.auth import require_admin
from app.services.pdf_generator import generate_invoice_pdf
from app.database import orders_col, customers_col, products_col, paniers_col
from app.services.audit import ORDER_TRACKED_FIELDS, _compute_diff, actor_id, log_change, request_ip
from app.services.notifications import send_and_log, notify_customer_and_log, notify_admin_and_log

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])

# ── Delivery zones ────────────────────────────────────────────────────────────
# Fixed per-zone delivery fee, in MAD. Must mirror DELIVERY_FEES in
# src/store/cartStore.ts on the frontend -- the client-supplied delivery_fee
# is never trusted, only used to detect a stale/tampered value (see below).
DELIVERY_FEES: dict[str, float] = {
    "laayayda": 0,
    "sale":     20,
    "rabat":    30,
    "temara":   40,
}
DEFAULT_DELIVERY_ZONE = "sale"

# ── Status machine ────────────────────────────────────────────────────────────
# Mirrors OrderStatus.allowed_next in app/models/order.py (legacy whatsapp_orders
# path) and NEXT_STATES in src/pages/AdminPage.tsx (frontend button gating) --
# this brings the same transition enforcement server-side for orders_col(),
# which previously accepted any status string with no validation at all.
STATUS_TRANSITIONS: dict[str, list[str]] = {
    "Pending":          ["Confirmed", "Cancelled"],
    "Confirmed":        ["Preparing", "Cancelled"],
    "Preparing":        ["Out for Delivery", "Cancelled"],
    "Out for Delivery": ["Delivered", "Cancelled"],
    "Delivered":        ["Completed"],
    "Completed":        [],
    "Cancelled":        [],
}

# ── Pydantic models ───────────────────────────────────────────────────────────

class GPSCoordinates(BaseModel):
    lat: float
    lng: float

class OrderItem(BaseModel):
    name: str
    quantity: float
    unit: str = "kg"
    price_per_unit: float
    variant_label: str | None = None

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
    delivery_zone: str | None = None
    delivery_fee: float | None = 0
    total_price: float

class OrderResponse(BaseModel):
    order_id: str
    status: str
    created_at: str
    message: str

class AssignDriverPayload(BaseModel):
    driver_name: str
    driver_phone: str

class OrderStatusUpdate(BaseModel):
    status: str
    note: str | None = None
    notify_customer: bool = True

# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_items(items: list[OrderItem]) -> str:
    return ", ".join(f"{i.quantity}{i.unit} x {i.name}" for i in items)

def _calculate_points(total_price: float) -> int:
    """10 MAD = 1 Point. Truncated (no rounding up)."""
    return int(total_price // 10)

async def _server_product_info(
    name: str,
    client_fallback_price: float,
    variant_label: str | None = None,
) -> dict[str, Any]:
    """
    Look up authoritative price + image_url from MongoDB.
    Prevents price manipulation: client cannot lower prices by sending a fake price_per_unit.

    Panier ("pack") cart lines have no matching product row -- they're added as a
    single line named after the basket's title, at the admin-set panier.price. If
    we fell through to client_fallback_price for those (like any other unmatched
    name), a tampered request could submit any price for the whole pack. So an
    unmatched name is checked against paniers.title next, before ever trusting
    the client-supplied price.

    variant_label, when set, selects the admin-set price for that weight-tier
    (250g/500g/1kg) from the product's variants[] -- otherwise every variant
    would silently be billed at the base product's price_mad instead of the
    price the admin actually set for that pack (L99).
    """
    col = products_col()
    doc = await col.find_one(
        {"$or": [{"name_fr": name}, {"name_ar": name}]},
        {"price_mad": 1, "image_url": 1, "variants": 1},
    )
    if doc:
        price = None
        if variant_label and doc.get("variants"):
            variant = next((v for v in doc["variants"] if v.get("label") == variant_label), None)
            if variant and variant.get("price_mad"):
                price = float(variant["price_mad"])
        if price is None:
            price = float(doc["price_mad"]) if doc.get("price_mad") else client_fallback_price
        return {
            "price":     price,
            "image_url": doc.get("image_url") or "",
        }

    panier = await paniers_col().find_one(
        {"title": {"$regex": f"^{re.escape(name)}$", "$options": "i"}},
        {"price": 1},
    )
    if panier and panier.get("price"):
        return {"price": float(panier["price"]), "image_url": ""}

    return {"price": client_fallback_price, "image_url": ""}

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=OrderResponse, status_code=201, summary="Place a new order")
async def create_order(payload: CreateOrderPayload, background_tasks: BackgroundTasks) -> OrderResponse:

    col      = orders_col()
    cust_col = customers_col()
    now      = datetime.now(tz=timezone.utc)

    # ── 1. Resolve authoritative prices + image URLs from DB ─────────────────
    validated_items: list[dict[str, Any]] = []
    for item in payload.items:
        info = await _server_product_info(item.name, item.price_per_unit, item.variant_label)
        validated_items.append({
            "name":           item.name,
            "quantity":       item.quantity,
            "unit":           item.unit,
            "variant_label":  item.variant_label,
            "price_per_unit": info["price"],
            "line_total":     round(item.quantity * info["price"], 2),
            "image_url":      info["image_url"],
        })
    server_total = round(sum(i["line_total"] for i in validated_items), 2)

    # ── 1b. Resolve authoritative delivery fee from zone ──────────────────────
    # The client's delivery_fee is never trusted -- it's only ever used as a
    # display value on the frontend. The fee actually charged is always
    # re-derived here from delivery_zone, same as prices above.
    zone = (payload.delivery_zone or DEFAULT_DELIVERY_ZONE).strip().lower()
    delivery_fee = DELIVERY_FEES.get(zone, DELIVERY_FEES[DEFAULT_DELIVERY_ZONE])
    final_total = round(server_total + delivery_fee, 2)

    # ── 2. Build order document ───────────────────────────────────────────────
    doc: dict[str, Any] = {
        "customer_name": payload.customer_name.strip(),
        "phone":         payload.phone.strip(),
        "address":       payload.address.strip(),
        "gps_coordinates": (
            {"lat": payload.gps_coordinates.lat, "lng": payload.gps_coordinates.lng}
            if payload.gps_coordinates else None
        ),
        "items":         validated_items,
        "delivery_zone": zone,
        "delivery_fee":  delivery_fee,
        "subtotal":      server_total,
        "total_price":   final_total,
        "status":        "Pending",
        "created_at":    now,
        "updated_at":    now,
    }

    try:
        result   = await col.insert_one(doc)
        order_id = str(result.inserted_id)
        short_id = order_id[-6:].upper()
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
                "$inc":  {
                    "total_points": net_points_delta,
                    # CRM summary fields (Module 4) -- kept on the same
                    # customer doc the loyalty system already maintains,
                    # rather than a second collection/upsert competing for
                    # the same phone key.
                    "total_orders": 1,
                    "total_spent":  final_total,
                },
                "$set":  {
                    "last_order_id": order_id,
                    "updated_at":    now,
                    "zone":          zone,
                },
                "$min": {"first_order": now},
                "$max": {"last_order":  now},
                "$push": {
                    "orders": {
                        "order_id":      order_id,
                        "total_price":   final_total,
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

        # Segment recompute -- needs the post-increment total_orders, so it's
        # a second, cheap update rather than part of the atomic upsert above.
        orders_count = update_result.get("total_orders", 1) if update_result else 1
        segment = "vip" if orders_count >= 10 else "regular" if orders_count >= 3 else "new"
        await cust_col.update_one({"phone": phone_key}, {"$set": {"segment": segment}})
    except Exception as exc:
        # Loyalty failure must NOT block the order confirmation
        total_points = earned_points

    # ── 4. WhatsApp notifications ─────────────────────────────────────────────
    # 4a. Customer: rich confirmation with product list + loyalty
    background_tasks.add_task(
        notify_customer_and_log,
        order_id, short_id,
        phone          = payload.phone,
        customer_name  = payload.customer_name,
        order_id       = order_id,
        items          = validated_items,
        subtotal       = server_total,
        delivery_zone  = zone,
        delivery_fee   = delivery_fee,
        total          = final_total,
        address        = payload.address,
        earned_points  = earned_points,
        total_points   = total_points,
    )

    # 4b. Admin: full alert with customer info, GPS, product images
    gps_dict = (
        {"lat": payload.gps_coordinates.lat, "lng": payload.gps_coordinates.lng}
        if payload.gps_coordinates else None
    )
    background_tasks.add_task(
        notify_admin_and_log,
        order_id, short_id,
        order_id        = order_id,
        customer_name   = payload.customer_name,
        customer_phone  = payload.phone,
        address         = payload.address,
        gps             = gps_dict,
        items           = validated_items,
        subtotal        = server_total,
        delivery_zone   = zone,
        delivery_fee    = delivery_fee,
        total           = final_total,
    )

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


# NOTE: this must stay declared before GET /{order_id} below -- FastAPI matches
# routes in declaration order, so a request to /orders/track would otherwise be
# swallowed by /{order_id} (with order_id="track") and always 404.
@router.get("/track", summary="Public order tracking by reference or phone — no auth required")
async def track_order_public(order_ref: str | None = None, phone: str | None = None) -> list[dict[str, Any]]:
    """
    Customer self-service lookup. Orders have no "order_number" field --
    the identifier customers actually have is the #{short_id} (last 6 chars
    of the Mongo _id, uppercased) sent in their WhatsApp confirmation
    (see notify_customer_order in app/services/whatsapp.py). Matching that
    suffix can't be done as a Mongo query on the ObjectId itself, so we
    filter in Python over a bounded candidate set instead of building a
    regex from raw user input (which would also be a ReDoS/injection risk).
    """
    if not order_ref and not phone:
        raise HTTPException(
            status_code=400,
            detail="Fournissez une référence de commande ou un numéro de téléphone",
        )

    col = orders_col()
    query: dict[str, Any] = {}
    if phone:
        p = phone.strip()
        if p.startswith("0") and len(p) == 10:
            p = "+212" + p[1:]
        query = {"$or": [{"phone": p}, {"phone": phone.strip()}]}

    docs = await col.find(query).sort("created_at", -1).limit(200).to_list(length=200)

    if order_ref:
        ref = order_ref.strip().upper()
        docs = [d for d in docs if str(d["_id"])[-6:].upper() == ref]

    docs = docs[:5]
    if not docs:
        raise HTTPException(
            status_code=404,
            detail="Aucune commande trouvée. Vérifiez la référence ou le numéro de téléphone.",
        )

    results: list[dict[str, Any]] = []
    for d in docs:
        created = d.get("created_at")
        # Normalize to lowercase snake_case (matches GET /{order_id}/tracking's
        # convention below) -- the DB stores display-cased values like
        # "Out for Delivery".
        raw_status = str(d.get("status", "Pending"))
        normalized_status = raw_status.lower().replace(" ", "_")
        results.append({
            "order_ref":          str(d["_id"])[-6:].upper(),
            "status":             normalized_status,
            "created_at":         created.isoformat() if isinstance(created, datetime) else str(created or ""),
            "total_price":        d.get("total_price", 0),
            "customer_name":      d.get("customer_name", ""),
            "items_count":        len(d.get("items", [])),
            "driver_name":        d.get("driver_name") or None,
            "driver_phone":       d.get("driver_phone") or None,
            "estimated_delivery": d.get("estimated_delivery") or None,
        })
    return results


@router.patch("/{order_id}/status", summary="Update order status")
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    request: Request,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    # Normalize: accept "out_for_delivery", "Out for Delivery", etc.
    status_map = {
        "pending":          "Pending",
        "confirmed":        "Confirmed",
        "preparing":        "Preparing",
        "out_for_delivery": "Out for Delivery",
        "out for delivery": "Out for Delivery",
        "delivered":        "Delivered",
        "cancelled":        "Cancelled",
        "canceled":         "Cancelled",
        "completed":        "Completed",
    }
    final_status = status_map.get(payload.status.lower().strip())
    if not final_status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {payload.status}. Must be one of: {list(status_map.keys())}",
        )

    col   = orders_col()
    order = await col.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current_status = order.get("status", "Pending")

    # Enforce the same transition rules already used by the legacy
    # whatsapp_orders lifecycle (OrderStatus.allowed_next) and the admin UI
    # (NEXT_STATES in AdminPage.tsx) -- previously this endpoint accepted any
    # status string with no validation.
    allowed = STATUS_TRANSITIONS.get(current_status, [])
    if final_status not in allowed and final_status != current_status:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid transition: '{current_status}' -> '{final_status}'. "
                f"Allowed: {allowed or ['none (terminal)']}"
            ),
        )

    now = datetime.now(tz=timezone.utc)
    history_entry = {
        "from":       current_status,
        "to":         final_status,
        "timestamp":  now,
        "changed_by": actor_id(request),
        "note":       payload.note or "",
    }

    await col.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set":  {"status": final_status, "updated_at": now},
            "$push": {"status_history": history_entry},
        },
    )

    # Auto-restock on cancellation. Variant lines (250g/500g/1kg) restock the
    # matching variants[].stock_qty; MongoDB's $inc creates the field at the
    # matched array position if it was never set, so no separate "init" step
    # is needed. Lines with no variant_label (or whose variant carries no
    # stock_qty) fall back to the base product's stock_qty. Either path is
    # skipped if there's no stock_qty to restock -- both fields are purely
    # informational (they don't gate in_stock/purchasability).
    restocked: list[str] = []
    if final_status == "Cancelled" and current_status != "Cancelled":
        for item in order.get("items", []):
            p_name  = item.get("name", "")
            v_label = item.get("variant_label")
            qty     = item.get("quantity", 0)
            if not p_name or not qty:
                continue

            product = await products_col().find_one(
                {"$or": [{"name_fr": p_name}, {"name_ar": p_name}]},
                {"_id": 1, "stock_qty": 1, "variants": 1},
            )
            if not product:
                continue

            if v_label and product.get("variants"):
                variant = next((v for v in product["variants"] if v.get("label") == v_label), None)
                if variant is not None:
                    result = await products_col().update_one(
                        {"_id": product["_id"], "variants.label": v_label},
                        {"$inc": {"variants.$.stock_qty": qty}},
                    )
                    if result.modified_count > 0:
                        restocked.append(f"{p_name} ({v_label}) +{qty}")
                    continue

            if product.get("stock_qty") is not None:
                await products_col().update_one(
                    {"_id": product["_id"]},
                    {"$inc": {"stock_qty": qty}},
                )
                restocked.append(f"{p_name} +{qty}")

    changes = _compute_diff(order, {**order, "status": final_status}, ORDER_TRACKED_FIELDS)
    await log_change(
        entity_type="order",
        entity_id=order_id,
        action="update",
        changes=changes,
        admin_id=actor_id(request),
        ip=request_ip(request),
        endpoint=f"/api/v1/orders/{order_id}/status",
    )

    customer_phone = order.get("phone")
    customer_name  = order.get("customer_name", "عزيزنا الزبون")
    short_id       = order_id[-6:].upper()

    wa_sent = False
    if payload.notify_customer and customer_phone:
        tracking_url = f"https://www.mygreengoo.com/suivi-commande?ref={short_id}"
        status_messages = {
            "Confirmed": (
                f"✅ مرحباً {customer_name}، طلبيتك مؤكدة! كنحضروها دابا. 📦\n"
                f"Commande confirmée — #{short_id}\n\n"
                f"🔍 تتبع طلبيتك: {tracking_url}"
            ),
            "Preparing": (
                f"🔵 مرحباً {customer_name}، بدأنا في تحضير طلبك الآن! 📦\n"
                f"En préparation — commande #{short_id}\n\n"
                f"🔍 تتبع طلبيتك: {tracking_url}"
            ),
            "Out for Delivery": (
                f"🚚 Votre commande #{short_id} est en route!\n"
                f"Votre livreur vous contactera bientôt.\n\n"
                f"🛵 {customer_name}، طلبك خرج مع الليفرور!\n\n"
                f"🔍 تتبع طلبيتك: {tracking_url}"
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
            background_tasks.add_task(send_and_log, customer_phone, msg, "order_status", order_id, short_id)
            wa_sent = True

    return {
        "order_id":        order_id,
        "previous_status": current_status,
        "new_status":       final_status,
        "restocked":        restocked,
        "whatsapp_sent":    wa_sent,
        "note":             payload.note,
    }



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
