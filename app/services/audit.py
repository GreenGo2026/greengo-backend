# app/services/audit.py
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from bson import ObjectId
from fastapi import Request

from app.database import audit_log_col

logger = logging.getLogger(__name__)


def _serialize(val: Any) -> Any:
    """Make a value JSON-safe for storage."""
    if isinstance(val, ObjectId):
        return str(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, list):
        return [_serialize(v) for v in val]
    if isinstance(val, dict):
        return {k: _serialize(v) for k, v in val.items()}
    return val


def _compute_diff(
    old_doc: dict[str, Any],
    new_doc: dict[str, Any],
    tracked_fields: set[str] | None = None,
) -> dict[str, Any]:
    """Compare two documents and return a dict of changed fields with old/new
    values. Only tracks fields in tracked_fields if provided, otherwise tracks
    all top-level fields."""
    changes: dict[str, Any] = {}
    all_keys = set(old_doc.keys()) | set(new_doc.keys())

    skip = {"_id", "updated_at", "created_at"}

    for key in all_keys:
        if key in skip:
            continue
        if tracked_fields and key not in tracked_fields:
            continue

        old_val = old_doc.get(key)
        new_val = new_doc.get(key)

        if isinstance(old_val, ObjectId):
            old_val = str(old_val)
        if isinstance(new_val, ObjectId):
            new_val = str(new_val)

        if old_val != new_val:
            changes[key] = {
                "old": _serialize(old_val),
                "new": _serialize(new_val),
            }

    return changes


def actor_id(request: Request) -> str:
    """
    Best-effort identity of who made the change. This is a single-admin
    system (require_admin has no per-user identity beyond JWT sub="admin"),
    so this distinguishes "browser admin session" from "machine/script using
    the raw API key" rather than naming individual admins.
    """
    api_key = request.headers.get("X-Admin-Key")
    if api_key:
        return api_key[:8]
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return "admin"
    if request.cookies.get("admin_jwt"):
        return "admin"
    return "unknown"


def request_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def log_change(
    entity_type: str,
    entity_id: str,
    action: str,
    changes: dict[str, Any],
    admin_id: str = "unknown",
    ip: str = "unknown",
    endpoint: str = "",
) -> None:
    """Insert an audit log entry. Fire-and-forget -- never raises, never
    blocks the main request (admin edits must succeed even if audit logging
    fails)."""
    try:
        if not changes and action == "update":
            return  # no actual changes -- skip

        await audit_log_col().insert_one({
            "entity_type": entity_type,
            "entity_id":   entity_id,
            "action":      action,
            "changes":     changes,
            "admin_id":    admin_id,
            "ip":          ip,
            "endpoint":    endpoint,
            "timestamp":   datetime.utcnow(),
        })

        logger.info(
            "AUDIT: %s %s %s — %d field(s) changed",
            action, entity_type, entity_id, len(changes),
        )
    except Exception as exc:
        logger.error("Audit log failed: %s", exc)


# ── Tracked fields per entity type ──────────────────────────────────────────
PRODUCT_TRACKED_FIELDS = {
    "name_fr", "name_ar", "price_mad", "unit",
    "category", "in_stock", "visible", "on_sale",
    "discount_pct", "description_fr", "image_url",
    "variants", "stock_qty", "step",
}

ORDER_TRACKED_FIELDS = {
    "status", "total_price", "subtotal",
    "delivery_fee", "delivery_zone",
    "customer_name", "phone", "address",
}

PANIER_TRACKED_FIELDS = {
    "title", "persons", "accent", "items",
    "price", "original_price", "meta_line",
}
