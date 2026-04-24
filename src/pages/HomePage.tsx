// src/pages/HomePage.tsx
import { useEffect, useState } from "react";
import { ShoppingCart, AlertCircle, Loader2, RefreshCw, Leaf } from "lucide-react";
import { getCatalog, type Product } from "../services/api";
import { useCartStore } from "../store/cartStore";

// ── Language type ─────────────────────────────────────────────────────────────
type Language = "ar" | "fr" | "en";

// ── Static UI copy ────────────────────────────────────────────────────────────
const UI = {
  ar: {
    heroTitle:   "طازج كل يوم، يوصلك لباب الدار 🌿",
    heroSub:     "خضرة وفواكه مختارة بعناية من أفضل المزارع المغربية",
    title:       "كتالوج المنتجات",
    subtitle:    (n: number) => `${n} منتج متاح`,
    all:         "الكل",
    addToCart:   "أضف للسلة",
    outOfStock:  "تسالات لينا",
    loading:     "جارٍ تحميل المنتجات الطازجة…",
    errorMsg:    "تعذّر تحميل المنتجات. تأكد من تشغيل الخادم.",
    retry:       "إعادة المحاولة",
    emptyFilter: "لا توجد منتجات في هذه الفئة",
    perUnit:     "لكل",
    dir:         "rtl" as const,
  },
  fr: {
    heroTitle:   "Frais chaque jour, livré chez vous 🌿",
    heroSub:     "Fruits et légumes sélectionnés des meilleures fermes du Maroc",
    title:       "Catalogue Produits",
    subtitle:    (n: number) => `${n} produit(s) disponible(s)`,
    all:         "Tout",
    addToCart:   "Ajouter",
    outOfStock:  "Rupture de stock",
    loading:     "Chargement des produits frais…",
    errorMsg:    "Impossible de charger les produits.",
    retry:       "Réessayer",
    emptyFilter: "Aucun produit dans cette catégorie",
    perUnit:     "par",
    dir:         "ltr" as const,
  },
  en: {
    heroTitle:   "Farm fresh, delivered to your door 🌿",
    heroSub:     "Hand-picked fruits and vegetables from Morocco's finest farms",
    title:       "Product Catalog",
    subtitle:    (n: number) => `${n} product${n !== 1 ? "s" : ""} available`,
    all:         "All",
    addToCart:   "Add to Cart",
    outOfStock:  "Out of Stock",
    loading:     "Loading fresh products…",
    errorMsg:    "Could not load products. Is the server running?",
    retry:       "Retry",
    emptyFilter: "No products in this category",
    perUnit:     "per",
    dir:         "ltr" as const,
  },
} as const;

type UICopy = typeof UI[Language];

// ── Category helpers ──────────────────────────────────────────────────────────
const VEGETABLE_KEYWORDS = ["بصل","طماطم","بطاطس","بطاطا","جزر","كوسة","فلفل","خس","معدنوس","كزبرة"];
const FRUIT_KEYWORDS     = ["تفاح","موز","برتقال","رمان","عنب","بطيخ","خوخ"];
const MEAT_KEYWORDS      = ["دجاج","صدر","مفروم","ديك"];
const EGG_KEYWORDS       = ["بيض"];

function guessCategory(name: string): string {
  if (!name) return "Other";
  if (EGG_KEYWORDS.some((w) => name.includes(w)))       return "Eggs";
  if (MEAT_KEYWORDS.some((w) => name.includes(w)))      return "White Meats";
  if (FRUIT_KEYWORDS.some((w) => name.includes(w)))     return "Fruits";
  if (VEGETABLE_KEYWORDS.some((w) => name.includes(w))) return "Vegetables";
  return "Other";
}

// Category accent colours for the fallback placeholder
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Vegetables:    { bg: "#dcfce7", text: "#16a34a" },
  Fruits:        { bg: "#fef3c7", text: "#d97706" },
  "White Meats": { bg: "#fce7f3", text: "#db2777" },
  Eggs:          { bg: "#fef9c3", text: "#ca8a04" },
  Other:         { bg: "#f0fdf4", text: "#2E8B57"  },
};

// Category display labels per language
const CATEGORY_LABELS: Record<string, Record<Language, string>> = {
  Vegetables:    { ar: "خضروات",   fr: "Légumes",    en: "Vegetables"   },
  Fruits:        { ar: "فواكه",    fr: "Fruits",     en: "Fruits"       },
  "White Meats": { ar: "لحوم",     fr: "Viandes",    en: "White Meats"  },
  Eggs:          { ar: "بيض",      fr: "Œufs",       en: "Eggs"         },
  Other:         { ar: "أخرى",     fr: "Autres",     en: "Other"        },
};

