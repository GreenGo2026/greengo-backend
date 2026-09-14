"""
Customer WhatsApp OTP authentication.

Pattern: mirrors livreur.py -- each auth domain owns its own token issuer,
all reading the same JWT_SECRET, distinguished by the `sub` claim ("admin",
"livreur", "customer"). No new customer-facing exposure: /customers/{phone}
stays admin-gated, /customers/{phone}/public stays public-safe-fields-only
(see customers.py's own docstrings) -- this file only adds a way for a
customer to prove they own a phone number, nothing else changes.
"""
from __future__ import annotations

import asyncio
import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.auth import _jwt_secret
from app.database import customers_col
from app.services.whatsapp import send_whatsapp_message

router = APIRouter(prefix="/api/v1/customers/auth", tags=["Customer Auth"])


def _iso(v) -> str:
    return v.isoformat() if isinstance(v, datetime) else str(v or "")

_BEARER = HTTPBearer(auto_error=False)

# ── Rate limit stores (per-process -- same caveat as every other in-memory
# limiter in this codebase: resets on redeploy, defeated with >1 replica) ────
_OTP_SEND_ATTEMPTS:   dict[str, list[float]] = {}
_OTP_VERIFY_ATTEMPTS: dict[str, list[float]] = {}

_SEND_LIMIT    = 3
_SEND_WINDOW   = 3600     # 1 h
_VERIFY_LIMIT  = 5
_VERIFY_WINDOW = 900      # 15 min
_OTP_TTL_MIN   = 5


def _check_send_limit(phone: str) -> None:
    now = time.time()
    times = [t for t in _OTP_SEND_ATTEMPTS.get(phone, []) if now - t < _SEND_WINDOW]
    if len(times) >= _SEND_LIMIT:
        _OTP_SEND_ATTEMPTS[phone] = times
        raise HTTPException(status_code=429, detail="Trop de demandes. Réessayez dans une heure.")
    times.append(now)
    _OTP_SEND_ATTEMPTS[phone] = times


def _check_verify_limit(phone: str) -> None:
    now = time.time()
    times = [t for t in _OTP_VERIFY_ATTEMPTS.get(phone, []) if now - t < _VERIFY_WINDOW]
    _OTP_VERIFY_ATTEMPTS[phone] = times
    if len(times) >= _VERIFY_LIMIT:
        raise HTTPException(status_code=429, detail="Trop de tentatives. Réessayez dans 15 minutes.")


def _record_verify_fail(phone: str) -> None:
    _OTP_VERIFY_ATTEMPTS.setdefault(phone, []).append(time.time())


def _clear_verify_counter(phone: str) -> None:
    _OTP_VERIFY_ATTEMPTS.pop(phone, None)


def _normalize_phone(raw: str) -> str:
    digits = (raw or "").strip().replace(" ", "").replace("-", "")
    if digits.startswith("+212"):
        return digits
    if digits.startswith("00212"):
        return "+" + digits[2:]
    if digits.startswith("0") and len(digits) == 10:
        return "+212" + digits[1:]
    raise HTTPException(status_code=422, detail="Format de téléphone invalide. Utilisez 06/07 ou +212.")


