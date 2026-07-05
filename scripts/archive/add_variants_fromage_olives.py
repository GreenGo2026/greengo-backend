# -*- coding: utf-8 -*-
"""
Applies 250g/500g/1kg variants to ALL products in Fromage and Olives
categories. Pricing rule: 1kg=base, 500g=50%, 250g=25%, rounded up to
nearest 0.5. Skips products that already have variants or price=0.

Run: railway run python scripts/add_variants_fromage_olives.py
"""
import asyncio, os, math
from motor.motor_asyncio import AsyncIOMotorClient

CATEGORIES = ["Fromage", "Olives"]


def compute_variants(price_1kg: float) -> list:
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
        {"category": {"$in": CATEGORIES}},
        {"_id": 1, "name_fr": 1, "price_mad": 1, "unit": 1, "category": 1, "variants": 1},
    ).sort("category", 1):
        products.append(p)

    print(f"Found {len(products)} products in Fromage + Olives\n")

    will_update = []
    will_skip = []

    for p in products:
        name = p.get("name_fr", "?")
        price = p.get("price_mad", 0)
        cat = p.get("category", "?")
        unit = p.get("unit", "?")
        existing = p.get("variants")

        if existing:
            will_skip.append(f"  SKIP (has variants): {name} ({len(existing)} variants)")
            continue

        if unit and unit.lower() == "piece":
            will_skip.append(f"  SKIP (sold per piece, not weight): {name} — {price} MAD/piece")
            continue

        if not price or price <= 0:
            will_skip.append(f"  SKIP (price=0): {name} -- set price first")
            continue

        variants = compute_variants(price)
        will_update.append({"_id": p["_id"], "name": name, "cat": cat, "unit": unit, "base": price, "variants": variants})

    print("=== DRY RUN ===\n")
    current_cat = None
    for item in will_update:
        if item["cat"] != current_cat:
            current_cat = item["cat"]
            print(f"\n[{current_cat}]")
        v = item["variants"]
        print(f"  {item['name']:30} (base {item['base']} MAD/{item['unit']})  {v[0]['price_mad']:5.1f} / {v[1]['price_mad']:5.1f} / {v[2]['price_mad']:5.1f} MAD")

    if will_skip:
        print(f"\n=== SKIPPED ({len(will_skip)}) ===")
        for s in will_skip:
            print(s)

    print(f"\nWill update: {len(will_update)} products")
    print(f"Will skip:   {len(will_skip)} products")

    if not will_update:
        print("Nothing to do.")
        client.close()
        return

    print("\n=== APPLYING ===")
    updated = 0
    for item in will_update:
        result = await db.products.update_one(
            {"_id": item["_id"]},
            {"$set": {"variants": item["variants"]}},
        )
        if result.modified_count:
            print(f"  OK  {item['name']}")
            updated += 1
        else:
            print(f"  ERR {item['name']} -- not modified")

    print(f"\n=== DONE: {updated}/{len(will_update)} updated ===")

    for cat in CATEGORIES:
        total = await db.products.count_documents({"category": cat})
        with_v = await db.products.count_documents({"category": cat, "variants": {"$exists": True, "$ne": []}})
        print(f"  {cat}: {with_v}/{total} have variants")

    client.close()


asyncio.run(main())
