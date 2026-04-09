# app/main.py
from __future__ import annotations

import asyncio
import random
import traceback
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Optional

import httpx
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi import status as http_status
from fastapi.middleware.cors import CORSMiddleware
from twilio.twiml.messaging_response import MessagingResponse

from app.config import get_settings
from app.database import (
    close_db,
    connect_db,
    orders_col,
    products_col,
    whatsapp_orders_col,
)
from app.models import (
    OrderCreateModel,
    OrderResponseModel,
    OrderUpdateStatusModel,
    ProductCreateModel,
    WhatsAppOrderCreate,
    parse_whatsapp_items,
)

# ---------------------------------------------------------------------------
# Settings singleton
# ---------------------------------------------------------------------------

_settings = get_settings()

# ---------------------------------------------------------------------------
# Gemini configuration
# ---------------------------------------------------------------------------

_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Primary: gemini-2.5-flash  → free tier, high quota
# Fallback: gemini-1.5-flash → separate free quota pool, never hits 2.5-pro
_GEMINI_MODELS: list[str] = [
    "gemini-2.5-flash",   # attempt first — fastest, best for Darija NLP
    "gemini-1.5-flash",   # escalate here on persistent 503 — separate pool
]

_MAX_RETRIES  = 3
_BACKOFF_BASE = 1.0

_PARSER_SYSTEM = (
    "أنت محرك NLP صامت لمتجر GreenGo. "
    "مهمتك الوحيدة: استخرج كل عنصر من طلب الزبون وأعد JSON فقط — "
    "بدون أي نص إضافي، بدون ماركداون. "
    'الشكل المطلوب: {"items": [{"item_name": "...", "quantity": 1.0, "unit": "kilo"}]}'
    ' إذا لم تجد أي طلب واضح أعد: {"items": []}'
)

_REPLY_SYSTEM = (
    "أنت مساعد ذكي لمتجر 'GreenGo' لبيع الخضار والفواكه بالمغرب. "
    "الزبون سيتحدث معك بالدارجة المغربية. "
    "مهمتك الرد بالدارجة بأسلوب محترم وودود، "
    "وتأكيد طلبات الخضار والفواكه بوضوح."
)

_FALLBACK_REPLY  = "سمح لينا، وقع مشكل تقني. عاود صيفط لينا الطلب ديالك من فضلك."
_AI_ERROR_REPLY  = "سمح لينا، كاينة مشكلة فالاتصال بالمساعد الذكي دابا."
_BAD_RESP_REPLY  = "سمح لينا، توصلنا برد غير مفهوم من الخادم."
_EMPTY_MSG_REPLY = "سمح ليا، ما قدرتش نقرا الرسالة ديالك. عاود كتب الطلب ديالك من فضلك."


# ---------------------------------------------------------------------------
# Gemini helpers
# ---------------------------------------------------------------------------

def _gemini_url(model: str) -> str:
    return (
        f"{_GEMINI_BASE_URL}/{model}:generateContent"
        f"?key={_settings.GEMINI_API_KEY}"
    )


def _gemini_headers() -> dict[str, str]:
    return {
        "Content-Type":   "application/json; charset=utf-8",
        "x-goog-api-key": _settings.GEMINI_API_KEY,
    }


def _build_payload(system_text: str, user_message: str) -> dict[str, Any]:
    return {
        "contents": [
            {"parts": [{"text": f"{system_text}\n\nرسالة الزبون: {user_message}"}]}
        ]
    }


def _extract_text(raw: dict[str, Any]) -> str | None:
    candidates = raw.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return None
    parts  = candidates[0].get("content", {}).get("parts", [])
    chunks = [
        p["text"].strip()
        for p in parts
        if isinstance(p, dict) and isinstance(p.get("text"), str) and p["text"].strip()
    ]
    return "\n".join(chunks).strip() or None


def _is_transient(raw: dict[str, Any], http_status_code: int) -> bool:
    """
    Returns True for errors worth retrying:
      - HTTP 503 (UNAVAILABLE)        — server overloaded, safe to retry
      - HTTP 429 (RESOURCE_EXHAUSTED) — quota hit on THIS model, escalate
    """
    if http_status_code in (503, 429):
        return True
    err_code   = raw.get("error", {}).get("code", 0)
    err_status = raw.get("error", {}).get("status", "")
    return err_code in (503, 429) or err_status in ("UNAVAILABLE", "RESOURCE_EXHAUSTED")


