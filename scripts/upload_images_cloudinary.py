"""
Upload product images to Cloudinary and write secure_url → products.image_url in MongoDB.

Setup (Railway Variables):
  CLOUDINARY_CLOUD_NAME=...
  CLOUDINARY_API_KEY=...
  CLOUDINARY_API_SECRET=...

Run:
  railway run python scripts/upload_images_cloudinary.py

Images must exist at paths relative to the repo root (greengo-backend/).
All image filenames in images/ are Arabic — mapping uses exact Arabic filenames.
"""
import cloudinary
import cloudinary.uploader
import asyncio, os, re
from motor.motor_asyncio import AsyncIOMotorClient

cloudinary.config(
    cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key=os.environ["CLOUDINARY_API_KEY"],
    api_secret=os.environ["CLOUDINARY_API_SECRET"],
)

# (local_image_path, name_fr in DB — current correct name after all renames)
# Filenames are the actual Arabic names found in greengo-backend/images/
IMAGE_MAPPING = [
    ("images/البلبولة.png",                         "Blboula"),

    # Amlou graines de courge (note: 250g starts with أملو, 500g starts with املو — different files)
    ("images/أملو بذور اليقطين 250 غ.png",          "Amlou graines de courge 250g"),
    ("images/املو بذور اليقطين 500 غ.png",           "Amlou graines de courge 500g"),

    # Amlou d'amande — single-space filenames
    ("images/أملو لوز 1 كجم.png",                   "Amlou d'amande 1kg"),
    ("images/أملو لوز 250 غ.png",                   "Amlou d'amande 250g"),
    ("images/أملو لوز 500 غ.png",                   "Amlou d'amande 500g"),
    # Amlou d'amande sans miel — double-space (NBSP+space) filenames on disk
    ("images/أملو لوز  1 كجم.png",                  "Amlou d'amande sans miel 1kg"),
    ("images/أملو لوز  250 غ.png",                  "Amlou d'amande sans miel 250g"),
    ("images/أملو لوز  500 غ.png",                  "Amlou d'amande sans miel 500g"),
    # amlou_cacahuetes_1kg — NO MATCHING FILE EXISTS, removed

    ("images/بركوكش القمح .png",                    "Barkoukouch ble"),

    ("images/عسل الدغموس 500 غ.png",                "Miel d'euphorbe 500g"),
    ("images/عسل الدغموس كيلو .png",                "Miel d'euphorbe 1kg"),
    ("images/عسل الزعتر 1 كجم.png",                 "Miel de thym 1kg"),
    ("images/عسل الزعتر 500 غ.png",                 "Miel de thym 500g"),
    ("images/عسل الزهور 1 كجم .png",                "Miel des fleurs 1kg"),
    ("images/عسل الزهور 500 غ.png",                 "Miel des fleurs 500g"),
    ("images/عسل الكالبتوس 1 كجم .png",             "Miel d'eucalyptus 1kg"),

    ("images/عسل الليمون المعلف  1 كجم.png",         "Miel d'orange almoualaf 1kg"),
    ("images/عسل الليمون المعلف 500 غ.png",          "Miel d'orange almoualaf 500g"),

    # These filenames have ".png" embedded mid-name — that is the actual filename on disk
    ("images/عسل الليمون الممتاز .png 1 كجم.png",   "Miel d'orange moumtaz 1kg"),
    ("images/عسل الليمون الممتاز .png 500 غ.png",   "Miel d'orange moumtaz 500g"),

    ("images/كسكس الخماسي 1 كجم.png",               "Couscous 5 cereales"),
    ("images/كسكس الشعير 1 كجم.png",                "Couscous orge"),
]

def make_public_id(name_fr):
    slug = name_fr.lower()
    slug = slug.replace("'", "").replace("'", "")
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
    return slug

def find_file(path):
    """Resolve a path whose filename may contain U+00A0 (NO-BREAK SPACE) on disk
    while the mapping uses U+0020 (regular space), or vice-versa."""
    if os.path.exists(path):
        return path
    dir_part = os.path.dirname(path) or "."
    name_part = os.path.basename(path)
    name_norm = name_part.replace(" ", " ")
    try:
        for f in os.listdir(dir_part):
            if f.replace(" ", " ") == name_norm:
                return os.path.join(dir_part, f)
    except OSError:
        pass
    return None

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    updated = 0
    not_found = []
    upload_failed = []
    skipped_missing = []

    for local_path, name_fr in IMAGE_MAPPING:
        actual_path = find_file(local_path)
        if actual_path is None:
            print(f"⚠️  LOCAL FILE MISSING: {local_path}")
            skipped_missing.append(local_path)
            continue

        try:
            result = cloudinary.uploader.upload(
                actual_path,
                folder="greengo/products",
                public_id=make_public_id(name_fr),
                overwrite=True,
            )
            image_url = result["secure_url"]
        except Exception as e:
            print(f"❌ UPLOAD FAILED  {local_path}: {e}")
            upload_failed.append(local_path)
            continue

        db_result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{re.escape(name_fr)}$", "$options": "i"}},
            {"$set": {"image_url": image_url, "image_status": "ready"}}
        )

        if db_result.matched_count > 0:
            print(f"✅ {name_fr:38} → {image_url}")
            updated += 1
        else:
            not_found.append(name_fr)
            print(f"❌ DB NOT FOUND   {name_fr}")

    print(f"\n=== {updated} images uploaded and linked ===")
    if skipped_missing:
        print(f"\n⚠️  {len(skipped_missing)} local files missing (skipped):")
        for f in skipped_missing: print(f"  - {f}")
    if upload_failed:
        print(f"\n❌ {len(upload_failed)} Cloudinary uploads failed:")
        for f in upload_failed: print(f"  - {f}")
    if not_found:
        print(f"\n❌ {len(not_found)} products not found in DB:")
        for n in not_found: print(f"  - {n}")

    client.close()

asyncio.run(main())
