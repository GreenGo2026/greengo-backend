"""
Link smaller-size honey/amlou products to the same Cloudinary image as their
larger-size sibling already in the DB. No upload needed — just copies image_url.

Run:
  railway run python scripts/link_size_variants.py
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

# (source name_fr that already has an image, target name_fr that needs one)
VARIANTS = [
    ("Miel d'eucalyptus 1kg",          "Miel d'eucalyptus 500g"),
    ("Miel d'eucalyptus 1kg",          "Miel d'eucalyptus 250g"),
    ("Miel d'euphorbe 500g",           "Miel d'euphorbe 250g"),
    ("Miel d'orange almoualaf 500g",   "Miel d'orange almoualaf 250g"),
    ("Miel d'orange moumtaz 500g",     "Miel d'orange moumtaz 250g"),
    ("Miel de thym 500g",              "Miel de thym 250g"),
    ("Miel des fleurs 500g",           "Miel des fleurs 250g"),
    ("Amlou graines de courge 500g",   "Amlou graines de courge 1kg"),
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    linked = 0
    skipped = 0

    for source_name, target_name in VARIANTS:
        source = await db.products.find_one(
            {"name_fr": {"$regex": f"^{source_name}$", "$options": "i"}},
            {"image_url": 1, "name_fr": 1}
        )
        if not source or not source.get("image_url"):
            print(f"⚠️  Source has no image, skipping: {source_name}")
            skipped += 1
            continue

        url = source["image_url"]
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{target_name}$", "$options": "i"},
             "$or": [{"image_url": {"$exists": False}}, {"image_url": None}, {"image_url": ""}]},
            {"$set": {"image_url": url, "image_status": "ready"}}
        )
        if result.modified_count:
            print(f"✅ {target_name:40} ← {source_name}")
            linked += 1
        else:
            existing = await db.products.find_one(
                {"name_fr": {"$regex": f"^{target_name}$", "$options": "i"}},
                {"image_url": 1}
            )
            if existing and existing.get("image_url"):
                print(f"⏭️  Already has image: {target_name}")
            else:
                print(f"❌ Target not found in DB: {target_name}")
            skipped += 1

    print(f"\n=== {linked} linked, {skipped} skipped ===")
    client.close()

asyncio.run(main())
