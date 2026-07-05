# -*- coding: utf-8 -*-
"""
Add weight variants to "Olives rouge beldi".

Run: railway run python scripts/add_variants_olives_rouge.py
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

VARIANTS = [
    {"label": "250g", "price_mad": 7.0, "weight_g": 250, "sku": None, "in_stock": True},
    {"label": "500g", "price_mad": 14.0, "weight_g": 500, "sku": None, "in_stock": True},
    {"label": "1kg", "price_mad": 28.0, "weight_g": 1000, "sku": None, "in_stock": True},
]


async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    p = await db.products.find_one(
        {"name_fr": {"$regex": "^Olives rouge beldi$", "$options": "i"}},
        {"name_fr": 1, "price_mad": 1, "unit": 1, "category": 1, "_id": 0},
    )
    if not p:
        print("NOT FOUND — check name spelling")
        client.close()
        return

    print(f"WILL CHANGE: {p['name_fr']} | {p['price_mad']} MAD/{p['unit']} | {p['category']}")
    print("WILL ADD variants:")
    for v in VARIANTS:
        print(f"  {v['label']} -> {v['price_mad']} MAD")

    result = await db.products.update_one(
        {"name_fr": {"$regex": "^Olives rouge beldi$", "$options": "i"}},
        {"$set": {"variants": VARIANTS}},
    )
    print(f"\nMatched: {result.matched_count} | Modified: {result.modified_count}")

    check = await db.products.find_one(
        {"name_fr": {"$regex": "^Olives rouge beldi$", "$options": "i"}},
        {"name_fr": 1, "variants": 1, "_id": 0},
    )
    print(f"\nVerified: {check['name_fr']}")
    for v in check.get("variants", []):
        print(f"  OK {v['label']} -> {v['price_mad']} MAD")

    client.close()


asyncio.run(main())
