"""
Full catalog audit — run before reopening the shop.
Checks:
  1. Products with missing images
  2. Duplicate product names (any)
  3. Duplicate names with conflicting prices
  4. Duplicate image_url assignments (same image on multiple products)

Run:
  railway run python scripts/catalog_audit.py
  railway run python scripts/catalog_audit.py > audit_report.txt
"""
import asyncio, os
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient

SEP  = "=" * 96
SEP2 = "-" * 96

async def main():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client["greengo_db"]

    products = await db.products.find({}).to_list(length=None)
    total = len(products)

    print(SEP)
    print(f"  GREENGO CATALOG AUDIT  —  {total} products total")
    print(SEP)

    # ── 1. MISSING IMAGES ────────────────────────────────────────────────────
    missing_img = [
        p for p in products
        if not p.get("image_url") or str(p.get("image_url", "")).strip() == ""
    ]
    missing_img.sort(key=lambda p: (p.get("category", ""), p.get("name_fr", "")))

    print(f"\n{'━'*96}")
    print(f"  [1] MISSING IMAGES  —  {len(missing_img)} / {total} products have no image")
    print(f"{'━'*96}")
    if missing_img:
        print(f"  {'Category':22} {'name_fr':35} {'name_ar':28} {'price':>7}")
        print(SEP2)
        for p in missing_img:
            print(
                f"  {p.get('category',''):22} "
                f"{p.get('name_fr',''):35} "
                f"{p.get('name_ar',''):28} "
                f"{p.get('price_mad', 0):>7.2f}"
            )
    else:
        print("  ✅  All products have images.")

    # ── 2. DUPLICATE NAMES (any) ─────────────────────────────────────────────
    by_name: dict[str, list] = defaultdict(list)
    for p in products:
        key = (p.get("name_fr") or p.get("name_ar") or "").strip().lower()
        if key:
            by_name[key].append(p)

    dupes_any = {k: v for k, v in by_name.items() if len(v) > 1}
    dupes_any_sorted = sorted(dupes_any.items(), key=lambda x: x[0])

    print(f"\n{'━'*96}")
    print(f"  [2] DUPLICATE NAMES  —  {len(dupes_any)} name(s) appear more than once")
    print(f"{'━'*96}")
    if dupes_any_sorted:
        for name, group in dupes_any_sorted:
            print(f"\n  ▶  \"{group[0].get('name_fr') or group[0].get('name_ar')}\"  ({len(group)} entries)")
            print(f"     {'_id':26} {'category':20} {'price':>7}  {'image':6}  name_ar")
            print(f"     {'-'*88}")
            for p in group:
                has_img = "✅" if p.get("image_url") else "❌"
                print(
                    f"     {str(p['_id']):26} "
                    f"{p.get('category',''):20} "
                    f"{p.get('price_mad', 0):>7.2f}  "
                    f"{has_img:6}  "
                    f"{p.get('name_ar','')}"
                )
    else:
        print("  ✅  No duplicate names found.")

    # ── 3. DUPLICATE NAMES WITH CONFLICTING PRICES ───────────────────────────
    dupes_price = {}
    for name, group in dupes_any.items():
        prices = set(round(p.get("price_mad", 0), 2) for p in group)
        if len(prices) > 1:
            dupes_price[name] = group

    dupes_price_sorted = sorted(dupes_price.items(), key=lambda x: x[0])

    print(f"\n{'━'*96}")
    print(f"  [3] PRICE CONFLICTS  —  {len(dupes_price)} duplicate name(s) have different prices")
    print(f"{'━'*96}")
    if dupes_price_sorted:
        for name, group in dupes_price_sorted:
            prices = sorted(set(round(p.get("price_mad", 0), 2) for p in group))
            print(f"\n  ▶  \"{group[0].get('name_fr') or group[0].get('name_ar')}\"  — prices: {prices}")
            print(f"     {'_id':26} {'category':20} {'price':>7}  name_ar")
            print(f"     {'-'*78}")
            for p in group:
                print(
                    f"     {str(p['_id']):26} "
                    f"{p.get('category',''):20} "
                    f"{p.get('price_mad', 0):>7.2f}  "
                    f"{p.get('name_ar','')}"
                )
    else:
        print("  ✅  No price conflicts among duplicate names.")

    # ── 4. DUPLICATE IMAGE ASSIGNMENTS ───────────────────────────────────────
    by_img: dict[str, list] = defaultdict(list)
    for p in products:
        url = (p.get("image_url") or "").strip()
        if url:
            by_img[url].append(p)

    dupes_img = {k: v for k, v in by_img.items() if len(v) > 1}
    dupes_img_sorted = sorted(dupes_img.items(), key=lambda x: x[0])

    print(f"\n{'━'*96}")
    print(f"  [4] DUPLICATE IMAGES  —  {len(dupes_img)} image URL(s) shared by multiple products")
    print(f"{'━'*96}")
    if dupes_img_sorted:
        for url, group in dupes_img_sorted:
            short_url = url.split("/")[-1] if "/" in url else url
            print(f"\n  ▶  .../{short_url}  ({len(group)} products share this image)")
            for p in group:
                print(
                    f"     {str(p['_id']):26} "
                    f"{p.get('category',''):20} "
                    f"{p.get('name_fr') or p.get('name_ar',''):35} "
                    f"{p.get('price_mad', 0):>7.2f} MAD"
                )
    else:
        print("  ✅  No duplicate image assignments found.")

    # ── SUMMARY ──────────────────────────────────────────────────────────────
    print(f"\n{SEP}")
    print(f"  SUMMARY")
    print(SEP)
    print(f"  Total products          : {total}")
    print(f"  Missing images          : {len(missing_img)}")
    print(f"  Duplicate names         : {sum(len(v) for v in dupes_any.values())} products in {len(dupes_any)} groups")
    print(f"  Price conflicts         : {sum(len(v) for v in dupes_price.values())} products in {len(dupes_price)} groups")
    print(f"  Shared image URLs       : {sum(len(v) for v in dupes_img.values())} products in {len(dupes_img)} groups")
    print(SEP)

    client.close()

asyncio.run(main())
