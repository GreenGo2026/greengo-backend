"""
Fix catalog duplicates identified in the June 2026 audit.
Safe to re-run: each operation is idempotent.

Run:
  railway run python scripts/fix_catalog_duplicates.py
"""
import asyncio, os
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    print("=== GreenGo catalog duplicate fixes ===\n")

    # ── 1. Delete duplicate "Piment rouge moulu" (no image, same price as keeper)
    #       Keeper  : 6a0b20e5d4687e1f5bfe4037  has image ✅
    #       Deleting: 6a4178f4e2d5e9ac68c291f5  no image  ❌
    r1 = await db.products.delete_one(
        {"_id": ObjectId("6a4178f4e2d5e9ac68c291f5")}
    )
    if r1.deleted_count:
        print("✅  Deleted duplicate Piment rouge moulu (6a4178f4e2d5e9ac68c291f5)")
    else:
        print("⚠️   Piment rouge moulu duplicate already gone (6a4178f4e2d5e9ac68c291f5 not found)")

    # ── 2. Clear wrong image from "Dinde hachée"
    #       meat_escalope_dinde.jpg belongs to Escalope de dinde only.
    #       Dinde hachée needs its own image.
    r2 = await db.products.update_one(
        {"name_fr": {"$regex": "^Dinde hach", "$options": "i"}},
        {"$unset": {"image_url": ""}, "$set": {"image_status": "missing"}}
    )
    if r2.modified_count:
        print("✅  Cleared image from 'Dinde hachée' (was sharing escalope image)")
    else:
        print("⚠️   'Dinde hachée' not found or image already cleared")

    # ── 3. Clear wrong image from "Oeufs petits"
    #       egg_blanc_frais.png stays on "Oeufs grands" only.
    #       "Oeufs petits" needs its own image.
    r3 = await db.products.update_one(
        {"name_fr": {"$regex": "^Oeufs? petits?$", "$options": "i"}},
        {"$unset": {"image_url": ""}, "$set": {"image_status": "missing"}}
    )
    if r3.modified_count:
        print("✅  Cleared image from 'Oeufs petits' (was sharing Oeufs grands image)")
    else:
        print("⚠️   'Oeufs petits' not found or image already cleared")

    # ── Verification ─────────────────────────────────────────────────────────
    print("\n--- Verification ---")
    remaining_piment = await db.products.count_documents(
        {"name_fr": {"$regex": "piment rouge moulu", "$options": "i"}}
    )
    print(f"  'Piment rouge moulu' entries remaining : {remaining_piment}  (expect 1)")

    dinde = await db.products.find_one(
        {"name_fr": {"$regex": "^Dinde hach", "$options": "i"}},
        {"name_fr": 1, "image_url": 1}
    )
    if dinde:
        print(f"  'Dinde hachée' image_url : {dinde.get('image_url') or '(none — correct)' }")

    oeufs_p = await db.products.find_one(
        {"name_fr": {"$regex": "^Oeufs? petits?$", "$options": "i"}},
        {"name_fr": 1, "image_url": 1}
    )
    if oeufs_p:
        print(f"  'Oeufs petits' image_url : {oeufs_p.get('image_url') or '(none — correct)'}")

    total = await db.products.count_documents({})
    missing = await db.products.count_documents({
        "$or": [
            {"image_url": {"$exists": False}},
            {"image_url": None},
            {"image_url": ""},
        ]
    })
    print(f"\n  Total products  : {total}")
    print(f"  Missing images  : {missing}")

    client.close()

asyncio.run(main())
