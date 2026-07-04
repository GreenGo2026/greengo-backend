"""
One-time price update script for GreenGo products.
Uses the live REST API (no direct MongoDB access needed).

Usage
-----
  # Step 1 — audit current prices (no changes):
  python scripts/update_prices.py

  # Step 2 — apply prices (writes via PATCH API):
  python scripts/update_prices.py --apply --token YOUR_JWT_TOKEN

  OR with the Railway ADMIN_API_KEY:
  python scripts/update_prices.py --apply --apikey YOUR_RAILWAY_ADMIN_KEY

How to get a JWT token
----------------------
  curl -s -X POST https://web-production-0cdd6.up.railway.app/api/v1/admin/auth/login \\
    -H 'Content-Type: application/json' \\
    -d '{"password":"YOUR_PW","totp_code":"YOUR_TOTP"}'
  # Copy access_token from the response.
"""
from __future__ import annotations

import argparse
import sys
import unicodedata
import requests

API_BASE = "https://web-production-0cdd6.up.railway.app/api/v1"

# ── PRICES ────────────────────────────────────────────────────────────────────
# Key   = French product name — case-insensitive substring match on name_fr
# Value = (price_mad: float, unit: str)
# Leave a product out to skip it.
# Products marked TODO need confirmation before running with --apply.
# ─────────────────────────────────────────────────────────────────────────────
PRICES: dict[str, tuple[float, str]] = {
    # Légumes
    "ail":               (10.0,  "kg"),
    "betterave":         (5.0,   "kg"),
    "brocoli":           (15.0,  "kg"),
    "carotte":           (6.0,   "kg"),
    "celeri":            (8.0,   "kg"),
    "chou blanc":        (5.0,   "kg"),
    "chou-fleur":        (10.0,  "kg"),
    "courgette":         (4.0,   "kg"),
    "epinards":          (8.0,   "kg"),
    "haricots verts":    (12.0,  "kg"),
    "laitue":            (5.0,   "piece"),
    "menthe":            (3.0,   "botte"),
    "navet":             (4.0,   "kg"),
    "oignon rouge":      (3.0,   "kg"),
    "persil":            (3.0,   "botte"),
    "coriandre":         (3.0,   "botte"),
    "poivron vert":      (9.0,   "kg"),
    "pomme de terre":    (4.0,   "kg"),
    "tomate ronde":      (8.0,   "kg"),

    # Fruits
    "ananas":            (25.0,  "piece"),
    "banane":            (7.0,   "kg"),
    "fraise":            (20.0,  "kg"),
    "framboise":         (35.0,  "kg"),
    "grenade":           (15.0,  "kg"),
    "kiwi":              (20.0,  "kg"),
    "mangue":            (30.0,  "kg"),
    "myrtille":          (40.0,  "kg"),
    "orange":            (5.0,   "kg"),
    "pasteque":          (4.0,   "kg"),
    "peche":             (15.0,  "kg"),
    "pomme verte":       (7.0,   "kg"),
    "raisin blanc":      (15.0,  "kg"),

    # Volailles
    "ailes de poulet":   (35.0,  "kg"),
    "blanc de poulet":   (65.0,  "kg"),
    "cuisse de poulet":  (40.0,  "kg"),
    "dinde hachee":      (50.0,  "kg"),
    "escalope de dinde": (55.0,  "kg"),
    "foie de poulet":    (25.0,  "kg"),
    "pilon de poulet":   (35.0,  "kg"),
    "poulet entier":     (45.0,  "piece"),
    "poulet hache":      (50.0,  "kg"),

    # Oeufs
    "oeufs beldi":       (30.0,  "piece"),
    "oeufs de caille":   (15.0,  "piece"),
    "oeufs grands":      (12.0,  "piece"),
    "oeufs petits":      (10.0,  "piece"),
    "plateau 15":        (35.0,  "piece"),
    "plateau 30":        (65.0,  "piece"),

    # Olives
    "olives de roseau":              (40.0, "kg"),
    "olives marinees":               (45.0, "kg"),
    "olives noires sechees":         (50.0, "kg"),
    "olives noires tranchees":       (35.0, "kg"),
    "olives rouges piquantes":       (45.0, "kg"),
    "olives vertes au citron":       (40.0, "kg"),
    "olives vertes tranchees":       (35.0, "kg"),
    "olives vertes":                 (35.0, "kg"),

    # Epices
    "cannelle moulue":   (15.0,  "100g"),
    "coriandre moulue":  (12.0,  "100g"),
    "cumin moulu":       (12.0,  "100g"),
    "curcuma moulu":     (15.0,  "100g"),
    "gingembre moulu":   (15.0,  "100g"),
    "paprika doux":      (12.0,  "100g"),
    "piment rouge moulu":(10.0,  "100g"),
    "poivre noir moulu": (20.0,  "100g"),
    "ras el hanout":     (20.0,  "100g"),

    # ── CONFIRMED ───────────────────────────────────────────────────────────
    "kiwi grande":       (20.0,  "kg"),
    "pomme rouge petite":(16.0,  "kg"),
    "pomme vert":        (17.0,  "kg"),
    "raisin vert":       (17.0,  "kg"),

    # ── STILL PENDING (price=0 = auto-skipped) ──────────────────────────────
    "poireau":           (0.0,   "kg"),    # TODO
    "potiron":           (0.0,   "kg"),    # TODO
    "tomate saurise":    (0.0,   "kg"),    # TODO
    "les chou":          (0.0,   "kg"),    # TODO
    "poireaux":          (0.0,   "kg"),    # TODO
}


