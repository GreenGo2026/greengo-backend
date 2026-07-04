import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient(os.environ["MONGODB_URI"])["greengo_db"]
    r = await db.products.update_one(
        {"name_fr": "Sel"},
        {"$set": {"price_mad": 0.0, "in_stock": False}}
    )
    print("Sel: " + ("updated" if r.modified_count else "no match"))

asyncio.run(main())