def _issue_customer_jwt(phone: str) -> str:
    payload = {
        "sub":   "customer",
        "phone": phone,
        "iat":   datetime.now(tz=timezone.utc),
        "exp":   datetime.now(tz=timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def verify_customer_jwt(token: str) -> str:
    """Returns the normalized phone if the token is a valid customer JWT,
    raises 401 otherwise. Exported for other routers (e.g. orders.py) that
    want to softly gate a feature on customer identity without a hard
    Depends() -- see the loyalty-redemption gate in orders.py."""
    try:
        data = jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
        if data.get("sub") != "customer":
            raise ValueError("wrong sub")
        phone = data.get("phone")
        if not phone:
            raise ValueError("no phone")
        return phone
    except Exception:
        raise HTTPException(status_code=401, detail="Session expirée. Reconnectez-vous.")


async def require_customer(
    credentials: HTTPAuthorizationCredentials | None = Security(_BEARER),
) -> str:
    """FastAPI dependency for routes that must be logged-in-customer only."""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Authentification requise.")
    return verify_customer_jwt(credentials.credentials)


@router.get("/me", summary="Authenticated customer's own profile")
async def get_my_profile(phone: str = Depends(require_customer)) -> dict:
    """Self-serve profile pull for a verified session. Distinct from
    GET /customers/{phone}/public (which trusts the phone as typed, no proof
    of ownership) -- this one is keyed off the JWT, not the request."""
    doc = await customers_col().find_one({"phone": phone})
    if not doc:
        raise HTTPException(status_code=404, detail="Profil introuvable.")
    return {
        "phone":         doc.get("phone", phone),
        "name":          doc.get("name", ""),
        "last_address":  doc.get("last_address", ""),
        "total_points":  doc.get("total_points", 0),
        "total_orders":  doc.get("total_orders", 0),
        "total_spent":   doc.get("total_spent", 0.0),
        "referral_code": doc.get("referral_code", ""),
        "segment":       doc.get("segment", ""),
        "first_order":   _iso(doc.get("first_order")),
        "last_order":    _iso(doc.get("last_order")),
    }


def _otp_expired(expires_at) -> bool:
    if not isinstance(expires_at, datetime):
        return True
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return datetime.now(tz=timezone.utc) > expires_at


# ── Request OTP ───────────────────────────────────────────────────────────────

class OTPRequestPayload(BaseModel):
    phone: str


@router.post("/request-otp", summary="Send a 6-digit WhatsApp OTP to a phone")
async def request_otp(payload: OTPRequestPayload) -> dict:
    phone = _normalize_phone(payload.phone)
    _check_send_limit(phone)

    otp = str(secrets.randbelow(900_000) + 100_000)
    otp_hash = hashlib.sha256(otp.encode()).hexdigest()
    expires = datetime.now(tz=timezone.utc) + timedelta(minutes=_OTP_TTL_MIN)

    await customers_col().update_one(
        {"phone": phone},
        {"$set": {
            "phone":          phone,
            "otp_hash":       otp_hash,
            "otp_expires_at": expires,
        }},
        upsert=True,
    )

    message = (
        f"مرحباً 👋\n\n"
        f"كود التحقق الخاص بك في GreenGo Market:\n\n"
        f"*{otp}*\n\n"
        f"صالح لمدة {_OTP_TTL_MIN} دقائق. لا تشاركه مع أحد."
    )
    # send_whatsapp_message is sync (requests) -- keep it off the event loop.
    wa_sent = await asyncio.to_thread(send_whatsapp_message, phone, message)

    return {"sent": True, "phone": phone, "whatsapp_sent": bool(wa_sent)}


# ── Verify OTP ────────────────────────────────────────────────────────────────

class OTPVerifyPayload(BaseModel):
    phone: str
    otp: str = Field(min_length=6, max_length=6)


@router.post("/verify-otp", summary="Verify the OTP and issue a 30-day customer JWT")
async def verify_otp(payload: OTPVerifyPayload) -> dict:
    phone = _normalize_phone(payload.phone)
    _check_verify_limit(phone)

    col = customers_col()
    doc = await col.find_one({"phone": phone})
    if not doc or not doc.get("otp_hash"):
        raise HTTPException(status_code=400, detail="Aucun code en attente pour ce numéro.")

    if _otp_expired(doc.get("otp_expires_at")):
        raise HTTPException(status_code=400, detail="Code expiré. Demandez un nouveau code.")

    submitted_hash = hashlib.sha256(payload.otp.encode()).hexdigest()
    if not secrets.compare_digest(submitted_hash, doc["otp_hash"]):
        _record_verify_fail(phone)
        raise HTTPException(status_code=400, detail="Code incorrect.")

    await col.update_one(
        {"phone": phone},
        {
            "$unset": {"otp_hash": "", "otp_expires_at": ""},
            "$set":   {"otp_verified": True, "last_login": datetime.now(tz=timezone.utc)},
        },
    )
    _clear_verify_counter(phone)

    token = _issue_customer_jwt(phone)
    public = {
        "phone":         doc.get("phone", phone),
        "name":          doc.get("name", ""),
        "last_address":  doc.get("last_address", ""),
        "total_points":  doc.get("total_points", 0),
        "total_orders":  doc.get("total_orders", 0),
        "referral_code": doc.get("referral_code", ""),
    }
    return {"token": token, "customer": public}
