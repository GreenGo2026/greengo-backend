# app/main.py
from __future__ import annotations

# ---------------------------------------------------------------------------
# Load .env FIRST
# ---------------------------------------------------------------------------
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

# ---------------------------------------------------------------------------
# Standard library
# ---------------------------------------------------------------------------
import asyncio
import json
import random
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncGenerator, Optional

# ---------------------------------------------------------------------------
# Third-party
# ---------------------------------------------------------------------------
import httpx
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi import status as http_status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from twilio.request_validator import RequestValidator
from twilio.twiml.messaging_response import MessagingResponse

# ---------------------------------------------------------------------------
# Internal — database only
# ---------------------------------------------------------------------------
from app.config import get_settings
from app.database import close_db, connect_db, orders_col, products_col, whatsapp_orders_col
from app.routes.products import router as products_router
from app.routes.orders   import router as orders_router
from app.routes.webhook  import router as webhook_router
from app.routes.storefront import router as storefront_router
from app.routes.analytics import router as analytics_router

# ---------------------------------------------------------------------------
# New models imported directly from their modules (not via __init__)
# ---------------------------------------------------------------------------
from app.models.order import (
    CreateOrderRequest,
    OrderStatus,
    UpdateOrderStatusRequest,
)
from app.models.product import UpdateProductRequest

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
_settings          = get_settings()
_TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
import os as _os
_ENV = _os.getenv("APP_ENV", "development")

# Development: allow localhost. Production: only real domains.
if _ENV == "production":
    ALLOWED_ORIGINS = [
        "https://mygreengoo.com",
        "https://www.mygreengoo.com",
        "https://greengo-frontend.up.railway.app",
        "https://greengo-frontend.vercel.app",
    ]
else:
    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

# ---------------------------------------------------------------------------
# Inline Pydantic models
# All models defined here — zero dependency on app.models.__init__
# ---------------------------------------------------------------------------

class CatalogItem(BaseModel):
    name:           str
    price_per_unit: float
    unit:           str
    available:      bool

class CatalogItemUpdate(BaseModel):
    product_name:   str                    # Arabic product name — sent in body, never in URL
    price_per_unit: Optional[float] = None
    available:      Optional[bool]  = None
    in_stock:       Optional[bool]  = None
    stock_qty:      Optional[float] = None

class CheckoutItem(BaseModel):
    name:           str
    quantity:       float = Field(..., gt=0)
    unit:           str   = Field(default="kg")
    price_per_unit: float = Field(..., ge=0)

class CheckoutOrderCreate(BaseModel):
    customer_name:    Optional[str]       = None
    customer_phone:   str                 = Field(..., min_length=6)
    delivery_address: str                 = Field(default="")
    items:            list[CheckoutItem]  = Field(..., min_length=1)
    total_price:      float               = Field(default=0.0, ge=0)
    notes:            Optional[str]       = None
    payment_method:   str                 = Field(default="cash")

class CheckoutOrderResponse(BaseModel):
    message:     str
    order_id:    str
    status:      str
    total_price: float
    created_at:  str

class OrderItemResponse(BaseModel):
    item_name:      str   = ""
    name:           str   = ""
    quantity:       float = 0.0
    unit:           str   = "kg"
    price_per_unit: float = 0.0
    line_total:     float = 0.0

class OrderResponse(BaseModel):
    id:               str
    customer_phone:   str                    = ""
    customer_name:    str                    = ""
    delivery_address: str                    = ""
    items:            list[OrderItemResponse] = Field(default_factory=list)
    total_price:      float                  = 0.0
    status:           str                    = "pending"
    created_at:       datetime

class WhatsAppOrderItemInline(BaseModel):
    item_name: str
    quantity:  float = 1.0
    unit:      str   = "kilo"

