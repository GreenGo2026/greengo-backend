# app/routes/analytics.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.database import whatsapp_orders_col

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


class StatusBreakdown(BaseModel):
    pending:          int = 0
    preparing:        int = 0
    out_for_delivery: int = 0
    delivered:        int = 0
    completed:        int = 0
    cancelled:        int = 0


class TopItem(BaseModel):
    name:     str
    qty_sold: float
    revenue:  float


class AnalyticsResponse(BaseModel):
    total_revenue:     float
    total_orders:      int
    orders_by_status:  StatusBreakdown
    top_selling_items: list[TopItem]
    avg_order_value:   float
    completion_rate:   float
    period:            str


def _threshold(period: str) -> Optional[datetime]:
    """Return the UTC datetime lower-bound for the given period, or None for all-time."""
    now = datetime.now(tz=timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return None  # "all"


@router.get("", response_model=AnalyticsResponse, summary="Business analytics overview")
async def get_analytics(
    period: str = Query(default="all", pattern="^(today|week|month|all)$"),
) -> AnalyticsResponse:
    col = whatsapp_orders_col()
    cutoff = _threshold(period)

    # Base match stage — applied to every pipeline
    base_match: dict[str, Any] = {}
    if cutoff is not None:
        base_match["created_at"] = {"$gte": cutoff}

    try:
        # ── 1. Orders by status ───────────────────────────────────────────
        status_pipeline: list[dict[str, Any]] = []
        if base_match:
            status_pipeline.append({"$match": base_match})
        status_pipeline.append({"$group": {"_id": "$status", "count": {"$sum": 1}}})

        status_docs = await col.aggregate(status_pipeline).to_list(length=20)
        status_map: dict[str, int] = {
            d["_id"]: d["count"] for d in status_docs if d.get("_id")
        }

        breakdown = StatusBreakdown(
            pending          = status_map.get("pending",          0),
            preparing        = status_map.get("preparing",        0),
            out_for_delivery = status_map.get("out_for_delivery", 0),
            delivered        = status_map.get("delivered",        0),
            completed        = status_map.get("completed",        0),
            cancelled        = status_map.get("cancelled",        0),
        )
        total_orders = sum(status_map.values())

        # ── 2. Total revenue — completed orders only ──────────────────────
        revenue_match = {**base_match, "status": "completed"}
        revenue_pipeline: list[dict[str, Any]] = [
            {"$match": revenue_match},
            {"$group": {"_id": None, "total": {"$sum": "$total_price"}}},
        ]
        rev_docs = await col.aggregate(revenue_pipeline).to_list(length=1)
        total_revenue = float(rev_docs[0]["total"]) if rev_docs else 0.0

        # ── 3. Average order value — non-cancelled orders ─────────────────
        avg_match: dict[str, Any] = {**base_match, "status": {"$nin": ["cancelled"]}}
        avg_pipeline: list[dict[str, Any]] = [
            {"$match": avg_match},
            {"$group": {"_id": None, "avg": {"$avg": "$total_price"}}},
        ]
        avg_docs = await col.aggregate(avg_pipeline).to_list(length=1)
        avg_order_value = float(avg_docs[0]["avg"]) if avg_docs else 0.0

        # ── 4. Completion rate ────────────────────────────────────────────
        completed = breakdown.completed
        cancelled = breakdown.cancelled
        denom     = completed + cancelled
        completion_rate = round(completed / denom * 100, 1) if denom > 0 else 0.0

        # ── 5. Top-selling items ──────────────────────────────────────────
        items_match: dict[str, Any] = {**base_match, "status": {"$nin": ["cancelled"]}}
        items_pipeline: list[dict[str, Any]] = [
            {"$match": items_match},
            {"$unwind": "$items"},
            {"$group": {
                "_id":      {"$ifNull": ["$items.item_name", "$items.name"]},
                "qty_sold": {"$sum": "$items.quantity"},
                "revenue":  {"$sum": {"$multiply": [
                    {"$ifNull": ["$items.quantity",       0]},
                    {"$ifNull": ["$items.price_per_unit", 0]},
                ]}},
            }},
            {"$match": {"_id": {"$ne": None}, "_id": {"$ne": ""}}},
            {"$sort":  {"qty_sold": -1}},
            {"$limit": 10},
        ]
        item_docs = await col.aggregate(items_pipeline).to_list(length=10)
        top_items = [
            TopItem(
                name     = str(d["_id"]),
                qty_sold = round(float(d.get("qty_sold", 0)), 2),
                revenue  = round(float(d.get("revenue",  0)), 2),
            )
            for d in item_docs
            if d.get("_id")
        ]

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analytics aggregation failed: {exc}")

    return AnalyticsResponse(
        total_revenue     = round(total_revenue,   2),
        total_orders      = total_orders,
        orders_by_status  = breakdown,
        top_selling_items = top_items,
        avg_order_value   = round(avg_order_value, 2),
        completion_rate   = completion_rate,
        period            = period,
    )