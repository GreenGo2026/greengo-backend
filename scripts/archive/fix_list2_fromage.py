import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

# Searches by exact French DB names (original script used Darija phonetic keys mapped to these)
CORRECTIONS = [
    # (name_fr_db, name_ar, price)
    ("Emental",             "إمنتال",                 140.0),
    ("Fromage Kroon",       "جبن كرون",               120.0),
    ("Fromage fumé nature", "جبن مدخن طبيعي",         140.0),
    ("Fromage fumé chilli", "جبن مدخن بالفلفل الحار", 140.0),
    ("Fromage fumé poivre", "جبن مدخن بالفلفل",       140.0),
    ("Gouda cumin",         "غودا بالكمون",            120.0),
    ("Gouda nature",        "غودا طبيعي",              120.0),
    ("Mozzarella noir",     "موزاريلا سوداء",           60.0),
    ("Mozzarella rouge",    "موزاريلا حمراء",           60.0),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = 0
    not_found = []

    for name_fr, name_ar, price in CORRECTIONS:
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"$set": {"name_ar": name_ar, "price_mad": price}}
        )
        if result.matched_count > 0:
            print(f"✅ {name_fr:25} | {name_ar:25} | {price} MAD")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ NOT FOUND: {name_fr}")

    print(f"\n=== {updated} updated, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