class WhatsAppOrderCreateInline(BaseModel):
    customer_phone: str
    raw_message:    str   = ""
    parsed_items:   list[WhatsAppOrderItemInline] = Field(default_factory=list)
    total_price:    float = 0.0
    status:         str   = "pending"
    source:         str   = "whatsapp"
    created_at:     datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at:     datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LegacyProductCreate(BaseModel):
    name:     str
    price:    float = 0.0
    category: str   = ""
    stock:    float = 0.0

class LegacyOrderCreate(BaseModel):
    customer_phone:   str
    delivery_address: str   = ""
    items:            list  = Field(default_factory=list)
    total_price:      float = 0.0
    status:           str   = "pending"
    created_at:       datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ---------------------------------------------------------------------------
# Prices catalog
# ---------------------------------------------------------------------------
_PRICES_PATH = Path(__file__).parent / "config" / "prices.json"


def _load_catalog() -> dict[str, Any]:
    try:
        raw = json.loads(_PRICES_PATH.read_text(encoding="utf-8-sig"))
        products = raw.get("products")
        if not isinstance(products, dict):
            raise ValueError("Top-level key 'products' must be a JSON object.")
        return products
    except FileNotFoundError:
        raise RuntimeError(f"prices.json not found at {_PRICES_PATH}.")
    except (json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(f"prices.json is malformed: {exc}")


_CATALOG: dict[str, Any] = _load_catalog()


def _persist_catalog() -> None:
    try:
        current = json.loads(_PRICES_PATH.read_text(encoding="utf-8-sig"))
        current["products"] = _CATALOG
        _PRICES_PATH.write_text(
            json.dumps(current, ensure_ascii=False, indent=2),
            encoding="utf-8-sig",
        )
    except Exception as exc:
        raise RuntimeError(f"Disk write failed: {exc}")


# ---------------------------------------------------------------------------
# Pricing helpers
# ---------------------------------------------------------------------------
def _calculate_total_whatsapp(items: list[WhatsAppOrderItemInline]) -> float:
    total = 0.0
    for item in items:
        entry = _CATALOG.get(item.item_name)
        if entry is None or not entry.get("available", False):
            continue
        total += round(item.quantity * float(entry["price_per_unit"]), 2)
    return round(total, 2)


def _recompute_total(items: list[dict[str, Any]]) -> float:
    total = 0.0
    for item in items:
        name    = item.get("name", "")
        qty     = float(item.get("quantity", 0))
        entry   = _CATALOG.get(name)
        unit_px = float(entry["price_per_unit"]) if entry else float(item.get("price_per_unit", 0))
        total  += round(qty * unit_px, 2)
    return round(total, 2)


# ---------------------------------------------------------------------------
# WhatsApp order parser
# ---------------------------------------------------------------------------
def _parse_whatsapp_items(raw_json: str) -> list[WhatsAppOrderItemInline]:
    try:
        clean = raw_json.strip()
        if clean.startswith("```"):
            clean = "\n".join(clean.split("\n")[1:])
        if clean.endswith("```"):
            clean = "\n".join(clean.split("\n")[:-1])
        data = json.loads(clean.strip())
        return [WhatsAppOrderItemInline(**i) for i in data.get("items", [])]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Gemini
# ---------------------------------------------------------------------------
_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
_GEMINI_MODELS   = ["gemini-2.5-flash", "gemini-1.5-flash"]
_MAX_RETRIES     = 3
_BACKOFF_BASE    = 1.0

_PARSER_SYSTEM = (
    "أنت محرك NLP صامت لمتجر GreenGo. "
    "مهمتك الوحيدة: استخرج كل عنصر من طلب الزبون وأعد JSON فقط — "
    "بدون أي نص إضافي، بدون ماركداون. "
    '{"items": [{"item_name": "...", "quantity": 1.0, "unit": "kilo"}]}'
    ' إذا لم تجد أي طلب واضح أعد: {"items": []}'
)
_REPLY_SYSTEM = (
    "أنت مساعد ذكي لمتجر 'GreenGo' لبيع الخضار والفواكه بالمغرب. "
    "الزبون سيتحدث معك بالدارجة المغربية. "
    "مهمتك الرد بالدارجة بأسلوب محترم وودود."
)
_FALLBACK_REPLY  = "أوووه! 😅 وقع شي حاجة ما تسناهاش. عاود صيفط الطلب! 🌿🛵"
_AI_ERROR_REPLY  = "سمح لينا 🙏 — عاود بعد دقيقة! 🍏"
_BAD_RESP_REPLY  = "عندنا مشكل صغير — عاود كتب الطلب! 🌿"
_EMPTY_MSG_REPLY = "السلام! 🍊 كتب لينا واش بغيتي — مثلاً: 'كيلو طماطم' 🥕🌿"


def _gemini_url(model: str) -> str:
    return f"{_GEMINI_BASE_URL}/{model}:generateContent?key={_settings.GEMINI_API_KEY}"


def _build_payload(system_text: str, user_message: str) -> dict[str, Any]:
    return {"contents": [{"parts": [{"text": f"{system_text}\n\nرسالة الزبون: {user_message}"}]}]}


def _extract_text(raw: dict[str, Any]) -> str | None:
    candidates = raw.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return None
    parts  = candidates[0].get("content", {}).get("parts", [])
    chunks = [p["text"].strip() for p in parts if isinstance(p, dict) and p.get("text", "").strip()]
    return "\n".join(chunks).strip() or None


def _is_transient(raw: dict[str, Any], code: int) -> bool:
    if code in (503, 429):
        return True
    err_code   = raw.get("error", {}).get("code", 0)
    err_status = raw.get("error", {}).get("status", "")
    return err_code in (503, 429) or err_status in ("UNAVAILABLE", "RESOURCE_EXHAUSTED")


async def _call_gemini(system_text: str, user_message: str) -> str:
    payload = _build_payload(system_text, user_message)
    headers = {"Content-Type": "application/json; charset=utf-8", "x-goog-api-key": _settings.GEMINI_API_KEY}
    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in _GEMINI_MODELS:
            url = _gemini_url(model)
            last_raw: dict[str, Any] = {}
            last_code = 0
            for attempt in range(1, _MAX_RETRIES + 1):
                try:
                    res       = await client.post(url, json=payload, headers=headers)
                    last_code = res.status_code
                    last_raw  = res.json()
                except Exception:
                    last_raw, last_code = {}, 503
                if "error" not in last_raw and "candidates" in last_raw:
                    reply = _extract_text(last_raw)
                    return reply if reply else _BAD_RESP_REPLY
                if "error" in last_raw and not _is_transient(last_raw, last_code):
                    return _AI_ERROR_REPLY
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(_BACKOFF_BASE * (2 ** (attempt - 1)) + random.uniform(0, 0.5))
    return _FALLBACK_REPLY


# ---------------------------------------------------------------------------
# Receipt builder
# ---------------------------------------------------------------------------
def _build_receipt(parsed_items: list[WhatsAppOrderItemInline], total_price: float) -> str:
    separator = "🟢・" * 10
    priced_lines: list[str] = []
    unavailable:  list[str] = []
    for item in parsed_items:
        entry = _CATALOG.get(item.item_name)
        if entry is None or not entry.get("available", False):
            unavailable.append(item.item_name)
            continue
        qty_str    = str(int(item.quantity)) if item.quantity == int(item.quantity) else str(item.quantity)
        line_total = round(item.quantity * float(entry["price_per_unit"]), 2)
        priced_lines.append(f"   🥕 {item.item_name} × {qty_str} {entry.get('unit','كيلو')}  ＝  *{line_total:.2f} درهم*")
    if not priced_lines:
        lines = [separator, "🌿 *GreenGo* — وصلنا صوتك! 🍊", ""]
        for n in unavailable:
            lines.append(f"   *{n}* تسالات لينا دابا 💚")
        lines += ["", "غادي نتصلو بيك. 📞", "", "🛵💨 *توصيل فابور فسلا للشهر الأول!*", "", "شكراً! 🌿🍏", separator]
        return "\n".join(lines)
    lines = [separator, "🌿 *GreenGo* — تأكيد طلبك وصل! ✅🍊", "", "📦 *المنتجات:*", ""]
    lines.extend(priced_lines)
    lines += ["", f"💰 *المجموع: {total_price:.2f} درهم*"]
    for n in unavailable:
        lines.append(f"   *{n}* تسالات لينا 💚")
    lines += ["", "🛵💨 *توصيل فابور فسلا للشهر الأول!*", "", "يسعد صباحك! 🍏🌿", separator]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# WhatsApp persistence
# ---------------------------------------------------------------------------
async def _persist_whatsapp_order(
    customer_phone: str,
    raw_message:    str,
    parser_raw:     str,
) -> tuple[list[WhatsAppOrderItemInline], float]:
    parsed_items = _parse_whatsapp_items(parser_raw)
    if not parsed_items:
        return [], 0.0
    total_price = _calculate_total_whatsapp(parsed_items)
    order = WhatsAppOrderCreateInline(
        customer_phone=customer_phone,
        raw_message=raw_message,
        parsed_items=parsed_items,
        total_price=total_price,
    )
    try:
        result = await whatsapp_orders_col().insert_one(order.model_dump())
        print(f"✅ [DB] WhatsApp order saved: {result.inserted_id} | {total_price} MAD")
    except Exception as exc:
        print(f"❌ [DB] Failed to save WhatsApp order: {exc}")
        traceback.print_exc()
    return parsed_items, total_price


# ---------------------------------------------------------------------------
# Twilio security
# ---------------------------------------------------------------------------
def _reconstruct_webhook_url(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto")
    host  = request.headers.get("x-forwarded-host")
    if proto and host:
        url = f"{proto}://{host}{request.url.path}"
        if request.url.query:
            url += f"?{request.url.query}"
        return url
    return str(request.url)


async def _validate_twilio_request(request: Request) -> dict:
    if not _TWILIO_AUTH_TOKEN:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Webhook security misconfigured.")
    form_data  = await request.form()
    params     = dict(form_data)
    signature  = request.headers.get("X-Twilio-Signature", "")
    public_url = _reconstruct_webhook_url(request)
    validator  = RequestValidator(_TWILIO_AUTH_TOKEN)
    if not validator.validate(public_url, params, signature):
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Forbidden: invalid Twilio signature.")
    return params


# ---------------------------------------------------------------------------
# Shared status-update helper (enforces lifecycle)
# ---------------------------------------------------------------------------
async def _do_update_order_status(order_id: str, new_status: OrderStatus) -> dict[str, Any]:
    # Resolve document — supports both ObjectId and UUID string _id
    doc: dict[str, Any] | None = None
    oid: ObjectId | None       = None
    try:
        oid = ObjectId(order_id)
        doc = await whatsapp_orders_col().find_one({"_id": oid})
    except InvalidId:
        pass
    if doc is None:
        doc = await whatsapp_orders_col().find_one({"_id": order_id})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")

    current_raw    = doc.get("status", "pending")
    try:
        current_status = OrderStatus(current_raw)
    except ValueError:
        current_status = OrderStatus.PENDING

    if current_status.is_terminal:
        raise HTTPException(
            status_code=409,
            detail=f"Order is already '{current_status.value}' — no further transitions allowed.",
        )
    if new_status not in current_status.allowed_next:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Invalid transition: '{current_status.value}' -> '{new_status.value}'. "
                f"Allowed: {[s.value for s in current_status.allowed_next]}"
            ),
        )

    update_filter = {"_id": oid} if oid is not None else {"_id": order_id}
    try:
        result = await whatsapp_orders_col().update_one(
            update_filter,
            {"$set": {"status": new_status.value, "updated_at": datetime.now(tz=timezone.utc)}},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DB update failed: {exc}")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' disappeared during update.")

    return {"message": "Status updated.", "order_id": order_id, "new_status": new_status.value}


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    if not _settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is empty. Check your .env file.")
    if not _TWILIO_AUTH_TOKEN:
        print("WARNING: TWILIO_AUTH_TOKEN not set — webhook will reject all requests.")
    print(f"STARTUP: Catalog items loaded -> {len(_CATALOG)}")
    await connect_db()
    yield
    close_db()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="GreenGo Market API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url  = None if _settings.is_production else "/docs",
    redoc_url = None if _settings.is_production else "/redoc",
)




