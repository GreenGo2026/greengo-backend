# app/services/session_logger.py
from __future__ import annotations

import logging
from datetime import datetime

from app.database import session_log_col

logger = logging.getLogger(__name__)


async def log_admin_session(
    event: str,  # "login" | "logout" | "failed_attempt"
    ip: str,
    user_agent: str = "",
    admin_id: str = "admin",
    details: str = "",
) -> None:
    """Log an admin session event. Fire-and-forget -- never raises, never
    blocks the caller (auth flow must succeed/fail on its own merits even if
    this logging fails)."""
    try:
        await session_log_col().insert_one({
            "event":      event,
            "ip":         ip,
            "user_agent": user_agent[:200],
            "admin_id":   admin_id,
            "details":    details,
            "timestamp":  datetime.utcnow(),
        })
    except Exception as exc:
        logger.error("Session log failed: %s", exc)
