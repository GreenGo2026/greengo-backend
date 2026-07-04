import asyncio, os, re, unicodedata
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

def _sku(name_fr: str) -> str:
    s = unicodedata.normalize("NFD", name_fr.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "product"

CORRECTIONS = [
    # (name_fr, name_ar, price, update_price)
    ("Ananas",      "أناناس",      23.0, True),
    ("Avocat",      "أفوكادو",      0.0, False),  # price TBC
    ("Banane",      "موز",         10.0, True),
    ("Cerise",      "كرز",          0.0, False),  # price TBC
    ("Citron",      "ليمون",       15.0, True),
    ("Coing",       "سفرجل",        0.0, False),  # price TBC
    ("Figue",       "تين",          0.0, False),  # price TBC
    ("Fraise",      "فراولة",       0.0, False),
    ("Framboise",   "توت العليق",   0.0, False),
    ("Grenade",     "رمان",        20.0, True),
    ("Kiwi petite", "كيوي صغيرة",  0.0, False),  # price TBC
    ("Mandarine",   "يوسفي",       15.0, True),
    ("Mangue",      "مانغا",        3.0, True),
    ("Melon",       "بطيخ أصفر",    5.0, True),
    ("Melon jaune", "شمام أصفر",    0.0, False),  # price TBC
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = created = 0
    not_found = []

    for name_fr, name_ar, price, update_price in CORRECTIONS:
        update_fields = {"name_ar": name_ar}
        if update_price and price > 0:
            update_fields["price_mad"] = price

        existing = await db.products.find_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}}
        )
        if existing:
            await db.products.update_one({"_id": existing["_id"]}, {"$set": update_fields})
            note = f"→ {price} MAD" if update_price else "(price unchanged)"
            print(f"✅ {name_fr:15} | {name_ar:14} | {note}")
            updated += 1
        else:
            doc = {"name_fr": name_fr, "name_ar": name_ar,
                   "price_mad": price, "category": "Fruits", "unit": "piece", "sku": _sku(name_fr)}
            try:
                await db.products.insert_one(doc)
                note = "(price TBC)" if price == 0 else f"{price} MAD"
                print(f"🆕 CREATED  {name_fr:15} | {name_ar:14} | {note}")
                created += 1
            except DuplicateKeyError:
                print(f"⚠️  SKU CONFLICT  {name_fr} | sku={doc['sku']} already taken → skipped")

    print(f"\n=== {updated} updated, {created} created, {len(not_found)} not found ===")
    client.close()

asyncio.run(main())
