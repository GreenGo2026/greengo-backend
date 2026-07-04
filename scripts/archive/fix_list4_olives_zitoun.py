import asyncio, os, re, unicodedata
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

def _sku(name_fr: str) -> str:
    s = unicodedata.normalize("NFD", name_fr.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "product"

# 3 existing Zitoun products (Arabic + price), 4 new specialty olives created if missing
PATCHES = [
    # (name_fr, name_ar, price)
    ("Zitoun khal",     "زيتون أخضر",    40.0),
    ("Zitoun hmar",     "زيتون أحمر",    28.0),
    ("Zitoun mcharmal", "زيتون مشرمَل", 30.0),
]

NEW = [
    # (name_fr, name_ar, price)
    ("Agrich",          "كريش",           55.0),
    ("Mniwra",          "منيوّرة",        20.0),
    ("Msslala",         "مسلالا",         35.0),
    ("Zitoun khal bldi","زيتون أخضر بلدي",32.0),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = created = not_found_count = 0
    not_found = []

    print("=== PATCHES ===")
    for name_fr, name_ar, price in PATCHES:
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"$set": {"name_ar": name_ar, "price_mad": price}}
        )
        if result.matched_count > 0:
            print(f"✅ {name_fr:20} | {name_ar:18} | {price} MAD")
            updated += 1
        else:
            not_found.append(name_fr)
            not_found_count += 1
            print(f"❌ NOT FOUND: {name_fr}")

    print("\n=== NEW PRODUCTS ===")
    for name_fr, name_ar, price in NEW:
        existing = await db.products.find_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}}
        )
        if existing:
            result = await db.products.update_one(
                {"_id": existing["_id"]},
                {"$set": {"name_ar": name_ar, "price_mad": price}}
            )
            print(f"✅ (exists) {name_fr:20} | {name_ar:18} | {price} MAD")
            updated += 1
        else:
            doc = {"name_fr": name_fr, "name_ar": name_ar, "price_mad": price,
                   "category": "Olives", "unit": "piece", "sku": _sku(name_fr)}
            try:
                await db.products.insert_one(doc)
                print(f"🆕 CREATED  {name_fr:20} | {name_ar:18} | {price} MAD")
                created += 1
            except DuplicateKeyError as e:
                print(f"⚠️  SKU CONFLICT  {name_fr} | sku={doc['sku']} already taken → skipped")

    print(f"\n=== {updated} updated, {created} created, {not_found_count} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
