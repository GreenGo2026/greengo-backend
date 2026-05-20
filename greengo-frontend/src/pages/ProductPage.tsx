// src/pages/ProductPage.tsx
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchProductById, getRelatedProducts } from "../services/api";
import type { DBProduct } from "../services/api";
import { useCartStore, getUnitStep, formatQuantity } from "../store/cartStore";

type L = "fr" | "ar" | "en";

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function resolveImg(url: string | null | undefined): string {
  if (!url || url.trim() === "") return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return API + (url.startsWith("/") ? url : "/" + url);
}

// ── Dynamic SEO head ──────────────────────────────────────────────────────────
function SeoHead({ product, lang }: { product: DBProduct; lang: string }) {
  const l = lang as L;
  const name = (product.name_fr && product.name_fr !== 'null') ? product.name_fr : (product.name_ar || "Produit");
  const title = `${name} — GreenGo Market | Livraison fraîche à Salé & Rabat`;
  const desc  = l === "ar"
    ? `اشتري ${product.name_ar} طازجة بسعر ${product.price_mad} درهم/${product.unit}. توصيل سريع في سلا والرباط.`
    : l === "fr"
    ? `Achetez ${name} frais à ${product.price_mad} MAD/${product.unit}. Livraison rapide à Salé et Rabat — GreenGo Market.`
    : `Buy fresh ${name} at ${product.price_mad} MAD/${product.unit}. Fast delivery in Salé & Rabat.`;
  const img = resolveImg(product.image_url);

  useEffect(() => {
    document.title = title;
    const setMeta = (name: string, content: string, prop = false) => {
      const sel = prop ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let el = document.querySelector(sel) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        prop ? el.setAttribute("property", name) : el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("description", desc);
    setMeta("keywords", `${name}, livraison légumes Salé, épicerie en ligne Maroc, GreenGo Market`);
    setMeta("og:title", title, true);
    setMeta("og:description", desc, true);
    setMeta("og:type", "product", true);
    setMeta("og:url", window.location.href, true);
    if (img) setMeta("og:image", img, true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);

    // JSON-LD structured data for Google Shopping
    const ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": name,
      "description": desc,
      "image": img || "",
      "brand": { "@type": "Brand", "name": "GreenGo Market" },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "MAD",
        "price": product.price_mad,
        "priceValidUntil": new Date(Date.now() + 86400000).toISOString().split("T")[0],
        "availability": product.in_stock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        "seller": { "@type": "Organization", "name": "GreenGo Market" },
        "url": window.location.href,
        "areaServed": ["Salé", "Rabat", "Témara"],
      },
    };
    let script = document.getElementById("ld-product") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "ld-product";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(ld);

    return () => {
      document.title = "GreenGo Market — Épicerie fraîche en ligne au Maroc";
    };
  }, [title, desc, img]);

  return null;
}

// ── Category metadata ─────────────────────────────────────────────────────────
const CAT_META: Record<string, { emoji: string; bg: string }> = {
  Fruits:           { emoji: "🍎", bg: "bg-orange-50"  },
  Vegetables:       { emoji: "🥕", bg: "bg-green-50"   },
  "Purified Greens":{ emoji: "🥗", bg: "bg-emerald-50" },
  "White Meats":    { emoji: "🍗", bg: "bg-rose-50"    },
  Eggs:             { emoji: "🥚", bg: "bg-yellow-50"  },
  "Natural Juices": { emoji: "🧃", bg: "bg-cyan-50"    },
  "Mixed Packs":    { emoji: "🛒", bg: "bg-purple-50"  },
  Olives:           { emoji: "🫒", bg: "bg-lime-50"    },
  Epices:           { emoji: "🧂", bg: "bg-orange-50"  },
};
function getCat(cat: string) { return CAT_META[cat] ?? { emoji: "🛒", bg: "bg-gray-50" }; }

