# -*- coding: utf-8 -*-
"""
Apply 250g/500g/1kg variants to existing Volailles products priced by kg.

Run: railway run python scripts/add_variants_volailles.py
"""
import asyncio, os, math
from motor.motor_asyncio import AsyncIOMotorClient


def compute_variants(price_1kg):
    def r(x):
        return math.ceil(x * 2) / 2

    return [
        {"label": "250g", "price_mad": r(price_1kg * 0.25), "weight_g": 250, "sku": None, "in_stock": True},
        {"label": "500g", "price_mad": r(price_1kg * 0.50), "weight_g": 500, "sku": None, "in_stock": True},
        {"label": "1kg", "price_mad": float(price_1kg), "weight_g": 1000, "sku": None, "in_stock": True},
    ]


async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    products = []
    async for p in db.products.find(
        {"category": "Volailles"}, {"_id": 1, "name_fr": 1, "price_mad": 1, "unit": 1, "variants": 1}
    ):
        products.append(p)

    will_update = []
    will_skip = []

    for p in products:
        name = p.get("name_fr", "?")
        price = p.get("price_mad", 0)
        unit = p.get("unit", "")
        existing = p.get("variants")

        if existing:
            will_skip.append(f"  SKIP (has variants): {name}")
            continue
        if unit != "kg":
            will_skip.append(f"  SKIP (unit={unit}): {name}")
            continue
        if not price or price <= 0:
            will_skip.append(f"  SKIP (price=0): {name}")
            continue

        will_update.append({"_id": p["_id"], "name": name, "base": price, "variants": compute_variants(price)})

    print("=== DRY RUN -- Volailles ===\n")
    for item in will_update:
        v = item["variants"]
        print(f"  {item['name']:30} {v[0]['price_mad']:5.1f} / {v[1]['price_mad']:5.1f} / {v[2]['price_mad']:5.1f} MAD")

    if will_skip:
        print(f"\n=== SKIPPED ({len(will_skip)}) ===")
        for s in will_skip:
            print(s)

    print(f"\nWill update: {len(will_update)}")
    print(f"Will skip:   {len(will_skip)}")

    if not will_update:
        print("Nothing to update.")
        client.close()
        return

    print("\n=== APPLYING ===")
    updated = 0
    for item in will_update:
        result = await db.products.update_one({"_id": item["_id"]}, {"$set": {"variants": item["variants"]}})
        if result.modified_count:
            print(f"  OK  {item['name']}")
            updated += 1
        else:
            print(f"  ERR {item['name']}")

    print(f"\n=== DONE: {updated}/{len(will_update)} ===")

    total = await db.products.count_documents({"category": "Volailles"})
    with_v = await db.products.count_documents({"category": "Volailles", "variants": {"$exists": True, "$ne": []}})
    print(f"Volailles: {with_v}/{total} have variants")

    client.close()


asyncio.run(main())
