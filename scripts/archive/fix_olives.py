import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient(os.environ["MONGODB_URI"])["greengo_db"]

    r1 = await db.products.update_one(
        {"name_fr": "Agrich"},
        {"$set": {"name_ar": "خليع"}}
    )
    print("Agrich name_ar: " + ("updated" if r1.modified_count else "no match"))

    r2 = await db.products.delete_one({"name_fr": "Carrotes"})
    print("Carrotes: " + ("deleted" if r2.deleted_count else "NOT FOUND"))

asyncio.run(main())
