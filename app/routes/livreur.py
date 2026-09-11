"""
Livreur (driver) portal + admin driver management.

Two routers live here:
  * admin_drivers_router -- /api/v1/admin/drivers/*  (admin auth)
  * livreur_router       -- /api/v1/livreur/*        (driver PIN JWT)

Auth model: drivers log in with a PIN and no username, so the server has to
identify the driver *from the PIN alone*. That has three consequences the code
below deals with explicitly:

  1. Login scans active drivers and bcrypt-checks each -- O(active drivers).
     Fine for a handful of drivers; it is not a design that scales to hundreds.
  2. Two drivers sharing a PIN would make login ambiguous, so a colliding PIN
     is rejected at creation time rather than resolved arbitrarily at login.
  3. A PIN is the entire credential, so it is rate-limited per IP and a
     minimum length is enforced (see _MIN_PIN_LENGTH).

Driver tokens carry sub="livreur", never "admin". app/auth.py's _verify_jwt
requires sub == "admin", so a driver token is rejected by require_admin on
every admin endpoint (and every admin-guarded orders write) without any extra
middleware. That property is load-bearing for the brief's isolation
requirement -- do not relax the sub check in either place.
"""
from __future__ import annotations

import asyncio
import os
import re
import secrets
import time
from collections import defaultdict
from datetime import datetime, time as dtime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt as pyjwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.auth import client_ip as _client_ip, require_admin
from app.database import drivers_col, orders_col
from app.services.whatsapp import send_whatsapp_message

admin_drivers_router = APIRouter(prefix="/api/v1/admin/drivers", tags=["Admin - Drivers"])
livreur_router       = APIRouter(prefix="/api/v1/livreur",       tags=["Livreur"])

_BEARER = HTTPBearer(auto_error=False)

# ── Credential policy ─────────────────────────────────────────────────────────
# The brief did not specify a PIN length. Enforcing 6 digits rather than the
# conventional 4 is deliberate: with no username, a 4-digit PIN is a 10k
# keyspace guessable in minutes even behind rate limiting. 6 digits plus the
# limiter below is defensible; raise it further if drivers tolerate it.
_MIN_PIN_LENGTH = 6
_MAX_PIN_LENGTH = 12
_PIN_PATTERN    = re.compile(rf"^\d{{{_MIN_PIN_LENGTH},{_MAX_PIN_LENGTH}}}$")

# bcrypt cost. Login bcrypt-checks every active driver, so cost multiplies by
# driver count -- 10 keeps a scan of ~10 drivers well under a second while
# staying far above an unsalted digest.
_BCRYPT_ROUNDS = 10

_TOKEN_TTL_HOURS = 4

# ── PIN login rate limiting ───────────────────────────────────────────────────
# Deliberately a separate namespace from app/auth.py's admin login counters:
# sharing them would let a driver fat-fingering a PIN hard-block the admin
# login from the same IP (shop wifi), and vice versa.
_PIN_SOFT_LIMIT  = int(os.getenv("LIVREUR_PIN_SOFT_LIMIT",  "5"))
_PIN_SOFT_WINDOW = int(os.getenv("LIVREUR_PIN_SOFT_WINDOW", "300"))    # 5 min
_PIN_HARD_LIMIT  = int(os.getenv("LIVREUR_PIN_HARD_LIMIT",  "12"))
_PIN_HARD_WINDOW = int(os.getenv("LIVREUR_PIN_HARD_WINDOW", "3600"))   # 1 h
_PIN_BAN_SECONDS = int(os.getenv("LIVREUR_PIN_BAN_SECONDS", "3600"))   # 1 h

# ── Self-registration rate limiting ───────────────────────────────────────────
# POST /livreur/register is public and writes a DB row an admin later acts on;
# an unbounded endpoint is an abuse vector (spam pending requests). Light cap.
_REG_LIMIT   = int(os.getenv("LIVREUR_REG_LIMIT",  "3"))
_REG_WINDOW  = int(os.getenv("LIVREUR_REG_WINDOW", "3600"))   # 1 h
_REG_ATTEMPTS: dict[str, list[float]] = defaultdict(list)


