# app/routes/admin_sessions.py
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query

from app.auth import require_admin
from app.database import session_log_col

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Sessions"])


@router.get("/sessions", summary="Admin login/logout/failed-auth event log")
async def get_session_log(
    limit: int = Query(50, le=200),
    event: str = Query(""),
    _: None = Depends(require_admin),
) -> dict:
    col = session_log_col()
    query: dict = {}
    if event:
        query["event"] = event

    cursor = col.find(query).sort("timestamp", -1).limit(limit)
    logs = []
    async for entry in cursor:
        logs.append({
            "id":         str(entry["_id"]),
            "event":      entry.get("event"),
            "ip":         entry.get("ip"),
            "user_agent": entry.get("user_agent", "")[:80],
            "timestamp":  str(entry.get("timestamp", "")),
            "details":    entry.get("details", ""),
        })

    yesterday = datetime.utcnow() - timedelta(hours=24)
    failed_24h = await col.count_documents({"event": "failed_attempt", "timestamp": {"$gte": yesterday}})

    return {"logs": logs, "failed_attempts_24h": failed_24h}
