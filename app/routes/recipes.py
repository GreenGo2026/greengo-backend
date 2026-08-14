# app/routes/recipes.py
from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_admin
from app.database import products_col, recipes_col

router = APIRouter(prefix="/api/v1/recipes", tags=["Recipes"])

# ── Seed data ──────────────────────────────────────────────────────────────────
# Gaps deliberately kept in the recipe (not_in_catalog=True) rather than
# dropping the ingredient entirely -- the recipe stays coherent, the customer
# just sees "available at your local grocer" for the few items GreenGo
# doesn't carry yet. Harira is excluded from launch (too many unverified
# ingredients); add it once the catalog covers its ingredient list.
INITIAL_RECIPES: list[dict[str, Any]] = [
    {
        "slug": "couscous-vendredi",
        "name_fr": "Couscous du vendredi",
        "name_ar": "كسكس الجمعة",
        "description_fr": (
            "Le grand classique du vendredi marocain. Un plat généreux qui réunit "
            "toute la famille autour d'une semoule parfumée et de légumes mijotés."
        ),
        "emoji": "🫕",
        "servings": 6,
        "prep_time_min": 30,
        "cook_time_min": 90,
        "visible": True,
        "ingredients": [
            {"name_fr": "Poulet entier", "quantity": 1, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Carottes", "quantity": 500, "unit": "g", "optional": False, "note_fr": None},
            {"name_fr": "Courgettes", "quantity": 3, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Navets", "quantity": 2, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Tomates", "quantity": 3, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Oignons", "quantity": 2, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Pois chiches", "quantity": 200, "unit": "g", "optional": False,
             "note_fr": "Disponible en épicerie locale", "not_in_catalog": True},
            {"name_fr": "Semoule", "quantity": 500, "unit": "g", "optional": False,
             "note_fr": "Disponible en épicerie locale", "not_in_catalog": True},
        ],
    },
    {
        "slug": "tajine-poulet-olives",
        "name_fr": "Tajine poulet aux olives",
        "name_ar": "طاجين الدجاج بالزيتون",
        "description_fr": (
            "Un tajine savoureux et parfumé, avec du poulet tendre, des olives "
            "et du citron confit. Le plat marocain par excellence."
        ),
        "emoji": "🍗",
        "servings": 4,
        "prep_time_min": 20,
        "cook_time_min": 75,
        "visible": True,
        "ingredients": [
            {"name_fr": "Poulet entier", "quantity": 1, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Olives", "quantity": 200, "unit": "g", "optional": False, "note_fr": None},
            {"name_fr": "Citron", "quantity": 2, "unit": "pièce", "optional": False, "note_fr": "Citron beldi de préférence"},
            {"name_fr": "Oignons", "quantity": 2, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Ail", "quantity": 4, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Huile d'olive", "quantity": 1, "unit": "pièce", "optional": False, "note_fr": None},
        ],
    },
    {
        "slug": "rfissa",
        "name_fr": "Rfissa au poulet",
        "name_ar": "الرفيسة بالدجاج",
        "description_fr": (
            "Plat de fête et de partage, la rfissa marie le poulet fondant "
            "aux lentilles et aux épices pour un résultat incomparable."
        ),
        "emoji": "🐔",
        "servings": 6,
        "prep_time_min": 30,
        "cook_time_min": 120,
        "visible": True,
        "ingredients": [
            {"name_fr": "Poulet entier", "quantity": 1, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Oignons", "quantity": 3, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Huile d'olive", "quantity": 1, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Lentilles", "quantity": 300, "unit": "g", "optional": False,
             "note_fr": "Disponible en épicerie locale", "not_in_catalog": True},
        ],
    },
    {
        "slug": "salade-marocaine",
        "name_fr": "Salade marocaine",
        "name_ar": "السلطة المغربية",
        "description_fr": (
            "Fraîche et colorée, la salade marocaine est le compagnon idéal de "
            "tous vos plats. Tomates, concombres et poivrons assaisonnés à la marocaine."
        ),
        "emoji": "🥗",
        "servings": 4,
        "prep_time_min": 10,
        "cook_time_min": 0,
        "visible": True,
        "ingredients": [
            {"name_fr": "Tomates", "quantity": 4, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Concombres", "quantity": 2, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Poivrons", "quantity": 2, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Oignons", "quantity": 1, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Citron", "quantity": 2, "unit": "pièce", "optional": False, "note_fr": None},
            {"name_fr": "Persil", "quantity": 1, "unit": "pièce", "optional": False, "note_fr": None},
        ],
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _match_product(ingredient_name: str, products: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Find the best-matching catalog product for an ingredient name.
    Simple substring/word-overlap scoring -- good enough for a fixed,
    admin-curated ingredient list, no need for the frontend's fuzzy
    search-scoring logic here."""
    name_lower = ingredient_name.lower()
    best: dict[str, Any] | None = None
    best_score = 0

    for p in products:
        p_name = (p.get("name_fr") or "").lower()
        if not p_name:
            continue

        score = 0
        if name_lower in p_name:
            score = 100 - len(p_name)
        elif p_name in name_lower:
            score = 80 - len(p_name)
        elif any(word in p_name for word in name_lower.split() if len(word) > 3):
            score = 50

        if score > best_score:
            best_score = score
            best = p

    return best if best_score > 0 else None


def _serialize_recipe(recipe: dict[str, Any], products: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Serialize a recipe document. If `products` is given, match each
    ingredient against the live catalog for price/availability."""
    ingredients_out: list[dict[str, Any]] = []
    for ing in recipe.get("ingredients", []):
        item: dict[str, Any] = {
            "name_fr":        ing.get("name_fr"),
            "quantity":       ing.get("quantity"),
            "unit":           ing.get("unit"),
            "optional":       ing.get("optional", False),
            "note_fr":        ing.get("note_fr"),
            "not_in_catalog": ing.get("not_in_catalog", False),
            "product":        None,
        }

        if products is not None and not ing.get("not_in_catalog"):
            matched = _match_product(ing["name_fr"], products)
            if matched:
                item["product"] = {
                    "id":         str(matched["_id"]),
                    "name_fr":    matched.get("name_fr"),
                    "name_ar":    matched.get("name_ar"),
                    "price_mad":  matched.get("price_mad"),
                    "unit":       matched.get("unit"),
                    "image_url":  matched.get("image_url"),
                    "in_stock":   matched.get("in_stock", True),
                }

        ingredients_out.append(item)

    total_price = sum(
        (i["product"]["price_mad"] or 0)
        for i in ingredients_out
        if i["product"] and not i.get("not_in_catalog")
    )

    return {
        "slug":                 recipe.get("slug"),
        "name_fr":              recipe.get("name_fr"),
        "name_ar":              recipe.get("name_ar"),
        "description_fr":       recipe.get("description_fr"),
        "emoji":                recipe.get("emoji", "🍽️"),
        "servings":             recipe.get("servings", 4),
        "prep_time_min":        recipe.get("prep_time_min", 0),
        "cook_time_min":        recipe.get("cook_time_min", 0),
        "ingredients":          ingredients_out,
        "estimated_price_mad":  round(total_price, 2),
        "ingredients_available": sum(1 for i in ingredients_out if i["product"]),
        "ingredients_total":    len(ingredients_out),
    }


async def _live_products() -> list[dict[str, Any]]:
    return await products_col().find(
        {"in_stock": {"$ne": False}},
        {"name_fr": 1, "name_ar": 1, "price_mad": 1, "unit": 1, "image_url": 1, "in_stock": 1},
    ).to_list(500)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", summary="List all visible recipes with price estimates")
async def list_recipes() -> dict[str, Any]:
    recipes = await recipes_col().find({"visible": True}).to_list(100)

    if not recipes:
        # DB not seeded yet -- fall back to the seed data so the page still
        # works (without live price matching) before /seed has been run.
        return {
            "recipes": [
                {
                    "slug":                r["slug"],
                    "name_fr":             r["name_fr"],
                    "name_ar":             r["name_ar"],
                    "description_fr":      r["description_fr"],
                    "emoji":               r["emoji"],
                    "servings":            r["servings"],
                    "prep_time_min":       r["prep_time_min"],
                    "cook_time_min":       r["cook_time_min"],
                    "estimated_price_mad": None,
                }
                for r in INITIAL_RECIPES
            ]
        }

    products = await _live_products()
    return {"recipes": [_serialize_recipe(r, products) for r in recipes]}


@router.get("/{slug}", summary="Get one recipe with full ingredient matching against the live catalog")
async def get_recipe(slug: str) -> dict[str, Any]:
    recipe = await recipes_col().find_one({"slug": slug, "visible": True})

    if not recipe:
        seed = next((r for r in INITIAL_RECIPES if r["slug"] == slug), None)
        if not seed:
            raise HTTPException(status_code=404, detail="Recette introuvable")
        recipe = seed

    products = await _live_products()
    return _serialize_recipe(recipe, products)


@router.post("/seed", summary="Admin: seed the initial recipes into the database (idempotent)")
async def seed_recipes(_: None = Depends(require_admin)) -> dict[str, Any]:
    col = recipes_col()
    seeded = 0
    for recipe in INITIAL_RECIPES:
        existing = await col.find_one({"slug": recipe["slug"]})
        if not existing:
            now = datetime.now(tz=timezone.utc)
            await col.insert_one({**recipe, "created_at": now, "updated_at": now})
            seeded += 1

    return {"seeded": seeded, "total": len(INITIAL_RECIPES), "message": f"{seeded} recettes ajoutées"}


# ── Admin CRUD ──────────────────────────────────────────────────────────────────

class IngredientInput(BaseModel):
    name_fr: str
    quantity: float
    unit: str
    optional: bool = False
    note_fr: str | None = None
    not_in_catalog: bool = False


class RecipeInput(BaseModel):
    name_fr: str
    name_ar: str
    description_fr: str
    emoji: str = "🍽️"
    servings: int = 4
    prep_time_min: int = 0
    cook_time_min: int = 0
    visible: bool = True
    ingredients: list[IngredientInput]


def _slug_from_name(name: str) -> str:
    """Generate a URL slug from a French recipe name (accents stripped)."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_str = nfkd.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^\w\s-]", "", ascii_str)
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    return slug.lower()


def _oid(recipe_id: str) -> ObjectId:
    try:
        return ObjectId(recipe_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")


# NOTE: /admin/list must stay declared before /admin/{recipe_id} below -- both
# are GET on a 2-segment path, so declaration order decides which one a
# request to /recipes/admin/list would match (same issue already solved for
# /orders/track vs /orders/{order_id} in orders.py).
@router.get("/admin/list", summary="Admin: list ALL recipes, including hidden ones")
async def admin_list_recipes(_: None = Depends(require_admin)) -> dict[str, Any]:
    recipes = await recipes_col().find({}).sort("created_at", -1).to_list(200)
    return {
        "recipes": [
            {
                "id":                 str(r["_id"]),
                "slug":               r.get("slug"),
                "name_fr":            r.get("name_fr"),
                "name_ar":            r.get("name_ar"),
                "emoji":              r.get("emoji", "🍽️"),
                "visible":            r.get("visible", True),
                "servings":           r.get("servings", 4),
                "prep_time_min":      r.get("prep_time_min", 0),
                "cook_time_min":      r.get("cook_time_min", 0),
                "ingredients_count":  len(r.get("ingredients", [])),
                "created_at":         str(r.get("created_at", "")),
            }
            for r in recipes
        ]
    }


@router.get("/admin/{recipe_id}", summary="Admin: get full recipe for editing")
async def admin_get_recipe(recipe_id: str, _: None = Depends(require_admin)) -> dict[str, Any]:
    recipe = await recipes_col().find_one({"_id": _oid(recipe_id)})
    if not recipe:
        raise HTTPException(status_code=404, detail="Non trouvée")

    recipe["id"] = str(recipe.pop("_id"))
    recipe["created_at"] = str(recipe.get("created_at", ""))
    recipe["updated_at"] = str(recipe.get("updated_at", ""))
    return recipe


@router.post("/admin", summary="Admin: create a new recipe")
async def admin_create_recipe(payload: RecipeInput, _: None = Depends(require_admin)) -> dict[str, Any]:
    slug = _slug_from_name(payload.name_fr)

    existing = await recipes_col().find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{str(ObjectId())[:6]}"

    now = datetime.now(tz=timezone.utc)
    doc = {**payload.model_dump(), "slug": slug, "created_at": now, "updated_at": now}

    result = await recipes_col().insert_one(doc)
    return {"id": str(result.inserted_id), "slug": slug, "message": "Recette créée"}


@router.patch("/admin/{recipe_id}", summary="Admin: update a recipe (partial)")
async def admin_update_recipe(recipe_id: str, payload: dict[str, Any], _: None = Depends(require_admin)) -> dict[str, Any]:
    oid = _oid(recipe_id)

    # _id is immutable; everything else (including slug) may be patched.
    payload.pop("_id", None)
    payload.pop("id", None)
    payload["updated_at"] = datetime.now(tz=timezone.utc)

    result = await recipes_col().update_one({"_id": oid}, {"$set": payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Non trouvée")

    return {"message": "Recette mise à jour"}


@router.delete("/admin/{recipe_id}", summary="Admin: delete a recipe")
async def admin_delete_recipe(recipe_id: str, _: None = Depends(require_admin)) -> dict[str, Any]:
    result = await recipes_col().delete_one({"_id": _oid(recipe_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Non trouvée")

    return {"message": "Recette supprimée"}


@router.patch("/admin/{recipe_id}/toggle-visible", summary="Admin: toggle a recipe's visibility")
async def toggle_recipe_visibility(recipe_id: str, _: None = Depends(require_admin)) -> dict[str, Any]:
    oid = _oid(recipe_id)
    recipe = await recipes_col().find_one({"_id": oid}, {"visible": 1})
    if not recipe:
        raise HTTPException(status_code=404, detail="Non trouvée")

    new_val = not recipe.get("visible", True)
    await recipes_col().update_one({"_id": oid}, {"$set": {"visible": new_val, "updated_at": datetime.now(tz=timezone.utc)}})
    return {"visible": new_val}
