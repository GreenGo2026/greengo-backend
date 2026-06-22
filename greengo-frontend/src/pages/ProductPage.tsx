// src/pages/ProductPage.tsx — v2
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchProductById, getRelatedProducts } from "../services/api";
import type { DBProduct } from "../services/api";
import { useCartStore, getUnitStep, formatQuantity } from "../store/cartStore";

type L = "fr" | "ar" | "en";
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/[/]+$/, "");

function resolveImg(url?: string | null): string {
  if (!url?.trim()) return "";
  return url.startsWith("http") ? url : API_BASE + (url.startsWith("/") ? url : "/" + url);
}

const CAT_META: Record<string, { emoji: string; fr: string; ar: string }> = {
  "Vegetables":      { emoji: "🥕", fr: "L\u00e9gumes frais",     ar: "\u062e\u0636\u0631\u0648\u0627\u062a" },
  "Purified Greens": { emoji: "🌱", fr: "Herbes fra\u00eeches",   ar: "\u0623\u0639\u0634\u0627\u0628" },
  "Fruits":          { emoji: "🍎", fr: "Fruits frais",            ar: "\u0641\u0648\u0627\u0643\u0647" },
  "White Meats":     { emoji: "🍗", fr: "Viandes blanches",       ar: "\u0644\u062d\u0648\u0645 \u0628\u064a\u0636\u0627\u0621" },
  "Eggs":            { emoji: "🥚", fr: "Oeufs frais",             ar: "\u0628\u064a\u0636" },
  "Olives":          { emoji: "🫒", fr: "Olives",                  ar: "\u0632\u064a\u062a\u0648\u0646" },
  "Epices":          { emoji: "🧂", fr: "\u00c9pices",             ar: "\u062a\u0648\u0627\u0628\u0644" },
  "Natural Juices":  { emoji: "🧃", fr: "Jus naturels",           ar: "\u0639\u0635\u0627\u0626\u0631" },
  "Mixed Packs":     { emoji: "🛒", fr: "Paniers mixtes",         ar: "\u0633\u0644\u0627\u0644" },
};
const getCat = (c: string) => CAT_META[c] ?? { emoji: "🛒", fr: c, ar: c };

function generateDescription(p: DBProduct, l: string): string {
  const name   = l === "ar" ? p.name_ar : (p.name_fr || p.name_ar);
  const cat    = getCat(p.category);
  const catLbl = l === "ar" ? cat.ar : cat.fr;
  const unit   = p.unit?.toLowerCase();
  const unitLbl = unit === "kg" ? (l === "fr" ? "au kilo" : l === "ar" ? "\u0628\u0627\u0644\u0643\u064a\u0644\u0648" : "per kg")
    : unit === "piece" || unit === "pi\u00e8ce" ? (l === "fr" ? "\u00e0 la pi\u00e8ce" : l === "ar" ? "\u0628\u0627\u0644\u0642\u0637\u0639\u0629" : "per piece")
    : unit === "bundle" || unit === "botte" ? (l === "fr" ? "\u00e0 la botte" : l === "ar" ? "\u0628\u0627\u0644\u0631\u0628\u0637\u0629" : "per bunch")
    : `par ${p.unit}`;
  if (l === "ar") {
    return `${name} \u0637\u0627\u0632\u062c\u0629 \u0645\u0646 ${catLbl} \u2014 \u0645\u062e\u062a\u0627\u0631\u0629 \u0628\u0639\u0646\u0627\u064a\u0629 \u0643\u0644 \u0635\u0628\u0627\u062d \u0645\u0646 \u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u062c\u0645\u0644\u0629. \u062a\u0648\u0635\u064a\u0644 \u0633\u0631\u064a\u0639 \u0641\u064a \u0633\u0644\u0627 \u0648\u0627\u0644\u0631\u0628\u0627\u0637 \u062e\u0644\u0627\u0644 \u0633\u0627\u0639\u062a\u064a\u0646. \u062c\u0648\u062f\u0629 \u0645\u0636\u0645\u0648\u0646\u0629.`;
  }
  if (l === "fr") {
    return `${name} fra\u00eeche — ${catLbl} s\u00e9lectionn\u00e9(e) chaque matin sur les march\u00e9s de gros, vendu(e) ${unitLbl}. Livr\u00e9(e) \u00e0 domicile \u00e0 Sal\u00e9 et Rabat en moins de 2h. Qualit\u00e9 garantie par GreenGo Market.`;
  }
  return `Fresh ${name} — ${catLbl} selected every morning from wholesale markets, sold ${unitLbl}. Home delivery in Sal\u00e9 & Rabat within 2 hours. Quality guaranteed by GreenGo Market.`;
}