// ── Related product mini-card ─────────────────────────────────────────────────
function RelatedCard({ p, lang }: { p: DBProduct; lang: string }) {
  const l   = lang as L;
  const img = resolveImg(p.image_url);
  const cat = getCat(p.category);
  return (
    <Link to={`/produit/${p.id}`}
      className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-green-600/40 transition-all hover:-translate-y-0.5">
      <div className={`flex items-center justify-center py-5 ${cat.bg} bg-opacity-10`}>
        {img
          ? <img src={img} alt={p.name_fr || ""} className="h-16 w-16 object-contain" />
          : <span className="text-4xl">{cat.emoji}</span>}
      </div>
      <div className="p-3">
        <p className="text-white/80 text-xs font-bold leading-tight line-clamp-2 mb-1">
          {l === "ar" ? p.name_ar : p.name_fr || p.name_ar}
        </p>
        <p className="text-green-400 text-sm font-black font-latin">{p.price_mad.toFixed(2)} <span className="text-white/30 text-[10px]">MAD</span></p>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProductPage() {
  const { id }              = useParams<{ id: string }>();
  const navigate            = useNavigate();
  const { language, isRTL } = useLanguage();
  const l                   = language as L;

  const addToCart  = useCartStore(s => s.addToCart);
  const removeCart = useCartStore(s => s.removeFromCart);
  const cart       = useCartStore(s => s.cart);

  const [product,  setProduct]  = useState<DBProduct | null>(null);
  const [related,  setRelated]  = useState<DBProduct[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [imgError, setImgError] = useState(false);
  const [added,    setAdded]    = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchProductById(id).then(p => {
      setProduct(p);
      setLoading(false);
      if (p) getRelatedProducts(p.category, p.id).then(setRelated);
    });
  }, [id]);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#031409,#0a2318)" }}
      className="flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-green-700/30 border-t-green-500 rounded-full animate-spin" />
        <p className="text-white/40 text-sm">{l==="ar"?"جارٍ التحميل...":l==="fr"?"Chargement...":"Loading..."}</p>
      </div>
    </div>
  );

  if (!product) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#031409,#0a2318)" }}
      className="flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-6xl">🔍</span>
      <h1 className="text-white font-black text-xl">{l==="ar"?"المنتج غير موجود":l==="fr"?"Produit introuvable":"Product not found"}</h1>
      <Link to="/shop" className="px-5 py-2.5 bg-green-700 rounded-xl text-white font-bold text-sm hover:bg-green-600 transition-colors">
        {l==="ar"?"العودة للكتالوج":l==="fr"?"Retour au catalogue":"Back to catalog"}
      </Link>
    </div>
  );

  const cat      = getCat(product.category);
  const img      = imgError ? "" : resolveImg(product.image_url);
  const step     = getUnitStep(product.unit);
  const cartItem = cart.find(i => i.name === product.name_ar || i.name === product.name_fr);
  const qty      = cartItem?.cartQuantity ?? 0;
  const discount = Math.random() > 0.6 ? Math.floor(Math.random() * 15) + 5 : 0; // demo

  function handleAdd() {
    addToCart({
      name:           product!.name_ar || product!.name_fr || "",
      price_per_unit: product!.price_mad,
      unit:           product!.unit,
      available:      product!.in_stock,
    }, step);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className={language==="ar"?"font-arabic":"font-latin"} dir={isRTL?"rtl":"ltr"}
      style={{ minHeight:"100vh", background:"linear-gradient(160deg,#031409 0%,#061a12 40%,#0a2318 100%)" }}>

      {product && <SeoHead product={product} lang={language} />}

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* Back button */}
        <button onClick={() => navigate(-1)}
          className={`flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors mb-6 ${isRTL?"flex-row-reverse":""}`}>
          <span className={isRTL?"rotate-180":""}>←</span>
          {l==="ar"?"رجوع":l==="fr"?"Retour":"Back"}
        </button>

        {/* Product card */}
        <section aria-label={product.name_fr || product.name_ar || "Produit"}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">

          {/* Image panel */}
          <div className={`flex items-center justify-center rounded-3xl overflow-hidden ${cat.bg} bg-opacity-10 border border-white/8 min-h-[280px] md:min-h-[360px] relative`}
            style={{ background:"rgba(255,255,255,0.03)" }}>
            {img ? (
              <img src={img} alt={product.name_fr || product.name_ar || ""}
                className="w-full h-full object-contain p-8 drop-shadow-2xl"
                style={{ maxHeight: 360, filter:"drop-shadow(0 8px 24px rgba(0,0,0,0.3))" }}
                onError={() => setImgError(true)} />
            ) : (
              <span className="text-9xl select-none">{cat.emoji}</span>
            )}
            {/* In stock badge */}
            <div className="absolute top-4 right-4">
              {product.in_stock
                ? <span className="flex items-center gap-1.5 rounded-full bg-green-900/60 border border-green-600/40 px-3 py-1 text-xs font-bold text-green-400 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {l==="ar"?"متوفر":l==="fr"?"En stock":"In stock"}
                  </span>
                : <span className="rounded-full bg-gray-900/60 border border-gray-600/40 px-3 py-1 text-xs font-bold text-gray-400 backdrop-blur-sm">
                    {l==="ar"?"نفذ":l==="fr"?"Épuisé":"Out of stock"}
                  </span>}
            </div>
          </div>

          {/* Info panel */}
          <div className="flex flex-col justify-between gap-5">
            <div>
              {/* Category pill */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{cat.emoji}</span>
                <span className="text-xs font-bold text-white/35 uppercase tracking-widest">{product.category}</span>
              </div>

              {/* Product name */}
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-1">
                {l === "ar" ? product.name_ar : product.name_fr || product.name_ar}
              </h1>
              {product.name_fr && product.name_ar && product.name_fr !== product.name_ar && (
                <p className="text-white/30 text-sm mb-4 font-arabic">
                  {l === "ar" ? product.name_fr : product.name_ar}
                </p>
              )}

              {/* Price block */}
              <div className="rounded-2xl border border-green-700/25 bg-green-900/10 px-5 py-4 mb-5">
                <p className="text-[10px] font-bold text-green-400/60 uppercase tracking-widest mb-1">
                  {l==="ar"?"السعر":l==="fr"?"Prix":"Price"}
                </p>
                <div className={`flex items-baseline gap-2 ${isRTL?"flex-row-reverse":""}`}>
                  <span className="text-4xl font-black text-green-400 font-latin">{product.price_mad.toFixed(2)}</span>
                  <span className="text-white/40 text-sm font-latin">MAD / {product.unit}</span>
                </div>
                {discount > 0 && (
                  <p className="text-orange-400/70 text-xs mt-1">
                    {"🏷️ " + (l==="ar" ? "خصم " + discount + "%" : l==="fr" ? "-" + discount + "% ce mois" : "-" + discount + "% this month")}
                  </p>
                )}
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { e:"🌿", fr:"Produit frais",    ar:"منتج طازج",   en:"Fresh product"   },
                  { e:"🛵", fr:"Livraison rapide", ar:"توصيل سريع",  en:"Fast delivery"   },
                  { e:"🇲🇦", fr:"Origine Maroc",   ar:"من المغرب",   en:"From Morocco"    },
                  { e:"✅", fr:"Qualité garantie", ar:"جودة مضمونة", en:"Quality assured" },
                ].map(f => (
                  <div key={f.en} className={`flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/8 px-3 py-2 ${isRTL?"flex-row-reverse":""}`}>
                    <span className="text-sm shrink-0">{f.e}</span>
                    <span className="text-[11px] font-semibold text-white/50">
                      {l==="ar"?f.ar:l==="fr"?f.fr:f.en}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart controls */}
            <div className="space-y-3">
              {qty === 0 ? (
                <button onClick={handleAdd} disabled={!product.in_stock}
                  className={`w-full rounded-2xl py-4 text-base font-extrabold text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] ${
                    product.in_stock
                      ? added
                        ? "bg-green-600 shadow-lg shadow-green-600/30"
                        : "bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 hover:opacity-90 shadow-lg shadow-green-900/30"
                      : "bg-gray-700/50 cursor-not-allowed opacity-50"
                  }`}>
                  {added
                    ? <><span>✓</span> {l==="ar"?"تمت الإضافة":l==="fr"?"Ajouté !":"Added!"}</>
                    : <><span>🛒</span> {l==="ar"?"أضف للسلة":l==="fr"?"Ajouter au panier":"Add to cart"}</>}
                </button>
              ) : (
                <div className="flex items-center rounded-2xl border-2 border-green-600/30 bg-green-900/10 overflow-hidden h-14">
                  <button onClick={() => removeCart(product.name_ar || product.name_fr || "", step)}
                    className="flex h-full w-14 shrink-0 items-center justify-center text-green-400 hover:bg-green-900/30 transition-colors text-xl font-black">
                    −
                  </button>
                  <span className="flex-1 text-center text-lg font-extrabold text-green-400 font-latin">
                    {formatQuantity(qty, product.unit)}
                  </span>
                  <button onClick={handleAdd}
                    className="flex h-full w-14 shrink-0 items-center justify-center text-green-400 hover:bg-green-900/30 transition-colors text-xl font-black">
                    +
                  </button>
                </div>
              )}

              {/* View cart shortcut */}
              {qty > 0 && (
                <Link to="/cart"
                  className="flex items-center justify-center gap-2 w-full rounded-2xl border border-green-600/30 bg-white/[0.03] py-3 text-sm font-bold text-green-400 hover:bg-green-900/10 transition-colors">
                  🛒 {l==="ar"?"عرض السلة":l==="fr"?"Voir le panier":"View cart"}
                  <span className="bg-green-600 text-white text-xs rounded-full px-2 py-0.5 font-latin">{qty}</span>
                </Link>
              )}

              {/* Share */}
              <button onClick={() => navigator.share?.({ title: product.name_fr || "", url: window.location.href })}
                className="flex items-center justify-center gap-2 w-full rounded-2xl border border-white/8 bg-white/[0.03] py-3 text-sm font-semibold text-white/40 hover:text-white/70 hover:border-white/15 transition-all">
                🔗 {l==="ar"?"مشاركة المنتج":l==="fr"?"Partager ce produit":"Share this product"}
              </button>
            </div>
          </div>
        </section>

        {/* SEO content block */}
        <section aria-label="Description produit" className="rounded-3xl bg-white/[0.03] border border-white/8 p-6 mb-10">
          <h2 className="text-white font-black text-lg mb-4">
            {l==="ar"?"عن المنتج":l==="fr"?"À propos de ce produit":"About this product"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {[
              { label:{fr:"Catégorie",ar:"الفئة",en:"Category"},       value:product.category },
              { label:{fr:"Unité",   ar:"الوحدة",en:"Unit"},           value:product.unit     },
              { label:{fr:"Statut",  ar:"الحالة",en:"Status"},
                value:product.in_stock
                  ? (l==="ar"?"متوفر":l==="fr"?"En stock":"In stock")
                  : (l==="ar"?"نفذ":l==="fr"?"Épuisé":"Out of stock") },
            ].map(row => (
              <div key={row.label.en} className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
                <p className="text-white/35 text-[10px] uppercase tracking-widest font-bold mb-1">{row.label[l]}</p>
                <p className="text-white font-semibold text-sm">{row.value}</p>
              </div>
            ))}
          </div>
          <p className="text-white/40 text-sm leading-relaxed mt-4">
            {l === "ar"
              ? `${product.name_ar} طازج يُختار يومياً من أسواق الجملة المغربية. نضمن الجودة والطازجية لكل طلبية. توصيل سريع في سلا والرباط وتمارة.`
              : l === "fr"
              ? `${product.name_fr || product.name_ar} frais sélectionné chaque matin dans les marchés de gros marocains. Qualité et fraîcheur garanties pour chaque commande. Livraison rapide à Salé, Rabat et Témara.`
              : `Fresh ${product.name_fr || product.name_ar} selected daily from Moroccan wholesale markets. Quality and freshness guaranteed. Fast delivery in Salé, Rabat and Témara.`}
          </p>
        </section>

        {/* Related products */}
        {related.length > 0 && (
          <section aria-label="Produits similaires">
            <h2 className="text-white font-black text-lg mb-4">
              {l==="ar"?"منتجات مشابهة":l==="fr"?"Produits similaires":"Similar products"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {related.map(p => <RelatedCard key={p.id} p={p} lang={language} />)}
            </div>
          </section>
        )}

      </main>

      {/* Breadcrumb nav */}
      <nav aria-label="Fil d'ariane" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-full text-xs border border-amber-800/20 max-w-[90vw] overflow-hidden"
        style={{ background:"rgba(6,26,18,0.92)", backdropFilter:"blur(12px)" }}>
        <Link to="/"     className="text-green-400 font-semibold shrink-0 hover:text-green-300">GreenGo</Link>
        <span className="text-white/25">/</span>
        <Link to="/shop" className="text-white/40 hover:text-white/70 transition-colors shrink-0">
          {l==="ar"?"الكتالوج":l==="fr"?"Catalogue":"Catalog"}
        </Link>
        <span className="text-white/25">/</span>
        <span className="text-amber-400 font-semibold truncate">
          {l==="ar"?product.name_ar:product.name_fr||product.name_ar}
        </span>
      </nav>
    </div>
  );
}