// ── Zellige SVG used in the Hero background ───────────────────────────────────
const ZELLIGE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><g fill='none' stroke='%23ffffff' stroke-width='0.6' opacity='0.12'><polygon points='30,4 37,17 52,17 41,26 45,41 30,33 15,41 19,26 8,17 23,17'/><line x1='30' y1='4' x2='30' y2='56'/><line x1='4' y1='30' x2='56' y2='30'/><line x1='8' y1='8' x2='52' y2='52'/><line x1='52' y1='8' x2='8' y2='52'/></g></svg>`;
const ZELLIGE_BG  = `url("data:image/svg+xml,${encodeURIComponent(ZELLIGE_SVG)}")`;

// ── Image fallback placeholder ────────────────────────────────────────────────
function ImageFallback({ name, category }: { name: string; category: string }) {
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
  const initial = name?.charAt(0) ?? "?";

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: colors.bg }}
    >
      <span
        className="text-5xl font-extrabold select-none opacity-60"
        style={{ color: colors.text, fontFamily: "serif" }}
      >
        {initial}
      </span>
    </div>
  );
}

// ── Product image with fallback ───────────────────────────────────────────────
function ProductImage({ product, category }: { product: Product; category: string }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = !imgError && !!(product as Product & { image_url?: string }).image_url;

  if (hasImage) {
    return (
      <img
        src={(product as Product & { image_url?: string }).image_url}
        alt={product.name}
        onError={() => setImgError(true)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
    );
  }

  return <ImageFallback name={product.name} category={category} />;
}

// ── Language toggle ───────────────────────────────────────────────────────────
function LangToggle({ current, onChange }: { current: Language; onChange: (l: Language) => void }) {
  const langs: { code: Language; label: string }[] = [
    { code: "ar", label: "عربي" },
    { code: "fr", label: "FR"   },
    { code: "en", label: "EN"   },
  ];
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-sm">
      {langs.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => onChange(code)}
          className={[
            "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
            current === code
              ? "bg-white text-[#0d3b36] shadow-sm"
              : "text-white/70 hover:text-white",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────
function ProductCard({ product, language, ui }: { product: Product; language: Language; ui: UICopy }) {
  const addToCart = useCartStore((s) => s.addToCart);
  const cart      = useCartStore((s) => s.cart);

  const cartItem    = cart.find((i) => i.name === product.name);
  const cartQty     = cartItem?.cartQuantity ?? 0;
  const isAvailable = product.available === true;
  const safePrice   = isFinite(Number(product.price_per_unit)) ? Number(product.price_per_unit) : 0;
  const category    = guessCategory(product.name);
  const catLabel    = CATEGORY_LABELS[category]?.[language] ?? category;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">

      {/* Image area */}
      <div className="relative h-48 w-full overflow-hidden bg-[#f0faf4]">
        <ProductImage product={product} category={category} />

        {/* Out-of-stock overlay */}
        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-red-500 shadow">
              {ui.outOfStock}
            </span>
          </div>
        )}

        {/* Cart quantity badge */}
        {cartQty > 0 && (
          <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#2E8B57] text-[11px] font-extrabold text-white shadow-md">
            {cartQty}
          </span>
        )}

        {/* Category chip */}
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-gray-600 shadow backdrop-blur-sm">
          {catLabel}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">

        {/* Product name */}
        <h2
          dir={ui.dir}
          className={[
            "text-base font-bold leading-snug text-gray-800",
            language === "ar" ? "text-right" : "text-left",
          ].join(" ")}
        >
          {product.name || "—"}
        </h2>

        {/* Price */}
        <div className="mt-auto flex items-baseline gap-1 pt-1">
          <span className="text-xl font-extrabold text-[#2E8B57]">
            {safePrice.toFixed(2)}
          </span>
          <span className="text-sm text-gray-400">MAD</span>
          {product.unit && (
            <span className="ml-1 text-xs text-gray-400">
              {ui.perUnit} {product.unit}
            </span>
          )}
        </div>

        {/* Add to cart button */}
        <button
          onClick={() => { if (isAvailable) addToCart(product as never); }}
          disabled={!isAvailable}
          aria-label={`${ui.addToCart} — ${product.name}`}
          className={[
            "mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all duration-150 active:scale-95",
            isAvailable
              ? "bg-[#FF9800] shadow-sm hover:bg-[#e68900] hover:shadow-md"
              : "cursor-not-allowed bg-gray-100 text-gray-400",
          ].join(" ")}
        >
          {isAvailable ? (
            <><ShoppingCart size={14} strokeWidth={2.5} />{ui.addToCart}</>
          ) : (
            <><AlertCircle size={14} />{ui.outOfStock}</>
          )}
        </button>
      </div>
    </article>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({
  categories, active, allLabel, language, onChange,
}: {
  categories: string[];
  active:     string;
  allLabel:   string;
  language:   Language;
  onChange:   (c: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        key="all"
        onClick={() => onChange(allLabel)}
        className={[
          "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
          active === allLabel
            ? "bg-[#2E8B57] text-white shadow-sm"
            : "bg-white text-gray-600 ring-1 ring-black/10 hover:bg-gray-50",
        ].join(" ")}
      >
        {allLabel}
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={[
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
            active === cat
              ? "bg-[#2E8B57] text-white shadow-sm"
              : "bg-white text-gray-600 ring-1 ring-black/10 hover:bg-gray-50",
          ].join(" ")}
        >
          {CATEGORY_LABELS[cat]?.[language] ?? cat}
        </button>
      ))}
    </div>
  );
}

// ── Hero banner ───────────────────────────────────────────────────────────────
function HeroBanner({ ui, language, onLangChange }: { ui: UICopy; language: Language; onLangChange: (l: Language) => void }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:      "linear-gradient(135deg, #0d3b36 0%, #1a5c4a 60%, #2E8B57 100%)",
        backgroundImage: `${ZELLIGE_BG}, linear-gradient(135deg, #0d3b36 0%, #1a5c4a 60%, #2E8B57 100%)`,
        backgroundSize:  "60px 60px, 100% 100%",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-12 md:flex-row md:py-14">

        {/* Text */}
        <div className={["max-w-lg space-y-3", language === "ar" ? "text-right" : "text-left"].join(" ")} dir={ui.dir}>
          <div className="flex items-center gap-2" style={{ justifyContent: language === "ar" ? "flex-end" : "flex-start" }}>
            <Leaf size={18} className="text-[#FF9800]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF9800]">
              GreenGo Market
            </span>
          </div>
          <h1 className="text-2xl font-extrabold leading-snug text-white md:text-3xl">
            {ui.heroTitle}
          </h1>
          <p className="text-sm leading-relaxed text-white/65">
            {ui.heroSub}
          </p>
        </div>

        {/* Lang toggle */}
        <div className="shrink-0">
          <LangToggle current={language} onChange={onLangChange} />
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-50 to-transparent" />
    </section>
  );
}

