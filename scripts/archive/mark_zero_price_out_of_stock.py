import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient(os.environ["MONGODB_URI"])["greengo_db"]
    result = await db.products.update_many(
        {"price_mad": 0},
        {"$set": {"in_stock": False}}
    )
    print(f"Matched: {result.matched_count}, Updated: {result.modified_count}")

    # List affected products
    async for p in db.products.find({"price_mad": 0}, {"name_fr": 1, "price_mad": 1, "in_stock": 1}):
        print(f"  {p['name_fr']:38} price={p['price_mad']}  in_stock={p.get('in_stock')}")

asyncio.run(main())
