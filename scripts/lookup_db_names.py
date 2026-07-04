"""
Show exact name_fr values for products in categories where upload names mismatched.
Run: railway run python scripts/lookup_db_names.py
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

CATEGORIES = ["Eggs", "Fruits", "Olives", "Epices", "Vegetables", "Cereales", "Grains"]

# Names that returned DB NOT FOUND — we need the real DB spelling
FAILED = [
    "Barkoukouch blé",
    "Oeuf blanc frais", "Oeuf brun beldi", "Oeuf de caille",
    "Pastèque", "Pêche danona", "Pomme",
    "Olive noire sèche", "Olive noire tranchée",
    "Poivre noir",
    "Céleri", "Chou", "Épinards",
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    print("=== DB name lookup for failed uploads ===\n")

    # 1. Show all products in affected categories
    for cat in CATEGORIES:
        products = await db.products.find(
            {"category": {"$regex": f"^{cat}$", "$options": "i"}},
            {"name_fr": 1, "name_ar": 1, "image_url": 1}
        ).sort("name_fr", 1).to_list(length=None)

        if not products:
            continue

        print(f"\n── {cat} ({len(products)} products) ──")
        for p in products:
            has_img = "✅" if p.get("image_url") else "❌"
            print(f"  {has_img}  {p.get('name_fr','(none)'):35}  {p.get('name_ar','')}")

    # 2. Fuzzy search: for each failed name, find any product containing key words
    print("\n\n=== Fuzzy matches for each failed name ===\n")
    for failed_name in FAILED:
        # Try first word of the name
        first_word = failed_name.split()[0]
        matches = await db.products.find(
            {"name_fr": {"$regex": first_word, "$options": "i"}},
            {"name_fr": 1, "category": 1, "image_url": 1}
        ).to_list(length=None)

        if matches:
            print(f"  '{failed_name}'  →  candidates:")
            for m in matches:
                has_img = "✅" if m.get("image_url") else "❌"
                print(f"      {has_img}  \"{m.get('name_fr','')}\"  [{m.get('category','')}]")
        else:
            print(f"  '{failed_name}'  →  NO MATCH EVEN ON FIRST WORD")

    client.close()

asyncio.run(main())
