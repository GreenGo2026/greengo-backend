import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

CORRECTIONS = [
    # (search_fr, correct_fr, name_ar, price)
    ("demi-cerneaux de noix",        "demi-cerneaux de noix",       "نصف حبات الجوز",   90.0),
    ("feuille de laurier",           "feuille de laurier",          "ورق الغار",         100.0),
    ("graine de coriandre",          "graine de coriandre",         "حب الكزبرة",        30.0),
    ("knor",                         "knor",                        "كنور",              7.0),
    ("knor safron",                  "knor safran",                 "كنور زعفران",       5.0),
    ("la charmoula pour poisson",    "la charmoula pour poisson",   "الشرمولة للحوت",    7.5),
    ("la marinade pour viande",      "la marinade pour viande",     "الماريناد للحوم",   7.5),
    ("la marinade pour poulet",      "la marinade pour poulet",     "الماريناد للدجاج",  7.5),
    ("piment fort",                  "piment fort",                 "فلفل حار",          60.0),
    ("pruneaux gros",                "pruneaux gros",               "برقوق مجفف كبير",   70.0),
    ("raisins secs blonds",          "raisins secs blonds",         "زبيب أشقر",         100.0),
    ("raisins secs noirs",           "raisins secs noirs",          "زبيب أسود",         65.0),
    ("raisins secs rouges",          "raisins secs rouges",         "زبيب أحمر",         50.0),
    ("shawarma",                     "shawarma",                    "شاورما",            7.5),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = 0
    not_found = []

    for search_fr, correct_fr, name_ar, price in CORRECTIONS:
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{search_fr}$", "$options": "i"}},
            {"$set": {
                "name_fr":   correct_fr,
                "name_ar":   name_ar,
                "price_mad": price,
            }}
        )
        if result.matched_count > 0:
            print(f"✅ {search_fr:30} | {name_ar:20} | {price} MAD")
            updated += 1
        else:
            not_found.append(search_fr)
            print(f"❌ NOT FOUND: {search_fr}")

    print(f"\n=== {updated} updated, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