async def _call_gemini(system_text: str, user_message: str) -> str:
    """
    Dual-auth Gemini call with per-model retry + model escalation.

    Model ladder (free-tier only):
      1. gemini-2.5-flash  — primary
      2. gemini-1.5-flash  — fallback (separate quota pool)

    Hard errors (400 INVALID_ARGUMENT, 401, 403) abort immediately — no retry.
    Transient errors (503, 429) exhaust retries then escalate to next model.
    """
    payload = _build_payload(system_text, user_message)
    headers = _gemini_headers()

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in _GEMINI_MODELS:
            url              = _gemini_url(model)
            last_raw:         dict[str, Any] = {}
            last_status_code: int            = 0

            for attempt in range(1, _MAX_RETRIES + 1):
                print(
                    f"🚀 [GEMINI] Model: {model} | "
                    f"Attempt {attempt}/{_MAX_RETRIES}"
                )
                try:
                    response         = await client.post(url, json=payload, headers=headers)
                    last_status_code = response.status_code
                    last_raw         = response.json()
                    print(f"📥 [GEMINI] HTTP {last_status_code} | body: {last_raw}")

                except httpx.TimeoutException:
                    print(f"⏱️  [GEMINI] Timeout — {model} attempt {attempt}")
                    last_raw, last_status_code = {}, 503

                except Exception as exc:
                    print(
                        f"❌ [GEMINI] Network error — "
                        f"{model} attempt {attempt}: {exc}"
                    )
                    last_raw, last_status_code = {}, 503

                # ── Success ─────────────────────────────────────────────────
                if "error" not in last_raw and "candidates" in last_raw:
                    reply = _extract_text(last_raw)
                    print(f"✅ [GEMINI] Success on {model} attempt {attempt}")
                    return reply if reply else _BAD_RESP_REPLY

                # ── Hard error — abort immediately, no retry, no escalation ─
                if "error" in last_raw and not _is_transient(last_raw, last_status_code):
                    err = last_raw["error"]
                    print(
                        f"❌ [GEMINI] Hard error {err.get('code')} "
                        f"{err.get('status')}: {err.get('message')}"
                    )
                    return _AI_ERROR_REPLY

                # ── Transient (503 / 429) — back off then retry ──────────────
                if attempt < _MAX_RETRIES:
                    backoff = (
                        _BACKOFF_BASE * (2 ** (attempt - 1))
                        + random.uniform(0, 0.5)
                    )
                    print(
                        f"⏳ [GEMINI] Transient {last_status_code} on {model} — "
                        f"backing off {backoff:.2f}s…"
                    )
                    await asyncio.sleep(backoff)

            # All retries for this model exhausted → escalate
            print(
                f"⚠️  [GEMINI] All {_MAX_RETRIES} retries exhausted "
                f"for {model} — escalating to next model."
            )

    print("❌ [GEMINI] All models exhausted.")
    return _FALLBACK_REPLY


# ---------------------------------------------------------------------------
# WhatsApp order persistence — non-fatal, never blocks the reply
# ---------------------------------------------------------------------------

async def _persist_whatsapp_order(
    customer_phone: str,
    raw_message:    str,
    parser_raw:     str,
) -> None:
    parsed_items = parse_whatsapp_items(parser_raw)
    print(f"🛒 [PARSED ITEMS]: {parsed_items}")

    if not parsed_items:
        return

    order = WhatsAppOrderCreate(
        customer_phone=customer_phone,
        raw_message=raw_message,
        parsed_items=parsed_items,
    )
    try:
        result = await whatsapp_orders_col().insert_one(order.model_dump())
        print(f"✅ [DB] WhatsApp order saved: {result.inserted_id}")
    except Exception as exc:
        print(f"❌ [DB] Failed to save WhatsApp order: {exc}")
        traceback.print_exc()


# ---------------------------------------------------------------------------
# Pydantic model for admin order status update
# ---------------------------------------------------------------------------

from enum import Enum
from pydantic import BaseModel


class AdminOrderStatus(str, Enum):
    pending           = "pending"
    preparing         = "preparing"
    out_for_delivery  = "out_for_delivery"
    delivered         = "delivered"
    completed         = "completed"
    cancelled         = "cancelled"


