# scripts/migrate_customers.py
#
# Backfills CRM summary fields (total_orders, total_spent, segment, zone,
# first_order, last_order) onto EXISTING customer documents.
#
# IMPORTANT: this is a merge-only backfill, not a from-scratch build. The
# customers collection is already populated by the loyalty upsert in
# create_order() (app/routes/orders.py) on every order -- every phone that
# has ever ordered already has a document with {phone, name, created_at,
# total_points, orders: [...]}. This script only adds the new summary
# fields on top of that; it never inserts or deletes documents, so it is
# safe to re-run (idempotent) and cannot create duplicate/conflicting
# customer records for a phone that already exists.
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main() -> None:
    from motor.motor_asyncio import AsyncIOMotorClient
    from pymongo import ASCENDING, DESCENDING, IndexModel

    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    cust_col = db.customers
    orders_col = db.orders

    total_customers = await cust_col.count_documents({})
    print(f"Found {total_customers} existing customer documents.")

    updated = 0
    segments = {"vip": 0, "regular": 0, "new": 0}

    async for c in cust_col.find({}, {"phone": 1, "orders": 1}):
        phone = c.get("phone")
        embedded_orders = c.get("orders", []) or []
        total_orders = len(embedded_orders)
        total_spent = round(sum(float(o.get("total_price", 0) or 0) for o in embedded_orders), 2)
        dates = [o.get("date") for o in embedded_orders if o.get("date")]
        first_order = min(dates) if dates else None
        last_order = max(dates) if dates else None

        # zone isn't stored in the embedded orders[] subdocument (only
        # order_id/total_price/points_earned/points_used/date) -- pull it
        # from the customer's most recent real order document instead.
        zone = None
        if phone:
            last_real_order = await orders_col.find_one({"phone": phone}, sort=[("created_at", -1)])
            if last_real_order:
                zone = last_real_order.get("delivery_zone")

        segment = "vip" if total_orders >= 10 else "regular" if total_orders >= 3 else "new"
        segments[segment] += 1

        update: dict = {"total_orders": total_orders, "total_spent": total_spent, "segment": segment}
        if zone:
            update["zone"] = zone
        if first_order:
            update["first_order"] = first_order
        if last_order:
            update["last_order"] = last_order

        await cust_col.update_one({"_id": c["_id"]}, {"$set": update})
        updated += 1

    print(f"Backfilled {updated} customer document(s).")
    for seg, n in segments.items():
        print(f"  {seg}: {n}")

    await cust_col.create_indexes([
        IndexModel([("phone", ASCENDING)], unique=True, name="uq_customer_phone"),
        IndexModel([("segment", ASCENDING)], name="idx_customer_segment"),
        IndexModel([("total_spent", DESCENDING)], name="idx_customer_total_spent"),
    ])
    print("Indexes verified/created.")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
