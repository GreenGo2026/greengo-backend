"""
Loyalty points expiry.

Points expire after LOYALTY_EXPIRY_DAYS of *inactivity*, not a fixed lifetime:
any order resets the clock (orders.py sets points_last_activity on every
checkout). A customer who keeps ordering never loses points.

Run by the daily sweep in app/services/scheduler.py.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import get_settings
from app.database import customers_col


def _effective_last_activity(doc: dict[str, Any]) -> datetime | None:
    """
    Best available "last activity" timestamp for a customer.

    points_last_activity is authoritative, but it only exists on customers who
    have checked out since that field was introduced. Falling back through the
    older timestamps means pre-existing customers age normally instead of
    being immortal -- a `$lt` query on a missing field matches nothing, which
    would have silently exempted every legacy record.
    """
    for field in ("points_last_activity", "last_order", "updated_at", "created_at"):
        val = doc.get(field)
        if isinstance(val, datetime):
            # Mongo returns naive UTC datetimes; make them comparable.
            return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    return None


async def expire_stale_points(*, dry_run: bool = False) -> dict[str, Any]:
    """
    Zero out points for customers inactive longer than LOYALTY_EXPIRY_DAYS.

    Returns a summary dict so the caller (scheduler or an admin endpoint) can
    log what happened. Never raises on a single bad document -- one malformed
    record shouldn't stop the sweep.
    """
    cfg    = get_settings()
    now    = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=cfg.LOYALTY_EXPIRY_DAYS)

    col = customers_col()
    # Only customers who actually hold points can lose any.
    cursor = col.find(
        {"total_points": {"$gt": 0}},
        {
            "_id": 1, "phone": 1, "total_points": 1,
            "points_last_activity": 1, "last_order": 1,
            "updated_at": 1, "created_at": 1,
        },
    )

    scanned = expired = points_cleared = skipped_no_date = 0

    async for doc in cursor:
        scanned += 1
        last_active = _effective_last_activity(doc)
        if last_active is None:
            # No usable timestamp at all -- leave it alone rather than guess.
            skipped_no_date += 1
            continue
        if last_active >= cutoff:
            continue

        balance = int(doc.get("total_points") or 0)
        if balance <= 0:
            continue

        expired        += 1
        points_cleared += balance

        if dry_run:
            continue

        try:
            await col.update_one(
                {"_id": doc["_id"], "total_points": balance},  # guard against a
                {                                              # concurrent checkout
                    "$set": {
                        "total_points":        0,
                        "points_expired_at":   now,
                        "updated_at":          now,
                    },
                    "$push": {
                        "points_expiry_log": {
                            "expired_at":     now,
                            "points_expired": balance,
                            "last_active":    last_active,
                        }
                    },
                },
            )
        except Exception as exc:
            print(f"[LOYALTY] expiry failed for {doc.get('phone')}: {exc}")

    summary = {
        "ran_at":          now.isoformat(),
        "dry_run":         dry_run,
        "expiry_days":     cfg.LOYALTY_EXPIRY_DAYS,
        "scanned":         scanned,
        "customers_expired": expired,
        "points_cleared":  points_cleared,
        "skipped_no_date": skipped_no_date,
    }
    print(
        f"[LOYALTY] expiry sweep{' (dry run)' if dry_run else ''}: "
        f"scanned={scanned} expired={expired} points_cleared={points_cleared}"
    )
    return summary