class AdminOrderStatusUpdate(BaseModel):
    status: AdminOrderStatus


# ---------------------------------------------------------------------------
# Lifespan — startup validation + DB connect / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:

    key_len = len(_settings.GEMINI_API_KEY) if _settings.GEMINI_API_KEY else 0
    print(f"🔑 STARTUP CHECK: Gemini Key loaded (Length: {key_len})")

    if key_len == 0:
        raise RuntimeError(
            "GEMINI_API_KEY is empty. "
            "Check your .env — no quotes, no trailing spaces."
        )

    key = _settings.GEMINI_API_KEY
    print(f"🔑 STARTUP CHECK: Key preview → {key[:8]}…{key[-4:]}")
    print(f"🤖 STARTUP CHECK: Model ladder → {_GEMINI_MODELS}")
    print(f"🗄️  STARTUP CHECK: MongoDB DB  → '{_settings.MONGO_DB_NAME}'")

    await connect_db()
    yield
    close_db()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="GreenGo Market API - MVP",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None  if _settings.is_production else "/docs",
    redoc_url=None if _settings.is_production else "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
async def health_check() -> dict:
    return {
        "status":       "GreenGo API is running",
        "version":      "1.0.0",
        "environment":  _settings.APP_ENV,
        "model_ladder": _GEMINI_MODELS,
    }


# ── Products ────────────────────────────────────────────────────────────────

@app.post(
    "/products/",
    status_code=http_status.HTTP_201_CREATED,
    tags=["Products"],
)
async def create_product(payload: ProductCreateModel) -> dict:
    try:
        result = await products_col().insert_one(payload.model_dump())
    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database insertion failed: {exc}",
        )
    return {"message": "Product created successfully", "_id": str(result.inserted_id)}


@app.get("/products/", tags=["Products"])
async def list_products() -> list[dict]:
    try:
        cursor   = products_col().find(
            {},
            {"_id": 1, "name": 1, "price": 1, "category": 1,
             "stock": 1, "image_url": 1, "is_vacuum_sealed": 1},
        )
        products = await cursor.to_list(length=200)
        for p in products:
            p["_id"] = str(p["_id"])
        return products
    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch products: {exc}",
        )


# ── Orders (PWA / Kanban) ───────────────────────────────────────────────────

@app.post(
    "/orders/",
    status_code=http_status.HTTP_201_CREATED,
    tags=["Orders"],
)
async def create_order(payload: OrderCreateModel) -> dict:
    try:
        result = await orders_col().insert_one(payload.model_dump())
    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Order insertion failed: {exc}",
        )
    return {"message": "Order created successfully", "_id": str(result.inserted_id)}


@app.get("/orders/", tags=["Orders"])
async def list_orders() -> list[dict]:
    try:
        cursor = orders_col().find({}).sort("created_at", -1)
        orders = await cursor.to_list(length=500)
        for o in orders:
            o["_id"] = str(o["_id"])
        return orders
    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch orders: {exc}",
        )


@app.patch("/orders/{order_id}/status", tags=["Orders"])
async def update_order_status(order_id: str, payload: OrderUpdateStatusModel) -> dict:
    try:
        oid = ObjectId(order_id)
    except InvalidId:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid order_id format.",
        )
    try:
        result = await orders_col().update_one(
            {"_id": oid},
            {"$set": payload.model_dump()},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Status update failed: {exc}",
        )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )
    return {
        "message":    "Order status updated.",
        "order_id":   order_id,
        "new_status": payload.status,
    }


# ── Admin Dashboard — Orders API ────────────────────────────────────────────

