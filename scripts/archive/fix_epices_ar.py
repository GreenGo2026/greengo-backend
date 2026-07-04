import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

FIXES = [
    ("Epices chawarma", "عطرية الشاورما"),
    ("Epices poisson",  "عطرية السمك"),
    ("Epices poulet",   "عطرية الدجاج"),
    ("Epices viande",   "عطرية اللحم"),
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
