import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    # Arabic name corrections
    r1 = await db.products.update_one(
        {"name_fr": "Chou-fleur"},
        {"$set": {"name_ar": "الشفلور"}}
    )
    print(f"Chou-fleur name_ar: {'updated' if r1.modified_count else 'no match'}")

    r2 = await db.products.update_one(
        {"name_fr": "Coriandre"},
        {"$set": {"name_ar": "قوزبر"}}
    )
    print(f"Coriandre name_ar: {'updated' if r2.modified_count else 'no match'}")

    # Deletions
    for name in ["Les chou", "Poireau", "Potiron"]:
        r = await db.products.delete_one({"name_fr": name})
        print(f"Delete {name}: {'deleted' if r.deleted_count else 'not found'}")

    client.close()

asyncio.run(main())
