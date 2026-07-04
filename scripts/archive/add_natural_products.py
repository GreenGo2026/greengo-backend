import asyncio, os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

CATEGORY_FR = "Produits naturels"

NATURAL_PRODUCTS = [
    # MIEL — عسل الزهور
    {"name_fr":"Miel des fleurs 250g","name_ar":"عسل الزهور 250غ","price_mad":40.0,"unit":"piece"},
    {"name_fr":"Miel des fleurs 500g","name_ar":"عسل الزهور 500غ","price_mad":70.0,"unit":"piece"},
    {"name_fr":"Miel des fleurs 1kg","name_ar":"عسل الزهور 1كغ","price_mad":130.0,"unit":"piece"},
    # عسل الدغموس
    {"name_fr":"Miel d'euphorbe 250g","name_ar":"عسل الدغموس 250غ","price_mad":80.0,"unit":"piece"},
    {"name_fr":"Miel d'euphorbe 500g","name_ar":"عسل الدغموس 500غ","price_mad":150.0,"unit":"piece"},
    {"name_fr":"Miel d'euphorbe 1kg","name_ar":"عسل الدغموس 1كغ","price_mad":300.0,"unit":"piece"},
    # عسل الكليبتوس
    {"name_fr":"Miel d'eucalyptus 250g","name_ar":"عسل الكليبتوس 250غ","price_mad":45.0,"unit":"piece"},
    {"name_fr":"Miel d'eucalyptus 500g","name_ar":"عسل الكليبتوس 500غ","price_mad":80.0,"unit":"piece"},
    {"name_fr":"Miel d'eucalyptus 1kg","name_ar":"عسل الكليبتوس 1كغ","price_mad":150.0,"unit":"piece"},
    # عسل الليمون الممتاز
    {"name_fr":"Miel de citron premium 250g","name_ar":"عسل الليمون الممتاز 250غ","price_mad":40.0,"unit":"piece"},
    {"name_fr":"Miel de citron premium 500g","name_ar":"عسل الليمون الممتاز 500غ","price_mad":65.0,"unit":"piece"},
    {"name_fr":"Miel de citron premium 1kg","name_ar":"عسل الليمون الممتاز 1كغ","price_mad":120.0,"unit":"piece"},
    # عسل الليمون المعلف
    {"name_fr":"Miel de citron almoualaf 500g","name_ar":"عسل الليمون المعلف 500غ","price_mad":35.0,"unit":"piece"},
    {"name_fr":"Miel de citron almoualaf 1kg","name_ar":"عسل الليمون المعلف 1كغ","price_mad":70.0,"unit":"piece"},
    # عسل الزعتر
    {"name_fr":"Miel de thym 250g","name_ar":"عسل الزعتر 250غ","price_mad":100.0,"unit":"piece"},
    {"name_fr":"Miel de thym 500g","name_ar":"عسل الزعتر 500غ","price_mad":200.0,"unit":"piece"},
    {"name_fr":"Miel de thym 1kg","name_ar":"عسل الزعتر 1كغ","price_mad":400.0,"unit":"piece"},
    # AMLOU — أملو لوز
    {"name_fr":"Amlou amande 250g","name_ar":"أملو لوز 250غ","price_mad":60.0,"unit":"piece"},
    {"name_fr":"Amlou amande 500g","name_ar":"أملو لوز 500غ","price_mad":110.0,"unit":"piece"},
    {"name_fr":"Amlou amande 1kg","name_ar":"أملو لوز 1كغ","price_mad":200.0,"unit":"piece"},
    # أملو بذور اليقطين
    {"name_fr":"Amlou graines de courge 250g","name_ar":"أملو بذور اليقطين 250غ","price_mad":40.0,"unit":"piece"},
    {"name_fr":"Amlou graines de courge 500g","name_ar":"أملو بذور اليقطين 500غ","price_mad":70.0,"unit":"piece"},
    {"name_fr":"Amlou graines de courge 1kg","name_ar":"أملو بذور اليقطين 1كغ","price_mad":130.0,"unit":"piece"},
    # أملو كاوكاو
    {"name_fr":"Amlou cacahuète 250g","name_ar":"أملو كاوكاو 250غ","price_mad":30.0,"unit":"piece"},
    {"name_fr":"Amlou cacahuète 500g","name_ar":"أملو كاوكاو 500غ","price_mad":45.0,"unit":"piece"},
    {"name_fr":"Amlou cacahuète 1kg","name_ar":"أملو كاوكاو 1كغ","price_mad":90.0,"unit":"piece"},
    # ÉPICES — توابل
    {"name_fr":"Épices poulet","name_ar":"توابل الدجاج","price_mad":7.50,"unit":"piece"},
    {"name_fr":"Épices poisson","name_ar":"توابل الحوت","price_mad":7.50,"unit":"piece"},
    {"name_fr":"Épices viande","name_ar":"توابل اللحم","price_mad":7.50,"unit":"piece"},
    {"name_fr":"Épices chawarma","name_ar":"توابل الشورما","price_mad":7.50,"unit":"piece"},
    # AUTRES PRODUITS NATURELS
    {"name_fr":"Rmita","name_ar":"الرميطة","price_mad":15.0,"unit":"piece"},
    {"name_fr":"Ilan","name_ar":"إلان","price_mad":15.0,"unit":"piece"},
    {"name_fr":"Blboula","name_ar":"بلبولة","price_mad":18.0,"unit":"piece"},
    {"name_fr":"Nabk","name_ar":"النبك","price_mad":15.0,"unit":"piece"},
    {"name_fr":"Soja","name_ar":"الصوجا","price_mad":15.0,"unit":"piece"},
    {"name_fr":"Caroube","name_ar":"الخروب","price_mad":15.0,"unit":"piece"},
    {"name_fr":"Couscous 5 céréales","name_ar":"الكسكس الخماسي","price_mad":18.0,"unit":"piece"},
    {"name_fr":"Couscous orge","name_ar":"الكسكس الشعير","price_mad":18.0,"unit":"piece"},
    {"name_fr":"Barkoukouch 5 céréales","name_ar":"بركوكش خماسي","price_mad":18.0,"unit":"piece"},
    {"name_fr":"Barkoukouch blé","name_ar":"بركوكش القمح","price_mad":18.0,"unit":"piece"},
]

