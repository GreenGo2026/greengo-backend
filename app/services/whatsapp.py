"""
Green-API WhatsApp service.

Public functions (all sync, never raise):
  send_whatsapp_message(phone, text)          — plain text to any number
  send_file_by_url(phone, url, name, caption) — image/file with caption
  notify_customer_order(...)                  — rich confirmation to customer
  notify_admin_new_order(...)                 — full order alert to admin
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)

# ── Credentials — accept both old and new env var names ──────────────────────
_INSTANCE_ID = (
    os.getenv("GREENAPI_INSTANCE_ID")
    or os.getenv("GREEN_API_ID_INSTANCE")
    or ""
)
_TOKEN = (
    os.getenv("GREENAPI_TOKEN")
    or os.getenv("GREEN_API_TOKEN_INSTANCE")
    or ""
)
_BASE = (os.getenv("GREEN_API_URL") or "https://api.green-api.com").rstrip("/")
_ADMIN_PHONE = os.getenv("ADMIN_WHATSAPP_PHONE", "")

_TIMEOUT = 12

# ── Internal helpers ──────────────────────────────────────────────────────────

def _chat_id(phone: str) -> str:
    """Convert any Moroccan phone format to Green-API chatId (212XXXXXXXXX@c.us)."""
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 10:
        digits = "212" + digits[1:]
    elif not digits.startswith("212"):
        digits = "212" + digits
    return f"{digits}@c.us"


def _ready() -> bool:
    if not _INSTANCE_ID or not _TOKEN:
        logger.warning("[WA] GREENAPI_INSTANCE_ID / GREENAPI_TOKEN not set — skipping.")
        return False
    return True


def _post(endpoint: str, payload: dict[str, Any]) -> bool:
    url = f"{_BASE}/waInstance{_INSTANCE_ID}/{endpoint}/{_TOKEN}"
    try:
        r = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            timeout=_TIMEOUT,
        )
        if r.status_code == 200:
            return True
        logger.warning("[WA] %s HTTP %s — %s", endpoint, r.status_code, r.text[:120])
        return False
    except requests.exceptions.Timeout:
        logger.warning("[WA] %s timeout.", endpoint)
        return False
    except Exception as exc:
        logger.warning("[WA] %s error: %s", endpoint, exc)
        return False


# ── Public API ────────────────────────────────────────────────────────────────

def format_moroccan_number(phone: str) -> str:
    """Kept for backwards compat with callers that import this."""
    return _chat_id(phone)


def send_whatsapp_message(phone: str, message: str) -> bool:
    """Send a plain text WhatsApp message. Never raises."""
    if not _ready():
        return False
    return _post("sendMessage", {"chatId": _chat_id(phone), "message": message})


def send_file_by_url(phone: str, url: str, filename: str, caption: str = "") -> bool:
    """Send an image or file by public URL with an optional caption."""
    if not _ready():
        return False
    return _post("sendFileByUrl", {
        "chatId":   _chat_id(phone),
        "urlFile":  url,
        "fileName": filename,
        "caption":  caption,
    })


# ── Order notifications ───────────────────────────────────────────────────────

def notify_customer_order(
    *,
    phone: str,
    customer_name: str,
    order_id: str,
    items: list[dict[str, Any]],
    total: float,
    address: str,
    earned_points: int,
    total_points: int,
) -> None:
    """
    Rich order confirmation to the customer.
    Includes product list, total, delivery address, and loyalty points.
    """
    short_id = order_id[-6:].upper()

    lines: list[str] = []
    for it in items:
        qty  = it.get("quantity", 0)
        unit = it.get("unit", "kg")
        name = it.get("name", "")
        price_per = it.get("price_per_unit", 0.0)
        line = it.get("line_total") or round(qty * price_per, 2)
        lines.append(f"   ▪ {name} × {qty} {unit} — {line:.2f} MAD")

    products_block = "\n".join(lines) if lines else "   —"

    msg = (
        f"🟢 مرحباً {customer_name}!\n\n"
        f"شكراً لاختيارك GreenGo Market 🛒\n"
        f"رقم طلبك: #{short_id}\n\n"
        f"📦 *تفاصيل طلبك:*\n"
        f"{products_block}\n\n"
        f"💰 إجمالي الطلب: *{total:.2f} MAD*\n"
        f"📍 عنوان التوصيل: {address}\n"
        f"⏳ الحالة: قيد الانتظار (Pending)\n\n"
        f"⭐ نقاط الولاء المكتسبة: +{earned_points} نقطة\n"
        f"💰 رصيد نقاطك الإجمالي: {total_points} نقطة\n"
        f"   (كل 10 درهم = نقطة واحدة)\n\n"
        f"سنتواصل معك قريباً للتوصيل. بالصحة والراحة! 🌿"
    )
    send_whatsapp_message(phone, msg)


def notify_admin_new_order(
    *,
    order_id: str,
    customer_name: str,
    customer_phone: str,
    address: str,
    gps: dict[str, float] | None,
    items: list[dict[str, Any]],
    total: float,
) -> None:
    """
    Send new-order alert to the admin WhatsApp number.
    Sends a text summary first, then one image per product (max 6) with price caption.
    """
    admin_phone = _ADMIN_PHONE
    if not admin_phone:
        logger.warning("[WA] ADMIN_WHATSAPP_PHONE not set — skipping admin notification.")
        return

    short_id  = order_id[-6:].upper()
    now_str   = datetime.now(tz=timezone.utc).strftime("%H:%M | %d/%m/%Y")

    # GPS link
    gps_line = ""
    if gps and gps.get("lat") and gps.get("lng"):
        gps_line = f"\n   📍 GPS: https://maps.google.com/?q={gps['lat']},{gps['lng']}"

    # Product lines
    product_lines: list[str] = []
    for it in items:
        qty   = it.get("quantity", 0)
        unit  = it.get("unit", "")
        name  = it.get("name", "")
        ppu   = it.get("price_per_unit", 0.0)
        total_line = it.get("line_total") or round(qty * ppu, 2)
        product_lines.append(f"   ▪ {name} × {qty} {unit} — {total_line:.2f} MAD")

    products_block = "\n".join(product_lines) if product_lines else "   —"

    text = (
        f"🛒 *طلب جديد — GreenGo Market* 🟢\n\n"
        f"👤 *العميل:*\n"
        f"   Nom: {customer_name}\n"
        f"   Tél: {customer_phone}\n"
        f"   Adresse: {address}"
        f"{gps_line}\n\n"
        f"📦 *المنتجات:*\n"
        f"{products_block}\n\n"
        f"💰 *المجموع: {total:.2f} MAD*\n"
        f"🔢 Commande: #{short_id}\n"
        f"🕐 {now_str}"
    )
    send_whatsapp_message(admin_phone, text)

    # Send product images (max 6, only items that have image_url)
    sent = 0
    for it in items:
        if sent >= 6:
            break
        img_url = (it.get("image_url") or "").strip()
        if not img_url:
            continue
        name    = it.get("name", "Produit")
        ppu     = it.get("price_per_unit", 0.0)
        unit    = it.get("unit", "")
        caption = f"{name} — {ppu:.2f} MAD/{unit}"
        time.sleep(0.5)  # avoid Green-API rate limit between rapid sends
        send_file_by_url(admin_phone, img_url, f"{name}.jpg", caption)
        sent += 1
