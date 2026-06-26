# app/auth.py
from __future__ import annotations

import os
import secrets
import time
from collections import defaultdict

import jwt as pyjwt
from fastapi import HTTPException, Request, Security, status
from fastapi.security import (
    APIKeyHeader,
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

_KEY_HEADER = APIKeyHeader(name="X-Admin-Key", auto_error=False)
_BEARER     = HTTPBearer(auto_error=False)

# ── Login brute-force config (override via Railway env vars) ──────────────────
# Protects POST /admin/auth/login from password-guessing only.
# API endpoints that fail auth simply return 401 — they do NOT accumulate here.
# Soft block  : 5 bad login attempts in 5 min  → HTTP 429, clears automatically
# Hard block  : 7 bad login attempts in 1 hour → IP banned for 24 h
_SOFT_LIMIT    = int(os.getenv("ADMIN_SOFT_LIMIT",    "5"))
_SOFT_WINDOW   = int(os.getenv("ADMIN_SOFT_WINDOW",   "300"))    # 5 min
_HARD_LIMIT    = int(os.getenv("ADMIN_HARD_LIMIT",    "7"))
_HARD_WINDOW   = int(os.getenv("ADMIN_HARD_WINDOW",   "3600"))   # 1 hour counting window
_HARD_DURATION = int(os.getenv("ADMIN_HARD_DURATION", "86400"))  # 24 h ban

_FAILURES:     dict[str, list[float]] = defaultdict(list)  # per-IP failure timestamps
_HARD_BLOCKED: dict[str, float]       = {}                 # IP → ban-expiry timestamp


# ── Env-var helpers ───────────────────────────────────────────────────────────

def _admin_key() -> str:
    key = os.getenv("ADMIN_API_KEY", "")
    if not key:
        raise RuntimeError("ADMIN_API_KEY is not set — check your .env file.")
    return key


def _jwt_secret() -> str:
    s = os.getenv("JWT_SECRET", "")
    if not s:
        raise RuntimeError("JWT_SECRET is not set — check your environment variables.")
    return s


# ── JWT verification ──────────────────────────────────────────────────────────

def _verify_jwt(token: str) -> bool:
    if not token:
        return False
    secret = _jwt_secret()
    try:
        payload = pyjwt.decode(token, secret, algorithms=["HS256"])
        return payload.get("sub") == "admin"
    except pyjwt.ExpiredSignatureError:
        return False
    except Exception:
        return False


# ── Login rate-limiting (called from admin_auth.py) ──────────────────────────

def check_login_rate_limit(ip: str) -> None:
    """Raise 429 if IP is currently rate-limited. Call at the start of the login handler."""
    now = time.time()
    if ip in _HARD_BLOCKED:
        if now < _HARD_BLOCKED[ip]:
            remaining_h = max(1, int((_HARD_BLOCKED[ip] - now) / 3600) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Accès bloqué pendant encore {remaining_h}h. Contactez l'administrateur.",
            )
        del _HARD_BLOCKED[ip]  # ban expired — let them try again
    _FAILURES[ip] = [t for t in _FAILURES[ip] if now - t < _HARD_WINDOW]
    recent = [t for t in _FAILURES[ip] if now - t < _SOFT_WINDOW]
    if len(recent) >= _SOFT_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de tentatives. Réessayez dans 5 minutes.",
        )


def record_failed_login(ip: str) -> None:
    """Record a failed login attempt; hard-block the IP if the threshold is exceeded."""
    now = time.time()
    _FAILURES[ip].append(now)
    if len(_FAILURES[ip]) >= _HARD_LIMIT:
        _HARD_BLOCKED[ip] = now + _HARD_DURATION
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives suspectes. IP bloquée pour {_HARD_DURATION // 3600}h.",
        )


# ── Dependency ────────────────────────────────────────────────────────────────

async def require_admin(
    request:     Request,
    api_key:     str | None = Security(_KEY_HEADER),
    credentials: HTTPAuthorizationCredentials | None = Security(_BEARER),
) -> None:
    """
    Accepts any of:
      • Authorization: Bearer <valid-JWT>  — browser sessions (2FA login)
      • admin_jwt httpOnly cookie          — same browser session, cross-origin
      • X-Admin-Key: <api-key>             — machine-to-machine (Railway, scripts)
    """
    if credentials and _verify_jwt(credentials.credentials):
        return

    if _verify_jwt(request.cookies.get("admin_jwt", "")):
        return

    expected = _admin_key()
    if api_key and secrets.compare_digest(api_key.encode(), expected.encode()):
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Accès refusé. Token JWT expiré/invalide ou clé admin incorrecte.",
        headers={"WWW-Authenticate": "Bearer"},
    )
