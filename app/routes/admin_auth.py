# app/routes/admin_auth.py
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
import pyotp
from fastapi import APIRouter, HTTPException, Request, Response, status
from passlib.context import CryptContext
from pydantic import BaseModel

from app.auth import check_login_rate_limit, record_failed_login

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/auth", tags=["Admin Auth"])

_pwd_ctx = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


# ── Env-var helpers ───────────────────────────────────────────────────────────

def _password_hash() -> str:
    h = os.getenv("ADMIN_PASSWORD_HASH", "").strip().strip('"').strip("'").strip()
    if not h:
        raise RuntimeError("ADMIN_PASSWORD_HASH is not set in environment.")
    return h


def _totp_secret() -> str:
    s = os.getenv("ADMIN_TOTP_SECRET", "").strip().strip('"').strip("'").strip()
    if not s:
        raise RuntimeError("ADMIN_TOTP_SECRET is not set in environment.")
    return s


def _jwt_secret() -> str:
    s = os.getenv("JWT_SECRET", "")
    if not s:
        raise RuntimeError("JWT_SECRET is not set in environment.")
    return s


# ── JWT issuance ──────────────────────────────────────────────────────────────

def issue_admin_jwt() -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": "admin",
        "iat": now,
        "exp": now + timedelta(hours=8),
    }
    return pyjwt.encode(payload, _jwt_secret(), algorithm="HS256")


# ── Pydantic models ───────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    password:  str
    totp_code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int = 28800  # 8 hours


# ── Routes ────────────────────────────────────────────────────────────────────

_COOKIE_NAME    = "admin_jwt"
_COOKIE_MAX_AGE = 28800  # 8 hours


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Admin 2FA login — password + Google Authenticator code",
)
async def admin_login(body: LoginRequest, request: Request, response: Response) -> TokenResponse:
    ip = request.client.host if request.client else "unknown"
    check_login_rate_limit(ip)

    # Validate password via bcrypt
    try:
        pw_ok = _pwd_ctx.verify(body.password, _password_hash())
    except Exception:
        pw_ok = False

    # Validate 6-digit TOTP (accept ±30 s window to tolerate clock skew)
    try:
        totp    = pyotp.TOTP(_totp_secret())
        totp_ok = totp.verify(body.totp_code.strip(), valid_window=1)
    except Exception:
        totp_ok = False

    if not totp_ok:
        logger.warning(
            "TOTP verification failed — server_time=%s window=1 input_length=%d",
            datetime.now(tz=timezone.utc).isoformat(),
            len(body.totp_code) if body.totp_code else 0,
        )

    # Return the same error whether password or TOTP failed (no oracle)
    if not pw_ok or not totp_ok:
        record_failed_login(ip)  # may raise 429 if hard-block threshold hit
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants invalides.",
        )

    token = issue_admin_jwt()
    # SameSite=None + Secure required for cross-origin (Vercel ↔ Railway)
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=_COOKIE_MAX_AGE,
        path="/",
    )
    return TokenResponse(access_token=token)


@router.post("/logout", summary="Clear admin session cookie")
async def admin_logout(response: Response) -> dict:
    response.delete_cookie(key=_COOKIE_NAME, path="/", samesite="none", secure=True)
    return {"ok": True}
