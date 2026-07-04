import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

CORRECTIONS = [
    # (search_fr, correct_fr, name_ar, price, update_price, category)
    ("coriadre moulue",   "coriandre moulue",   "كزبرة مطحونة",   40.0, True,  "Épices"),
    ("kiwi grande",       "kiwi grande",         "كيوي كبيرة",     0.0,  False, None),
    ("nectarine",         "nectarine",           "نكتارين",         11.0, True,  None),
    ("peche",             "peche",               "خوخ",             23.0, True,  None),
    ("pomme rouge grande","pomme rouge grande",  "تفاح أحمر كبير", 16.0, True,  None),
    ("pomme rouge petite","pomme rouge petite",  "تفاح أحمر صغير", 0.0,  False, None),
    ("pomme vert",        "pomme vert",          "تفاح أخضر",      0.0,  False, None),
    ("raisin vert",       "raisin vert",         "عنب أخضر",       0.0,  False, None),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = 0
    not_found = []

    for search_fr, correct_fr, name_ar, price, update_price, category in CORRECTIONS:
        update_fields = {
            "name_fr": correct_fr,
            "name_ar": name_ar,
        }
        if update_price and price > 0:
            update_fields["price_mad"] = price
        if category:
            update_fields["category"] = category

        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{search_fr}$", "$options": "i"}},
            {"$set": update_fields}
        )
        if result.matched_count > 0:
            note = f"→ {price} MAD" if update_price else "(price unchanged)"
            cat_note = f"→ {category}" if category else ""
            print(f"✅ {search_fr:22} | {name_ar:18} | {note} {cat_note}")
            updated += 1
        else:
            not_found.append(search_fr)
            print(f"❌ NOT FOUND: {search_fr}")

    print(f"\n=== {updated} updated, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
