import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

# Searches by FINAL correct name_fr (after rename). Renames already applied.
CORRECTIONS = [
    # (name_fr, name_ar, price, update_price)
    ("Ail",                   "ثوم",            60.0,  True),
    ("Ail en poudre",         "ثوم بودرة",      10.0,  True),
    ("Cannelle",              "قرفة",           60.0,  True),   # was: Cannelle moulue
    ("Cumin",                 "كمون",           80.0,  True),   # was: Cumin moulu
    ("Curcuma",               "كركم",           50.0,  True),   # was: Curcuma moulu
    ("Fenouil",               "فنّون",           0.0,  False),
    ("Gingembre",             "زنجبيل",         80.0,  True),   # was: Gingembre moulu
    ("Macis",                 "ماكسيس",          0.0,  False),
    ("Paprika",               "بابريكا",        60.0,  True),   # was: Paprika doux
    ("Poivre",                "فلفل أسود",     100.0,  True),   # was: Poivre noir moulu
    ("Safran pur",            "زعفران خالص",    40.0,  True),
    ("Sel",                   "ملح",            90.0,  True),
    ("Demi-cerneaux de noix", "نصف حبات الجوز", 90.0,  True),
    ("Feuille de laurier",    "ورق الغار",      30.0,  True),
    ("Graine de coriandre",   "حب الكزبرة",     30.0,  True),
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
            print(f"✅ {name_fr:25} | {name_ar:18} | {note}")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ NOT FOUND: {name_fr}")

    print(f"\n=== {updated} updated, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
