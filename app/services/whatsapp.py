"""
Green-API WhatsApp service.

Public functions (all sync, never raise):
  send_whatsapp_message(phone, text)          — plain text to any number
  send_file_by_url(phone, url, name, caption) — image/file with caption
  notify_customer_order(...)                  — builds + sends customer confirmation
  notify_admin_new_order(...)                 — builds + sends admin alert
  build_customer_order_message(...)           — pure text builder (no I/O), for logging/retry
  build_admin_order_message(...)              — pure text builder (no I/O), for logging/retry
"""
from __future__ import annotations

import json
import logging
import os
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

def build_customer_order_message(
    *,
    customer_name: str,
    order_id: str,
    items: list[dict[str, Any]],
    subtotal: float,
    delivery_zone: str,
    delivery_fee: float,
    total: float,
    address: str,
    earned_points: int,
    total_points: int,
) -> str:
    """
    Pure text builder for the rich order confirmation sent to the customer --
    no I/O. Extracted from notify_customer_order() so the exact text can be
    logged (and retried) rather than just a summary.
    """
    short_id = order_id[-6:].upper()

    lines: list[str] = []
    for it in items:
        qty  = it.get("quantity", 0)
        unit = it.get("unit", "kg")
        name = it.get("name", "")
        variant = it.get("variant_label")
        if variant:
            name = f"{name} ({variant})"
        price_per = it.get("price_per_unit", 0.0)
        line = it.get("line_total") or round(qty * price_per, 2)
        lines.append(f"   ▪ {name} × {qty} {unit} — {line:.2f} MAD")

    products_block = "\n".join(lines) if lines else "   —"
    delivery_line = (
        "🚚 التوصيل: مجاني" if delivery_fee == 0
        else f"🚚 التوصيل ({delivery_zone}): {delivery_fee:.2f} MAD"
    )

    return (
        f"🟢 مرحباً {customer_name}!\n\n"
        f"شكراً لاختيارك GreenGo Market 🛒\n"
        f"رقم طلبك: #{short_id}\n\n"
        f"📦 *تفاصيل طلبك:*\n"
        f"{products_block}\n\n"
        f"💵 المجموع الفرعي: {subtotal:.2f} MAD\n"
        f"{delivery_line}\n"
        f"💰 إجمالي الطلب: *{total:.2f} MAD*\n"
        f"📍 عنوان التوصيل: {address}\n"
        f"⏳ الحالة: قيد الانتظار (Pending)\n\n"
        f"⭐ نقاط الولاء المكتسبة: +{earned_points} نقطة\n"
        f"💰 رصيد نقاطك الإجمالي: {total_points} نقطة\n"
        f"   (كل 10 درهم = نقطة واحدة)\n\n"
        f"🔍 تتبع طلبيتك: https://www.mygreengoo.com/suivi-commande?ref={short_id}\n\n"
        f"سنتواصل معك قريباً للتوصيل. بالصحة والراحة! 🌿"
    )


def notify_customer_order(
    *,
    phone: str,
    customer_name: str,
    order_id: str,
    items: list[dict[str, Any]],
    subtotal: float,
    delivery_zone: str,
    delivery_fee: float,
    total: float,
    address: str,
    earned_points: int,
    total_points: int,
) -> bool:
    """
    Rich order confirmation to the customer.
    Includes product list, subtotal, delivery fee, total, address, and loyalty points.
    """
    msg = build_customer_order_message(
        customer_name=customer_name,
        order_id=order_id,
        items=items,
        subtotal=subtotal,
        delivery_zone=delivery_zone,
        delivery_fee=delivery_fee,
        total=total,
        address=address,
        earned_points=earned_points,
        total_points=total_points,
    )
    return send_whatsapp_message(phone, msg)


def build_admin_order_message(
    *,
    order_id: str,
    customer_name: str,
    customer_phone: str,
    address: str,
    gps: dict[str, float] | None,
    items: list[dict[str, Any]],
    subtotal: float,
    delivery_zone: str,
    delivery_fee: float,
    total: float,
) -> str:
    """
    Pure text builder for the new-order alert sent to the admin -- no I/O.
    Extracted from notify_admin_new_order() so the exact text can be logged
    (and retried) rather than just a summary.
    """
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
        variant = it.get("variant_label")
        if variant:
            name = f"{name} ({variant})"
        ppu   = it.get("price_per_unit", 0.0)
        total_line = it.get("line_total") or round(qty * ppu, 2)
        product_lines.append(f"   ▪ {name} × {qty} {unit} — {total_line:.2f} MAD")

    products_block = "\n".join(product_lines) if product_lines else "   —"
    delivery_line = (
        f"🚚 Livraison ({delivery_zone}): "
        + ("Gratuite" if delivery_fee == 0 else f"{delivery_fee:.2f} MAD")
    )

    return (
        f"🛒 *طلب جديد — GreenGo Market* 🟢\n\n"
        f"👤 *العميل:*\n"
        f"   Nom: {customer_name}\n"
        f"   Tél: {customer_phone}\n"
        f"   Adresse: {address}"
        f"{gps_line}\n\n"
        f"📦 *المنتجات:*\n"
        f"{products_block}\n\n"
        f"🧾 Sous-total: {subtotal:.2f} MAD\n"
        f"{delivery_line}\n"
        f"💰 *Total: {total:.2f} MAD*\n"
        f"   (dont livraison: {delivery_fee:.2f} MAD)\n"
        f"🔢 Commande: #{short_id}\n"
        f"🕐 {now_str}"
    )


def build_referral_code_message(customer_name: str, code: str) -> str:
    """Pure text builder -- announces a newly-issued referral code to its owner."""
    return (
        f"🎁 مبروك {customer_name}!\n\n"
        f"معك دابا كود الإحالة ديالك: *{code}*\n\n"
        f"شارك هاد الكود مع صحابك — كل واحد كيطلب لأول مرة بالكود ديالك كيربح "
        f"-15 درهم على الطلبية ديالو، وانت كتربح +50 نقطة ولاء 🎉\n\n"
        f"شارك دابا: https://mygreengoo.com/?ref={code}"
    )


def build_referral_reward_message(new_total_points: int) -> str:
    """Pure text builder -- tells a referrer their code was just used."""
    return (
        f"🎉 صاحبك طلب بالكود ديالك — ربحتي +50 نقطة!\n\n"
        f"💰 رصيدك الجديد: {new_total_points} نقطة\n"
        f"شكراً على الثقة 🌿 GreenGo Market"
    )


def notify_admin_new_order(
    *,
    order_id: str,
    customer_name: str,
    customer_phone: str,
    address: str,
    gps: dict[str, float] | None,
    items: list[dict[str, Any]],
    subtotal: float,
    delivery_zone: str,
    delivery_fee: float,
    total: float,
) -> bool:
    """
    Send new-order alert to the admin WhatsApp number.
    Sends a text summary first, then one image per product (max 6) with price caption.
    """
    admin_phone = _ADMIN_PHONE
    if not admin_phone:
        logger.warning("[WA] ADMIN_WHATSAPP_PHONE not set — skipping admin notification.")
        return False

    text = build_admin_order_message(
        order_id=order_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        address=address,
        gps=gps,
        items=items,
        subtotal=subtotal,
        delivery_zone=delivery_zone,
        delivery_fee=delivery_fee,
        total=total,
    )
    return send_whatsapp_message(admin_phone, text)