// ── SEO head ──────────────────────────────────────────────────────────────────
function SeoHead({ product, lang }: { product: DBProduct; lang: string }) {
  const l    = lang as L;
  const name = product.name_fr || product.name_ar || "Produit";
  const title = `${name} \u2014 GreenGo Market | Livraison fra\u00eeche \u00e0 Sal\u00e9 & Rabat`;
  const desc  = generateDescription(product, "fr");
  const img   = resolveImg(product.image_url);

  useEffect(() => {
    document.title = title;
    const setMeta = (n: string, v: string, prop = false) => {
      const sel = prop ? `meta[property="${n}"]` : `meta[name="${n}"]`;
      let el = document.querySelector(sel) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); prop ? el.setAttribute("property", n) : el.setAttribute("name", n); document.head.appendChild(el); }
      el.setAttribute("content", v);
    };
    setMeta("description", desc);
    setMeta("og:title", title, true);
    setMeta("og:description", desc, true);
    setMeta("og:type", "product", true);
    setMeta("og:url", window.location.href, true);
    if (img) setMeta("og:image", img, true);
    // JSON-LD structured data for Google Shopping
    let ld = document.getElementById("product-ld");
    if (!ld) { ld = document.createElement("script"); ld.id = "product-ld"; ld.setAttribute("type", "application/ld+json"); document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org/",
      "@type": "Product",
      name,
      description: desc,
      image: img || undefined,
      brand: { "@type": "Brand", name: "GreenGo Market" },
      offers: {
        "@type": "Offer",
        priceCurrency: "MAD",
        price: product.price_mad.toFixed(2),
        availability: product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: "GreenGo Market" },
      },
    });
    return () => { document.title = "GreenGo Market"; };
  }, [product.id]);
  return null;
}

// ── Trust badge ───────────────────────────────────────────────────────────────
function TrustBadge({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="text-base">{icon}</span>
      <span className="font-semibold">{text}</span>
    </div>
  );
}

