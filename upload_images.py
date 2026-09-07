"""
upload_images.py — Upload local product images to Cloudinary and link them in MongoDB.

Usage:
    python upload_images.py [--dry-run]

For each PNG in the image folder:
  1. Normalize the filename to match a product's name_fr or name_ar
  2. Upload to Cloudinary (folder: greengo/products) with f_auto,q_auto
  3. Update the product's image_url in MongoDB
"""
from __future__ import annotations

import argparse
import os
import sys
import unicodedata
from pathlib import Path

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from pymongo import MongoClient

# -- Config --------------------------------------------------------------------

# Same convention as app/main.py -- secrets live in .env, never in the script.
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY    = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")

MONGODB_URI  = os.environ.get("MONGODB_URI")
MONGO_DB     = os.environ.get("MONGO_DB_NAME", "greengo_db")

_missing = [
    name for name, val in (
        ("CLOUDINARY_CLOUD_NAME", CLOUDINARY_CLOUD_NAME),
        ("CLOUDINARY_API_KEY",    CLOUDINARY_API_KEY),
        ("CLOUDINARY_API_SECRET", CLOUDINARY_API_SECRET),
        ("MONGODB_URI",           MONGODB_URI),
    ) if not val
]
if _missing:
    sys.exit(f"Missing required env vars in .env: {', '.join(_missing)}")

IMAGE_FOLDER = Path(r"C:\Windows\System32\greengo-backend\assets\products\Produit GreenGo")

# Folders holding product images awaiting upload. --folder overrides.
KNOWN_FOLDERS = {
    "greengo":  Path(r"C:\Windows\System32\greengo-backend\assets\products\Produit GreenGo"),
    "new":      Path(r"C:\Windows\System32\greengo-backend\assets\products\My Product New"),
    "images":   Path(r"C:\Windows\System32\greengo-backend\images"),
}

# -- Cloudinary setup ----------------------------------------------------------

cloudinary.config(
    cloud_name = CLOUDINARY_CLOUD_NAME,
    api_key    = CLOUDINARY_API_KEY,
    api_secret = CLOUDINARY_API_SECRET,
    secure     = True,
)

# -- Helpers -------------------------------------------------------------------

def normalize(s: str) -> str:
    """Strip accents, lowercase, collapse spaces — for fuzzy matching."""
    nfd = unicodedata.normalize("NFD", s.lower())
    stripped = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return " ".join(stripped.split())


def cloudinary_url(public_id: str) -> str:
    """Return the f_auto,q_auto delivery URL for a Cloudinary public_id."""
    return (
        f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}"
        f"/image/upload/f_auto,q_auto/{public_id}"
    )


def build_index(products: list[dict]) -> dict[str, dict]:
    """
    Build a lookup dict: normalized_name -> product doc.
    Indexes both name_fr and name_ar for each product.
    """
    idx: dict[str, dict] = {}
    for p in products:
        for field in ("name_fr", "name_ar"):
            val = (p.get(field) or "").strip()
            if val:
                key = normalize(val)
                if key:
                    idx[key] = p
    return idx


# Manual overrides: filename stem (lowercased, stripped) -> name_fr or name_ar to look up
# Used when fuzzy matching fails due to spelling differences between filename and DB
MANUAL_MAP: dict[str, str] = {
    "carob":                              "Caroube",
    "graines de millet ايلان": "Ilan",
    "peaches  danon":                     "pêche danon",
    "peaches":                            "peche",
    "pear":                               "Poire",
    "pomme june":                         "Pomme jaune",
    "soybean صوجا":   "Soja",
    "أملو الفول السوداني 1 كجم": "Amlou cacahuètes 1kg",
    "أملو الفول السوداني 500 غ (2)": "Amlou cacahuètes 500g",
    "فخد ديك الرومي":  "Beldi de dinde",
}