# ── Static files — absolute path ────────────────────────────────────────────
_ASSETS_DIR = Path(__file__).resolve().parent.parent / 'assets'
app.mount('/static', StaticFiles(directory=str(_ASSETS_DIR)), name='static')

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
)

# ── Security headers middleware ───────────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware as _BaseMiddleware
from collections import defaultdict as _defaultdict
import time as _time

class SecurityHeadersMiddleware(_BaseMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"]    = "nosniff"
        response.headers["X-Frame-Options"]           = "DENY"
        response.headers["X-XSS-Protection"]          = "1; mode=block"
        response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"]        = "geolocation=(), microphone=(), camera=()"
        if _os.getenv("APP_ENV") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

# ── Rate limiting middleware ──────────────────────────────────────────────────
_RATE_LIMITS: dict[str, list[float]] = _defaultdict(list)
_RATE_WINDOW  = 60      # seconds
_RATE_MAX_REQ = 60      # requests per window per IP (general)
_RATE_MAX_ORD = 10      # stricter limit for POST /orders

class RateLimitMiddleware(_BaseMiddleware):
    async def dispatch(self, request, call_next):
        ip  = request.client.host if request.client else "unknown"
        now = _time.time()
        path = request.url.path

        # Choose limit
        limit = _RATE_MAX_ORD if (
            path.startswith("/api/v1/orders") and request.method == "POST"
        ) else _RATE_MAX_REQ

        key = f"{ip}:{path if limit == _RATE_MAX_ORD else 'global'}"
        _RATE_LIMITS[key] = [t for t in _RATE_LIMITS[key] if now - t < _RATE_WINDOW]

        if len(_RATE_LIMITS[key]) >= limit:
            from fastapi.responses import JSONResponse as _JR
            return _JR(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": "60"},
            )

        _RATE_LIMITS[key].append(now)
        return await call_next(request)

# ── Payload size limit middleware ─────────────────────────────────────────────
_MAX_BODY_BYTES = 512 * 1024  # 512 KB

class MaxBodySizeMiddleware(_BaseMiddleware):
    async def dispatch(self, request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            cl = request.headers.get("content-length")
            if cl and int(cl) > _MAX_BODY_BYTES:
                from fastapi.responses import JSONResponse as _JR
                return _JR(
                    status_code=413,
                    content={"detail": "Payload too large. Maximum 512 KB."},
                )
        return await call_next(request)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(MaxBodySizeMiddleware)

app.include_router(products_router)
app.include_router(orders_router)
app.include_router(webhook_router)
app.include_router(storefront_router)
app.include_router(analytics_router)


# ===========================================================================
# ROUTES
# ===========================================================================

@app.get("/", tags=["Health"])
async def health_check() -> dict:
    return {
        "status":        "GreenGo API is running",
        "version":       "2.0.0",
        "environment":   _settings.APP_ENV,
        "catalog_items": len(_CATALOG),
    }


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------
@app.get("/api/v1/catalog", response_model=list[CatalogItem], tags=["Catalog"])
async def get_catalog(
    available_only: bool = Query(default=False),
) -> list[CatalogItem]:
    items: list[CatalogItem] = []
    for name, entry in _CATALOG.items():
        is_available = bool(entry.get("available", False))
        if available_only and not is_available:
            continue
        items.append(CatalogItem(
            name           = name,
            price_per_unit = float(entry["price_per_unit"]),
            unit           = str(entry.get("unit", "kg")),
            available      = is_available,
        ))
    items.sort(key=lambda x: (not x.available, x.name))
    return items



@app.patch("/api/v1/catalog", tags=["Catalog"])
async def update_catalog_item(payload: CatalogItemUpdate) -> dict:
    """
    Update price/availability for one product.
    product_name is in the JSON body — never in the URL path —
    so Arabic characters are never percent-encoded.
    """
    product_name = payload.product_name.strip()
    if not product_name:
        raise HTTPException(status_code=400, detail="product_name must not be empty.")
    if product_name not in _CATALOG:
        raise HTTPException(status_code=404, detail=f"Product '{product_name}' not found in catalog.")
    all_none = all(v is None for v in [payload.price_per_unit, payload.available, payload.in_stock, payload.stock_qty])
    if all_none:
        raise HTTPException(status_code=400, detail="Provide at least one field to update.")
    if payload.price_per_unit is not None:
        if payload.price_per_unit < 0:
            raise HTTPException(status_code=400, detail="price_per_unit must be >= 0.")
        _CATALOG[product_name]["yesterday_price"] = _CATALOG[product_name].get("price_per_unit", 0)
        _CATALOG[product_name]["price_per_unit"]  = round(payload.price_per_unit, 2)
    if payload.available is not None:
        _CATALOG[product_name]["available"] = payload.available
    if payload.in_stock is not None:
        _CATALOG[product_name]["in_stock"] = payload.in_stock
    if payload.stock_qty is not None:
        _CATALOG[product_name]["stock_qty"] = payload.stock_qty
    _CATALOG[product_name]["updated_at"] = datetime.now(tz=timezone.utc).isoformat()
    try:
        _persist_catalog()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {
        "message":        "Updated successfully.",
        "product_name":   product_name,
        "price_per_unit": _CATALOG[product_name]["price_per_unit"],
        "available":      _CATALOG[product_name].get("available", True),
        "in_stock":       _CATALOG[product_name].get("in_stock", True),
        "updated_at":     _CATALOG[product_name].get("updated_at", ""),
    }



@app.get("/api/v1/orders", response_model=list[OrderResponse], tags=["Orders"])
async def get_admin_orders(
    status: Optional[str] = Query(default=None),
    limit:  int           = Query(default=50, ge=1, le=500),
) -> list[OrderResponse]:
    try:
        pipeline: list[dict[str, Any]] = []
        if status:
            pipeline.append({"$match": {"status": status}})
        pipeline.extend([{"$sort": {"created_at": -1}}, {"$limit": limit}])
        docs = await whatsapp_orders_col().aggregate(pipeline).to_list(length=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch orders: {exc}")

    results: list[OrderResponse] = []
    for doc in docs:
        try:
            raw_items = doc.get("items") or doc.get("parsed_items") or []
            normalised: list[OrderItemResponse] = []
            for item in raw_items:
                qty = float(item.get("quantity", 0))
                ppu = float(item.get("price_per_unit", 0))
                normalised.append(OrderItemResponse(
                    item_name      = item.get("item_name") or item.get("name") or "",
                    name           = item.get("name")      or item.get("item_name") or "",
                    quantity       = qty,
                    unit           = item.get("unit") or "kg",
                    price_per_unit = ppu,
                    line_total     = round(qty * ppu, 2),
                ))
            results.append(OrderResponse(
                id               = str(doc["_id"]),
                customer_phone   = doc.get("customer_phone", ""),
                customer_name    = doc.get("customer_name", ""),
                delivery_address = doc.get("delivery_address", ""),
                items            = normalised,
                total_price      = float(doc.get("total_price", 0.0)),
                status           = doc.get("status", "pending"),
                created_at       = doc["created_at"],
            ))
        except Exception as exc:
            print(f"WARNING: Skipping malformed doc {doc.get('_id')}: {exc}")
    return results



@app.options("/api/v1/orders/{order_id}/invoice", tags=["Orders"])
async def invoice_preflight(order_id: str):
    from fastapi.responses import Response as FR
    return FR(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

@app.get("/api/v1/orders/{order_id}/invoice", tags=["Orders"])
async def download_invoice(order_id: str):
    """Generate and download a PDF invoice for a given order."""
    import io
    from fastapi.responses import StreamingResponse
    from app.services.pdf_generator import generate_invoice_pdf

    from bson import ObjectId

    # Search orders_col first (website orders), then whatsapp_orders_col (legacy)
    doc = None
    for get_col in [orders_col, whatsapp_orders_col]:
        col = get_col()
        try:
            doc = await col.find_one({"_id": ObjectId(order_id)})
        except Exception:
            pass
        if doc is None:
            try:
                doc = await col.find_one({"_id": order_id})
            except Exception:
                pass
        if doc is not None:
            break
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Order {order_id} not found."
        )

    # Normalise _id and dates for the PDF generator
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    if isinstance(doc.get("updated_at"), datetime):
        doc["updated_at"] = doc["updated_at"].isoformat()

    try:
        pdf_bytes = generate_invoice_pdf(doc)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {exc}"
        )

    short_id = order_id[-8:].upper()
    filename = "GreenGo_Facture_" + short_id + ".pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition":         "attachment; filename=" + filename,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# Legacy routes
# ---------------------------------------------------------------------------
@app.post("/products/", status_code=201, tags=["Legacy"])
async def legacy_create_product(payload: LegacyProductCreate) -> dict:
    result = await products_col().insert_one(payload.model_dump())
    return {"message": "Product created.", "_id": str(result.inserted_id)}


@app.get("/products/", tags=["Legacy"])
async def legacy_list_products() -> list[dict]:
    cursor   = products_col().find({}, {"_id": 1, "name": 1, "price": 1, "category": 1, "stock": 1})
    products = await cursor.to_list(length=200)
    for p in products:
        p["_id"] = str(p["_id"])
    return products


@app.post("/orders/", status_code=201, tags=["Legacy"])
async def legacy_create_order(payload: LegacyOrderCreate) -> dict:
    result = await orders_col().insert_one(payload.model_dump())
    return {"message": "Order created.", "_id": str(result.inserted_id)}


@app.get("/orders/", tags=["Legacy"])
async def legacy_list_orders() -> list[dict]:
    cursor = orders_col().find({}).sort("created_at", -1)
    orders = await cursor.to_list(length=500)
    for o in orders:
        o["_id"] = str(o["_id"])
    return orders


@app.get("/whatsapp-orders/", tags=["Legacy"])
async def legacy_list_whatsapp_orders() -> list[dict]:
    cursor = whatsapp_orders_col().find({}).sort("created_at", -1)
    orders = await cursor.to_list(length=500)
    for o in orders:
        o["_id"] = str(o["_id"])
    return orders


# ---------------------------------------------------------------------------
# Twilio webhook
# ---------------------------------------------------------------------------
@app.post("/webhook/whatsapp", tags=["Webhook"])
async def whatsapp_webhook(
    form: dict = Depends(_validate_twilio_request),
) -> Response:
    sender: str = str(form.get("From", ""))
    body:   str = str(form.get("Body", "")).strip()
    reply = _FALLBACK_REPLY
    try:
        if not body:
            reply = _EMPTY_MSG_REPLY
        else:
            parser_raw          = await _call_gemini(_PARSER_SYSTEM, body)
            parsed_items, total = await _persist_whatsapp_order(sender, body, parser_raw)
            if parsed_items:
                reply = _build_receipt(parsed_items, total)
            else:
                reply = await _call_gemini(_REPLY_SYSTEM, body)
    except Exception as exc:
        print(f"WEBHOOK ERROR: {exc}")
        traceback.print_exc()
        reply = _FALLBACK_REPLY
    twiml = MessagingResponse()
    twiml.message(reply)
    return Response(content=str(twiml), media_type="application/xml")