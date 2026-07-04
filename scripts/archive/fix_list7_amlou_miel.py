import asyncio, os, re, unicodedata
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

def _sku(name_fr: str) -> str:
    s = unicodedata.normalize("NFD", name_fr.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "product"

# Searches by final correct names (renames cacahuete→cacahuètes, amande→d'amande already applied)
CORRECTIONS = [
    # (name_fr, name_ar, price, update_price)
    ("Amlou cacahuètes 500g",          "أملو الفول السوداني 500غ",  45.0,  True),
    ("Amlou cacahuètes 250g",          "أملو الفول السوداني 250غ",  30.0,  True),
    ("Amlou cacahuètes 1kg",           "أملو الفول السوداني 1 كغ",  90.0,  True),
    ("Amlou d'amande 1kg",             "أملو اللوز 1 كغ",          200.0,  True),
    ("Amlou d'amande 250g",            "أملو اللوز 250غ",           60.0,  True),
    ("Amlou d'amande 500g",            "أملو اللوز 500غ",          110.0,  True),
    ("Amlou graines de courge 1kg",    "أملو بذور القرع 1 كغ",     130.0,  True),
    ("Amlou graines de courge 250g",   "أملو بذور القرع 250غ",      40.0,  True),
    ("Amlou graines de courge 500g",   "أملو بذور القرع 500غ",      70.0,  True),
    ("Miel d'eucalyptus 1kg",          "عسل الأوكالبتوس 1 كغ",      0.0,  False),  # price TBC
    ("Miel d'eucalyptus 250g",         "عسل الأوكالبتوس 250غ",      45.0,  True),
    ("Miel d'eucalyptus 500g",         "عسل الأوكالبتوس 500غ",      80.0,  True),
    ("Miel d'euphorbe 1kg",            "عسل الدغموس 1 كغ",           0.0,  False),  # price TBC
    ("Miel d'orange moumtaz 1kg",      "عسل البرتقال ممتاز 1 كغ",  120.0,  True),
]

NEW = [
    ("Amlou d'amande sans miel 1kg", "أملو اللوز بدون عسل 1 كغ", 200.0, "Produits naturels"),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = created = 0
    not_found = []

    print("=== PATCHES ===")
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
            print(f"✅ {name_fr:35} | {name_ar:25} | {note}")
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
            print(f"✅ (exists) {name_fr} | {name_ar} | {price} MAD")
            updated += 1
        else:
            doc = {"name_fr": name_fr, "name_ar": name_ar, "price_mad": price,
                   "category": category, "unit": "piece", "sku": _sku(name_fr)}
            try:
                await db.products.insert_one(doc)
                print(f"🆕 CREATED  {name_fr} | {name_ar} | {price} MAD")
                created += 1
            except DuplicateKeyError:
                print(f"⚠️  SKU CONFLICT  {name_fr} | sku={doc['sku']} already taken → skipped")

    print(f"\n=== {updated} updated, {created} created, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
