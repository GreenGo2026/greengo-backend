import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

TO_DELETE = [
    "Ailes de dinde",
    "Cuisses de dinde",
    "Dinde hachée",
    "Escalope de dinde",
    "Filet de dinde",
    "Filet de poulet",
    "Foie de dinde",
    "Pilon de poulet",
    "Poulet hache",
]

async def main():
    db = AsyncIOMotorClient(os.environ["MONGODB_URI"])["greengo_db"]
    for name in TO_DELETE:
        r = await db.products.delete_one({"name_fr": name})
        print(name + ": " + ("deleted" if r.deleted_count else "NOT FOUND"))

asyncio.run(main())
