import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    print("PRODUCTS WITH MISSING PRICE (price_mad == 0)\n")
    print(f"{'Category':20} {'name_fr':30} {'name_ar':25} {'price':>8}")
    print("-" * 90)

    count = 0
    async for p in db.products.find(
        {"price_mad": {"$in": [0, 0.0]}},
        sort=[("category", 1), ("name_fr", 1)]
    ):
        print(f"{p.get('category',''):20} "
              f"{p.get('name_fr',''):30} "
              f"{p.get('name_ar',''):25} "
              f"{p.get('price_mad',0):>8.2f}")
        count += 1

    print(f"\nTotal: {count} products with missing price")
    client.close()

asyncio.run(main())
