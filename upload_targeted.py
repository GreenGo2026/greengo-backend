"""
upload_targeted.py — Upload specific product images to Cloudinary and update MongoDB.
Each entry: (image_filename, mongodb_id, cloudinary_slug, display_name)
"""
from __future__ import annotations

import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import os
from pathlib import Path
import cloudinary
import cloudinary.uploader
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

# Same convention as app/main.py -- secrets live in .env, never in the script.
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
API_KEY    = os.environ.get("CLOUDINARY_API_KEY")
API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")
MONGO_URI  = os.environ.get("MONGODB_URI")
MONGO_DB   = os.environ.get("MONGO_DB_NAME", "greengo_db")
IMG_DIR    = Path(__file__).parent / "assets" / "products" / "Produit GreenGo"

_missing = [
    name for name, val in (
        ("CLOUDINARY_CLOUD_NAME", CLOUD_NAME),
        ("CLOUDINARY_API_KEY",    API_KEY),
        ("CLOUDINARY_API_SECRET", API_SECRET),
        ("MONGODB_URI",           MONGO_URI),
    ) if not val
]
if _missing:
    sys.exit(f"Missing required env vars in .env: {', '.join(_missing)}")

cloudinary.config(cloud_name=CLOUD_NAME, api_key=API_KEY, api_secret=API_SECRET, secure=True)

# (filename, mongo_id, cloudinary_slug, label)
TARGETS = [
    # melon — REPLACE existing image
    ("melon.png",            "6a4178e5e2d5e9ac68c291eb", "melon",           "Melon"),
    # new products
    ("pomme story.png",      "6a465ead2a77f8ba79ec75fe", "pomme-story",     "pomme story"),
    ("برقوق المارتيني.png",  "6a465ef52a77f8ba79ec75ff", "barkouk-martini", "prune matrin"),
    ("red morzalila.jpg",    "6a3ffd2cf4877c80b8868cda", "red-morzalila",   "Mozzarella rouge"),
    ("حب الملوك.png",        "6a4658ed2a77f8ba79ec75eb", "habb-lmelouk",    "cerise / حب الملوك"),
    ("حامض بلدي.png",        "6a4290fae2d5e9ac68c29222", "hamed-bledi",     "hamd baldi / حامض بلدي"),
    ("زعفران خالص.png",      "6a4178f3e2d5e9ac68c291f0", "safran-khalis",   "Safran pur / زعفران خالص"),
    ("عطرية السمك.png",      "6a41233fd26d5260bde1a875", "3atrya-lhout",    "Epices poisson / عطرية السمك"),
    ("كفتة الديك الرومي.png","6a429064e2d5e9ac68c2921f", "kefta-dinde",     "Kefta de dinde"),
    ("مسلالا.png",           "6a417906e2d5e9ac68c291fd", "msellala",        "Msslala / مسلالا"),
]

def cloudinary_url(public_id: str) -> str:
    return f"https://res.cloudinary.com/{CLOUD_NAME}/image/upload/f_auto,q_auto/{public_id}"

def main() -> None:
    col = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10_000)[MONGO_DB]["products"]

    ok = errors = 0
    for filename, mongo_id, slug, label in TARGETS:
        img_path = IMG_DIR / filename
        if not img_path.exists():
            print(f"  [MISSING]  {filename}")
            errors += 1
            continue

        print(f"  [UPLOAD]   {filename}  ->  {label}", end=" ... ", flush=True)
        try:
            result = cloudinary.uploader.upload(
                str(img_path),
                folder        = "greengo/products",
                public_id     = slug,
                overwrite     = True,
                resource_type = "image",
            )
            public_id = result["public_id"]
            url = cloudinary_url(public_id)

            col.update_one(
                {"_id": ObjectId(mongo_id)},
                {"$set": {"image_url": url, "image_status": "ok"}},
            )
            print(f"OK -> {url[:70]}")
            ok += 1
        except Exception as exc:
            print(f"ERROR: {exc}")
            errors += 1

    print(f"\nDone: {ok} uploaded, {errors} errors")

if __name__ == "__main__":
    main()