def _check_register_rate_limit(ip: str) -> None:
    now = time.time()
    _REG_ATTEMPTS[ip] = [t for t in _REG_ATTEMPTS[ip] if now - t < _REG_WINDOW]
    if len(_REG_ATTEMPTS[ip]) >= _REG_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de demandes. Réessayez dans une heure.",
        )
    _REG_ATTEMPTS[ip].append(now)

_PIN_FAILURES: dict[str, list[float]] = defaultdict(list)
_PIN_BANNED:   dict[str, float]       = {}


def _check_pin_rate_limit(ip: str) -> None:
    now = time.time()
    if ip in _PIN_BANNED:
        if now < _PIN_BANNED[ip]:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de tentatives. Réessayez plus tard.",
            )
        del _PIN_BANNED[ip]

    _PIN_FAILURES[ip] = [t for t in _PIN_FAILURES[ip] if now - t < _PIN_HARD_WINDOW]
    recent = [t for t in _PIN_FAILURES[ip] if now - t < _PIN_SOFT_WINDOW]
    if len(recent) >= _PIN_SOFT_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de tentatives. Réessayez dans 5 minutes.",
        )


def _record_pin_failure(ip: str) -> None:
    now = time.time()
    _PIN_FAILURES[ip].append(now)
    if len(_PIN_FAILURES[ip]) >= _PIN_HARD_LIMIT:
        _PIN_BANNED[ip] = now + _PIN_BAN_SECONDS


# ── PIN hashing ───────────────────────────────────────────────────────────────
# bcrypt directly rather than through passlib: this project's passlib version
# (1.7.4) cannot drive bcrypt 5.x -- its backend reads bcrypt.__about__, which
# bcrypt removed, so CryptContext(schemes=["bcrypt"]) raises on first use.

def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode("utf-8")


def verify_pin(pin: str, pin_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("utf-8"))
    except Exception:
        # Malformed/legacy hash -- never let it authenticate.
        return False


def _validate_pin(pin: str) -> str:
    pin = (pin or "").strip()
    if not _PIN_PATTERN.match(pin):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Le PIN doit contenir entre {_MIN_PIN_LENGTH} et {_MAX_PIN_LENGTH} chiffres."
            ),
        )
    return pin


# ── JWT ───────────────────────────────────────────────────────────────────────

def _jwt_secret() -> str:
    s = os.getenv("JWT_SECRET", "")
    if not s:
        raise RuntimeError("JWT_SECRET is not set — check your environment variables.")
    return s


def issue_livreur_jwt(driver_id: str, name: str) -> tuple[str, int]:
    """Returns (token, expires_in_seconds). sub is 'livreur', never 'admin'."""
    now = datetime.now(tz=timezone.utc)
    ttl = timedelta(hours=_TOKEN_TTL_HOURS)
    payload = {
        "sub":       "livreur",
        "role":      "livreur",
        "driver_id": driver_id,
        "name":      name,
        "iat":       now,
        "exp":       now + ttl,
    }
    return pyjwt.encode(payload, _jwt_secret(), algorithm="HS256"), int(ttl.total_seconds())


class LivreurIdentity(BaseModel):
    driver_id: str
    name:      str


