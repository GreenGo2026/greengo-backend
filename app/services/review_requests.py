"""
Post-delivery review sweep.

Runs every 10 minutes (registered in main.py). Finds delivered orders where:
  - review_scheduled_at is set (stamped by update_order_status on the
    Pending -> Delivered transition, see app/routes/orders.py)
  - review_sent_at is still None
  - review_scheduled_at is at least 2 hours in the past (grace period so the
    request doesn't land while the customer is still unpacking groceries)

Sends a WhatsApp rating request; the customer replies 1-5, intercepted by
_try_review_reply() in app/routes/webhook.py, which stores the score on the
order and calls _update_product_rating() below to denormalize onto each
product in the order.

Deliberately NOT named reviews.py / placed in app/routes -- that module and
path already belong to the unrelated customer-testimonial system
(app/routes/reviews.py, ReviewCreate/reviews_col, admin-curated quotes).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from app.database import orders_col, products_col
from app.services.whatsapp import send_whatsapp_message


async def send_review_requests() -> dict[str, int]:
    now       = datetime.now(tz=timezone.utc)
    threshold = now - timedelta(hours=2)

    pending = await orders_col().find({
        "status":              {"$in": ["Delivered", "Completed"]},
        "review_scheduled_at": {"$ne": None, "$lte": threshold},
        "review_sent_at":      None,
        "review_score":        None,
    }).to_list(length=200)

    sent_count = 0
    for order in pending:
        phone = order.get("phone") or order.get("customer_phone", "")
        name  = order.get("customer_name", "")
        if not phone:
            continue

        message = (
            f"مرحباً {name} \U0001F44B\n\n"
            f"وصلت طلبيتك من GreenGo Market ✅\n\n"
            f"كيفاش كانت التجربة؟ قيّم من 1 إلى 5:\n"
            f"1 = ضعيف جداً  2 = ضعيف  3 = معقول  4 = جيد  5 = ممتاز\n\n"
            f"ردّ بالرقم فقط (1-5) \U0001F64F"
        )
        sent = await asyncio.to_thread(send_whatsapp_message, phone, message)
        if sent:
            await orders_col().update_one(
                {"_id": order["_id"]},
                {"$set": {"review_sent_at": now}},
            )
            sent_count += 1

    summary = {"checked": len(pending), "sent": sent_count}
    print(f"[REVIEW-SWEEP] {summary}")
    return summary


async def _update_product_rating(product_name_ar: str) -> None:
    """
    Recomputes avg_rating and review_count for a product from all orders
    that carry a review_score and include that item. Called once per
    product in an order right after that order's score is stored.
    """
    pipeline = [
        {"$match": {
            "review_score": {"$ne": None, "$exists": True},
            "items.name":   product_name_ar,
        }},
        {"$group": {
            "_id":   None,
            "avg":   {"$avg": "$review_score"},
            "count": {"$sum": 1},
        }},
    ]
    result = await orders_col().aggregate(pipeline).to_list(length=1)
    if result:
        await products_col().update_one(
            {"name_ar": product_name_ar},
            {"$set": {
                "avg_rating":   round(result[0]["avg"], 1),
                "review_count": result[0]["count"],
            }},
        )
