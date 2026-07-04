import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

TO_DELETE = [
    "Coriandre moulue",
    "Fenouil",
    "demi-cerneaux de noix",
    "feuille de laurier",
    "graine de coriandre",
    "raisins secs blonds",
]

async def main():
    db = AsyncIOMotorClient(os.environ["MONGODB_URI"])["greengo_db"]

    r = await db.products.update_one(
        {"name_fr": "Curcuma"},
        {"$set": {"name_ar": "خرقوم"}}
    )
    print("Curcuma name_ar: " + ("updated" if r.modified_count else "no match"))

    for name in TO_DELETE:
        r = await db.products.delete_one({"name_fr": name})
        print(name + ": " + ("deleted" if r.deleted_count else "NOT FOUND"))

asyncio.run(main())
