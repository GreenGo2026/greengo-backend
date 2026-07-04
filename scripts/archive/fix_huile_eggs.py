import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

FIXES = [
    ("Huile d'olive vierge", "زيت زيتون"),
    ("Plateau 15 oeufs",     "بلاطو 15 البيضة"),
    ("Plateau 30 oeufs",     "بلاطو 30 البيضة"),
]

async def main():
    db = AsyncIOMotorClient(os.environ["MONGODB_URI"])["greengo_db"]
    for name_fr, name_ar in FIXES:
        r = await db.products.update_one(
            {"name_fr": name_fr},
            {"$set": {"name_ar": name_ar}}
        )
        print(name_fr + ": " + ("updated" if r.modified_count else "no match"))

asyncio.run(main())
