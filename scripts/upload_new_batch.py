"""
Upload images from assets/products/My Product New/ to Cloudinary
and write secure_url -> products.image_url in MongoDB.

Run:
  PYTHONIOENCODING=utf-8 railway run python scripts/upload_new_batch.py
"""
import cloudinary, cloudinary.uploader
import asyncio, os, re
from motor.motor_asyncio import AsyncIOMotorClient

cloudinary.config(
    cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key=os.environ["CLOUDINARY_API_KEY"],
    api_secret=os.environ["CLOUDINARY_API_SECRET"],
)

BASE = "assets/products/My Product New"

IMAGE_MAPPING = [
    (f"{BASE}/أفوكادو.png",              "Avocat"),
    (f"{BASE}/العنب أخضر.png",           "raisin vert"),
    (f"{BASE}/برقوق.png",                "Prune"),
    (f"{BASE}/بصل.png",                  "Oignon"),
    (f"{BASE}/بطاطا حلوة.jpg",           "Patate douce"),
    (f"{BASE}/بطيخ أصفر .png",           "Melon"),
    (f"{BASE}/زيتون أخضر بلدي.png",      "Zitoun khal bldi"),
    (f"{BASE}/زيتون بلا عضم .jpg",       "zitoun bla adam"),
    (f"{BASE}/زيتون مقطع أخضر .png",     "Zitoun mkataa khdar"),
    (f"{BASE}/طماطم كرزية.png",          "Tomate saurise"),
    (f"{BASE}/فجل.png",                  "Radis"),
    (f"{BASE}/فلفل حلو .png",            "Poivron"),
    (f"{BASE}/كورنيشون.png",             "Cornichon"),
    (f"{BASE}/ليمون.png",                "Citron"),
]

def make_public_id(name_fr):
    slug = name_fr.lower()
    slug = slug.replace("'", "").replace("'", "")
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
    return slug

def find_file(path):
    if os.path.exists(path):
        return path
    dir_part = os.path.dirname(path) or "."
    name_part = os.path.basename(path)
    name_norm = name_part.replace("\xa0", " ")
    try:
        for f in os.listdir(dir_part):
            if f.replace("\xa0", " ") == name_norm:
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
            print("MISSING: " + local_path)
            skipped_missing.append(local_path)
            continue

        try:
            result = cloudinary.uploader.upload(
                actual_path,
                folder="greengo/products",
                public_id=make_public_id(name_fr),
                overwrite=True,
            )
            url = result["secure_url"]
            # Apply f_auto,q_auto
            url = url.replace("/upload/", "/upload/f_auto,q_auto/", 1)
        except Exception as e:
            print("UPLOAD FAILED: " + local_path + " — " + str(e))
            upload_failed.append(local_path)
            continue

        r = await db.products.update_one(
            {"name_fr": {"$regex": f"^{re.escape(name_fr)}$", "$options": "i"}},
            {"$set": {"image_url": url, "image_status": "ready"}}
        )
        if r.matched_count:
            print("OK: " + name_fr + " -> " + url)
            updated += 1
        else:
            print("DB NOT FOUND: " + name_fr)
            not_found.append(name_fr)

    print(f"\n=== {updated} uploaded and linked, {len(skipped_missing)} missing, {len(upload_failed)} failed, {len(not_found)} DB not found ===")
    client.close()

asyncio.run(main())
