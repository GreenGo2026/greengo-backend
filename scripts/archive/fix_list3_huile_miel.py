import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

# Renames already applied (citron→orange, premium→moumtaz). Searches by final names.
# Zamita: moved to Produits naturels.
CORRECTIONS = [
    # (name_fr, name_ar, price, category_override)
    ("Miel de thym 1kg",              "عسل الزعتر 1 كغ",           400.0, None),
    ("Miel de thym 250g",             "عسل الزعتر 250غ",           100.0, None),
    ("Miel de thym 500g",             "عسل الزعتر 500غ",           200.0, None),
    ("Miel des fleurs 1kg",           "عسل الزهور 1 كغ",           130.0, None),
    ("Zamita",                        "زميطة",                      15.0,  "Produits naturels"),
    ("Amlou d'amande sans miel 250g", "أملو اللوز بدون عسل 250غ",  60.0,  "Produits naturels"),
    ("Amlou d'amande sans miel 500g", "أملو اللوز بدون عسل 500غ", 110.0,  "Produits naturels"),
    ("Miel d'euphorbe 250g",          "عسل الدغموس 250غ",           80.0,  None),
    ("Miel d'euphorbe 500g",          "عسل الدغموس 500غ",          150.0,  None),
    ("Miel d'orange almoualaf 1kg",   "عسل البرتقال الموالف 1 كغ",  70.0,  None),
    ("Miel d'orange almoualaf 250g",  "عسل البرتقال الموالف 250غ",  30.0,  None),
    ("Miel d'orange almoualaf 500g",  "عسل البرتقال الموالف 500غ",  35.0,  None),
    ("Miel d'orange moumtaz 250g",    "عسل البرتقال ممتاز 250غ",    40.0,  None),
    ("Miel d'orange moumtaz 500g",    "عسل البرتقال ممتاز 500غ",    65.0,  None),
    ("Huile d'olive vierge",          "زيت زيتون بكر",              40.0,  None),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = 0
    not_found = []

    for name_fr, name_ar, price, category in CORRECTIONS:
        update_fields = {"name_ar": name_ar, "price_mad": price}
        if category:
            update_fields["category"] = category

        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"$set": update_fields}
        )
        if result.matched_count > 0:
            cat_note = f" → {category}" if category else ""
            print(f"✅ {name_fr:35} | {name_ar:25} | {price} MAD{cat_note}")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ NOT FOUND: {name_fr}")

    print(f"\n=== {updated} updated, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