// ── Related product card ──────────────────────────────────────────────────────
function RelatedCard({ p, lang }: { p: DBProduct; lang: string }) {
  const l    = lang as L;
  const name = l === "ar" ? p.name_ar : (p.name_fr || p.name_ar);
  const img  = resolveImg(p.image_url);
  const isJpg = p.image_url?.endsWith(".jpg");
  return (
    <Link to={`/produit/${p.id}`}
      className="flex flex-col rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
      <div className="h-28 flex items-center justify-center" style={{ background: isJpg ? "#f9fafb" : "#f0fdf4" }}>
        {img
          ? <img src={img} alt={name || ""} className={`h-full w-full ${isJpg ? "object-cover" : "object-contain p-2"}`} loading="lazy" />
          : <span className="text-4xl">{getCat(p.category).emoji}</span>}
      </div>
      <div className="p-3">
        <p className={`text-xs font-bold text-gray-800 leading-tight truncate ${l === "ar" ? "font-arabic text-right" : "font-latin"}`}>{name}</p>
        <p className="text-[#2E8B57] font-black text-sm font-latin mt-1">{p.price_mad.toFixed(2)} MAD</p>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProductPage() {
  const { id }              = useParams<{ id: string }>();
  const { language, isRTL } = useLanguage();
  const navigate            = useNavigate();
  const l = language as L;
  const font = l === "ar" ? "font-arabic" : "font-latin";

  const [product,  setProduct]  = useState<DBProduct | null>(null);
  const [related,  setRelated]  = useState<DBProduct[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [imgError, setImgError] = useState(false);
  const [added,    setAdded]    = useState(false);

  const addToCart = useCartStore(s => s.addToCart);
  const cart      = useCartStore(s => s.cart);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setImgError(false);
    fetchProductById(id).then(p => {
      setProduct(p);
      setLoading(false);
      if (p) getRelatedProducts(p.category, p.id).then(setRelated);
    });
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]" style={{ background: "#FAF7F2" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[#2E8B57]/30 border-t-[#2E8B57] animate-spin" />
        <p className="text-gray-400 text-sm">{l === "fr" ? "Chargement..." : l === "ar" ? "\u062c\u0627\u0631\u064d..." : "Loading..."}</p>
      </div>
    </div>
  );

  if (!product) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center" style={{ background: "#FAF7F2" }}>
      <span className="text-5xl">🔍</span>
      <h1 className="text-gray-800 font-black text-xl">{l === "fr" ? "Produit introuvable" : l === "ar" ? "\u0627\u0644\u0645\u0646\u062a\u062c \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f" : "Product not found"}</h1>
      <Link to="/shop" className="px-5 py-2.5 bg-[#2E8B57] rounded-xl text-white font-bold text-sm hover:bg-[#1F6B40] transition-colors">
        {l === "fr" ? "Retour au catalogue" : l === "ar" ? "\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u0643\u062a\u0627\u0644\u0648\u062c" : "Back to catalog"}
      </Link>
    </div>
  );

  const cat      = getCat(product.category);
  const img      = imgError ? "" : resolveImg(product.image_url);
  const isJpg    = product.image_url?.endsWith(".jpg") || product.image_url?.endsWith(".jpeg");
  const step     = getUnitStep(product.unit);
  const cartItem = cart.find(i => i.name === product.name_ar || i.name === product.name_fr);
  const qty      = cartItem?.cartQuantity ?? 0;
  const disc     = (product as any).discount_pct as number | undefined;
  const dealPrice = disc ? Math.round(product.price_mad * (1 - disc / 100) * 100) / 100 : null;
  // Use DB description when available, fall back to generated
  const desc = (
    (product as any).description_fr?.trim()
      ? (product as any).description_fr
      : generateDescription(product, l)
  );

  function handleAdd() {
    addToCart({
      name:           product!.name_ar || product!.name_fr || "",
      price_per_unit: dealPrice ?? product!.price_mad,
      unit:           product!.unit,
      available:      product!.in_stock,
    }, step);
    setAdded(true);
    // GA4 add_to_cart event
    try {
      if ((window as any).gtag) {
        (window as any).gtag("event", "add_to_cart", {
          currency: "MAD",
          value:    dealPrice ?? product!.price_mad,
          items: [{ item_id: (product as any).sku || product!.id, item_name: product!.name_fr || product!.name_ar, price: dealPrice ?? product!.price_mad, quantity: step }],
        });
      }
    } catch { /* ignore */ }
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className={font} dir={isRTL ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#FAF7F2" }}>
      {product && <SeoHead product={product} lang={language} />}

      <main className="max-w-4xl mx-auto px-4 py-6">

        {/* Breadcrumb */}
        <nav className={`flex items-center gap-2 text-xs text-gray-400 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Link to="/" className="hover:text-[#2E8B57] transition-colors">
            {l === "fr" ? "Accueil" : l === "ar" ? "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629" : "Home"}
          </Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-[#2E8B57] transition-colors">
            {l === "fr" ? "Catalogue" : l === "ar" ? "\u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c" : "Catalog"}
          </Link>
          <span>/</span>
          <span className="text-gray-600 font-semibold truncate max-w-[120px]">
            {l === "ar" ? product.name_ar : product.name_fr || product.name_ar}
          </span>
        </nav>

        {/* Product grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">

          {/* Image */}
          <div className="rounded-3xl overflow-hidden flex items-center justify-center aspect-square"
            style={{ background: isJpg ? "#f9fafb" : "#f0fdf4", border: "1px solid rgba(0,0,0,0.06)" }}>
            {img
              ? <img src={img} alt={l === "ar" ? product.name_ar : product.name_fr || product.name_ar}
                  className={`w-full h-full ${isJpg ? "object-cover" : "object-contain p-8"}`}
                  loading="lazy"
                  onError={() => setImgError(true)} />
              : <span className="text-8xl">{cat.emoji}</span>}
          </div>

          {/* Info panel */}
          <div className="flex flex-col gap-5">

            {/* Category + stock */}
            <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {l === "ar" ? cat.ar : cat.fr}
                </span>
              </div>
              {product.in_stock
                ? <span className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-bold text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {l === "fr" ? "En stock" : l === "ar" ? "\u0645\u062a\u0648\u0641\u0631" : "In stock"}
                  </span>
                : <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-red-500">
                    {l === "fr" ? "\u00c9puis\u00e9" : l === "ar" ? "\u0646\u0641\u0630" : "Out of stock"}
                  </span>}
            </div>

            {/* Name */}
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem,4vw,2.2rem)", fontWeight: 700, color: "#0c3228", lineHeight: 1.1 }}>
                {l === "ar" ? product.name_ar : (product.name_fr || product.name_ar)}
              </h1>
              {product.name_fr && product.name_ar && product.name_fr !== product.name_ar && (
                <p className={`text-gray-400 text-sm mt-1 ${l === "ar" ? "font-latin" : "font-arabic"}`}>
                  {l === "ar" ? product.name_fr : product.name_ar}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#fdf8ef,#f9efda)", border: "1px solid rgba(201,169,110,0.2)" }}>
              {dealPrice ? (
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black font-latin text-[#2E8B57]">{dealPrice.toFixed(2)}</span>
                  <span className="text-gray-400 text-sm font-latin line-through">{product.price_mad.toFixed(2)}</span>
                  <span className="text-xs font-black text-white bg-[#C9A96E] rounded-full px-2 py-0.5">-{disc}%</span>
                  <span className="text-gray-500 text-sm font-latin">MAD / {product.unit}</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-latin text-[#2E8B57]">{product.price_mad.toFixed(2)}</span>
                  <span className="text-gray-500 text-sm font-latin">MAD / {product.unit}</span>
                </div>
              )}
              {product.unit?.toLowerCase() === "kg" && (
                <p className="text-xs text-gray-500 mt-1">
                  {l === "fr" ? "Disponible au demi-kilo (500g minimum)" : l === "ar" ? "\u0645\u062a\u0627\u062d \u0628\u0646\u0635\u0641 \u0643\u064a\u0644\u0648 (500\u063a \u0643\u062d\u062f \u0623\u062f\u0646\u0649)" : "Available per 500g minimum"}
                </p>
              )}
            </div>

            {/* Quantity + Add to cart */}
            {product.in_stock && (
              <div className="flex flex-col gap-3">
                {qty > 0 && (
                  <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <button onClick={() => { addToCart({ name: product!.name_ar || product!.name_fr || "", price_per_unit: dealPrice ?? product!.price_mad, unit: product!.unit, available: true }, -step); }}
                      className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-lg transition-colors flex items-center justify-center">-</button>
                    <span className="font-bold text-gray-800 font-latin min-w-[60px] text-center">
                      {formatQuantity(qty, product.unit)}
                    </span>
                    <button onClick={handleAdd}
                      className="w-10 h-10 rounded-xl bg-[#2E8B57]/10 hover:bg-[#2E8B57]/20 text-[#2E8B57] font-black text-lg transition-colors flex items-center justify-center">+</button>
                  </div>
                )}
                <button onClick={handleAdd}
                  className={`w-full rounded-2xl py-4 text-base font-extrabold text-white transition-all active:scale-[0.98] shadow-lg ${added ? "bg-green-600" : "bg-[#2E8B57] hover:bg-[#1F6B40]"}`}
                  style={{ boxShadow: "0 4px 16px rgba(46,139,87,0.3)" }}>
                  {added
                    ? (l === "fr" ? "\u2713 Ajout\u00e9 au panier" : l === "ar" ? "\u2713 \u062a\u0645 \u0627\u0644\u0625\u0636\u0627\u0641\u0629" : "\u2713 Added!")
                    : qty > 0
                    ? (l === "fr" ? "Ajouter encore" : l === "ar" ? "\u0625\u0636\u0627\u0641\u0629 \u0623\u062e\u0631\u0649" : "Add more")
                    : (l === "fr" ? "\ud83d\uded2 Ajouter au panier" : l === "ar" ? "\ud83d\uded2 \u0623\u0636\u0641 \u0644\u0644\u0633\u0644\u0629" : "\ud83d\uded2 Add to cart")}
                </button>
                <a href={"https://wa.me/212664500789?text=" + encodeURIComponent(
                  l === "fr" ? `Commander: ${product.name_fr || product.name_ar} - ${(dealPrice ?? product.price_mad).toFixed(2)} MAD/${product.unit}`
                  : `\u0628\u063a\u064a\u062a \u0646\u0637\u0644\u0628: ${product.name_ar} - ${(dealPrice ?? product.price_mad).toFixed(2)} \u062f\u0631\u0647\u0645/${product.unit}`
                )}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 text-sm font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  {l === "fr" ? "Commander via WhatsApp" : l === "ar" ? "\u0637\u0644\u0628 \u0639\u0628\u0631 \u0648\u0627\u062a\u0633\u0627\u0628" : "Order via WhatsApp"}
                </a>
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <TrustBadge icon="\u26a1" text={l === "fr" ? "Livraison en 2h" : l === "ar" ? "\u062a\u0648\u0635\u064a\u0644 \u062e\u0644\u0627\u0644 \u0633\u0627\u0639\u062a\u064a\u0646" : "2h delivery"} />
              <TrustBadge icon="\u2705" text={l === "fr" ? "Qualit\u00e9 garantie" : l === "ar" ? "\u062c\u0648\u062f\u0629 \u0645\u0636\u0645\u0648\u0646\u0629" : "Quality guaranteed"} />
              <TrustBadge icon="🌿" text={l === "fr" ? "Fra\u00eecheur du matin" : l === "ar" ? "\u0637\u0627\u0632\u062c\u0629 \u0645\u0646 \u0627\u0644\u0635\u0628\u0627\u062d" : "Morning fresh"} />
              <TrustBadge icon="\ud83d\udccd" text={l === "fr" ? "Sal\u00e9 & Rabat" : l === "ar" ? "\u0633\u0644\u0627 \u0648\u0627\u0644\u0631\u0628\u0627\u0637" : "Sal\u00e9 & Rabat"} />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 mb-8">
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, color: "#0c3228", fontStyle: "italic", marginBottom: "0.75rem" }}>
            {l === "fr" ? "Description" : l === "ar" ? "\u0627\u0644\u0648\u0635\u0641" : "Description"}
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
        </div>

        {/* Delivery info */}
        <div className="rounded-2xl p-5 mb-8" style={{ background: "linear-gradient(135deg,#f0fdf4,#fafff7)", border: "1px solid #bbf7d0" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700, color: "#0c3228", fontStyle: "italic", marginBottom: "0.75rem" }}>
            {l === "fr" ? "Livraison" : l === "ar" ? "\u0627\u0644\u062a\u0648\u0635\u064a\u0644" : "Delivery"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "\u26a1", title: l === "fr" ? "Livraison rapide" : "\u062a\u0648\u0635\u064a\u0644 \u0633\u0631\u064a\u0639", sub: l === "fr" ? "En moins de 2h \u00e0 Sal\u00e9 & Rabat" : "\u062e\u0644\u0627\u0644 \u0633\u0627\u0639\u062a\u064a\u0646 \u0641\u064a \u0633\u0644\u0627 \u0648\u0627\u0644\u0631\u0628\u0627\u0637" },
              { icon: "\ud83d\udcc5", title: l === "fr" ? "7j/7" : "\u064a\u0648\u0645\u064a\u0627\u064b", sub: l === "fr" ? "De 8h \u00e0 20h" : "\u0645\u0646 8\u0635 \u0625\u0644\u0649 20\u0635" },
              { icon: "\ud83d\udcac", title: l === "fr" ? "Support WhatsApp" : "\u062f\u0639\u0645 \u0648\u0627\u062a\u0633\u0627\u0628", sub: l === "fr" ? "+212 664 500 789" : "+212 664 500 789" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xl shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-bold text-gray-700">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, color: "#0c3228", fontStyle: "italic", marginBottom: "1rem" }}>
              {l === "fr" ? "Vous aimerez aussi" : l === "ar" ? "\u0642\u062f \u064a\u0639\u062c\u0628\u0643 \u0623\u064a\u0636\u0627\u064b" : "You may also like"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {related.slice(0, 4).map(p => <RelatedCard key={p.id} p={p} lang={language} />)}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
