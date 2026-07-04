import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

CORRECTIONS = [
    # (name_fr, name_ar, price, update_price)
    ("Mûre",         "توت أسود",   0.0,  False),
    ("Noix de coco", "جوز الهند",  0.0,  False),
    ("Orange",       "برتقال",     5.0,  True),
    ("Pamplemousse", "جريب فروت",  0.0,  False),
    ("Pastèque",     "بطيخ أحمر",  2.0,  True),
    ("Poire",        "إجاص",       25.0, True),
    ("Pomme jaune",  "تفاح أصفر",  23.0, True),
    ("Prune",        "برقوق",      11.0, True),
    ("Pêche danona", "خوخ دانونا", 0.0,  False),
    ("Raisin",       "عنب",        20.0, True),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = 0
    not_found = []

    for name_fr, name_ar, price, update_price in CORRECTIONS:
        update_fields = {"name_ar": name_ar}
        if update_price and price > 0:
            update_fields["price_mad"] = price

        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"$set": update_fields}
        )
        if result.matched_count > 0:
            note = f"→ {price} MAD" if update_price else "(price unchanged)"
            print(f"✅ {name_fr:15} | {name_ar:12} | {note}")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ NOT FOUND: {name_fr}")

    print(f"\n=== {updated} updated, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
