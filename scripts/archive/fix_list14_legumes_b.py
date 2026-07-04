import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

CORRECTIONS = [
    ("betterave",            "شمندر",          7.0),
    ("chou",                 "ملفوف",          8.0),
    ("corian et persil",     "كزبرة ومعدنوس",  1.0),
    ("courgette rouge",      "كوسة حمراء",     7.0),
    ("cucumber marocain",    "خيار مغربي",     5.0),
    ("haricots verts",       "فاصوليا خضراء",  12.0),
    ("piment doux long",     "فلفل حلو طويل",  6.0),
    ("pomme de terre rouge", "بطاطا حمراء",    5.0),
    ("pommes nouvelles",     "بطاطا جديدة",    13.0),
    ("tkhlita couscous",     "تخلطـة الكسكس",  8.0),
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
            print(f"✅ {name_fr:22} | {name_ar:18} | {price} MAD")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ NOT FOUND: {name_fr}")

    print(f"\n=== {updated} updated, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