def _norm(s: str) -> str:
    """Lowercase + strip diacritics so 'hachee' matches 'hachée'."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower())
        if unicodedata.category(c) != "Mn"
    )


def _match(key: str, doc: dict) -> bool:
    """
    Exact or prefix match after accent normalization.
    'ail' matches 'Ail' but NOT 'Ailes de poulet'.
    'oeufs beldi' matches 'Oeufs beldi (12)'.
    """
    nk = _norm(key)
    nf = _norm(doc.get("name_fr") or "")
    if nf == nk:
        return True
    # prefix match: key must be followed by space, '(', or end-of-string
    if len(nf) > len(nk) and nf.startswith(nk) and nf[len(nk)] in (" ", "(", "-"):
        return True
    return False


def _build_headers(token: str | None, apikey: str | None) -> dict[str, str]:
    h: dict[str, str] = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    elif apikey:
        h["X-Admin-Key"] = apikey
    return h


def _fetch_products() -> list[dict]:
    resp = requests.get(f"{API_BASE}/products", timeout=15)
    resp.raise_for_status()
    return resp.json()


def run(apply: bool, token: str | None, apikey: str | None) -> None:
    print("Fetching products from live API…")
    try:
        products = _fetch_products()
    except Exception as exc:
        print(f"ERROR: could not fetch products — {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(products)} products.\n")

    if apply and not token and not apikey:
        print("ERROR: --apply requires --token JWT or --apikey ADMIN_KEY", file=sys.stderr)
        sys.exit(1)

    headers = _build_headers(token, apikey)

    matched: list[str] = []
    missed:  list[str] = []
    skipped: list[str] = []
    errors:  list[str] = []

    for key, (new_price, new_unit) in PRICES.items():
        if new_price == 0.0:
            skipped.append(key)
            print(f"  SKIP  {key!r:42s} (price=0.0 — needs confirmation)")
            continue

        hits = [p for p in products if _match(key, p)]
        if not hits:
            missed.append(key)
            print(f"  MISS  {key!r:42s} (no product matched)")
            continue

        for p in hits:
            name  = p.get("name_fr") or p.get("name_ar") or "?"
            pid   = p["id"]
            old_p = p.get("price_mad", 0)
            if apply:
                try:
                    r = requests.patch(
                        f"{API_BASE}/products/{pid}",
                        json={"price_mad": new_price, "unit": new_unit},
                        headers=headers,
                        timeout=15,
                    )
                    if r.status_code in (200, 201):
                        matched.append(name)
                        print(f"  OK    {name:42s} {old_p} -> {new_price} {new_unit}")
                    else:
                        errors.append(f"{name}: HTTP {r.status_code} — {r.text[:80]}")
                        print(f"  ERR   {name:42s} HTTP {r.status_code}: {r.text[:60]}")
                except Exception as exc:
                    errors.append(f"{name}: {exc}")
                    print(f"  ERR   {name:42s} {exc}")
            else:
                matched.append(name)
                print(f"  DRY   {name:42s} {old_p} -> {new_price} {new_unit}")

    print()
    print("=" * 60)
    print(f"  {'Updated' if apply else 'Would update'} : {len(matched)}")
    print(f"  Skipped (price=0.0)          : {len(skipped)}")
    print(f"  Not found in catalog         : {len(missed)}")
    print(f"  Errors                       : {len(errors)}")
    if missed:
        print(f"\n  MISSED: {', '.join(missed)}")
    if skipped:
        print(f"\n  CONFIRM PRICES FOR: {', '.join(skipped)}")
    if errors:
        print(f"\n  ERRORS: {'; '.join(errors)}")
    if not apply:
        print("\n  Re-run with --apply --token <JWT> to write changes.")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply",  action="store_true", help="Write changes via PATCH API")
    parser.add_argument("--token",  default=None, help="Admin JWT token")
    parser.add_argument("--apikey", default=None, help="Railway ADMIN_API_KEY")
    args = parser.parse_args()
    run(apply=args.apply, token=args.token, apikey=args.apikey)
