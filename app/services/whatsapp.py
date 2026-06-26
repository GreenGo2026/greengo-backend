import os
import json
import logging
import requests

logger = logging.getLogger(__name__)

# ── Credentials — read from Railway env vars (GREENAPI_* naming) ─────────────
# Also accept legacy GREEN_API_* names for backwards compat with old .env files.
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
_BASE_URL = os.getenv("GREEN_API_URL", "https://api.green-api.com").rstrip("/")

_QUOTA_STRINGS = ("quota", "exceeded", "limit", "rate", "too many", "unauthorized", "blocked")


def format_moroccan_number(phone: str) -> str:
    """Convert Moroccan phone number to Green-API chatId format (212XXXXXXXXX@c.us)."""
    clean = "".join(filter(str.isdigit, phone))
    if clean.startswith("0"):
        clean = "212" + clean[1:]
    elif not clean.startswith("212"):
        clean = "212" + clean
    return f"{clean}@c.us"


def send_whatsapp_message(phone: str, message: str) -> bool:
    """
    Send a WhatsApp message via Green-API.
    Never raises — always returns bool.
    Quota / API errors are logged as WARNING so the server continues normally.
    """
    if not _INSTANCE_ID or not _TOKEN:
        logger.warning(
            "[WhatsApp] GREENAPI_INSTANCE_ID / GREENAPI_TOKEN missing — skipping send."
        )
        return False

    endpoint = f"{_BASE_URL}/waInstance{_INSTANCE_ID}/sendMessage/{_TOKEN}"
    chat_id  = format_moroccan_number(phone)
    payload  = {"chatId": chat_id, "message": message}

    try:
        resp = requests.post(
            endpoint,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            timeout=10,
        )

        if resp.status_code == 200:
            logger.info("[WhatsApp] Message sent to %s", phone)
            return True

        body_lower = resp.text.lower()
        is_quota   = any(q in body_lower for q in _QUOTA_STRINGS)

        if is_quota:
            logger.warning(
                "[WhatsApp] Quota/limit reached — message NOT sent to %s. Response: %s",
                phone, resp.text[:120],
            )
        else:
            logger.warning(
                "[WhatsApp] Send failed (HTTP %s) to %s. Response: %s",
                resp.status_code, phone, resp.text[:120],
            )
        return False

    except requests.exceptions.Timeout:
        logger.warning("[WhatsApp] Request timed out for %s — skipping.", phone)
        return False
    except requests.exceptions.ConnectionError:
        logger.warning("[WhatsApp] Connection error for %s — skipping.", phone)
        return False
    except Exception as exc:
        logger.warning("[WhatsApp] Unexpected error for %s: %s", phone, exc)
        return False
