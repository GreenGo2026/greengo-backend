import asyncio, os, re, unicodedata
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

def _sku(name_fr: str) -> str:
    s = unicodedata.normalize("NFD", name_fr.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "product"

PATCHES = [
    # (name_fr, name_ar, price, update_price)
    ("Navet",          "لفت",      8.0,  True),
    ("Oignon rouge",   "بصل أحمر", 3.0,  False),
    ("Pomme de terre", "بطاطا",    5.0,  True),
]

# Piment fort: Épices version was renamed to "Piment rouge moulu" by fix_piment_fort.py,
# so creating fresh-vegetable "Piment fort" here should succeed.
NEW_VEGETABLES = [
    # (name_fr, name_ar, price)
    ("Les chou",       "الملفوف",       0.0),   # price TBC
    ("Oignon",         "بصل",           3.0),
    ("Patate douce",   "بطاطا حلوة",    5.0),
    ("Piment fort",    "فلفل حار",     10.0),   # fresh vegetable (Épices version renamed)
    ("Poireau",        "كراث",          0.0),   # price TBC
    ("Poivron",        "فلفل حلو",      7.0),
    ("Potiron",        "قرع",           0.0),   # price TBC
    ("Radis",          "فجل",           7.0),
    ("Tomate",         "طماطم",        10.0),
    ("Tomate saurise", "طماطم كرزية",  10.0),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = created = 0
    not_found = []

    print("=== PATCHES ===")
    for name_fr, name_ar, price, update_price in PATCHES:
        update_fields = {"name_ar": name_ar}
        if update_price:
            update_fields["price_mad"] = price
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"$set": update_fields}
        )
        if result.matched_count > 0:
            note = f"→ {price} MAD" if update_price else "(price unchanged)"
            print(f"✅ {name_fr:18} | {name_ar:12} | {note}")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ NOT FOUND: {name_fr}")

    print("\n=== NEW VEGETABLES ===")
    for name_fr, name_ar, price in NEW_VEGETABLES:
        existing = await db.products.find_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}}
        )
        if existing:
            update_fields = {"name_ar": name_ar}
            if price > 0:
                update_fields["price_mad"] = price
            await db.products.update_one({"_id": existing["_id"]}, {"$set": update_fields})
            note = f"{price} MAD" if price > 0 else "(price TBC)"
            print(f"✅ (exists) {name_fr:18} | {name_ar:12} | {note}")
            updated += 1
        else:
            doc = {"name_fr": name_fr, "name_ar": name_ar, "price_mad": price,
                   "category": "Vegetables", "unit": "kg", "sku": _sku(name_fr)}
            try:
                await db.products.insert_one(doc)
                note = f"{price} MAD" if price > 0 else "(price TBC)"
                print(f"🆕 CREATED  {name_fr:18} | {name_ar:12} | {note}")
                created += 1
            except DuplicateKeyError as e:
                key = e.details.get("keyValue", {})
                print(f"⚠️  SKU CONFLICT  {name_fr:18} | sku={doc['sku']} already taken by another product → skipped")
                print(f"   (fix: rename the conflicting product's SKU, then re-run)")
                not_found.append(f"{name_fr} [SKU conflict: {key}]")

    print(f"\n=== {updated} updated, {created} created, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    print("\nSKIPPED  Petitpois — Arabic name needs confirmation")
    client.close()

asyncio.run(main())
