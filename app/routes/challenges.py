# app/routes/challenges.py
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Query

from app.database import challenges_col, challenge_completions_col, customers_col, orders_col
from app.routes.customers import _normalize_phone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/challenges", tags=["Challenges"])

DEFAULT_CHALLENGES: list[dict[str, Any]] = [
    {
        "id": "two_orders_week",
        "title_fr": "Commande régulière",
        "title_ar": "طلبية منتظمة",
        "description_fr": "Passez 2 commandes cette semaine",
        "description_ar": "اطلب مرتين هذا الأسبوع",
        "points_reward": 20,
        "icon": "🛒",
        "type": "order_count_week",
        "target": 2,
    },
    {
        "id": "morning_order",
        "title_fr": "Commande matinale",
        "title_ar": "طلبية الصباح",
        "description_fr": "Passez une commande avant midi",
        "description_ar": "اطلب قبل الظهر",
        "points_reward": 15,
        "icon": "☀️",
        "type": "order_before_hour",
        "target": 12,
    },
    {
        "id": "big_basket",
        "title_fr": "Grand panier",
        "title_ar": "سلة كبيرة",
        "description_fr": "Atteignez 150 MAD en une commande",
        "description_ar": "اوصل لـ 150 درهم في طلبية واحدة",
        "points_reward": 30,
        "icon": "🧺",
        "type": "order_min_amount",
        "target": 150,
    },
]


def get_week_start() -> datetime:
    now = datetime.now(tz=timezone.utc)
    return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def _compute_progress(ch: dict[str, Any], week_orders: list[dict[str, Any]]) -> dict[str, Any]:
    c_type = ch.get("type")
    target = ch.get("target", 1)

    if c_type == "order_count_week":
        current = min(len(week_orders), target)
        return {"current": current, "target": target, "pct": int(current / target * 100)}

    if c_type == "order_before_hour":
        # +1 is a rough UTC->Morocco offset (UTC+1 most of the year) -- this
        # is a fun/perk check, not a billing calculation, so exact DST/Ramadan
        # correctness isn't worth the complexity here.
        qualified = any(
            ((o.get("created_at") or datetime.now(tz=timezone.utc)).hour + 1) % 24 < target
            for o in week_orders
        )
        current = 1 if qualified else 0
        return {"current": current, "target": 1, "pct": current * 100}

    if c_type == "order_min_amount":
        qualified = any((o.get("total_price") or 0) >= target for o in week_orders)
        current = 1 if qualified else 0
        return {"current": current, "target": 1, "pct": current * 100}

    return {"current": 0, "target": target, "pct": 0}


async def _week_orders_for(phone: str, week_start: datetime, week_end: datetime) -> list[dict[str, Any]]:
    return await orders_col().find(
        {
            "phone": phone,
            "created_at": {"$gte": week_start, "$lt": week_end},
            "status": {"$nin": ["Cancelled", "cancelled"]},
        },
        {"total_price": 1, "created_at": 1},
    ).to_list(100)


async def _week_completions_for(phone: str, week_start: datetime, week_end: datetime) -> set[str]:
    docs = await challenge_completions_col().find(
        {"phone": phone, "completed_at": {"$gte": week_start, "$lt": week_end}}
    ).to_list(100)
    return {d["challenge_id"] for d in docs}


async def _active_challenge_list() -> list[dict[str, Any]]:
    active = await challenges_col().find_one({"active": True})
    return active.get("challenges", DEFAULT_CHALLENGES) if active else DEFAULT_CHALLENGES


@router.get("", summary="This week's challenges + progress for a customer")
async def get_challenges(phone: str = Query(...)) -> dict[str, Any]:
    normalized = _normalize_phone(phone)
    week_start = get_week_start()
    week_end = week_start + timedelta(days=7)

    ch_list = await _active_challenge_list()
    completed_ids = await _week_completions_for(normalized, week_start, week_end)
    week_orders = await _week_orders_for(normalized, week_start, week_end)

    result = [
        {
            **ch,
            "completed": ch["id"] in completed_ids,
            "progress": _compute_progress(ch, week_orders),
        }
        for ch in ch_list
    ]

    return {
        "challenges": result,
        "total_possible_points": sum(c["points_reward"] for c in ch_list),
        "total_earned_this_week": sum(c["points_reward"] for c in result if c["completed"]),
    }


def check_challenges_and_notify(phone: str, order_id: str) -> None:
    """
    Background-task-safe (call via background_tasks.add_task, never await
    directly). Mirrors notifications.py's _run_and_log pattern: FastAPI runs
    this in a worker thread since it's a plain sync function, so it's safe
    to open its own event loop with asyncio.run() here -- and safe to make
    the blocking send_whatsapp_message() call at the end, since that thread
    isn't serving other requests.

    Checks this week's challenges for `phone`, credits any newly-completed
    ones, and sends one WhatsApp summary if any landed. Never raises --
    a challenge-tracking failure must not surface to the order response.
    """
    async def _do() -> None:
        week_start = get_week_start()
        week_end = week_start + timedelta(days=7)

        ch_list = await _active_challenge_list()
        done_ids = await _week_completions_for(phone, week_start, week_end)
        week_orders = await _week_orders_for(phone, week_start, week_end)

        newly_completed: list[dict[str, Any]] = []
        for ch in ch_list:
            if ch["id"] in done_ids:
                continue
            if _compute_progress(ch, week_orders)["pct"] < 100:
                continue
            await challenge_completions_col().insert_one({
                "phone":           phone,
                "challenge_id":    ch["id"],
                "challenge_title": ch["title_fr"],
                "points_awarded":  ch["points_reward"],
                "order_id":        order_id,
                "completed_at":    datetime.now(tz=timezone.utc),
            })
            await customers_col().update_one({"phone": phone}, {"$inc": {"total_points": ch["points_reward"]}})
            newly_completed.append(ch)

        if newly_completed:
            from app.services.whatsapp import send_whatsapp_message
            titles = " · ".join(c["title_fr"] for c in newly_completed)
            total_new_points = sum(c["points_reward"] for c in newly_completed)
            send_whatsapp_message(
                phone,
                f"🎯 تحدي مكتمل!\n\n"
                f"ربحتي *{total_new_points} نقطة*\n"
                f"{titles}\n\n"
                f"mygreengoo.com/mon-compte"
            )

    try:
        asyncio.run(_do())
    except Exception as exc:
        logger.error("Challenge check failed for %s: %s", phone, exc)
