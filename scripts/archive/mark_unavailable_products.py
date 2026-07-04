# -*- coding: utf-8 -*-
"""
Mark confirmed zero-price products as unavailable (in_stock: False),
without touching price_mad (already 0) or overwriting any real price.

Run: railway run python scripts/mark_unavailable_products.py
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Verified against live DB — these are the real zero-price products
# that need marking unavailable
UNAVAILABLE_PRODUCTS = [
    # Fruits — 0 MAD
    "Pomme verte",
    "Kiwi",
    "Framboise",
    "Kiwi petite",
    "Fraise",
    "Mandarine",
    # Vegetables — 0 MAD
    "Menthe",
    "Epinards",
    "Brocoli",
    # Épices — 0 MAD
    "Ras el hanout",
]


async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    print("=== DRY RUN — no changes yet ===\n")
    for name_fr in UNAVAILABLE_PRODUCTS:
        p = await db.products.find_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"name_fr": 1, "price_mad": 1, "in_stock": 1, "category": 1, "_id": 0},
        )
        if p:
            print(f"  WILL CHANGE: {p['name_fr']:20} | {p['category']:20} | {p['price_mad']} MAD | in_stock={p['in_stock']}")
        else:
            print(f"  NOT FOUND:   {name_fr}")

    print("\nProducts NOT in this list (safety check — should stay untouched):")
    real_prices = await db.products.find_one(
        {"name_fr": "Avocat"}, {"name_fr": 1, "price_mad": 1, "in_stock": 1, "_id": 0}
    )
    if real_prices:
        safe = real_prices["price_mad"] == 50 and real_prices["in_stock"] is True
        print(f"  Avocat: {real_prices['price_mad']} MAD in_stock={real_prices['in_stock']} {'SAFE' if safe else 'MISMATCH -- STOP'}")

    print("\n=== APPLYING CHANGES ===\n")
    updated = 0
    not_found = []

    for name_fr in UNAVAILABLE_PRODUCTS:
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"$set": {
                "in_stock": False,
                "visible": True,
                "availability_note": "Prix non confirmé — temporairement indisponible",
                "updated_at": datetime.utcnow(),
            }},
        )
        if result.matched_count > 0:
            print(f"OK  {name_fr}")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"NOT FOUND: {name_fr}")

    print(f"\n=== {updated} marked unavailable ===")
    if not_found:
        print("Still not found:")
        for n in not_found:
            print(f"  - {n}")

    print("\n=== FINAL STATE ===")
    async for p in db.products.find(
        {"name_fr": {"$in": UNAVAILABLE_PRODUCTS}},
        {"name_fr": 1, "in_stock": 1, "price_mad": 1, "category": 1, "availability_note": 1, "_id": 0},
    ).sort("category", 1):
        status = "OUT" if not p["in_stock"] else "IN "
        note = p.get("availability_note", "")
        print(f"  {status} {p['name_fr']:20} | {p['category']:15} | {p['price_mad']} MAD | note={note!r}")

    client.close()


asyncio.run(main())
