# app/routes/audit.py
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.auth import require_admin
from app.database import audit_log_col

router = APIRouter(prefix="/api/v1/audit-log", tags=["audit"])


def _serialize_log(doc: dict[str, Any]) -> dict[str, Any]:
    ts = doc.get("timestamp")
    return {
        "id":          str(doc["_id"]),
        "entity_type": doc.get("entity_type", ""),
        "entity_id":   doc.get("entity_id", ""),
        "action":      doc.get("action", ""),
        "changes":     doc.get("changes", {}),
        "admin_id":    doc.get("admin_id", ""),
        "ip":          doc.get("ip", ""),
        "endpoint":    doc.get("endpoint", ""),
        "timestamp":   ts.isoformat() if hasattr(ts, "isoformat") else str(ts or ""),
    }


@router.get("/recent", summary="Get recent audit log entries across all entities")
async def get_recent_logs(
    limit: int = Query(50, ge=1, le=200),
    entity_type: Optional[str] = Query(default=None),
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if entity_type:
        query["entity_type"] = entity_type

    cursor = audit_log_col().find(query).sort("timestamp", -1).limit(limit)
    logs = [_serialize_log(doc) async for doc in cursor]
    return {"logs": logs}


@router.get("/{entity_type}/{entity_id}", summary="Get audit history for an entity")
async def get_audit_log(
    entity_type: str,
    entity_id: str,
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    query = {"entity_type": entity_type, "entity_id": entity_id}

    cursor = audit_log_col().find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = [_serialize_log(doc) async for doc in cursor]
    total = await audit_log_col().count_documents(query)

    return {"logs": logs, "total": total, "limit": limit, "skip": skip}
