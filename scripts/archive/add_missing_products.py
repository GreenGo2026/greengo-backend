"""
Add missing products to GreenGo via the live REST API.
No direct MongoDB access required.

Usage
-----
  # Dry run (lists what would be added):
  python scripts/add_missing_products.py

  # Apply (creates products):
  python scripts/add_missing_products.py --apply --apikey YOUR_RAILWAY_ADMIN_KEY
  python scripts/add_missing_products.py --apply --token YOUR_JWT_TOKEN
"""
from __future__ import annotations

import argparse
import sys
import requests

API_BASE = "https://web-production-0cdd6.up.railway.app/api/v1"

MISSING_PRODUCTS = [
    # ── FRUITS (missing from catalog) ────────────────────────────────────────
    {"name_fr": "Kiwi grande",        "name_ar": "كيوي كبير",            "category": "Fruits",       "price_mad": 20.0, "unit": "piece"},
    {"name_fr": "Pomme rouge petite", "name_ar": "تفاحة حمراء صغيرة",   "category": "Fruits",       "price_mad": 16.0, "unit": "kg"},
    {"name_fr": "Pomme vert",         "name_ar": "تفاحة خضراء",          "category": "Fruits",       "price_mad": 17.0, "unit": "kg"},
    {"name_fr": "Raisin vert",        "name_ar": "عنب أخضر",             "category": "Fruits",       "price_mad": 17.0, "unit": "kg"},
    # ── VOLAILLES ────────────────────────────────────────────────────────────
    {"name_fr": "Crispy de poulet",     "name_ar": "كريسبي ديال الدجاج",  "category": "Volailles",    "price_mad": 75.0,  "unit": "piece"},
    {"name_fr": "Batonnets de poulet",  "name_ar": "باتونيه ديال الدجاج", "category": "Volailles",    "price_mad": 66.0,  "unit": "piece"},
    {"name_fr": "Cordon bleu",          "name_ar": "كوردون بلو",           "category": "Volailles",    "price_mad": 70.0,  "unit": "piece"},
    {"name_fr": "Ring de poulet",       "name_ar": "رينغ ديال الدجاج",    "category": "Volailles",    "price_mad": 75.0,  "unit": "piece"},
    {"name_fr": "Pané de poulet",       "name_ar": "بانيه ديال الدجاج",   "category": "Volailles",    "price_mad": 70.0,  "unit": "piece"},
    {"name_fr": "Nuggets au fromage",   "name_ar": "نوجيتس بالفرماج",     "category": "Volailles",    "price_mad": 70.0,  "unit": "piece"},
    {"name_fr": "Osso de poulet",       "name_ar": "أوسو ديال الدجاج",    "category": "Volailles",    "price_mad": 35.0,  "unit": "piece"},
    {"name_fr": "Tendres de poulet",    "name_ar": "تندرز ديال الدجاج",   "category": "Volailles",    "price_mad": 80.0,  "unit": "piece"},
    {"name_fr": "Brochettes de poulet", "name_ar": "بروشيت ديال الدجاج",  "category": "Volailles",    "price_mad": 60.0,  "unit": "piece"},
    {"name_fr": "Beldi de dinde",       "name_ar": "بيلاك الديك الرومي",  "category": "Volailles",    "price_mad": 60.0,  "unit": "kg"},
    # ── HUILE ET MIEL ────────────────────────────────────────────────────────
    {"name_fr": "Amlou d'amande sans miel 250g", "name_ar": "أملو بالوز بلا عسل 250 غ",  "category": "Huile et miel", "price_mad": 60.0,  "unit": "piece"},
    {"name_fr": "Amlou d'amande sans miel 500g", "name_ar": "أملو بالوز بلا عسل 500 غ",  "category": "Huile et miel", "price_mad": 110.0, "unit": "piece"},
    {"name_fr": "Zamita",               "name_ar": "الزميتة",              "category": "Huile et miel","price_mad": 15.0,  "unit": "kg"},
    # ── FROMAGE ──────────────────────────────────────────────────────────────
    {"name_fr": "Emental",              "name_ar": "فرماج إيمونتال",       "category": "Fromage",      "price_mad": 140.0, "unit": "kg"},
    {"name_fr": "Fromage Kroon",        "name_ar": "فرماج كرون",           "category": "Fromage",      "price_mad": 120.0, "unit": "piece"},
    {"name_fr": "Fromage fumé nature",  "name_ar": "فرماج مدخن طبيعي",    "category": "Fromage",      "price_mad": 140.0, "unit": "piece"},
    {"name_fr": "Fromage fumé chilli",  "name_ar": "فرماج مدخن بالشيلي",  "category": "Fromage",      "price_mad": 140.0, "unit": "piece"},
    {"name_fr": "Fromage fumé poivre",  "name_ar": "فرماج مدخن بالفلفل",  "category": "Fromage",      "price_mad": 140.0, "unit": "piece"},
    {"name_fr": "Gouda cumin",          "name_ar": "غودا بالكمون",         "category": "Fromage",      "price_mad": 120.0, "unit": "kg"},
    {"name_fr": "Gouda nature",         "name_ar": "غودا طبيعي",           "category": "Fromage",      "price_mad": 120.0, "unit": "kg"},
    {"name_fr": "Mozzarella noir",      "name_ar": "موزاريلا سوداء",       "category": "Fromage",      "price_mad": 60.0,  "unit": "piece"},
    {"name_fr": "Mozzarella rouge",     "name_ar": "موزاريلا حمراء",       "category": "Fromage",      "price_mad": 60.0,  "unit": "piece"},
]

