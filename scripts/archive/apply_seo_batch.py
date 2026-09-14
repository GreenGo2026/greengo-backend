"""
scripts/apply_seo_batch.py

One-off batch: applies shared SEO descriptions to 6 products (11 documents --
Miel des fleurs and Amlou cacahuetes are each modeled as 3 separate size
documents rather than one product with a variants array), and fixes a
category mismatch on Amlou cacahuetes 500g ("Huile et miel" -> "Produits
naturels", to match its 250g/1kg siblings).

Idempotent -- always sets description_fr to the same text, safe to re-run.

Usage:
    railway run <path-to-venv-python> scripts/apply_seo_batch.py

Archived to scripts/archive/ after running, per project convention.
"""
import json
import os
import urllib.error
import urllib.request

BASE = "https://web-production-0cdd6.up.railway.app/api/v1/products"
KEY = os.environ["ADMIN_API_KEY"]

DESC_MIEL_FLEURS = """Le miel de fleurs est l'expression la plus douce et la plus délicate du travail des abeilles marocaines. Récolté au printemps et en début d'été dans des zones florales variées — champs sauvages, jardins et prairies naturelles — ce miel multifloraux offre un profil aromatique complexe et changeant selon la saison et la région de récolte.

Sa couleur dorée claire, sa texture fluide et son goût subtilement sucré en font le choix préféré de ceux qui découvrent le miel artisanal marocain. Moins intense que le miel de thym ou d'euphorbe, il séduit par sa douceur naturelle et sa polyvalence en cuisine.

Nutritionnellement, le miel de fleurs est naturellement riche en fructose, glucose, enzymes digestives, et traces de vitamines et minéraux. Consommé le matin avec de l'amlou sur du pain traditionnel, il constitue un petit-déjeuner complet et énergisant.

Chez GreenGo Market, notre miel de fleurs est sélectionné auprès d'apiculteurs marocains artisanaux. Non chauffé, non filtré, il conserve toutes ses propriétés naturelles. Disponible en 250g, 500g et 1kg, livré en 30 minutes à Salé et Rabat, 7j/7 de 8h à 21h.

عسل الزهور المغربي — طبيعي 100٪، غني بالأنزيمات والمعادن. توصيل في 30 دقيقة في سلا والرباط."""

DESC_HUILE = """L'huile d'olive extra vierge est le pilier de la cuisine méditerranéenne et marocaine. Extraite à froid lors de la première pression des olives fraîches, elle conserve intégralement ses arômes, ses polyphénols antioxydants et ses acides gras essentiels — notamment l'acide oléique (oméga-9) qui représente jusqu'à 80% de sa composition.

Reconnaissable à sa couleur vert doré, son arôme fruité légèrement herbacé et son goût qui peut être doux, fruité ou légèrement amer selon la variété d'olive, une bonne huile d'olive extra vierge se distingue immédiatement d'une huile raffinée industrielle.

Elle est indispensable dans la cuisine marocaine : pour les salades, le pain traditionnel trempé à l'huile, les tajines, les chermoulas et les marinades. Ses bienfaits sur la santé cardiovasculaire, la digestion et la peau en font également un aliment fonctionnel reconnu par la nutrition moderne.

Chez GreenGo Market, notre huile d'olive extra vierge est sélectionnée pour sa qualité constante et sa fraîcheur garantie. Livrée en 30 minutes à Salé et Rabat, 7j/7 de 8h à 21h.

زيت الزيتون البكر الممتاز — معصور على البارد، طبيعي 100٪. توصيل في 30 دقيقة في سلا والرباط."""

DESC_EMMENTAL = """L'emmental est l'un des fromages les plus reconnaissables au monde, apprécié pour ses trous caractéristiques, sa pâte souple et son goût doux légèrement sucré avec des notes de noisette. Originaire de Suisse, il est aujourd'hui l'un des fromages les plus consommés au Maroc, aussi bien dans les foyers que dans la restauration.

Riche en protéines complètes, en calcium et en phosphore, l'emmental est un aliment nutritionnellement dense qui s'intègre facilement dans tous les repas. Une portion de 30g couvre environ 30% des besoins journaliers en calcium — un apport essentiel pour les enfants, les adolescents et les femmes.

En cuisine marocaine, l'emmental trouve sa place dans les sandwichs au kefta, les omelettes du matin, les pizzas maison, les gratins de légumes et les crêpes garnies. Il fond parfaitement à la chaleur, offrant une texture filante très appréciée.

Chez GreenGo Market, notre emmental est sélectionné pour sa fraîcheur et sa qualité constante. Disponible en 250g, 500g et 1kg, livré en 30 minutes à Salé et Rabat, 7j/7 de 8h à 21h.

جبن الإمنتال — غني بالكالسيوم والبروتين، طري وشهي. توصيل في 30 دقيقة في سلا والرباط."""

