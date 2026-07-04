import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# ═══════════════════════════════════════════════
# SOURCE OF TRUTH FROM POS IMAGES
# ═══════════════════════════════════════════════

PRICE_CORRECTIONS = [
    # ── LES ÉPICES ──────────────────────────────
    {"name_fr": "Ail",                        "price_mad": 60.0,  "category": "Épices"},
    {"name_fr": "Ail en poudre",              "price_mad": 10.0,  "category": "Épices"},
    {"name_fr": "Cannelle",                   "price_mad": 60.0,  "category": "Épices"},
    {"name_fr": "Cumin",                      "price_mad": 80.0,  "category": "Épices"},
    {"name_fr": "Curcuma",                    "price_mad": 50.0,  "category": "Épices"},
    {"name_fr": "Gingembre",                  "price_mad": 80.0,  "category": "Épices"},
    {"name_fr": "Paprika",                    "price_mad": 60.0,  "category": "Épices"},
    {"name_fr": "Poivre",                     "price_mad": 100.0, "category": "Épices"},
    {"name_fr": "Safran pur",                 "price_mad": 40.0,  "category": "Épices"},
    {"name_fr": "demi-cerneaux de noix",      "price_mad": 90.0,  "category": "Épices"},
    {"name_fr": "feuille de laurier",         "price_mad": 100.0, "category": "Épices"},
    {"name_fr": "graine de coriandre",        "price_mad": 30.0,  "category": "Épices"},
    {"name_fr": "knor",                       "price_mad": 7.0,   "category": "Épices"},
    {"name_fr": "knor safron",                "price_mad": 5.0,   "category": "Épices"},
    {"name_fr": "la charmoula pour poisson",  "price_mad": 7.5,   "category": "Épices"},
    {"name_fr": "la marinade pour viande",    "price_mad": 7.5,   "category": "Épices"},
    {"name_fr": "la marinade pour poulet",    "price_mad": 7.5,   "category": "Épices"},
    {"name_fr": "piment fort",                "price_mad": 60.0,  "category": "Épices"},
    {"name_fr": "pruneaux gros",              "price_mad": 70.0,  "category": "Épices"},
    {"name_fr": "raisins secs blonds",        "price_mad": 100.0, "category": "Épices"},
    {"name_fr": "raisins secs noirs",         "price_mad": 65.0,  "category": "Épices"},
    {"name_fr": "raisins secs rouges",        "price_mad": 50.0,  "category": "Épices"},
    {"name_fr": "shawarma",                   "price_mad": 7.5,   "category": "Épices"},
    # ── FRUITS ──────────────────────────────────
    {"name_fr": "Ananas",       "price_mad": 23.0, "category": "Fruits"},
    {"name_fr": "Banane",       "price_mad": 10.0, "category": "Fruits"},
    {"name_fr": "Citron",       "price_mad": 15.0, "category": "Fruits"},
    {"name_fr": "Grenade",      "price_mad": 20.0, "category": "Fruits"},
    {"name_fr": "Mandarine",    "price_mad": 15.0, "category": "Fruits"},
    {"name_fr": "Mangue",       "price_mad": 3.0,  "category": "Fruits"},
    {"name_fr": "Melon",        "price_mad": 5.0,  "category": "Fruits"},
    {"name_fr": "Orange",       "price_mad": 5.0,  "category": "Fruits"},
    {"name_fr": "Pastèque",     "price_mad": 2.0,  "category": "Fruits"},
    {"name_fr": "Poire",        "price_mad": 25.0, "category": "Fruits"},
    {"name_fr": "Pomme jaune",  "price_mad": 23.0, "category": "Fruits"},
    {"name_fr": "Prune",        "price_mad": 11.0, "category": "Fruits"},
    {"name_fr": "Pêche danona", "price_mad": 20.0, "category": "Fruits"},
    # ── OLIVES ──────────────────────────────────
    {"name_fr": "Agrich",              "price_mad": 55.0, "category": "Olives"},
    {"name_fr": "Mniwra",              "price_mad": 20.0, "category": "Olives"},
    {"name_fr": "Msslala",             "price_mad": 35.0, "category": "Olives"},
    {"name_fr": "Zitoun khal bldi",    "price_mad": 32.0, "category": "Olives"},
    {"name_fr": "barkouk",             "price_mad": 45.0, "category": "Olives"},
    {"name_fr": "carrotes",            "price_mad": 8.0,  "category": "Olives"},
    {"name_fr": "chlada hmra",         "price_mad": 40.0, "category": "Olives"},
    {"name_fr": "chlada sfra",         "price_mad": 40.0, "category": "Olives"},
    {"name_fr": "chou-fleur",          "price_mad": 16.0, "category": "Olives"},
    {"name_fr": "cornichon",           "price_mad": 35.0, "category": "Olives"},
    {"name_fr": "cornichon hind",      "price_mad": 50.0, "category": "Olives"},
    {"name_fr": "falfala garn hmar",   "price_mad": 25.0, "category": "Olives"},
    {"name_fr": "falfla lssan tir",    "price_mad": 14.0, "category": "Olives"},
    {"name_fr": "zitoun mkataa khal",  "price_mad": 32.0, "category": "Olives"},
    {"name_fr": "zitoun mkataa khdar", "price_mad": 32.0, "category": "Olives"},
    {"name_fr": "zitoun sfar",         "price_mad": 25.0, "category": "Olives"},
    # ── HUILE ET MIEL / AMLOU ───────────────────
    {"name_fr": "Amlou cacahuetes 500g",         "price_mad": 45.0,  "category": "Produits naturels"},
    {"name_fr": "Amlou cacahutes 250g",          "price_mad": 30.0,  "category": "Produits naturels"},
    {"name_fr": "Amlou cacahuétes 1kg",          "price_mad": 90.0,  "category": "Produits naturels"},
    {"name_fr": "Amlou d'amande 1kg",            "price_mad": 200.0, "category": "Produits naturels"},
    {"name_fr": "Amlou d'amande 250g",           "price_mad": 60.0,  "category": "Produits naturels"},
    {"name_fr": "Amlou d'amande 500g",           "price_mad": 110.0, "category": "Produits naturels"},
    {"name_fr": "Amlou graines de courge 1kg",   "price_mad": 130.0, "category": "Produits naturels"},
    {"name_fr": "Amlou graines de courge 250g",  "price_mad": 40.0,  "category": "Produits naturels"},
    {"name_fr": "Amlou graines de courge 500g",  "price_mad": 70.0,  "category": "Produits naturels"},
    {"name_fr": "Miel d'eucalyptus 1kg",         "price_mad": 150.0, "category": "Produits naturels"},
    {"name_fr": "Miel d'eucalyptus 250g",        "price_mad": 45.0,  "category": "Produits naturels"},
    {"name_fr": "Miel d'eucalyptus 500g",        "price_mad": 80.0,  "category": "Produits naturels"},
    {"name_fr": "Miel d'euphorbe 1kg",           "price_mad": 300.0, "category": "Produits naturels"},
    {"name_fr": "Miel d'oRange moumtaz 1kg",     "price_mad": 120.0, "category": "Produits naturels"},
]

