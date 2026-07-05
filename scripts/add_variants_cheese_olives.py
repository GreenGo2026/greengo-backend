# -*- coding: utf-8 -*-
"""
Add weight variants to Gouda cumin / Gouda nature (confirmed prices,
proportional to the current 120 MAD/kg base price).

"zitoun hmar" does not match any exact product name_fr in the DB -- the
two closest candidates ("Olives rouge beldi" at 28 MAD/kg, "Olive rouge"
at 28 MAD/piece) are shown but NOT written to, since guessing which one
is intended risks tagging the wrong product. Confirm the exact name
before re-running with that entry included.

Run: railway run python scripts/add_variants_cheese_olives.py
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

CHEESE_VARIANTS = {
    "Gouda cumin": [
        {"label": "250g (rabaa)", "price_mad": 30.0, "weight_g": 250, "sku": None, "in_stock": True},
        {"label": "500g", "price_mad": 60.0, "weight_g": 500, "sku": None, "in_stock": True},
        {"label": "1kg", "price_mad": 120.0, "weight_g": 1000, "sku": None, "in_stock": True},
    ],
    "Gouda nature": [
        {"label": "250g (rabaa)", "price_mad": 30.0, "weight_g": 250, "sku": None, "in_stock": True},
        {"label": "500g", "price_mad": 60.0, "weight_g": 500, "sku": None, "in_stock": True},
        {"label": "1kg", "price_mad": 120.0, "weight_g": 1000, "sku": None, "in_stock": True},
    ],
}


async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    print("=== DRY RUN ===\n")
    for name_fr in CHEESE_VARIANTS:
        p = await db.products.find_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"name_fr": 1, "price_mad": 1, "unit": 1, "variants": 1, "_id": 0},
        )
        print(f"  WILL CHANGE: {p}" if p else f"  NOT FOUND: {name_fr}")

    print("\n  'zitoun hmar' -- no exact match. Candidates (NOT touched):")
    async for p in db.products.find(
        {"category": "Olives", "name_fr": {"$regex": "rouge", "$options": "i"}},
        {"name_fr": 1, "price_mad": 1, "unit": 1, "_id": 0},
    ):
        print(f"    candidate: {p}")

    print("\n=== APPLYING (Gouda only) ===\n")
    updated = 0
    not_found = []
    for name_fr, variants in CHEESE_VARIANTS.items():
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"$set": {"variants": variants}},
        )
        if result.matched_count > 0:
            print(f"OK  {name_fr} -- matched={result.matched_count} modified={result.modified_count}")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"NOT FOUND: {name_fr}")

    print(f"\n=== {updated} products updated, {len(not_found)} not found ===")

    print("\n=== VERIFICATION (read back from DB) ===")
    async for p in db.products.find(
        {"name_fr": {"$in": list(CHEESE_VARIANTS.keys())}},
        {"name_fr": 1, "price_mad": 1, "variants": 1, "_id": 0},
    ):
        print(p)

    client.close()


asyncio.run(main())
