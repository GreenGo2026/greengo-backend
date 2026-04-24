# app/routes/customers.py
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import customers_col

router = APIRouter(prefix="/api/v1/customers", tags=["Customers"])

# ── Pydantic models ───────────────────────────────────────────────────────────

class OfflinePointsPayload(BaseModel):
    phone:        str
    customer_name: str
    amount_paid:  float   # MAD spent in the physical store

class OfflinePointsResponse(BaseModel):
    phone:         str
    points_earned: int
    total_points:  int
    message:       str

# ── Helper (same rule as orders) ─────────────────────────────────────────────

def _calculate_points(amount: float) -> int:
    """10 MAD = 1 Point. Truncated."""
    return int(amount // 10)

# ── Route ─────────────────────────────────────────────────────────────────────

@router.post(
    "/offline-points",
    response_model=OfflinePointsResponse,
    status_code=200,
    summary="Award loyalty points for an in-store (POS) purchase",
)
async def award_offline_points(payload: OfflinePointsPayload) -> OfflinePointsResponse:
    if payload.amount_paid <= 0:
        raise HTTPException(status_code=400, detail="amount_paid must be greater than 0.")

    col           = customers_col()
    now           = datetime.now(tz=timezone.utc)
    phone_key     = payload.phone.strip()
    earned_points = _calculate_points(payload.amount_paid)

    try:
        result = await col.find_one_and_update(
            {"phone": phone_key},
            {
                "$setOnInsert": {
                    "phone":      phone_key,
                    "name":       payload.customer_name.strip(),
                    "created_at": now,
                },
                "$inc":  {"total_points": earned_points},
                "$set":  {"updated_at": now},
                "$push": {
                    "orders": {
                        "source":        "pos",
                        "amount_paid":   round(payload.amount_paid, 2),
                        "points_earned": earned_points,
                        "date":          now,
                    }
                },
            },
            upsert=True,
            return_document=True,
        )
        total_points = result.get("total_points", earned_points) if result else earned_points
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DB upsert failed: {exc}")

    return OfflinePointsResponse(
        phone=phone_key,
        points_earned=earned_points,
        total_points=total_points,
        message=(
            f"✅ {earned_points} points awarded for {payload.amount_paid:.2f} MAD. "
            f"Total balance: {total_points} points."
        ),
    )