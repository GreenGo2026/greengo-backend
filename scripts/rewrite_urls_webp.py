"""
Rewrite existing Cloudinary image URLs to add f_auto,q_auto transformation.
Cloudinary will then serve WebP/AVIF automatically based on browser support.
No download, no re-upload, no PIL required.

Run:
  railway run python scripts/rewrite_urls_webp.py
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

TRANSFORM = "f_auto,q_auto"

def rewrite(url: str) -> str | None:
    """Insert f_auto,q_auto after /upload/ if not already present."""
    if "/upload/" not in url:
        return None
    if TRANSFORM in url:
        return None  # already done
    return url.replace("/upload/", f"/upload/{TRANSFORM}/", 1)

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    rewritten = 0
    already_done = 0
    skipped_no_url = 0
    skipped_non_cloudinary = 0

    async for p in db.products.find(
        {"image_url": {"$exists": True, "$nin": ["", None]}},
        sort=[("category", 1), ("name_fr", 1)]
    ):
        url = p.get("image_url", "")
        name_fr = p.get("name_fr", "?")

        if not url:
            skipped_no_url += 1
            continue

        new_url = rewrite(url)

        if new_url is None:
            if TRANSFORM in url:
                already_done += 1
            else:
                print(f"⏭️  Non-Cloudinary URL skipped: {name_fr}")
                skipped_non_cloudinary += 1
            continue

        await db.products.update_one(
            {"_id": p["_id"]},
            {"$set": {"image_url": new_url}}
        )
        print(f"✅ {name_fr:38} → {new_url}")
        rewritten += 1

    print(f"\n=== Done ===")
    print(f"  Rewritten          : {rewritten}")
    print(f"  Already had f_auto : {already_done}")
    print(f"  Non-Cloudinary URL : {skipped_non_cloudinary}")
    print(f"  No URL             : {skipped_no_url}")

    client.close()

asyncio.run(main())