// ── HomePage ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [products,       setProducts]       = useState<Product[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [language,       setLanguage]       = useState<Language>("ar");
  const [activeCategory, setActiveCategory] = useState<string>(UI.ar.all);

  const ui = UI[language];

  // Sync "All" label when language changes
  useEffect(() => {
    setActiveCategory(UI[language].all);
  }, [language]);

  // Fetch on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCatalog();
        if (!cancelled) {
          console.log(`[HomePage] ✅ ${data.length} products loaded`, data[0]);
          setProducts(data);
        }
      } catch (err) {
        console.error("[HomePage] fetch error:", err);
        if (!cancelled) setError(UI[language].errorMsg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = [...new Set(products.map((p) => guessCategory(p.name)))].sort();
  const allLabel   = ui.all;
  const visible    = activeCategory === allLabel
    ? products
    : products.filter((p) => guessCategory(p.name) === activeCategory);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <HeroBanner ui={ui} language={language} onLangChange={setLanguage} />
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-[#2E8B57]">
        <Loader2 size={48} className="animate-spin" />
        <p className="font-semibold text-gray-600">{ui.loading}</p>
      </div>
    </>
  );

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) return (
    <>
      <HeroBanner ui={ui} language={language} onLangChange={setLanguage} />
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-5 px-6 text-center">
        <AlertCircle size={48} className="text-red-400" />
        <p className="max-w-sm text-base text-gray-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 rounded-xl bg-[#2E8B57] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1F6B40] transition-colors"
        >
          <RefreshCw size={14} />
          {ui.retry}
        </button>
      </div>
    </>
  );

  // ── Main ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hero */}
      <HeroBanner ui={ui} language={language} onLangChange={setLanguage} />

      {/* Catalog */}
      <main dir={ui.dir} className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* Section header */}
        <div className={language === "ar" ? "text-right" : "text-left"}>
          <h2 className="text-xl font-extrabold text-gray-800">
            {ui.title}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {ui.subtitle(products.length)}
          </p>
        </div>

        {/* Category filter */}
        <FilterBar
          categories={categories}
          active={activeCategory}
          allLabel={allLabel}
          language={language}
          onChange={setActiveCategory}
        />

        {/* Empty filtered state */}
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
            <span className="text-5xl">🥺</span>
            <p className="text-base">{ui.emptyFilter}</p>
          </div>
        )}

        {/* Product grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product, index) => (
            <ProductCard
              key={`${product.name}-${index}`}
              product={product}
              language={language}
              ui={ui}
            />
          ))}
        </div>

      </main>
    </>
  );
}