OLD_HONEY_PATTERNS = [
    "miel des fleurs", "miel de thym", "miel d'euphorbe",
    "miel d'orange almoualaf", "miel d'oronge",
    "amlou d'amande", "zamita", "huile d'olive",
]

async def main():
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI not set")

    client = AsyncIOMotorClient(uri)
    db = client["greengo_db"]

    moved = 0
    for pattern in OLD_HONEY_PATTERNS:
        result = await db.products.update_many(
            {"name_fr": {"$regex": pattern, "$options": "i"}, "category": "Huile et miel"},
            {"$set": {"category": CATEGORY_FR}},
        )
        if result.modified_count > 0:
            print(f"📦 Moved {result.modified_count} product(s) matching '{pattern}' → {CATEGORY_FR}")
            moved += result.modified_count

    added = 0
    updated = 0
    for product in NATURAL_PRODUCTS:
        existing = await db.products.find_one(
            {"name_fr": {"$regex": f"^{product['name_fr']}$", "$options": "i"}}
        )
        if existing:
            await db.products.update_one(
                {"_id": existing["_id"]},
                {"$set": {"price_mad": product["price_mad"], "category": CATEGORY_FR, "name_ar": product["name_ar"]}},
            )
            print(f"✏️  Updated: {product['name_fr']} → {product['price_mad']} MAD")
            updated += 1
        else:
            await db.products.insert_one({
                **product,
                "category": CATEGORY_FR,
                "in_stock": True,
                "visible": True,
                "image_status": "pending",
                "on_sale": False,
                "discount_pct": 0,
                "created_at": datetime.utcnow(),
            })
            print(f"✅ Added: {product['name_fr']} ({product['price_mad']} MAD)")
            added += 1

    print(f"\n=== DONE: {added} added, {updated} updated, {moved} moved from old category ===")

    print("\nCATEGORY SUMMARY:")
    async for row in db.products.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]):
        print(f"  {(row['_id'] or 'None'):35} {row['count']:3} products")

    total = await db.products.count_documents({})
    print(f"\nTOTAL PRODUCTS IN DB: {total}")

    client.close()

asyncio.run(main())