# Common defaults applied to every product
_DEFAULTS = {
    "in_stock": True,
    "visible": True,
    "image_status": "pending",
    "on_sale": False,
    "discount_pct": 0,
}


def _headers(token: str | None, apikey: str | None) -> dict[str, str]:
    h: dict[str, str] = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    elif apikey:
        h["X-Admin-Key"] = apikey
    return h


def _existing_names() -> set[str]:
    resp = requests.get(f"{API_BASE}/products", timeout=15)
    resp.raise_for_status()
    return {(p.get("name_fr") or "").strip().lower() for p in resp.json()}


def run(apply: bool, token: str | None, apikey: str | None) -> None:
    if apply and not token and not apikey:
        print("ERROR: --apply requires --token JWT or --apikey ADMIN_KEY", file=sys.stderr)
        sys.exit(1)

    print("Fetching existing products…")
    try:
        existing = _existing_names()
    except Exception as exc:
        print(f"ERROR: could not fetch products — {exc}", file=sys.stderr)
        sys.exit(1)
    print(f"Found {len(existing)} existing products.\n")

    headers = _headers(token, apikey)
    added: list[str] = []
    skipped: list[str] = []
    errors: list[str] = []

    for product in MISSING_PRODUCTS:
        name = product["name_fr"]
        if name.strip().lower() in existing:
            skipped.append(name)
            print(f"  SKIP  {name!r:<40} (already exists)")
            continue

        payload = {**_DEFAULTS, **product}

        if apply:
            try:
                r = requests.post(f"{API_BASE}/products", json=payload, headers=headers, timeout=15)
                if r.status_code in (200, 201):
                    added.append(name)
                    print(f"  OK    {name:<40} {product['price_mad']:>7.2f} MAD  [{product['category']}]")
                else:
                    errors.append(f"{name}: HTTP {r.status_code} — {r.text[:80]}")
                    print(f"  ERR   {name:<40} HTTP {r.status_code}: {r.text[:60]}")
            except Exception as exc:
                errors.append(f"{name}: {exc}")
                print(f"  ERR   {name:<40} {exc}")
        else:
            added.append(name)
            print(f"  DRY   {name:<40} {product['price_mad']:>7.2f} MAD  [{product['category']}]")

    print()
    print("=" * 60)
    print(f"  {'Added' if apply else 'Would add'}          : {len(added)}")
    print(f"  Already existed   : {len(skipped)}")
    print(f"  Errors            : {len(errors)}")
    if errors:
        print(f"\n  ERRORS: {'; '.join(errors)}")
    if not apply:
        print("\n  Re-run with --apply --apikey <KEY> or --token <JWT> to write.")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply",  action="store_true", help="Create products via POST API")
    parser.add_argument("--token",  default=None, help="Admin JWT token")
    parser.add_argument("--apikey", default=None, help="ADMIN_API_KEY")
    args = parser.parse_args()
    run(apply=args.apply, token=args.token, apikey=args.apikey)
