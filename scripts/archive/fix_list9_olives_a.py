import asyncio, os, re, unicodedata
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

def _sku(name_fr: str) -> str:
    s = unicodedata.normalize("NFD", name_fr.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "product"

CORRECTIONS = [
    # (name_fr, name_ar, price)
    ("Agrich",            "كريش",              55.0),
    ("Mniwra",            "منيوّرة",           20.0),
    ("Msslala",           "مسلالا",            35.0),
    ("Zitoun khal bldi",  "زيتون أخضر بلدي",   32.0),
    ("barkouk",           "برقوق",             45.0),
    ("carrotes",          "جزر",                8.0),
    ("chlada hmra",       "سلطة حمراء",        40.0),
    ("chlada sfra",       "سلطة صفراء",        40.0),
    ("chou-fleur",        "قرنبيط",            16.0),
    ("cornichon",         "كورنيشون",          35.0),
    ("cornichon hind",    "كورنيشون هندي",     50.0),
    ("falfala garn hmar", "فلفلة حمراء كبيرة", 25.0),
    ("falfla lssan tir",  "فلفلة لسان الطير",  14.0),
    ("fifla mzawd",       "فلفلة مزودة",       15.0),
    ("hamd baldi",        "حامض بلدي",         15.0),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = created = 0
    not_found = []

    for name_fr, name_ar, price in CORRECTIONS:
        existing = await db.products.find_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}}
        )
        if existing:
            await db.products.update_one({"_id": existing["_id"]},
                                          {"$set": {"name_ar": name_ar, "price_mad": price}})
            print(f"✅ {name_fr:22} | {name_ar:20} | {price} MAD")
            updated += 1
        else:
            doc = {"name_fr": name_fr, "name_ar": name_ar, "price_mad": price,
                   "category": "Olives", "unit": "piece", "sku": _sku(name_fr)}
            try:
                await db.products.insert_one(doc)
                print(f"🆕 CREATED  {name_fr:22} | {name_ar:20} | {price} MAD")
                created += 1
            except DuplicateKeyError:
                print(f"⚠️  SKU CONFLICT  {name_fr} | sku={doc['sku']} already taken → skipped")

    print(f"\n=== {updated} updated, {created} created, {len(not_found)} not found ===")
    client.close()

asyncio.run(main())