PENDING_CONFIRMATION = [
    "Avocat", "Cerise", "Coing", "Figue", "Fraise",
    "Framboise", "Kiwi petite", "Melon jaune", "Mûre",
    "Noix de coco", "Pamplemousse", "Raisin",
    "Fenouil", "Macis", "Sel",
    "poireau", "potiron", "tomate saurise",
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    updated = 0
    not_found = []

    for item in PRICE_CORRECTIONS:
        result = await db.products.update_one(
            {"name_fr": {"$regex": f"^{item['name_fr']}$", "$options": "i"}},
            {"$set": {"price_mad": item["price_mad"], "category": item["category"]}}
        )
        if result.matched_count > 0:
            print(f"✅ {item['name_fr']:40} → {item['price_mad']:>8.2f} MAD")
            updated += 1
        else:
            result = await db.products.update_one(
                {"name_fr": {"$regex": item['name_fr'], "$options": "i"}},
                {"$set": {"price_mad": item["price_mad"], "category": item["category"]}}
            )
            if result.matched_count > 0:
                print(f"✅ (partial) {item['name_fr']:35} → {item['price_mad']:>8.2f} MAD")
                updated += 1
            else:
                not_found.append(item['name_fr'])
                print(f"❌ NOT FOUND: {item['name_fr']}")

    print(f"\n=== {updated} updated, {len(not_found)} not found ===")
    if not_found:
        print("\nNOT FOUND (may need to be added):")
        for n in not_found: print(f"  - {n}")

    print("\nPENDING MANUAL PRICE CONFIRMATION:")
    for p in PENDING_CONFIRMATION: print(f"  ⏳ {p}")

    print("\nCATEGORY SUMMARY:")
    async for row in db.products.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]):
        print(f"  {(row['_id'] or 'None'):30} {row['count']:3}")

    total = await db.products.count_documents({})
    print(f"\nTOTAL PRODUCTS: {total}")
    client.close()

asyncio.run(main())
