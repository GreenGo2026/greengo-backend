import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

CORRECTIONS = [
    # (name_fr, name_ar, price, update_price)
    ("fifla mzawd",     "فلفلة مزودة",   15.0,  True),
    ("hamd baldi",      "حامض بلدي",     15.0,  True),
    ("hamd mthoun",     "حامض مطحون",    15.0,  True),
    ("hrissa",          "هريسة",         12.0,  True),
    ("hrissa khdra",    "هريسة خضراء",   12.0,  True),
    ("khlia 1kg",       "خلية 1 كغ",     150.0, True),
    ("khlia 250g",      "خلية 250غ",     40.0,  True),
    ("khlia 500g",      "خلية 500غ",     75.0,  True),
    ("sauce piquante",  "صوص حارة",      8.0,   True),
    ("sman",            "سمن",           90.0,  True),
    ("touma mkhlla",    "ثومة مخللة",    70.0,  True),
    ("zitoun bla adam", "زيتون بلا عظم", 32.0,  True),
    ("zitoun hmar",     "زيتون أحمر",    28.0,  True),
    ("zitoun khal",     "زيتون أخضر",    40.0,  True),
    ("zitoun mcharmal", "زيتون مشرمَل",  30.0,  True),
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
            print(f"✅ {name_fr:18} | {name_ar:18} | {note}")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ NOT FOUND: {name_fr}")

    print(f"\n=== {updated} updated, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
