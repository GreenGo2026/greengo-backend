"""
Diagnose upload_images_cloudinary.py before running it.
Checks:
  1. "Belboula" / "Blboula" — find the actual name_fr in DB
  2. "Miel des fleurs 500g" — does it exist?
  3. All Produits naturels + Couscous products — to spot the 2 missing from IMAGE_MAPPING

railway run python scripts/check_image_targets.py
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

IMAGE_MAPPING_NAMES = {
    "Belboula",
    "Amlou graines de courge 500g", "Amlou graines de courge 250g",
    "Amlou d'amande 1kg", "Amlou d'amande 250g", "Amlou d'amande 500g",
    "Amlou cacahuètes 1kg",
    "Barkoukouch blé",
    "Miel d'euphorbe 500g", "Miel d'euphorbe 1kg",
    "Miel de thym 1kg", "Miel de thym 500g",
    "Miel des fleurs 1kg", "Miel des fleurs 500g",
    "Miel d'eucalyptus 1kg",
    "Miel d'orange almoualaf 1kg", "Miel d'orange almoualaf 500g",
    "Miel d'orange moumtaz 1kg", "Miel d'orange moumtaz 500g",
    "Couscous 5 céréales", "Couscous orge",
}

def norm(s):
    return (s or "").lower().strip()

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    # --- 1. Belboula / Blboula ---
    print("=== 1. BELBOULA SEARCH ===")
    async for p in db.products.find({"name_fr": {"$regex": "bel?boula", "$options": "i"}}):
        print(f"  id={p['_id']}  name_fr={p.get('name_fr')}  cat={p.get('category')}  price={p.get('price_mad')}")

    # --- 2. Miel des fleurs ---
    print("\n=== 2. MIEL DES FLEURS ===")
    async for p in db.products.find({"name_fr": {"$regex": "miel des fleurs", "$options": "i"}}):
        print(f"  id={p['_id']}  name_fr={p.get('name_fr')}  price={p.get('price_mad')}")

    # --- 3. Produits naturels + Couscous — full list vs IMAGE_MAPPING ---
    print("\n=== 3. PRODUITS NATURELS + COUSCOUS (all) ===")
    print(f"{'name_fr':40} {'price':>8}  {'in mapping?'}")
    print("-" * 65)
    categories = ["Produits naturels", "Couscous"]
    missing_from_mapping = []
    async for p in db.products.find(
        {"category": {"$in": categories}},
        sort=[("category", 1), ("name_fr", 1)]
    ):
        name = p.get("name_fr", "")
        price = p.get("price_mad", 0)
        matched = any(norm(name) == norm(m) for m in IMAGE_MAPPING_NAMES)
        tag = "✅" if matched else "❌ MISSING FROM MAPPING"
        print(f"  {name:40} {price:>8.2f}  {tag}")
        if not matched:
            missing_from_mapping.append(name)

    if missing_from_mapping:
        print(f"\n  → {len(missing_from_mapping)} products have no image in mapping:")
        for n in missing_from_mapping:
            print(f"     - {n}")
    else:
        print("\n  → All products in these categories are covered by IMAGE_MAPPING ✅")

    client.close()

asyncio.run(main())
