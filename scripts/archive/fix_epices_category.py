import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

PRODUCTS = [
    "Epices chawarma",
    "Epices poisson",
    "Epices poulet",
    "Epices viande",
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]
    updated = 0
    not_found = []

    for name_fr in PRODUCTS:
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{name_fr}$", "$options": "i"}},
            {"$set": {"category": "Épices"}}
        )
        if result.matched_count > 0:
            print(f"✅ {name_fr}  →  Épices")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ NOT FOUND: {name_fr}")

    print(f"\n=== {updated} moved to Épices, {len(not_found)} not found ===")
    if not_found:
        for n in not_found: print(f"  - {n}")
    client.close()

asyncio.run(main())
