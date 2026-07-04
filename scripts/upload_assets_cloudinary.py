"""
Upload existing product images from assets/products/ to Cloudinary and write
secure_url → products.image_url in MongoDB.

Run:
  railway run python scripts/upload_assets_cloudinary.py

Paths are relative to the repo root (greengo-backend/).
Any "❌ DB NOT FOUND" line in the output means the name_fr needs correcting below.
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

# (local_image_path, name_fr in DB)
IMAGE_MAPPING = [

    # ── Eggs ──────────────────────────────────────────────────────────────
    ("assets/products/eggs/egg_blanc_frais.png",    "Oeufs petits"),
    ("assets/products/eggs/egg_brun_beldi.png",     "Oeufs beldi (12)"),
    ("assets/products/eggs/egg_caille.png",         "Oeufs de caille"),
    ("assets/products/eggs/egg_plateau_15.png",     "Plateau 15 oeufs"),
    ("assets/products/eggs/egg_plateau_30.png",     "Plateau 30 oeufs"),

    # ── Fruits ────────────────────────────────────────────────────────────
    ("assets/products/fruits/fruit_ananas.png",     "Ananas"),
    ("assets/products/fruits/fruit_banane.png",     "Banane"),
    ("assets/products/fruits/fruit_fraise.png",     "Fraise"),
    ("assets/products/fruits/fruit_framboise.png",  "Framboise"),
    ("assets/products/fruits/fruit_grenade.png",    "Grenade"),
    ("assets/products/fruits/fruit_kiwi.png",       "Kiwi petite"),   # ⚠️ confirm: "Kiwi petite" vs "Kiwi"
    ("assets/products/fruits/fruit_mangue.png",     "Mangue"),
    ("assets/products/fruits/fruit_myrtille.png",   "Myrtille"),       # ⚠️ confirm exact DB name
    ("assets/products/fruits/fruit_orange.png",     "Orange"),         # ⚠️ confirm exact DB name
    ("assets/products/fruits/fruit_pasteque.png",   "Pasteque"),
    ("assets/products/fruits/fruit_peche.png",      "peche"),
    ("assets/products/fruits/fruit_pomme.png",      "Pomme verte"),    # ⚠️ one generic apple image → mapped to Pomme verte; Pomme jaune / pomme rouge petite still need images
    ("assets/products/fruits/fruit_raisin_blanc.png", "Raisin blanc"), # ⚠️ confirm exact DB name

    # ── Olives & condiments ───────────────────────────────────────────────
    ("assets/products/olives/olive_verte.jpg",          "Zitoun khal"),     # ⚠️ confirm
    ("assets/products/olives/olive_rouge_piquante.jpg", "Zitoun hmar"),     # ⚠️ confirm
    ("assets/products/olives/olive_marinee_epices.jpg", "Zitoun mcharmal"), # ⚠️ confirm
    ("assets/products/olives/olive_noire_seche.jpg",    "Olives noires séchées (beldi)"),
    ("assets/products/olives/olive_noire_tranchee.jpg", "Olives noires tranchées"),
    ("assets/products/olives/olive_roseau.jpg",         "Agrich"),          # ⚠️ confirm: Agrich or Mniwra?
    ("assets/products/olives/olive_verte_citron.jpg",   "Hamd baldi"),      # ⚠️ confirm: hamd baldi = lemon-preserved olive?
    ("assets/products/olives/olive_verte_tranchee.jpg", "Chlada sfra"),     # ⚠️ confirm

    # ── Épices ────────────────────────────────────────────────────────────
    ("assets/products/spices/spice_cannelle.jpg",        "Cannelle"),
    ("assets/products/spices/spice_coriandre_moulue.jpg","Coriandre moulue"),
    ("assets/products/spices/spice_cumin.jpg",           "Cumin"),
    ("assets/products/spices/spice_curcuma.jpg",         "Curcuma"),
    ("assets/products/spices/spice_gingembre.jpg",       "Gingembre"),
    ("assets/products/spices/spice_paprika.jpg",         "Paprika"),
    ("assets/products/spices/spice_piment_rouge.jpg",    "Piment rouge moulu"),
    ("assets/products/spices/spice_poivre_noir.jpg",     "Poivre"),
    ("assets/products/spices/spice_ras_el_hanout.jpg",   "Ras el hanout"),

    # ── Légumes ───────────────────────────────────────────────────────────
    ("assets/products/vegetables/veg_ail.png",          "Ail"),
    ("assets/products/vegetables/veg_betterave.png",    "Betterave"),
    ("assets/products/vegetables/veg_brocoli.png",      "Brocoli"),
    ("assets/products/vegetables/veg_carotte.png",      "Carotte"),       # ⚠️ confirm: "Carotte" vs "carrotes"
    ("assets/products/vegetables/veg_celeri.png",       "Celeri"),
    ("assets/products/vegetables/veg_chou.png",         "Chou blanc"),
    ("assets/products/vegetables/veg_chou_fleur.png",   "Chou-fleur"),
    ("assets/products/vegetables/veg_coriandre.png",    "Coriandre"),     # ⚠️ confirm: fresh herb name in DB
    ("assets/products/vegetables/veg_courgette.png",    "Courgette"),
    ("assets/products/vegetables/veg_epinards.png",     "Epinards"),
    ("assets/products/vegetables/veg_haricots_verts.png","Haricots verts"),
    ("assets/products/vegetables/veg_laitue.png",       "Laitue"),
    ("assets/products/vegetables/veg_menthe.png",       "Menthe"),
    ("assets/products/vegetables/veg_navet.png",        "Navet"),
    ("assets/products/vegetables/veg_oignon_rouge.png", "Oignon rouge"),
    ("assets/products/vegetables/veg_persil.png",       "Persil"),
    ("assets/products/vegetables/veg_poivron_vert.png", "Poivron vert"),
    ("assets/products/vegetables/veg_pomme_de_terre.png","Pomme de terre"),
    ("assets/products/vegetables/veg_tomate.png",       "Tomate"),

    # ── Volailles / White Meats ───────────────────────────────────────────
    ("assets/products/white-meats/meat_ailes_poulet.jpg",  "Ailes de poulet"),
    ("assets/products/white-meats/meat_blanc_poulet.jpg",  "Filet de poulet"),   # ⚠️ blanc=filet — confirm
    ("assets/products/white-meats/meat_cuisse_poulet.jpg", "Cuisse de poulet"),
    ("assets/products/white-meats/meat_escalope_dinde.jpg","Filet de dinde"),    # ⚠️ escalope≈filet — confirm
    ("assets/products/white-meats/meat_foie_poulet.jpg",   "Foie de poulet"),
    ("assets/products/white-meats/meat_pilon_poulet.jpg",  "Batonnets de poulet"), # ⚠️ confirm: pilon vs bâtonnets
    ("assets/products/white-meats/meat_poulet_entier.jpg", "Poulet entier"),     # ⚠️ confirm exact DB name
    ("assets/products/white-meats/meat_poulet_hache.jpg",  "Kefta de poulet"),  # ⚠️ haché=kefta — confirm
]


def make_public_id(name_fr):
    slug = name_fr.lower()
    slug = slug.replace("'", "").replace("’", "")
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
    return slug


async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    updated = 0
    not_found = []
    upload_failed = []
    skipped_missing = []

    for local_path, name_fr in IMAGE_MAPPING:
        if not os.path.exists(local_path):
            print(f"⚠️  LOCAL FILE MISSING: {local_path}")
            skipped_missing.append(local_path)
            continue

        try:
            result = cloudinary.uploader.upload(
                local_path,
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
        print(f"\n❌ {len(not_found)} products not found in DB (name_fr mismatch):")
        for n in not_found: print(f"  - {n}")

    client.close()


asyncio.run(main())
