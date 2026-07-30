# app/routes/notifications.py
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from app.auth import require_admin
from app.database import notifications_col
from app.services.notifications import check_greenapi_status

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


def _serialize_notif(n: dict) -> dict:
    return {
        "id":                 str(n["_id"]),
        "recipient_phone":    n.get("recipient_phone", ""),
        "message":            n.get("message", ""),
        "notification_type":  n.get("notification_type", ""),
        "order_id":           n.get("order_id"),
        "order_ref":          n.get("order_ref"),
        "status":             n.get("status", "unknown"),
        "error":              n.get("error"),
        "attempts":           n.get("attempts", 0),
        "created_at":         str(n.get("created_at", "")),
        "updated_at":         str(n.get("updated_at", "")),
    }


@router.get("", summary="List recent WhatsApp notifications with delivery status")
async def list_notifications(
    status: str = Query(""),
    notification_type: str = Query(""),
    limit: int = Query(50, le=200),
    skip: int = Query(0),
    hours: int = Query(24),
    _: None = Depends(require_admin),
) -> dict:
    col = notifications_col()
    query: dict[str, Any] = {"created_at": {"$gte": datetime.utcnow() - timedelta(hours=hours)}}
    if status:
        query["status"] = status
    if notification_type:
        query["notification_type"] = notification_type

    total = await col.count_documents(query)

    stats = {}
    for s in ["sent", "failed", "pending"]:
        stats[s] = await col.count_documents({**query, "status": s})

    cursor = col.find(query).sort("created_at", -1).skip(skip).limit(limit)
    notifs = [_serialize_notif(n) async for n in cursor]

    return {"notifications": notifs, "total": total, "stats": stats, "hours": hours}


@router.get("/greenapi-status", summary="Check Green-API WhatsApp instance connection status")
async def get_greenapi_status(_: None = Depends(require_admin)) -> dict:
    status = await check_greenapi_status()
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent_failures = await notifications_col().count_documents({
        "status": "failed",
        "created_at": {"$gte": one_hour_ago},
    })
    return {**status, "recent_failures_1h": recent_failures}


@router.post("/{notif_id}/retry", summary="Retry a failed notification")
async def retry_notification(notif_id: str, _: None = Depends(require_admin)) -> dict:
    col = notifications_col()
    try:
        oid = ObjectId(notif_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")

    notif = await col.find_one({"_id": oid})
    if not notif:
        raise HTTPException(status_code=404, detail="Not found")
    if notif.get("status") != "failed":
        raise HTTPException(
            status_code=400,
            detail=f"Can only retry failed notifications. Current status: {notif.get('status')}",
        )

    # send_whatsapp_message is sync (requests, not httpx) -- run it off the
    # event loop rather than blocking this async request handler on it.
    from app.services.whatsapp import send_whatsapp_message

    phone   = notif.get("recipient_phone", "")
    message = notif.get("message", "")

    try:
        ok = await run_in_threadpool(send_whatsapp_message, phone, message)
    except Exception as exc:
        ok = False
        error = str(exc)
    else:
        error = None if ok else "Green-API returned failure"

    await col.update_one(
        {"_id": oid},
        {
            "$set": {"status": "sent" if ok else "failed", "error": error, "updated_at": datetime.utcnow()},
            "$inc": {"attempts": 1},
        },
    )

    if not ok:
        raise HTTPException(status_code=502, detail=f"Retry failed: {error}")
    return {"status": "sent", "retried": True}
