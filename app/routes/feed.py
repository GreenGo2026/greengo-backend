from datetime import datetime, timezone
from typing import Any
import xml.etree.ElementTree as ET
from xml.dom import minidom

from fastapi import APIRouter
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient

from app.database import products_col

router = APIRouter(tags=["Feed"])

# ── Google Product Category mapping ──────────────────────────────────────────
CAT_MAP: dict[str, str] = {
    "Vegetables":      "422",   # Food, Beverages & Tobacco > Food Items > Fruit & Vegetables
    "Purified Greens": "422",
    "Fruits":          "422",
    "White Meats":     "1033",  # Food Items > Meat, Seafood & Eggs > Meat
    "Eggs":            "4695",  # Food Items > Meat, Seafood & Eggs > Eggs
    "Epices":          "2660",  # Food Items > Condiments & Sauces > Spices & Seasonings
    "Olives":          "422",
    "Natural Juices":  "413",   # Food Items > Beverages > Juices
    "Mixed Packs":     "422",
}

# ── Product type (breadcrumb) mapping ─────────────────────────────────────────
TYPE_MAP: dict[str, str] = {
    "Vegetables":      "Épicerie > Légumes frais",
    "Purified Greens": "Épicerie > Herbes fraîches",
    "Fruits":          "Épicerie > Fruits frais",
    "White Meats":     "Épicerie > Viandes > Viandes blanches",
    "Eggs":            "Épicerie > Oeufs frais",
    "Epices":          "Épicerie > Épices et condiments",
    "Olives":          "Épicerie > Olives",
    "Natural Juices":  "Épicerie > Jus naturels",
    "Mixed Packs":     "Épicerie > Paniers mixtes",
}

# ── Rich description generator ────────────────────────────────────────────────
def make_description(name_fr: str, name_ar: str, category: str, unit: str) -> str:
    cat_label = {
        "Vegetables":      "légume frais",
        "Purified Greens": "herbe fraîche",
        "Fruits":          "fruit frais de saison",
        "White Meats":     "viande blanche fraîche",
        "Eggs":            "oeufs frais",
        "Epices":          "épice naturelle",
        "Olives":          "olive fraîche",
        "Natural Juices":  "jus naturel",
        "Mixed Packs":     "panier de produits frais",
    }.get(category, "produit frais")

    unit_label = {
        "kg":     "au kilo",
        "piece":  "à la pièce",
        "pièce":  "à la pièce",
        "bundle": "à la botte",
        "botte":  "à la botte",
        "boite":  "à la boîte",
        "100g":   "par 100g",
        "500g":   "par 500g",
    }.get(unit.lower() if unit else "", "")

    return (
        f"{name_fr} — {cat_label} sélectionné chaque matin"
        f"{' vendu ' + unit_label if unit_label else ''}. "
        f"Livré frais à domicile à Salé et Rabat par GreenGo Market. "
        f"Qualité garantie, livraison rapide en 30 min."
    )

@router.get("/feed/google", summary="Google Shopping XML feed")
async def google_shopping_feed() -> Response:
    col  = products_col()
    docs = await col.find({"visible": True, "in_stock": True}).to_list(500)

    # Build RSS 2.0 + Google Merchant namespace
    rss = ET.Element("rss", {
        "version": "2.0",
        "xmlns:g": "http://base.google.com/ns/1.0",
    })
    channel = ET.SubElement(rss, "channel")

    ET.SubElement(channel, "title").text       = "GreenGo Market — Épicerie fraîche Salé Rabat"
    ET.SubElement(channel, "link").text        = "https://www.mygreengoo.com"
    ET.SubElement(channel, "description").text = (
        "Produits frais livrés à domicile à Salé et Rabat — "
        "légumes, fruits, viandes et épices. GreenGo Market."
    )

    BASE_URL = "https://www.mygreengoo.com"
    IMG_BASE = "https://web-production-0cdd6.up.railway.app"

    for doc in docs:
        sku        = str(doc.get("sku", ""))
        name_fr    = str(doc.get("name_fr") or doc.get("name_ar", "")).strip()
        name_ar    = str(doc.get("name_ar", "")).strip()
        category   = str(doc.get("category", ""))
        price      = float(doc.get("price_mad", 0))
        unit       = str(doc.get("unit", "kg"))
        image_url  = str(doc.get("image_url", ""))
        on_sale    = bool(doc.get("on_sale", False))
        disc_pct   = int(doc.get("discount_pct", 0))
        product_id = str(doc["_id"])

        if not sku or not name_fr or price <= 0 or not image_url:
            continue  # skip incomplete products

        # Build absolute image URL
        if image_url.startswith("http"):
            abs_image = image_url
        else:
            abs_image = IMG_BASE + (image_url if image_url.startswith("/") else "/" + image_url)

        item = ET.SubElement(channel, "item")

        def g(tag: str, text: str) -> ET.Element:
            el = ET.SubElement(item, f"g:{tag}")
            el.text = text
            return el

        g("id",                    sku)
        g("title",                 name_fr)
        g("description",           make_description(name_fr, name_ar, category, unit))
        g("link",                  f"{BASE_URL}/produit/{product_id}")
        g("image_link",            abs_image)
        g("condition",             "new")
        g("availability",          "in stock")
        g("price",                 f"{price:.2f} MAD")
        g("brand",                 "GreenGo Market")
        g("identifier_exists",     "no")
        g("google_product_category", CAT_MAP.get(category, "422"))
        g("product_type",          TYPE_MAP.get(category, "Épicerie > Produits frais"))

        # Sale price — only when genuinely on sale
        if on_sale and disc_pct > 0:
            sale_price = round(price * (1 - disc_pct / 100), 2)
            g("sale_price", f"{sale_price:.2f} MAD")

        # Unit pricing — required for weight-based products in EU/MA
        unit_lower = unit.lower()
        if unit_lower in ("kg", "kilo"):
            g("unit_pricing_measure",      "1 kg")
            g("unit_pricing_base_measure", "1 kg")
        elif unit_lower in ("100g", "g"):
            g("unit_pricing_measure",      "100 g")
            g("unit_pricing_base_measure", "100 g")

    # Pretty-print XML
    raw  = ET.tostring(rss, encoding="unicode", xml_declaration=False)
    pretty = minidom.parseString(raw).toprettyxml(indent="  ", encoding="utf-8")
    # Remove the extra XML declaration minidom adds
    lines = pretty.decode("utf-8").split("\n")
    if lines[0].startswith("<?xml"):
        lines = lines[1:]
    xml_out = '<?xml version="1.0" encoding="UTF-8"?>\n' + "\n".join(lines)

    return Response(
        content=xml_out,
        media_type="application/xml; charset=utf-8",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": "inline; filename=google_feed.xml",
        },
    )
