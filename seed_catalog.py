# seed_catalog.py
# ---------------------------------------------------------------------------
# GreenGo Market — products collection seeder
# Usage:  python seed_catalog.py
# Requires MONGODB_URI in .env (or already set in the environment).
# ---------------------------------------------------------------------------
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
import os

# Load .env from the same directory as this script, then fall back to cwd
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MONGODB_URI: str = os.getenv("MONGODB_URI", "")
DB_NAME:     str = os.getenv("MONGO_DB_NAME", "greengo_db")
COLLECTION:  str = "products"

# ---------------------------------------------------------------------------
# Seed data — 20 core Moroccan grocery items
# ---------------------------------------------------------------------------

PRODUCTS: list[dict] = [
    # ── Vegetables ────────────────────────────────────────────────────────────
    {
        "name_ar":   "طماطم",
        "name_fr":   "Tomates",
        "category":  "Vegetables",
        "price_mad": 4.50,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "بطاطس",
        "name_fr":   "Pommes de terre",
        "category":  "Vegetables",
        "price_mad": 3.00,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "بصل",
        "name_fr":   "Oignons",
        "category":  "Vegetables",
        "price_mad": 2.50,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "جزر",
        "name_fr":   "Carottes",
        "category":  "Vegetables",
        "price_mad": 3.50,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "كوسة",
        "name_fr":   "Courgettes",
        "category":  "Vegetables",
        "price_mad": 4.00,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "فلفل أخضر",
        "name_fr":   "Poivron vert",
        "category":  "Vegetables",
        "price_mad": 5.00,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "خس",
        "name_fr":   "Laitue",
        "category":  "Purified Greens",
        "price_mad": 3.00,
        "unit":      "ربطة",
        "in_stock":  True,
    },
    {
        "name_ar":   "معدنوس",
        "name_fr":   "Persil",
        "category":  "Purified Greens",
        "price_mad": 1.50,
        "unit":      "ربطة",
        "in_stock":  True,
    },
    {
        "name_ar":   "كزبرة",
        "name_fr":   "Coriandre",
        "category":  "Purified Greens",
        "price_mad": 1.50,
        "unit":      "ربطة",
        "in_stock":  True,
    },
    # ── Fruits ────────────────────────────────────────────────────────────────
    {
        "name_ar":   "تفاح",
        "name_fr":   "Pommes",
        "category":  "Fruits",
        "price_mad": 8.00,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "موز",
        "name_fr":   "Bananes",
        "category":  "Fruits",
        "price_mad": 7.00,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "برتقال",
        "name_fr":   "Oranges",
        "category":  "Fruits",
        "price_mad": 4.00,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "رمان",
        "name_fr":   "Grenade",
        "category":  "Fruits",
        "price_mad": 10.00,
        "unit":      "كيلو",
        "in_stock":  False,   # seasonal
    },
    # ── White Meats ───────────────────────────────────────────────────────────
    {
        "name_ar":   "دجاج كامل",
        "name_fr":   "Poulet entier",
        "category":  "White Meats",
        "price_mad": 28.00,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "صدر الدجاج",
        "name_fr":   "Blanc de poulet",
        "category":  "White Meats",
        "price_mad": 45.00,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "دجاج مفروم",
        "name_fr":   "Poulet haché",
        "category":  "White Meats",
        "price_mad": 40.00,
        "unit":      "كيلو",
        "in_stock":  True,
    },
    {
        "name_ar":   "ديك رومي مفروم",
        "name_fr":   "Dinde hachée",
        "category":  "White Meats",
        "price_mad": 50.00,
        "unit":      "كيلو",
        "in_stock":  False,
    },
    # ── Eggs ─────────────────────────────────────────────────────────────────
    {
        "name_ar":   "بيض بلدي",
        "name_fr":   "Œufs fermiers",
        "category":  "Eggs",
        "price_mad": 15.00,
        "unit":      "كرتونة 12",
        "in_stock":  True,
    },
    {
        "name_ar":   "بيض كبير",
        "name_fr":   "Œufs grands",
        "category":  "Eggs",
        "price_mad": 13.00,
        "unit":      "كرتونة 12",
        "in_stock":  True,
    },
    {
        "name_ar":   "بيض صغير",
        "name_fr":   "Œufs petits",
        "category":  "Eggs",
        "price_mad": 10.00,
        "unit":      "كرتونة 12",
        "in_stock":  True,
    },
]

# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

async def seed() -> None:
    if not MONGODB_URI:
        raise RuntimeError(
            "MONGODB_URI is not set. "
            "Add it to your .env file or export it as an environment variable."
        )

    print(f"🔌 Connecting to MongoDB …")
    client: AsyncIOMotorClient = AsyncIOMotorClient(MONGODB_URI)

    try:
        # Verify the connection is alive before doing anything destructive
        await client.admin.command("ping")
        print(f"✅ Connected — database: '{DB_NAME}', collection: '{COLLECTION}'")
    except Exception as exc:
        raise RuntimeError(f"Could not reach MongoDB: {exc}") from exc

    db         = client[DB_NAME]
    collection = db[COLLECTION]

    # ── 1. Clear existing documents ──────────────────────────────────────────
    delete_result = await collection.delete_many({})
    print(f"🗑️  Cleared {delete_result.deleted_count} existing document(s).")

    # ── 2. Stamp each document with a creation timestamp ────────────────────
    now      = datetime.now(tz=timezone.utc)
    stamped  = [{**p, "created_at": now} for p in PRODUCTS]

    # ── 3. Insert ────────────────────────────────────────────────────────────
    insert_result = await collection.insert_many(stamped)
    print(
        f"✅ Inserted {len(insert_result.inserted_ids)} product(s) "
        f"into '{DB_NAME}.{COLLECTION}'."
    )

    # ── 4. Summary by category ───────────────────────────────────────────────
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort":  {"_id": 1}},
    ]
    cursor = collection.aggregate(pipeline)
    rows   = await cursor.to_list(length=50)

    print("\n📦 Seeded inventory by category:")
    for row in rows:
        print(f"   {row['_id']:20s}  {row['count']} item(s)")

    in_stock_count = await collection.count_documents({"in_stock": True})
    oos_count      = await collection.count_documents({"in_stock": False})
    print(f"\n   In stock : {in_stock_count}")
    print(f"   Out of stock: {oos_count}")
    print("\n🌿 GreenGo catalog seeded successfully.\n")

    client.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    asyncio.run(seed())