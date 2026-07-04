import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

TO_DELETE = [
    "Cerise", "Coing", "Figue", "Fraise", "Grenade",
    "Mandarine", "Melon jaune", "Myrtille", "Poire",
    "kiwi grande", "pomme vert",
]

async def main():
    db = AsyncIOMotorClient(os.environ["MONGODB_URI"])["greengo_db"]
    for name in TO_DELETE:
        r = await db.products.delete_one({"name_fr": name})
        status = "deleted" if r.deleted_count else "NOT FOUND"
        print(name + ": " + status)

asyncio.run(main())