async def require_livreur(
    credentials: HTTPAuthorizationCredentials | None = Security(_BEARER),
) -> LivreurIdentity:
    """
    Authenticates a driver token and returns its identity.

    Rejects admin tokens too: an endpoint scoped to "the driver named in the
    token" has no meaning for an admin token, which carries no driver_id.
    Admins act through the admin endpoints instead.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session livreur requise.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = pyjwt.decode(credentials.credentials, _jwt_secret(), algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée. Reconnectez-vous.")
    except Exception:
        raise HTTPException(status_code=401, detail="Session invalide.")

    if payload.get("sub") != "livreur" or payload.get("role") != "livreur":
        raise HTTPException(status_code=403, detail="Ce token n'est pas un token livreur.")

    driver_id = str(payload.get("driver_id") or "")
    if not driver_id:
        raise HTTPException(status_code=401, detail="Session invalide.")

    # A deactivated driver's in-flight token must stop working immediately --
    # otherwise firing a driver leaves them up to 4h of access.
    try:
        driver = await drivers_col().find_one(
            {"_id": ObjectId(driver_id)}, {"_id": 1, "name": 1, "active": 1}
        )
    except (InvalidId, TypeError):
        raise HTTPException(status_code=401, detail="Session invalide.")
    if not driver or not driver.get("active", False):
        raise HTTPException(status_code=403, detail="Compte livreur désactivé.")

    return LivreurIdentity(driver_id=driver_id, name=str(driver.get("name") or payload.get("name") or ""))


# ── Payloads ──────────────────────────────────────────────────────────────────

class CreateDriverPayload(BaseModel):
    name:  str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=6, max_length=20)
    pin:   str


class UpdateDriverPayload(BaseModel):
    active: bool | None = None
    name:   str | None  = Field(default=None, min_length=2, max_length=80)
    pin:    str | None  = None


class LivreurAuthPayload(BaseModel):
    pin: str


class DriverRegistrationRequest(BaseModel):
    name:         str = Field(min_length=2, max_length=80)
    phone:        str = Field(min_length=6, max_length=20)
    vehicle_type: Literal["moto", "vélo", "voiture"]


# ── Admin: driver management ──────────────────────────────────────────────────

def _mask_cin(cin: str) -> str:
    """Last 4 digits only. Full CIN is PII -- admin reveals it explicitly."""
    cin = (cin or "").strip()
    if len(cin) < 4:
        return "••••"
    return "•" * (len(cin) - 4) + cin[-4:]


def _driver_public(doc: dict[str, Any]) -> dict[str, Any]:
    """Never leaks pin_hash. CIN is masked -- full value only via the
    dedicated reveal endpoint."""
    return {
        "id":           str(doc["_id"]),
        "name":         doc.get("name") or "",
        "phone":        doc.get("phone") or "",
        "active":       bool(doc.get("active", False)),
        # Legacy docs predate the status field -- an existing driver is active.
        "status":       doc.get("status") or ("active" if doc.get("active") else "inactive"),
        "vehicle_type": doc.get("vehicle_type") or "",
        "cin_masked":   _mask_cin(doc.get("cin") or ""),
        "created_at":   (doc["created_at"].isoformat()
                         if isinstance(doc.get("created_at"), datetime) else None),
        "activated_at": (doc["activated_at"].isoformat()
                         if isinstance(doc.get("activated_at"), datetime) else None),
    }


@admin_drivers_router.get("", summary="List drivers")
async def list_drivers(
    status: Literal["pending", "active", "inactive", "rejected"] | None = None,
    _: None = Depends(require_admin),
) -> list[dict[str, Any]]:
    query: dict[str, Any] = {}
    if status == "active":
        # Legacy docs (no status field) are active if their flag is set.
        query = {"$or": [{"status": "active"}, {"status": {"$exists": False}, "active": True}]}
    elif status == "inactive":
        query = {"$or": [{"status": "inactive"},
                         {"status": {"$exists": False}, "active": {"$ne": True}}]}
    elif status is not None:
        query = {"status": status}

    docs = await drivers_col().find(query).sort("created_at", -1).to_list(length=200)
    return [_driver_public(d) for d in docs]


@admin_drivers_router.get("/{driver_id}/cin", summary="Reveal a driver's full CIN")
async def reveal_driver_cin(
    driver_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    try:
        oid = ObjectId(driver_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Identifiant livreur invalide.")
    doc = await drivers_col().find_one({"_id": oid}, {"cin": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Livreur introuvable.")
    return {"cin": doc.get("cin") or ""}


@admin_drivers_router.post("", status_code=201, summary="Create a driver")
async def create_driver(
    payload: CreateDriverPayload,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    pin   = _validate_pin(payload.pin)
    col   = drivers_col()
    phone = payload.phone.strip()
    now   = datetime.now(tz=timezone.utc)

    if await col.find_one({"phone": phone}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="Un livreur avec ce téléphone existe déjà.")

    # PIN-only login means a duplicate PIN makes login ambiguous. Reject here
    # rather than pick a winner at login time. Only active drivers matter --
    # an inactive driver can't log in, so its PIN can be reused.
    async for existing in col.find({"active": True}, {"pin_hash": 1}):
        if verify_pin(pin, existing.get("pin_hash") or ""):
            raise HTTPException(
                status_code=409,
                detail="Ce PIN est déjà utilisé par un autre livreur actif. Choisissez-en un autre.",
            )

    doc = {
        "name":             payload.name.strip(),
        "phone":            phone,
        "pin_hash":         hash_pin(pin),
        "active":           True,
        "created_by_admin": True,
        "created_at":       now,
        "updated_at":       now,
    }
    result = await col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _driver_public(doc)


@admin_drivers_router.patch("/{driver_id}", summary="Activate/deactivate or update a driver")
async def update_driver(
    driver_id: str,
    payload: UpdateDriverPayload,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    col = drivers_col()
    try:
        oid = ObjectId(driver_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Identifiant livreur invalide.")

    updates: dict[str, Any] = {"updated_at": datetime.now(tz=timezone.utc)}
    if payload.active is not None:
        updates["active"] = payload.active
        # Keep status in step so the ?status= filter and the admin UI agree.
        updates["status"] = "active" if payload.active else "inactive"
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.pin is not None:
        new_pin = _validate_pin(payload.pin)
        async for existing in col.find({"active": True, "_id": {"$ne": oid}}, {"pin_hash": 1}):
            if verify_pin(new_pin, existing.get("pin_hash") or ""):
                raise HTTPException(
                    status_code=409,
                    detail="Ce PIN est déjà utilisé par un autre livreur actif.",
                )
        updates["pin_hash"] = hash_pin(new_pin)

    if len(updates) == 1:  # only updated_at
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour.")

    doc = await col.find_one_and_update({"_id": oid}, {"$set": updates}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Livreur introuvable.")
    return _driver_public(doc)


@admin_drivers_router.post("/{driver_id}/validate", summary="Approve a pending driver: issue a PIN and WhatsApp it")
async def validate_driver(
    driver_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    col = drivers_col()
    try:
        oid = ObjectId(driver_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Identifiant livreur invalide.")

    driver = await col.find_one({"_id": oid})
    if not driver:
        raise HTTPException(status_code=404, detail="Livreur introuvable.")
    if driver.get("status") == "active" or driver.get("active"):
        # Idempotency guard: a double-click must not mint a second PIN and
        # send a second WhatsApp. The first PIN is already gone (only its hash
        # is stored), so there's nothing to return -- the admin re-issues via
        # the PATCH pin endpoint if the driver never got it.
        raise HTTPException(status_code=409, detail="Ce livreur est déjà actif.")

    # 6-digit PIN, regenerated on the (rare) collision with an active driver.
    pin = ""
    for _attempt in range(10):
        candidate = str(secrets.randbelow(900_000) + 100_000)
        clash = False
        async for other in col.find({"active": True}, {"pin_hash": 1}):
            if verify_pin(candidate, other.get("pin_hash") or ""):
                clash = True
                break
        if not clash:
            pin = candidate
            break
    if not pin:
        raise HTTPException(status_code=500, detail="Impossible de générer un PIN unique. Réessayez.")

    now = datetime.now(tz=timezone.utc)
    await col.update_one(
        {"_id": oid},
        {"$set": {
            "active":       True,
            "status":       "active",
            "pin_hash":     hash_pin(pin),
            "activated_at": now,
            "updated_at":   now,
        }},
    )

    message = (
        f"مرحباً {driver.get('name') or ''} 👋\n\n"
        f"تم قبول طلبك كسائق في GreenGo Market ✅\n\n"
        f"🔐 كود PIN الخاص بك: *{pin}*\n"
        f"🔗 بوابة التوصيل: https://www.mygreengoo.com/livreur\n\n"
        f"لا تشارك هذا الكود مع أحد."
    )
    # send_whatsapp_message is sync (requests) -- keep it off the event loop.
    wa_sent = await asyncio.to_thread(send_whatsapp_message, driver.get("phone") or "", message)

    return {
        "validated":     True,
        "driver_name":   driver.get("name") or "",
        "pin":           pin,          # manual fallback if WhatsApp failed
        "whatsapp_sent": bool(wa_sent),
    }


@admin_drivers_router.patch("/{driver_id}/reject", summary="Reject a pending driver")
async def reject_driver(
    driver_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    try:
        oid = ObjectId(driver_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Identifiant livreur invalide.")
    result = await drivers_col().update_one(
        {"_id": oid},
        {"$set": {"status": "rejected", "active": False,
                  "updated_at": datetime.now(tz=timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Livreur introuvable.")
    return {"rejected": True}


@admin_drivers_router.post("/{driver_id}/resend-pin", summary="Regenerate and WhatsApp a new driver PIN")
async def resend_driver_pin(
    driver_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    try:
        oid = ObjectId(driver_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Identifiant livreur invalide.")

    driver = await drivers_col().find_one({"_id": oid, "active": True})
    if not driver:
        raise HTTPException(status_code=404, detail="Livreur introuvable ou inactif.")

    # Regenerate on collision with another active driver -- same rule as /validate.
    pin = ""
    for _attempt in range(10):
        candidate = str(secrets.randbelow(900_000) + 100_000)
        clash = False
        async for other in drivers_col().find(
            {"active": True, "_id": {"$ne": oid}}, {"pin_hash": 1}
        ):
            if verify_pin(candidate, other.get("pin_hash") or ""):
                clash = True
                break
        if not clash:
            pin = candidate
            break
    if not pin:
        raise HTTPException(status_code=500, detail="Impossible de générer un PIN unique. Réessayez.")

    now = datetime.now(tz=timezone.utc)
    await drivers_col().update_one(
        {"_id": oid},
        {"$set": {"pin_hash": hash_pin(pin), "updated_at": now}},
    )

    message = (
        f"مرحباً {driver.get('name') or ''} 👋\n\n"
        f"تم تجديد كود PIN الخاص بك في GreenGo Market ✅\n\n"
        f"🔐 كود PIN الجديد: *{pin}*\n"
        f"🔗 بوابة التوصيل: https://www.mygreengoo.com/livreur\n\n"
        f"لا تشارك هذا الكود مع أحد."
    )
    wa_sent = await asyncio.to_thread(send_whatsapp_message, driver.get("phone") or "", message)

    return {
        "resent":        True,
        "driver_name":   driver.get("name") or "",
        "pin":           pin,
        "whatsapp_sent": bool(wa_sent),
    }


# ── Livreur: authentication ───────────────────────────────────────────────────

@livreur_router.post("/auth", summary="Driver login by PIN (no username)")
async def livreur_auth(payload: LivreurAuthPayload, request: Request) -> dict[str, Any]:
    ip = _client_ip(request)
    _check_pin_rate_limit(ip)

    pin = (payload.pin or "").strip()
    # Don't leak the length policy to an unauthenticated caller -- a wrong-length
    # PIN gets the same generic failure as a wrong PIN.
    if not pin.isdigit() or not (_MIN_PIN_LENGTH <= len(pin) <= _MAX_PIN_LENGTH):
        _record_pin_failure(ip)
        raise HTTPException(status_code=401, detail="PIN incorrect.")

    matched: dict[str, Any] | None = None
    async for driver in drivers_col().find({"active": True}, {"_id": 1, "name": 1, "pin_hash": 1}):
        if verify_pin(pin, driver.get("pin_hash") or ""):
            matched = driver
            break

    if not matched:
        _record_pin_failure(ip)
        raise HTTPException(status_code=401, detail="PIN incorrect.")

    driver_id = str(matched["_id"])
    name      = str(matched.get("name") or "")
    token, expires_in = issue_livreur_jwt(driver_id, name)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "expires_in":   expires_in,
        "driver_id":    driver_id,
        "name":         name,
        "role":         "livreur",
    }


# ── Livreur: self-registration ───────────────────────────────────────────────

@livreur_router.post("/register", summary="Driver self-registration (public, admin approval required)")
async def register_driver(payload: DriverRegistrationRequest, request: Request) -> dict[str, Any]:
    _check_register_rate_limit(_client_ip(request))

    col   = drivers_col()
    phone = payload.phone.strip()

    existing = await col.find_one(
        {"phone": phone, "status": {"$in": ["pending", "active"]}}, {"_id": 1}
    )
    # A legacy admin-created driver has no status field but is active.
    if not existing:
        existing = await col.find_one(
            {"phone": phone, "status": {"$exists": False}, "active": True}, {"_id": 1}
        )
    if existing:
        raise HTTPException(status_code=409, detail="Ce numéro est déjà enregistré.")

    now = datetime.now(tz=timezone.utc)
    await col.insert_one({
        "name":             payload.name.strip(),
        "phone":            phone,
        "vehicle_type":     payload.vehicle_type,
        "status":           "pending",
        "active":           False,
        "pin_hash":         None,
        "created_by_admin": False,
        "created_at":       now,
        "updated_at":       now,
    })
    return {"message": "Demande envoyée. Votre PIN vous sera envoyé par WhatsApp après validation."}


# ── Livreur: order dispatch (pool + claim) ───────────────────────────────────

def _fmt_dt(v: Any) -> str:
    return v.isoformat() if isinstance(v, datetime) else (str(v) if v else "")


def _serialize_order_for_driver(doc: dict[str, Any]) -> dict[str, Any]:
    """Order shape the driver portal consumes. Scoped to livreur routes --
    not a general order serializer (there isn't one; orders.py builds dicts
    inline)."""
    return {
        "id":                  str(doc["_id"]),
        "customer_name":       doc.get("customer_name", ""),
        "customer_phone":      doc.get("customer_phone") or doc.get("phone", ""),
        "address":             doc.get("address") or doc.get("delivery_address", ""),
        "gps_coordinates":     doc.get("gps_coordinates"),
        "items":               doc.get("items", []),
        "total_price":         doc.get("total_price", 0),
        "driver_payout_mad":   doc.get("driver_payout_mad", 15.0),
        "status":              doc.get("status", "Pending"),
        "assigned_at":         _fmt_dt(doc.get("assigned_at")),
        "ready_at":            _fmt_dt(doc.get("ready_at")),
        "delivering_at":       _fmt_dt(doc.get("delivering_at")),
        "created_at":          _fmt_dt(doc.get("created_at")),
        "assigned_livreur_id": doc.get("assigned_livreur_id"),
        # No order doc currently stores a customer note -- default keeps the
        # rider modal's amber block a safe no-op until that field exists.
        "notes": doc.get("notes") or doc.get("delivery_notes") or doc.get("customer_note") or "",
    }


_POOL_QUERY: dict[str, Any] = {
    "status": {"$in": ["Pending", "Confirmed"]},
    "$or": [
        {"assigned_livreur_id": None},
        {"assigned_livreur_id": {"$exists": False}},
    ],
}


@livreur_router.get("/orders/available", summary="Unclaimed orders any available driver can take")
async def livreur_available_orders(
    _: LivreurIdentity = Depends(require_livreur),
) -> list[dict[str, Any]]:
    docs = await orders_col().find(_POOL_QUERY).sort("created_at", 1).to_list(length=50)
    return [_serialize_order_for_driver(d) for d in docs]


@livreur_router.get("/orders/my", summary="This driver's orders, by tab")
async def livreur_my_orders(
    tab: str = "processing",
    identity: LivreurIdentity = Depends(require_livreur),
) -> list[dict[str, Any]]:
    tab_map = {
        "processing": ["Assigned", "Ready", "Out for Delivery", "Pending Confirmation"],
        "delivered":  ["Delivered", "Completed"],
    }
    statuses = tab_map.get(tab, tab_map["processing"])
    docs = await orders_col().find(
        {"assigned_livreur_id": identity.driver_id, "status": {"$in": statuses}}
    ).sort("created_at", -1).to_list(length=100)
    return [_serialize_order_for_driver(d) for d in docs]


@livreur_router.post("/orders/{order_id}/claim", summary="Claim an unassigned order from the pool")
async def livreur_claim_order(
    order_id: str,
    identity: LivreurIdentity = Depends(require_livreur),
) -> dict[str, Any]:
    try:
        oid = ObjectId(order_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Identifiant de commande invalide.")

    now = datetime.now(tz=timezone.utc)
    result = await orders_col().find_one_and_update(
        {"_id": oid, **_POOL_QUERY},
        {
            "$set": {
                "status":                "Assigned",
                "assigned_livreur_id":   identity.driver_id,
                "assigned_livreur_name": identity.name,
                "driver_name":           identity.name,
                "assigned_at":           now,
                "updated_at":            now,
            },
            "$push": {"status_history": {
                "from": "Pending", "to": "Assigned",
                "timestamp": now, "changed_by": identity.driver_id, "note": "Pris par livreur",
            }},
        },
        return_document=True,
    )
    if result is None:
        raise HTTPException(status_code=409, detail="Cette commande a déjà été prise par un autre livreur.")
    return {"claimed": True, "order_id": order_id, "status": "Assigned"}


@livreur_router.patch("/orders/{order_id}/picking-up", summary="Driver is en route with the order")
async def livreur_picking_up(
    order_id: str,
    identity: LivreurIdentity = Depends(require_livreur),
) -> dict[str, Any]:
    try:
        oid = ObjectId(order_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Identifiant de commande invalide.")

    now = datetime.now(tz=timezone.utc)
    result = await orders_col().find_one_and_update(
        {
            "_id": oid,
            "assigned_livreur_id": identity.driver_id,
            "status": {"$in": ["Assigned", "Ready"]},
        },
        {
            "$set": {"status": "Out for Delivery", "delivering_at": now, "updated_at": now},
            "$push": {"status_history": {
                "from": "Ready", "to": "Out for Delivery",
                "timestamp": now, "changed_by": identity.driver_id, "note": "En route",
            }},
        },
        return_document=True,
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Commande introuvable, non autorisée, ou statut incompatible.",
        )
    return {"status": "Out for Delivery", "order_id": order_id}


# ── Livreur: deliveries ───────────────────────────────────────────────────────

_OPEN_STATUSES_EXCLUDED = ["Completed", "Cancelled"]


def _today_bounds() -> tuple[datetime, datetime]:
    """
    Start/end of the current day in UTC.

    NOTE: Morocco runs UTC+1, so a "today" computed in UTC drops orders placed
    between 00:00 and 01:00 local. Kept as UTC to match how created_at is
    stored everywhere else in this codebase; revisit together with the rest if
    local-day boundaries start mattering.
    """
    now   = datetime.now(tz=timezone.utc)
    start = datetime.combine(now.date(), dtime.min, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


@livreur_router.get("/deliveries", summary="Today's deliveries for the logged-in driver")
async def livreur_deliveries(identity: LivreurIdentity = Depends(require_livreur)) -> list[dict[str, Any]]:
    start, end = _today_bounds()
    cursor = orders_col().find(
        {
            "assigned_livreur_id": identity.driver_id,
            "status":     {"$nin": _OPEN_STATUSES_EXCLUDED},
            "created_at": {"$gte": start, "$lt": end},
        },
        {
            "_id": 1, "customer_name": 1, "phone": 1, "address": 1,
            "gps_coordinates": 1, "total_price": 1, "items": 1, "status": 1,
            "delivery_zone": 1, "created_at": 1,
        },
    ).sort("created_at", 1)

    out: list[dict[str, Any]] = []
    async for d in cursor:
        gps = d.get("gps_coordinates") or None
        out.append({
            "order_id":      str(d["_id"]),
            "customer_name": d.get("customer_name") or "",
            "phone":         d.get("phone") or "",
            "address":       d.get("address") or "",
            "gps":           gps,
            "maps_url": (
                f"https://www.google.com/maps/search/?api=1&query={gps['lat']},{gps['lng']}"
                if gps and gps.get("lat") is not None and gps.get("lng") is not None else None
            ),
            "total_price":   float(d.get("total_price") or 0),
            "items_count":   len(d.get("items") or []),
            "status":        d.get("status") or "Pending",
            "delivery_zone": d.get("delivery_zone") or "",
            "created_at": (d["created_at"].isoformat()
                           if isinstance(d.get("created_at"), datetime) else None),
        })
    return out


@livreur_router.patch("/orders/{order_id}/deliver", summary="Driver marks an order delivered")
async def livreur_mark_delivered(
    order_id: str,
    identity: LivreurIdentity = Depends(require_livreur),
) -> dict[str, Any]:
    """
    Sets "Pending Confirmation" -- deliberately NOT "Delivered".

    Only an admin closes an order out, so a driver can neither complete an
    order nor undo their own submission. Scoped to orders assigned to this
    driver, so one driver cannot touch another's delivery.
    """
    col = orders_col()
    try:
        oid = ObjectId(order_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Identifiant de commande invalide.")

    order = await col.find_one(
        {"_id": oid}, {"_id": 1, "status": 1, "assigned_livreur_id": 1}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    if str(order.get("assigned_livreur_id") or "") != identity.driver_id:
        # 404 rather than 403 -- don't confirm the order exists to a driver it
        # isn't assigned to.
        raise HTTPException(status_code=404, detail="Commande introuvable.")

    current = order.get("status") or "Pending"
    if current == "Pending Confirmation":
        return {"order_id": order_id, "status": current, "already_submitted": True}
    if current in _OPEN_STATUSES_EXCLUDED or current == "Delivered":
        raise HTTPException(
            status_code=400,
            detail=f"Cette commande est déjà « {current} ».",
        )

    now = datetime.now(tz=timezone.utc)
    result = await col.update_one(
        # status guard makes the transition idempotent under a double-tap.
        {"_id": oid, "status": current},
        {
            "$set": {
                "status":     "Pending Confirmation",
                "updated_at": now,
                "delivered_by_driver_id":   identity.driver_id,
                "delivered_by_driver_name": identity.name,
                "delivered_submitted_at":   now,
            },
            "$push": {
                "status_history": {
                    "from":       current,
                    "to":         "Pending Confirmation",
                    "timestamp":  now,
                    "changed_by": f"livreur:{identity.driver_id}",
                    "note":       f"Marqué livré par {identity.name}",
                }
            },
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=409, detail="Statut modifié entre-temps. Rechargez.")

    return {"order_id": order_id, "status": "Pending Confirmation", "already_submitted": False}


# ── Livreur: availability, profile, earnings, wallet ─────────────────────────

class AvailabilityPayload(BaseModel):
    is_available: bool
    latitude:     float | None = None
    longitude:    float | None = None


async def _driver_doc(identity: LivreurIdentity) -> dict[str, Any]:
    try:
        oid = ObjectId(identity.driver_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=401, detail="Session invalide.")
    doc = await drivers_col().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Livreur introuvable.")
    return doc


@livreur_router.patch("/availability", summary="Driver toggles online/offline")
async def livreur_set_availability(
    payload: AvailabilityPayload,
    identity: LivreurIdentity = Depends(require_livreur),
) -> dict[str, Any]:
    now = datetime.now(tz=timezone.utc)
    update: dict[str, Any] = {"is_available": payload.is_available, "updated_at": now}

    if payload.is_available and payload.latitude is not None and payload.longitude is not None:
        # Going online with a fix -- dispatch can route by proximity.
        update["last_location"] = {
            "lat": payload.latitude,
            "lng": payload.longitude,
            "recorded_at": now,
        }
    elif not payload.is_available:
        # Offline -- a stale location is worse than none.
        update["last_location"] = None

    await drivers_col().update_one({"_id": ObjectId(identity.driver_id)}, {"$set": update})
    return {"is_available": payload.is_available}


@livreur_router.get("/profile", summary="Logged-in driver's profile")
async def livreur_profile(identity: LivreurIdentity = Depends(require_livreur)) -> dict[str, Any]:
    doc = await _driver_doc(identity)
    return {
        **_driver_public(doc),
        "is_available":   bool(doc.get("is_available", False)),
        "total_earnings": doc.get("total_earnings", 0.0),
    }


@livreur_router.get("/earnings", summary="Driver earnings summary + daily breakdown")
async def livreur_earnings(identity: LivreurIdentity = Depends(require_livreur)) -> dict[str, Any]:
    doc = await _driver_doc(identity)
    daily: list[dict[str, Any]] = doc.get("daily_earnings", []) or []

    now        = datetime.now(tz=timezone.utc)
    today      = now.strftime("%Y-%m-%d")
    week_start = (now - timedelta(days=6)).strftime("%Y-%m-%d")

    today_mad = round(sum(e.get("amount_mad", 0.0) for e in daily if e.get("date") == today), 2)
    week_mad  = round(sum(e.get("amount_mad", 0.0) for e in daily if e.get("date", "") >= week_start), 2)

    by_date: dict[str, float] = {}
    for e in daily:
        d = e.get("date", "")
        by_date[d] = round(by_date.get(d, 0.0) + e.get("amount_mad", 0.0), 2)

    return {
        "total_mad": doc.get("total_earnings", 0.0),
        "today_mad": today_mad,
        "week_mad":  week_mad,
        "chart":     [{"date": k, "amount_mad": v} for k, v in sorted(by_date.items())],
        "recent":    sorted(daily, key=lambda x: x.get("date", ""), reverse=True)[:20],
    }


@livreur_router.get("/wallet", summary="Driver wallet balance")
async def livreur_wallet(identity: LivreurIdentity = Depends(require_livreur)) -> dict[str, Any]:
    doc = await _driver_doc(identity)
    return {
        "balance_mad":  doc.get("total_earnings", 0.0),
        "transactions": [],   # withdrawal records land here in a later pass
    }
