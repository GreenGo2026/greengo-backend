# scripts/export_catalog_by_category.py
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

# Review order — one category at a time
CATEGORY_ORDER = [
    "Vegetables",
    "Fruits",
    "Olives",
    "Épices",
    "Epices",
    "Produits naturels",
    "Fromage",
    "Volailles",
    "White Meats",
    "Huile et miel",
    "Eggs",
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    # Get all distinct categories in DB
    all_cats = await db.products.distinct("category")

    # Build ordered list — known categories first, then any extras
    ordered = CATEGORY_ORDER.copy()
    for cat in sorted(all_cats):
        if cat not in ordered:
            ordered.append(cat)

    grand_total = 0

    for cat in ordered:
        products = []
        async for p in db.products.find(
            {"category": cat}
        ).sort("name_fr", 1):
            products.append(p)

        if not products:
            continue

        print(f"\n{'='*95}")
        print(f"  CATEGORY: {cat}  ({len(products)} products)")
        print(f"{'='*95}")
        print(f"  {'#':>3}  {'name_fr':38} {'name_ar':26} "
              f"{'price':>8}  {'image':6}  vis")
        print(f"  {'-'*90}")

        for i, p in enumerate(products, 1):
            name_fr  = p.get("name_fr", "")
            name_ar  = p.get("name_ar", "") or "—"
            price    = p.get("price_mad", 0)
            has_img  = "OK" if p.get("image_url") else "NO"
            visible  = "Y" if p.get("visible", True) else "N"
            p_flag   = " !! NO PRICE" if price == 0 else ""

            print(f"  {i:>3}. {name_fr:38} {name_ar:26} "
                  f"{price:>8.2f}  {has_img}      {visible}"
                  f"{p_flag}")

        grand_total += len(products)
        print(f"\n  Subtotal: {len(products)} products")

    print(f"\n{'='*95}")
    print(f"  GRAND TOTAL: {grand_total} products")
    print(f"{'='*95}")

    client.close()

asyncio.run(main())