@app.get(
    "/api/v1/orders",
    response_model=list[OrderResponseModel],
    tags=["Admin Dashboard"],
    summary="List all WhatsApp orders with optional status filter",
)
async def get_admin_orders(
    status: Optional[str] = Query(
        default=None,
        description="Filter by order status: pending | preparing | out_for_delivery | delivered",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
        description="Maximum number of orders to return",
    ),
) -> list[OrderResponseModel]:
    """
    Returns WhatsApp orders from newest to oldest.

    - **status**: optional filter — must match an `OrderStatus` enum value exactly.
    - **limit**: max results returned (1–500, default 50).
    """
    try:
        pipeline: list[dict[str, Any]] = []

        if status is not None:
            pipeline.append({"$match": {"status": status}})

        pipeline.extend([
            {"$sort":  {"created_at": -1}},
            {"$limit": limit},
        ])

        cursor = whatsapp_orders_col().aggregate(pipeline)
        docs   = await cursor.to_list(length=limit)

    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch admin orders: {exc}",
        )

    results: list[OrderResponseModel] = []
    for doc in docs:
        try:
            results.append(
                OrderResponseModel(
                    id              = str(doc["_id"]),
                    whatsapp_sender = doc.get("customer_phone", ""),
                    items           = doc.get("parsed_items", []),
                    status          = doc.get("status", "pending"),
                    created_at      = doc["created_at"],
                )
            )
        except Exception as exc:
            # Skip malformed documents — log and continue
            print(f"⚠️  [ADMIN] Skipping malformed doc {doc.get('_id')}: {exc}")
            continue

    return results


# ── Admin Dashboard — Update WhatsApp Order Status  ─────────────────────────

@app.patch(
    "/api/v1/orders/{order_id}/status",
    tags=["Admin Dashboard"],
    summary="Update the status of a WhatsApp order (Complete / Cancel)",
)
async def update_admin_order_status(
    order_id: str,
    payload: AdminOrderStatusUpdate,
) -> dict:
    """
    Updates the `status` field of a WhatsApp order document in MongoDB.

    Allowed values for **status**:
    `pending` | `preparing` | `out_for_delivery` | `delivered` | `completed` | `cancelled`

    Returns 400 if `order_id` is not a valid ObjectId.
    Returns 404 if no document with that `_id` exists in the collection.
    """
    # ── 1. Validate the ObjectId format ─────────────────────────────────────
    try:
        oid = ObjectId(order_id)
    except InvalidId:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"'{order_id}' is not a valid ObjectId.",
        )

    # ── 2. Attempt the update ────────────────────────────────────────────────
    try:
        result = await whatsapp_orders_col().update_one(
            {"_id": oid},
            {"$set": {"status": payload.status.value}},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database update failed: {exc}",
        )

    # ── 3. Guard: document not found ─────────────────────────────────────────
    if result.matched_count == 0:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Order '{order_id}' not found.",
        )

    return {
        "message":    "Order status updated successfully.",
        "order_id":   order_id,
        "new_status": payload.status.value,
    }


# ── WhatsApp orders (read-only — written by webhook) ───────────────────────

@app.get("/whatsapp-orders/", tags=["WhatsApp Orders"])
async def list_whatsapp_orders() -> list[dict]:
    try:
        cursor = whatsapp_orders_col().find({}).sort("created_at", -1)
        orders = await cursor.to_list(length=500)
        for o in orders:
            o["_id"] = str(o["_id"])
        return orders
    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch WhatsApp orders: {exc}",
        )


# ── Twilio / WhatsApp webhook ───────────────────────────────────────────────

@app.post("/webhook/whatsapp", tags=["Webhook"])
async def whatsapp_webhook(request: Request) -> Response:
    form_data = await request.form()
    sender: str = str(form_data.get("From", ""))
    body:   str = str(form_data.get("Body", "")).strip()

    print(f"\n📩 [INCOMING] From: {sender} | Message: {body}")

    reply = _FALLBACK_REPLY

    try:
        if not body:
            reply = _EMPTY_MSG_REPLY
        else:
            # Step 1 — silent NLP extraction
            parser_raw = await _call_gemini(_PARSER_SYSTEM, body)

            # Step 2 — non-fatal DB write
            await _persist_whatsapp_order(
                customer_phone=sender,
                raw_message=body,
                parser_raw=parser_raw,
            )

            # Step 3 — friendly Darija confirmation (always reaches customer)
            reply = await _call_gemini(_REPLY_SYSTEM, body)
            print(f"🤖 [FINAL REPLY]: {reply}")

    except Exception as exc:
        print(f"❌ [WEBHOOK ERROR]: {exc}")
        traceback.print_exc()
        reply = _FALLBACK_REPLY

    twiml = MessagingResponse()
    twiml.message(reply)
    return Response(content=str(twiml), media_type="application/xml")