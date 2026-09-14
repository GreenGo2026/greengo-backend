import asyncio, os, re
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

REPLACEMENTS_FR = [
    ("en moins de 2h",        "en 30 minutes"),
    ("en moins de 2 h",       "en 30 minutes"),
    ("en 2h",                 "en 30 minutes"),
    ("en 2 h",                "en 30 minutes"),
    ("livraison en 2h",       "livraison en 30 minutes"),
    ("livraison en 2 h",      "livraison en 30 minutes"),
    ("livrés en 2h",          "livrés en 30 minutes"),
    ("livrés en 2 h",         "livrés en 30 minutes"),
    ("livré en 2h",           "livré en 30 minutes"),
    ("livré en 2 h",          "livré en 30 minutes"),
    ("en moins de 2 heures",  "en 30 minutes"),
    ("en 2 heures",           "en 30 minutes"),
    ("dans les 2h",           "dans les 30 minutes"),
    ("dans les 2 h",          "dans les 30 minutes"),
    ("sous 2h",               "en 30 minutes"),
    ("sous 2 h",              "en 30 minutes"),
]

REPLACEMENTS_AR = [
    ("خلال ساعتين",  "في 30 دقيقة"),
    ("في ساعتين",    "في 30 دقيقة"),
    ("أقل من ساعتين","في أقل من 30 دقيقة"),
    ("2 ساعة",       "30 دقيقة"),
    ("ساعتان",       "30 دقيقة"),
]

def apply_replacements(text: str,
                       replacements: list) -> str:
    if not text:
        return text
    result = text
    for old, new in replacements:
        # Case-insensitive for French
        result = re.sub(
            re.escape(old), new,
            result, flags=re.IGNORECASE
        )
    return result

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    # Find all affected products
    all_products = []
    async for p in db.products.find(
        {},
        {"_id":1, "name_fr":1,
         "description_fr":1, "description_ar":1}
    ):
        all_products.append(p)

    will_update = []
    for p in all_products:
        desc_fr = p.get("description_fr", "") or ""
        desc_ar = p.get("description_ar", "") or ""

        new_fr = apply_replacements(
            desc_fr, REPLACEMENTS_FR)
        new_ar = apply_replacements(
            desc_ar, REPLACEMENTS_AR)

        changed_fr = new_fr != desc_fr
        changed_ar = new_ar != desc_ar

        if changed_fr or changed_ar:
            will_update.append({
                "_id":     p["_id"],
                "name":    p.get("name_fr","?"),
                "old_fr":  desc_fr[:80],
                "new_fr":  new_fr[:80],
                "changed_fr": changed_fr,
                "changed_ar": changed_ar,
                "new_fr_full": new_fr,
                "new_ar_full": new_ar,
            })

    # DRY RUN
    print(f"=== DRY RUN ===")
    print(f"Total products scanned: {len(all_products)}")
    print(f"Products with '2h' to fix: {len(will_update)}\n")

    for item in will_update[:10]:
        print(f"  {item['name'][:35]}")
        if item["changed_fr"]:
            print(f"    FR: ...{item['old_fr'][-50:]}...")
            print(f"    → : ...{item['new_fr'][-50:]}...")
        if item["changed_ar"]:
            print(f"    AR: changed")
        print()

    if len(will_update) > 10:
        print(f"  ... and {len(will_update)-10} more\n")

    if not will_update:
        print("Nothing to fix — all descriptions clean.")
        client.close()
        return

    confirm = input(
        f"Apply fixes to {len(will_update)} "
        f"products? (yes/no): "
    )
    if confirm.strip().lower() != "yes":
        print("Aborted — nothing changed.")
        client.close()
        return

    # Apply
    print("\n=== APPLYING ===")
    updated = 0
    for item in will_update:
        update_fields = {
            "updated_at": datetime.utcnow()
        }
        if item["changed_fr"]:
            update_fields["description_fr"] = \
                item["new_fr_full"]
        if item["changed_ar"]:
            update_fields["description_ar"] = \
                item["new_ar_full"]

        result = await db.products.update_one(
            {"_id": item["_id"]},
            {"$set": update_fields}
        )
        if result.modified_count:
            updated += 1
        else:
            print(f"  ERR: {item['name']}")

    print(f"\n=== DONE: {updated}/{len(will_update)} fixed ===")

    # Verify — check no 2h remains
    remaining = await db.products.count_documents({
        "$or": [
            {"description_fr": {
                "$regex": "2h|2 h|2 heure|ساعتين",
                "$options": "i"
            }},
        ]
    })
    print(f"Remaining '2h' mentions: {remaining}")
    if remaining == 0:
        print("✅ All descriptions now say 30 minutes")
    else:
        print(f"⚠️  {remaining} products still have '2h'")
        print("Run the script again to see which ones.")

    client.close()

asyncio.run(main())