DESC_AMLOU_KK = """L'amlou de cacahuètes est la version la plus accessible et la plus généreuse de la grande famille des amlous marocains. Préparé à base de cacahuètes torréfiées, d'huile végétale et de miel naturel, il offre une texture crémeuse et un goût intense de cacahuète grillée qui plaît immédiatement aux adultes comme aux enfants.

Moins onéreux que l'amlou d'amande, il n'en est pas moins nourrissant : riche en protéines végétales (environ 25g pour 100g), en acides gras insaturés et en magnésium, l'amlou de cacahuètes constitue un petit-déjeuner ou une collation rassasiante et énergétique, idéale pour les journées actives.

Sa polyvalence en fait un incontournable du garde-manger marocain moderne : sur du pain, avec des dattes, mélangé dans un smoothie, ou incorporé dans des recettes de pâtisserie maison. Les enfants l'adoptent facilement comme alternative naturelle aux pâtes à tartiner industrielles.

Chez GreenGo Market, notre amlou de cacahuètes est préparé sans conservateurs ni colorants. Disponible en 250g, 500g et 1kg, livré en 30 minutes à Salé et Rabat, 7j/7 de 8h à 21h.

أملو الكاوكاو — غني بالبروتين والطاقة الطبيعية. بدون مواد حافظة. توصيل في 30 دقيقة في سلا والرباط."""

DESC_OLIVES_NOIRES = """Les olives noires marocaines sont le fruit de la maturité complète de l'olivier — récoltées tardivement, elles ont développé toute leur richesse en huile, leur couleur profonde et leur saveur douce et légèrement amère caractéristique. Elles sont l'un des ingrédients les plus emblématiques de la table marocaine, présentes du petit-déjeuner traditionnel au tajine du soir.

Naturellement riches en acides gras mono-insaturés, en vitamine E et en polyphénols antioxydants, les olives noires sont reconnues pour leurs bienfaits sur la santé cardiovasculaire et leur effet anti-inflammatoire naturel. Leur teneur en fer et en cuivre en fait également un aliment intéressant pour lutter contre la fatigue.

En cuisine marocaine, elles accompagnent le tajine de poulet au citron confit, les salades de tomates et poivrons, le kefta grillé, et se dégustent simplement avec du pain et de l'huile d'olive le matin. Leur saveur douce se marie parfaitement avec les épices marocaines.

Chez GreenGo Market, nos olives noires sont sélectionnées pour leur qualité artisanale et leur fraîcheur. Disponibles en 250g, 500g et 1kg, livrées en 30 minutes à Salé et Rabat, 7j/7 de 8h à 21h.

زيتون أسود مغربي أصيل — طبيعي وطازج، غني بمضادات الأكسدة. توصيل في 30 دقيقة في سلا والرباط."""

DESC_CITRON = """Le citron mokhalal — ou citron confit — est l'un des ingrédients les plus distinctifs et les plus irremplaçables de la cuisine marocaine. Préparé par fermentation naturelle dans le sel, parfois avec des épices comme la cannelle, les clous de girofle ou le piment, le citron confit développe avec le temps une saveur unique : intense, acidulée, légèrement salée, avec une texture fondante qui disparaît dans les plats en y laissant son arôme incomparable.

Son usage en cuisine marocaine est codifié par des siècles de tradition. Il est l'ingrédient clé du tajine de poulet aux olives et citron confit — le plat marocain le plus cuisiné dans les foyers de Salé et Rabat. Il parfume également les chermoulas de poisson, les salades cuites de courgettes et d'aubergines, et certaines pastillas.

Sur le plan nutritionnel, la fermentation du citron développe des probiotiques naturels bénéfiques pour la flore intestinale, en plus des propriétés antioxydantes naturelles du citron frais.

Chez GreenGo Market, notre citron mokhalal est préparé selon la recette traditionnelle marocaine, sans conservateurs artificiels. Livré en 30 minutes à Salé et Rabat, 7j/7 de 8h à 21h.

الحامض المخلل المغربي الأصيل — مكون أساسي في الطاجين المغربي. توصيل في 30 دقيقة في سلا والرباط."""

# Name fragment (lowercase) -> description text. First match wins.
# "olives noires" intentionally matches both "Olives noires" and
# "Olives noires tranchées" -- confirmed decision: same description for both.
PATTERNS = [
    ("miel des fleurs", DESC_MIEL_FLEURS),
    ("miel de fleurs", DESC_MIEL_FLEURS),
    ("huile d'olive", DESC_HUILE),
    ("emmental", DESC_EMMENTAL),
    ("amlou cacahu", DESC_AMLOU_KK),
    ("olives noires", DESC_OLIVES_NOIRES),
    ("citron mokhalal", DESC_CITRON),
]


def fetch_products():
    with urllib.request.urlopen(BASE, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data if isinstance(data, list) else data.get("products", data.get("items", []))


def patch_product(product_id, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/{product_id}",
        data=body,
        method="PATCH",
        headers={"Content-Type": "application/json", "X-Admin-Key": KEY},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def main():
    products = fetch_products()
    updated = 0
    category_fixed = 0
    errors = 0

    for p in products:
        name = (p.get("name_fr") or "").lower()
        matched_desc = None
        for fragment, desc in PATTERNS:
            if fragment in name:
                matched_desc = desc
                break
        if matched_desc is None:
            continue

        payload = {"description_fr": matched_desc}

        if "amlou cacahu" in name and "500" in name and p.get("category") == "Huile et miel":
            payload["category"] = "Produits naturels"
            category_fixed += 1
            print(f"  CATEGORY FIX: {p['name_fr']}")

        status, body = patch_product(p["id"], payload)
        if status == 200:
            print(f"  OK ({status}): {p['name_fr']} -> desc {len(matched_desc)} chars")
            updated += 1
        else:
            print(f"  ERR ({status}): {p['name_fr']} -> {body[:200]}")
            errors += 1

    print(f"\nTotal updated: {updated}")
    print(f"Categories fixed: {category_fixed}")
    print(f"Errors: {errors}")


if __name__ == "__main__":
    main()
