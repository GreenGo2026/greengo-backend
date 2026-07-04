import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

TO_DELETE = ["Batonnets de poulet", "Cordon bleu", "Pane de poulet"]

async def main():
    db = AsyncIOMotorClient(os.environ["MONGODB_URI"])["greengo_db"]
    for name in ["Batonnets de poulet", "Cordon bleu", "Pané de poulet"]:
        r = await db.products.delete_one({"name_fr": name})
        print(name + ": " + ("deleted" if r.deleted_count else "NOT FOUND"))

asyncio.run(main())
