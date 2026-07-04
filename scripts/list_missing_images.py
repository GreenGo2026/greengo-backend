"""
List all products that have no image (image_url absent, null, or empty).
Run: railway run python scripts/list_missing_images.py
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    query = {
        "$or": [
            {"image_url": {"$exists": False}},
            {"image_url": None},
            {"image_url": ""},
        ]
    }

    total_all = await db.products.count_documents({})
    total_missing = await db.products.count_documents(query)

    print(f"Total products : {total_all}")
    print(f"Missing image  : {total_missing}")
    print(f"Has image      : {total_all - total_missing}")
    print()
    print(f"{'Category':22} {'name_fr':35} {'name_ar':30}")
    print("-" * 92)

    async for p in db.products.find(
        query,
        sort=[("category", 1), ("name_fr", 1)]
    ):
        print(
            f"{p.get('category',''):22} "
            f"{p.get('name_fr',''):35} "
            f"{p.get('name_ar',''):30}"
        )

    client.close()

asyncio.run(main())