def match_product(stem: str, idx: dict[str, dict], products_by_name: dict[str, dict]) -> dict | None:
    """
    Try to match filename stem to a product.
    Strategy (in order):
      1. Manual override map (handles spelling mismatches)
      2. Exact normalized match against index
      3. Product name is a substring of the stem
      4. Stem is a substring of the product name (stem length >= 4)
    """
    # 1. Manual override
    manual_target = MANUAL_MAP.get(stem) or MANUAL_MAP.get(stem.lower())
    if manual_target:
        hit = products_by_name.get(manual_target)
        if hit:
            return hit

    norm_stem = normalize(stem)

    # 2. Exact
    if norm_stem in idx:
        return idx[norm_stem]

    # 3. Product name contained in stem
    for key, prod in idx.items():
        if key and key in norm_stem:
            return prod

    # 4. Stem contained in product name (min 4 chars to avoid false positives)
    if len(norm_stem) >= 4:
        for key, prod in idx.items():
            if norm_stem in key:
                return prod

    return None

# -- Main ----------------------------------------------------------------------

def main(dry_run: bool, folder: Path) -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(f"{'[DRY RUN] ' if dry_run else ''}Connecting to MongoDB…")
    client  = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    col     = client[MONGO_DB]["products"]
    products = list(col.find({}, {"_id": 1, "name_fr": 1, "name_ar": 1, "image_url": 1}))
    print(f"  -> {len(products)} products loaded from MongoDB")

    idx = build_index(products)
    print(f"  -> {len(idx)} name entries indexed\n")

    # Secondary index: exact name_fr or name_ar -> product (for manual map lookups)
    products_by_name: dict[str, dict] = {}
    for p in products:
        for field in ("name_fr", "name_ar"):
            val = (p.get(field) or "").strip()
            if val:
                products_by_name[val] = p

    # jpg as well as png -- several folders mix the two, and a png-only glob
    # silently drops them.
    images = sorted(
        p for p in folder.iterdir()
        if p.suffix.lower() in (".png", ".jpg", ".jpeg")
    )
    print(f"Found {len(images)} images in {folder}\n")

    ok = skipped = unmatched = errors = 0

    for img_path in images:
        stem = img_path.stem  # filename without extension
        product = match_product(stem, idx, products_by_name)

        if product is None:
            print(f"  [NO MATCH]  {stem}")
            unmatched += 1
            continue

        name_display = product.get("name_fr") or product.get("name_ar") or "?"
        existing_url = (product.get("image_url") or "").strip()

        if existing_url and "res.cloudinary.com" in existing_url:
            print(f"  [SKIP]      {stem!r}  ->  {name_display!r}  (already has Cloudinary URL)")
            skipped += 1
            continue

        print(f"  [UPLOAD]    {stem!r}  ->  {name_display!r}", end=" … ", flush=True)

        if dry_run:
            print("(dry run)")
            ok += 1
            continue

        try:
            # Public ID: greengo/products/<slug> — no extension, Cloudinary infers it
            slug = normalize(stem).replace(" ", "-")
            result = cloudinary.uploader.upload(
                str(img_path),
                folder      = "greengo/products",
                public_id   = slug,
                overwrite   = True,
                resource_type = "image",
            )
            public_id = result["public_id"]
            url = cloudinary_url(public_id)
            print(f"uploaded -> {public_id}")

            # Update MongoDB
            col.update_one(
                {"_id": product["_id"]},
                {"$set": {"image_url": url, "image_status": "ok"}},
            )
            ok += 1

        except Exception as exc:
            print(f"ERROR: {exc}")
            errors += 1

    print(f"\n{'-'*60}")
    print(f"  Uploaded : {ok}")
    print(f"  Skipped  : {skipped}  (already had Cloudinary URL)")
    print(f"  Unmatched: {unmatched}  (no product found)")
    print(f"  Errors   : {errors}")
    client.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Match only — don't upload or update DB")
    parser.add_argument(
        "--folder",
        default="greengo",
        help=f"Image folder: a shortcut ({', '.join(KNOWN_FOLDERS)}) or an explicit path",
    )
    args = parser.parse_args()

    folder = KNOWN_FOLDERS.get(args.folder, Path(args.folder))
    if not folder.is_dir():
        parser.error(f"not a directory: {folder}")

    main(dry_run=args.dry_run, folder=folder)
