import os
import json
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GREEN_API_URL             = os.getenv("GREEN_API_URL")
GREEN_API_ID_INSTANCE     = os.getenv("GREEN_API_ID_INSTANCE")
GREEN_API_TOKEN_INSTANCE  = os.getenv("GREEN_API_TOKEN_INSTANCE")

# Quota / transient error strings — treated as warnings, not errors
_QUOTA_STRINGS = (
    "quota",
    "exceeded",
    "limit",
    "rate",
    "too many",
    "unauthorized",
    "blocked",
)

def format_moroccan_number(phone: str) -> str:
    """Convert Moroccan phone number to GREEN-API chatId format."""
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
    if not GREEN_API_URL or not GREEN_API_ID_INSTANCE or not GREEN_API_TOKEN_INSTANCE:
        logger.warning("[WhatsApp] GREEN-API credentials missing in .env — skipping.")
        return False

    endpoint = (
        f"{GREEN_API_URL}/waInstance{GREEN_API_ID_INSTANCE}"
        f"/sendMessage/{GREEN_API_TOKEN_INSTANCE}"
    )
    chat_id = format_moroccan_number(phone)
    payload = {"chatId": chat_id, "message": message}

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

        # Detect quota / rate-limit responses
        body_lower = resp.text.lower()
        is_quota   = any(q in body_lower for q in _QUOTA_STRINGS)

        if is_quota:
            logger.warning(
                "[WhatsApp] Quota/limit reached — message NOT sent to %s. "
                "Response: %s", phone, resp.text[:120]
            )
        else:
            logger.warning(
                "[WhatsApp] Send failed (HTTP %s) to %s. Response: %s",
                resp.status_code, phone, resp.text[:120]
            )
        return False

    except requests.exceptions.Timeout:
        logger.warning("[WhatsApp] Request timed out for %s — skipping.", phone)
        return False
    except requests.exceptions.ConnectionError:
        logger.warning("[WhatsApp] Connection error for %s — skipping.", phone)
        return False
    except Exception as exc:                          # noqa: BLE001
        logger.warning("[WhatsApp] Unexpected error for %s: %s", phone, exc)
        return False
