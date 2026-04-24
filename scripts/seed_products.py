#!/usr/bin/env python3
"""
scripts/seed_products.py
Upserts the canonical GreenGo product catalog into MongoDB.
Uses the EXACT schema already present in the database:
  name_ar, name_fr, category, price_mad, unit, in_stock

Run from the project root:
    python scripts/seed_products.py
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

import certifi
import motor.motor_asyncio

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB_NAME", "greengo_db")
NOW       = datetime.now(timezone.utc)

# ---------------------------------------------------------------------------
# Catalog — uses exact DB field names: name_ar, name_fr, price_mad, in_stock
# ---------------------------------------------------------------------------
PRODUCTS = [
    # ── Vegetables ────────────────────────────────────────────────────────
    {"name_ar":"\u0637\u0645\u0627\u0637\u0645",           "name_fr":"Tomate",          "category":"Vegetables",  "price_mad":5.00,  "unit":"kg",     "in_stock":True},
    {"name_ar":"\u0628\u0635\u0644",                       "name_fr":"Oignon",          "category":"Vegetables",  "price_mad":3.50,  "unit":"kg",     "in_stock":True},
    {"name_ar":"\u0628\u0637\u0627\u0637\u0627",           "name_fr":"Pomme de terre",  "category":"Vegetables",  "price_mad":4.00,  "unit":"kg",     "in_stock":True},
    {"name_ar":"\u062c\u0632\u0631",                       "name_fr":"Carotte",         "category":"Vegetables",  "price_mad":4.00,  "unit":"kg",     "in_stock":True},
    {"name_ar":"\u0643\u0648\u0633\u0629",                 "name_fr":"Courgette",       "category":"Vegetables",  "price_mad":6.00,  "unit":"kg",     "in_stock":True},
    {"name_ar":"\u0641\u0644\u0641\u0644 \u0623\u062e\u0636\u0631","name_fr":"Poivron vert","category":"Vegetables","price_mad":8.00,"unit":"kg",     "in_stock":False},
    {"name_ar":"\u0643\u0632\u0628\u0631\u0629",           "name_fr":"Coriandre",       "category":"Vegetables",  "price_mad":2.00,  "unit":"bundle", "in_stock":True},
    {"name_ar":"\u0645\u0639\u062f\u0646\u0648\u0633",     "name_fr":"Persil",          "category":"Vegetables",  "price_mad":2.00,  "unit":"bundle", "in_stock":True},
    # ── Fruits ────────────────────────────────────────────────────────────
    {"name_ar":"\u062a\u0641\u0627\u062d",                 "name_fr":"Pomme",           "category":"Fruits",      "price_mad":7.00,  "unit":"kg",     "in_stock":True},
    {"name_ar":"\u0645\u0648\u0632",                       "name_fr":"Banane",          "category":"Fruits",      "price_mad":8.00,  "unit":"kg",     "in_stock":True},
    {"name_ar":"\u0628\u0631\u062a\u0642\u0627\u0644",     "name_fr":"Orange",          "category":"Fruits",      "price_mad":6.00,  "unit":"kg",     "in_stock":True},
    {"name_ar":"\u0631\u0645\u0627\u0646",                 "name_fr":"Grenade",         "category":"Fruits",      "price_mad":10.00, "unit":"kg",     "in_stock":False},
    {"name_ar":"\u0639\u0646\u0628",                       "name_fr":"Raisin",          "category":"Fruits",      "price_mad":12.00, "unit":"kg",     "in_stock":True},
    # ── White Meats ───────────────────────────────────────────────────────
    {"name_ar":"\u062f\u062c\u0627\u062c \u0643\u0627\u0645\u0644","name_fr":"Poulet entier","category":"White Meats","price_mad":45.00,"unit":"piece","in_stock":True},
    {"name_ar":"\u0635\u062f\u0631 \u0627\u0644\u062f\u062c\u0627\u062c","name_fr":"Blanc de poulet","category":"White Meats","price_mad":32.00,"unit":"kg","in_stock":True},
    # ── Eggs ──────────────────────────────────────────────────────────────
    {"name_ar":"\u0628\u064a\u0636 \u0628\u0644\u062f\u064a", "name_fr":"Oeufs fermiers","category":"Eggs",       "price_mad":12.00, "unit":"piece",  "in_stock":True},
]


async def seed() -> None:
    client = motor.motor_asyncio.AsyncIOMotorClient(
        MONGO_URI,
        tlsCAFile=certifi.where(),
    )
    col = client[DB_NAME]["products"]

    inserted = 0
    updated  = 0
    skipped  = 0

    for item in PRODUCTS:
        doc = {
            **item,
            "updated_at": NOW,
        }
        result = await col.update_one(
            {"name_ar": item["name_ar"]},   # match on Arabic name (stable key)
            {
                "$setOnInsert": {"created_at": NOW},
                "$set": doc,
            },
            upsert=True,
        )
        label = item["name_ar"]
        if result.upserted_id:
            inserted += 1
            print(f"  Inserted   {label}")
        elif result.modified_count:
            updated += 1
            print(f"  Updated    {label}")
        else:
            skipped += 1
            print(f"  No change  {label}")

    total = await col.count_documents({})
    print(f"\nSeed complete: {inserted} inserted, {updated} updated, {skipped} unchanged — {total} total documents.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())