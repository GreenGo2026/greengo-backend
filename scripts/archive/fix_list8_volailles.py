import asyncio, os, re, unicodedata
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

def _sku(name_fr: str) -> str:
    s = unicodedata.normalize("NFD", name_fr.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "product"

PATCHES = [
    # (name_fr_db, name_ar, price)
    ("Ailes de poulet",      "أجنحة دجاج",   22.0),
    ("Batonnets de poulet",  "أصابع",          66.0),
    ("Beldi de dinde",       "فخذ ديك رومي",  60.0),
    ("Brochettes de poulet", "بروشيت",         60.0),
    ("Cordon bleu",          "كوردون بلو",     70.0),
    ("Crispy de poulet",     "كريسبي",         75.0),
    ("Cuisse de poulet",     "أفخاذ دجاج",    25.0),
    ("Foie de poulet",       "كبد دجاج",       50.0),
]

NEW = [
    # (name_fr, name_ar, price, category)
    ("Ailes de dinde",   "أجنحة ديك رومي", 30.0, "White Meats"),
    ("Cuisses de dinde", "أفخاذ ديك رومي", 45.0, "White Meats"),
    ("Filet de dinde",   "فيليه ديك رومي", 60.0, "White Meats"),
    ("Filet de poulet",  "فيليه دجاج",     40.0, "White Meats"),
    ("Foie de dinde",    "كبد ديك رومي",   55.0, "White Meats"),
    ("Kefta de dinde",   "كفتة ديك رومي",  45.0, "Volailles"),
    ("Kefta de poulet",  "كفتة دجاج",      45.0, "Volailles"),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = created = 0
    not_found = []

    print("=== PATCHES ===")
    for name_fr, name_ar, price in PATCHES:
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"$set": {"name_ar": name_ar, "price_mad": price}}
        )
        if result.matched_count > 0:
            print(f"✅ {name_fr:22} | {name_ar:16} | {price} MAD")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ NOT FOUND: {name_fr}")

    print("\n=== NEW PRODUCTS ===")
    for name_fr, name_ar, price, category in NEW:
        existing = await db.products.find_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}}
        )
        if existing:
            await db.products.update_one({"_id": existing["_id"]},
                                          {"$set": {"name_ar": name_ar, "price_mad": price}})
            print(f"✅ (exists) {name_fr:20} | {name_ar:16} | {price} MAD [{category}]")
            updated += 1
        else:
            doc = {"name_fr": name_fr, "name_ar": name_ar, "price_mad": price,
                   "category": category, "unit": "piece", "sku": _sku(name_fr)}
            try:
                await db.products.insert_one(doc)
                print(f"🆕 CREATED  {name_fr:20} | {name_ar:16} | {price} MAD [{category}]")
                created += 1
            except DuplicateKeyError:
                print(f"⚠️  SKU CONFLICT  {name_fr} | sku={doc['sku']} already taken → skipped")

    print(f"\n=== {updated} updated, {created} created, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
