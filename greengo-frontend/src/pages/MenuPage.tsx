// src/pages/MenuPage.tsx — Menu Digital GreenGo Market v3
// Design: Moroccan Fresh Market — warm light theme, editorial typography
import { useState, useEffect, useMemo, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { getProducts } from "../services/api";
import type { DBProduct } from "../services/api";
import QRCode from "qrcode";

type L = "fr" | "ar" | "en";
const API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const WA  = "https://wa.me/212664500789";

function resolveImg(url?: string | null): string {
  if (!url?.trim()) return "";
  return url.startsWith("http") ? url : API + (url.startsWith("/") ? url : "/" + url);
}

// ── Brand tokens ──────────────────────────────────────────────────────────────
const GREEN  = "#1a5c38";
const DGREEN = "#0c3228";
const GOLD   = "#C9A96E";
const CREAM  = "#F7F5EF";
const CREAM2 = "#EDE9E0";

// ── Category config ───────────────────────────────────────────────────────────
const CAT: Record<string, { emoji: string; fr: string; ar: string; en: string; dot: string }> = {
  "Vegetables":      { emoji: "🥕", fr: "Légumes",          ar: "خضروات",           en: "Vegetables",     dot: "#16a34a" },
  "Purified Greens": { emoji: "🌿", fr: "Herbes fraîches",  ar: "أعشاب طازجة",      en: "Fresh Herbs",    dot: "#15803d" },
  "Fruits":          { emoji: "🍊", fr: "Fruits",            ar: "فواكه",             en: "Fruits",         dot: "#ea580c" },
  "White Meats":     { emoji: "🍗", fr: "Viandes blanches", ar: "لحوم بيضاء",       en: "White Meats",    dot: "#dc2626" },
  "Eggs":            { emoji: "🥚", fr: "Œufs",             ar: "بيض",               en: "Eggs",           dot: "#ca8a04" },
  "Olives":          { emoji: "🫒", fr: "Olives",            ar: "زيتون",             en: "Olives",         dot: "#65a30d" },
  "Epices":          { emoji: "🧂", fr: "Épices",            ar: "توابل",             en: "Spices",         dot: "#9333ea" },
  "Natural Juices":  { emoji: "🧃", fr: "Jus naturels",     ar: "عصائر طبيعية",     en: "Natural Juices", dot: "#0891b2" },
  "Mixed Packs":     { emoji: "🛒", fr: "Paniers mixtes",   ar: "سلال مشكلة",       en: "Mixed Packs",    dot: "#7c3aed" },
};
const c = (cat: string) => CAT[cat] ?? { emoji: "🛒", fr: cat, ar: cat, en: cat, dot: GREEN };

function fmtUnit(unit: string, l: string): string {
  const u = unit.toLowerCase();
  if (u === "kg" || u === "كيلو") return l === "ar" ? "/ كغ" : "/ kg";
  if (u === "piece" || u === "pièce") return l === "ar" ? "/ قطعة" : l === "fr" ? "/ pièce" : "/ piece";
  if (u === "bundle" || u === "botte") return l === "ar" ? "/ ربطة" : l === "fr" ? "/ botte" : "/ bunch";
  return `/ ${unit}`;
}

// ── Premium card ──────────────────────────────────────────────────────────────
function MenuCard({ p, lang }: { p: DBProduct; lang: string }) {
  const l      = lang as L;
  const meta   = c(p.category);
  const img    = resolveImg(p.image_url);
  const isJpg  = p.image_url?.endsWith(".jpg") || p.image_url?.endsWith(".jpeg");
  const name   = l === "ar" ? p.name_ar : (p.name_fr || p.name_ar);
  const alt    = l === "ar" ? (p.name_fr || null) : (p.name_ar || null);
  const disc   = (p as any).discount_pct as number | undefined;
  const deal   = disc ? Math.round(p.price_mad * (1 - disc / 100) * 100) / 100 : null;
  const isKg   = p.unit?.toLowerCase() === "kg" || p.unit === "كيلو";

  if (!p.in_stock) {
    return (
      <div className="flex items-center gap-3 py-3 px-3 opacity-35">
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
          {img ? <img src={img} alt="" width={40} height={40} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-lg">{meta.emoji}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold text-gray-400 line-through ${l === "ar" ? "font-arabic text-right" : "font-latin"}`}>{name}</p>
        </div>
        <span className="text-[10px] font-bold text-gray-300 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
          {l === "ar" ? "نفذ" : l === "fr" ? "Épuisé" : "Out"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3.5 py-3 px-3">


      {/* Left: name + details */}
      <div className="flex-1 min-w-0 pl-2">
        <p className={`font-bold text-gray-900 leading-tight ${
          l === "ar" ? "font-arabic text-right text-[14px]" : "font-latin text-[13px]"
        }`}>{name}</p>
        {alt && alt !== name && (
          <p className={`text-[11px] text-gray-400 mt-0.5 leading-tight ${l === "ar" ? "font-latin" : "font-arabic"}`}>
            {alt}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-[10px] text-gray-400 font-latin">{p.unit}</span>
          {isKg && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: "#f0fdf4", color: GREEN }}>
              {l === "fr" ? "½ kg min." : l === "ar" ? "½ كغ" : "½ kg"}
            </span>
          )}
          {disc && disc > 0 && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white"
              style={{ background: GOLD }}>
              -{disc}%
            </span>
          )}
        </div>
      </div>

      {/* Right: image + price stacked */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {/* Image */}
        <div className="w-[60px] h-[60px] rounded-xl overflow-hidden"
          style={{ background: isJpg ? "#F7F5EF" : "#edf7f0", border: "1px solid rgba(0,0,0,0.05)" }}>
          {img
            ? <img src={img} alt={name || ""} width={60} height={60}
                className={`w-full h-full ${isJpg ? "object-cover" : "object-contain p-1"}`}
                loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center text-2xl">{meta.emoji}</div>
          }
        </div>
        {/* Price */}
        <div className="text-right">
          {deal ? (
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-300 line-through font-latin leading-none">{p.price_mad.toFixed(2)}</span>
              <span className="text-[18px] font-black font-latin leading-none" style={{ color: GREEN }}>{deal.toFixed(2)}</span>
            </div>
          ) : (
            <span className="text-[18px] font-black font-latin leading-none" style={{ color: GREEN }}>{p.price_mad.toFixed(2)}</span>
          )}
          <span className="text-[9px] text-gray-400 font-latin block leading-none mt-0.5">
            MAD {fmtUnit(p.unit, lang)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────
function CategorySection({ catKey, items, lang, activeCat }: {
  catKey: string; items: DBProduct[]; lang: string; activeCat: string;
}) {
  const l    = lang as L;
  const meta = c(catKey);
  const inStock = items.filter(p => p.in_stock);
  const prices  = inStock.map(p => p.price_mad);
  const mn = prices.length ? Math.min(...prices) : 0;
  const mx = prices.length ? Math.max(...prices) : 0;

  return (
    <section id={`section-${catKey.replace(/\s+/g, "-").toLowerCase()}`} className="mb-6">
      {activeCat === "all" && (
        <div className="flex items-baseline gap-3 mb-3 pb-2"
          style={{ borderBottom: `2px solid ${meta.dot}20` }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700, color: DGREEN, letterSpacing: "-0.02em", fontStyle: "italic" }}>
            {meta.emoji} {l === "ar" ? meta.ar : l === "fr" ? meta.fr : meta.en}
          </h2>
          <span className="text-[10px] text-gray-400 font-latin ml-auto shrink-0">
            {inStock.length} dispo
            {prices.length > 0 && (
              <> &bull; {mn === mx ? `${mn.toFixed(0)}` : `${mn.toFixed(0)}–${mx.toFixed(0)}`} MAD</>
            )}
          </span>
        </div>
      )}
      <div className="space-y-2">
        {items.map(p => (
          <div key={p.id}
            className="rounded-2xl overflow-hidden"
            style={{
              background: "#F7F5EF",
              border: "1px solid rgba(0,0,0,0.055)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
            <MenuCard p={p} lang={lang} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const { language, isRTL } = useLanguage();
  const l = language as L;

  const [products,   setProducts]   = useState<DBProduct[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeCat,  setActiveCat]  = useState("all");
  const [search,     setSearch]     = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showQR,     setShowQR]     = useState(false);
  const [updatedAt,  setUpdatedAt]  = useState("");
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Hide main site chrome — with pagehide cleanup for iOS Safari bfcache
  useEffect(() => {
    const toHide: HTMLElement[] = [];
    ["header", "footer", "nav", ".zellige-border"].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const e = el as HTMLElement;
        e.style.setProperty("display", "none", "important");
        toHide.push(e);
      });
    });
    const shell = document.querySelector(".pb-16") as HTMLElement | null;
    if (shell) shell.style.paddingBottom = "0";

    // iOS Safari bfcache fix — restore elements synchronously on pagehide
    function restoreAll() {
      toHide.forEach(e => e.style.removeProperty("display"));
      if (shell) shell.style.paddingBottom = "";
    }
    window.addEventListener("pagehide", restoreAll);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") restoreAll();
    });

    return () => {
      restoreAll();
      window.removeEventListener("pagehide", restoreAll);
      window.removeEventListener("visibilitychange", restoreAll);
    };
  }, []);

  // QR code
  useEffect(() => {
    if (showQR && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, "https://www.mygreengoo.com/menu", {
        width: 200, margin: 2, color: { dark: DGREEN, light: "#ffffff" },
      }).catch(console.error);
    }
  }, [showQR]);

  // Load products
  useEffect(() => {
    getProducts().then(all => {
      setProducts(all.filter(p => p.visible));
      setLoading(false);
      const now = new Date();
      setUpdatedAt(now.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" }));
    }).catch(() => setLoading(false));
  }, []);

  const categories = useMemo(() =>
    [...new Set(products.map(p => p.category))]
      .filter(cat => products.some(p => p.category === cat && p.in_stock))
      .sort(),
  [products]);

  const filtered = useMemo(() => {
    let list = activeCat === "all" ? products : products.filter(p => p.category === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.name_fr || "").toLowerCase().includes(q) ||
        (p.name_ar || "").includes(search)
      );
    }
    return [...list].sort((a, b) => (b.in_stock ? 1 : 0) - (a.in_stock ? 1 : 0));
  }, [products, activeCat, search]);

  const grouped = useMemo(() => {
    if (activeCat !== "all") return { [activeCat]: filtered };
    const g: Record<string, DBProduct[]> = {};
    for (const p of filtered) {
      if (!g[p.category]) g[p.category] = [];
      g[p.category].push(p);
    }
    return g;
  }, [filtered, activeCat]);

  const inStockCount = products.filter(p => p.in_stock).length;

  return (
    <div className={language === "ar" ? "font-arabic" : "font-latin"} dir={isRTL ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", background: "#F7F5EF" }}>
      <style>{`body { background: #F7F5EF !important; }`}</style>

      {/* ── Hero ── */}
      <div style={{ background: `linear-gradient(160deg, ${DGREEN} 0%, ${GREEN} 100%)`, paddingBottom: 0 }}>
        {/* Zellige strip */}
        <div style={{ height: 4, backgroundImage: `repeating-linear-gradient(90deg,${GOLD} 0,${GOLD} 12px,transparent 12px,transparent 16px,${GREEN} 16px,${GREEN} 28px,transparent 28px,transparent 32px)`, backgroundSize: "64px 4px", opacity: 0.7 }} />

        <div className="px-5 pt-5 pb-6 text-center">
          <img src="/greengo-logo-header.png" alt="GreenGo Market"
            className="h-10 w-auto object-contain mx-auto mb-3"
            style={{ filter: "brightness(0) invert(1)" }}
            onError={e => { e.currentTarget.style.display = "none"; }} />

          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem,6vw,2.2rem)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", fontStyle: "italic", lineHeight: 1.1 }}>
            {l === "ar" ? "قائمة منتجاتنا الطازجة" : l === "fr" ? "Nos Produits Frais" : "Our Fresh Products"}
          </h1>

          <div className="flex items-center justify-center gap-2 mt-2 mb-4">
            <div className="h-px flex-1 max-w-[60px] opacity-30" style={{ background: GOLD }} />
            <span style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {l === "ar" ? "سلا والرباط" : l === "fr" ? "Salé & Rabat" : "Salé & Rabat"}
            </span>
            <div className="h-px flex-1 max-w-[60px] opacity-30" style={{ background: GOLD }} />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-white font-black text-xl font-latin leading-none">{loading ? "—" : inStockCount}</p>
              <p className="text-white/50 text-[9px] uppercase tracking-widest mt-0.5">
                {l === "fr" ? "Produits" : l === "ar" ? "منتج" : "Products"}
              </p>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div className="text-center">
              <p className="text-white font-black text-xl font-latin leading-none">2h</p>
              <p className="text-white/50 text-[9px] uppercase tracking-widest mt-0.5">
                {l === "fr" ? "Livraison" : l === "ar" ? "توصيل" : "Delivery"}
              </p>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div className="text-center">
              <p style={{ color: GOLD }} className="font-black text-xl font-latin leading-none">MAD</p>
              <p className="text-white/50 text-[9px] uppercase tracking-widest mt-0.5">
                {l === "fr" ? "Monnaie" : l === "ar" ? "عملة" : "Currency"}
              </p>
            </div>
          </div>

          {updatedAt && (
            <p className="text-white/35 text-[9px] mt-3 font-latin">
              {l === "fr" ? `Mis à jour à ${updatedAt}` : l === "ar" ? `آخر تحديث: ${updatedAt}` : `Updated at ${updatedAt}`}
            </p>
          )}
        </div>

        {/* Bottom curve */}
        <svg viewBox="0 0 390 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block" style={{ marginBottom: -1 }}>
          <path d="M0 24 C97.5 0 292.5 0 390 24 L390 24 L0 24 Z" fill="#F7F5EF" />
        </svg>
      </div>

      {/* ── Sticky nav ── */}
      <div className="sticky top-0 z-40 px-4 py-2 flex items-center gap-2"
        style={{ background: "#F7F5EF", borderBottom: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>

        {/* Pills */}
        <div className={`flex gap-1.5 overflow-x-auto flex-1 scrollbar-hide ${isRTL ? "flex-row-reverse" : ""}`}>
          <button onClick={() => setActiveCat("all")}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap"
            style={activeCat === "all"
              ? { background: DGREEN, color: "#fff", boxShadow: "0 2px 8px rgba(12,50,40,0.25)" }
              : { background: "#F7F5EF", color: "#374151", border: "1.5px solid rgba(0,0,0,0.14)" }}>
            {l === "ar" ? "الكل" : l === "fr" ? "Tout" : "All"}
            {!loading && <span className="ml-1 font-latin opacity-60">{products.length}</span>}
          </button>
          {categories.map(cat => {
            const m = c(cat);
            return (
              <button key={cat}
                onClick={() => {
                  if (activeCat === "all") {
                    document.getElementById(`section-${cat.replace(/\s+/g, "-").toLowerCase()}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  } else {
                    setActiveCat(cat);
                  }
                }}
                className="shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap"
                style={activeCat === cat
                  ? { background: DGREEN, color: "#fff", boxShadow: "0 2px 8px rgba(12,50,40,0.25)" }
                  : { background: "#F7F5EF", color: "#374151", border: "1.5px solid rgba(0,0,0,0.14)" }}>
                <span>{m.emoji}</span>
                <span>{l === "ar" ? m.ar : l === "fr" ? m.fr : m.en}</span>
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setShowQR(true)} aria-label="QR Code"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "#F7F5EF", color: DGREEN }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/>
              <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
              <rect x="18" y="18" width="3" height="3"/>
            </svg>
          </button>
          <button onClick={() => setShowSearch(s => !s)} aria-label="Search"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: showSearch ? DGREEN : "#F7F5EF", color: showSearch ? "#fff" : DGREEN }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2" style={{ background: "#F7F5EF", borderBottom: `1px solid ${CREAM2}` }}>
          <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={l === "ar" ? "ابحث عن منتج..." : l === "fr" ? "Rechercher un produit..." : "Search..."}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none font-latin"
            style={{ background: "#F7F5EF", border: `1px solid ${CREAM2}`, color: "#1f2937" }}
            dir="auto" />
        </div>
      )}

      {/* ── Products ── */}
      <main className="px-4 pt-4 pb-32 max-w-lg mx-auto" style={{ background: "#F7F5EF", minHeight: "60vh" }}>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded gg-skeleton" />
                  <div className="h-2.5 w-1/3 rounded gg-skeleton" />
                </div>
                <div className="w-[60px] h-[60px] rounded-xl gg-skeleton shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">🔍</span>
            <p className="text-gray-400 text-sm">
              {l === "ar" ? "لا توجد منتجات" : l === "fr" ? "Aucun produit trouvé" : "No products found"}
            </p>
            <button onClick={() => { setSearch(""); setActiveCat("all"); }}
              className="text-xs font-bold underline" style={{ color: GREEN }}>
              {l === "fr" ? "Tout afficher" : l === "ar" ? "عرض الكل" : "Show all"}
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <CategorySection key={cat} catKey={cat} items={items} lang={language} activeCat={activeCat} />
          ))
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-center text-[10px] text-gray-300 mt-4 pb-2 font-latin">
            GreenGo Market · mygreengoo.com · +212 664 500 789
          </p>
        )}
      </main>

      {/* ── WhatsApp CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 max-w-lg mx-auto"
        style={{ background: "linear-gradient(0deg, #F7F5EF 80%, transparent 100%)" }}>
        <a href={WA} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 w-full rounded-2xl py-3.5 text-sm font-extrabold text-white"
          style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", boxShadow: "0 4px 20px rgba(37,211,102,0.35)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          {l === "ar" ? "اطلب الآن عبر واتساب" : l === "fr" ? "Commander via WhatsApp" : "Order via WhatsApp"}
        </a>
        <p className="text-center text-[9px] text-gray-400 mt-1.5 font-latin">
          Laayayda, Salé · Livraison 2h · 8h–20h
        </p>
      </div>

      {/* ── QR Modal ── */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-3xl p-6 text-center shadow-2xl max-w-xs w-full"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700, color: DGREEN, fontStyle: "italic" }}>
              GreenGo Market
            </p>
            <p className="text-[11px] font-bold uppercase tracking-widest mt-0.5 mb-4"
              style={{ color: GOLD }}>Menu Digital</p>
            {/* QR */}
            <div className="flex justify-center mb-3 p-3 rounded-2xl" style={{ background: CREAM }}>
              <canvas ref={qrCanvasRef} className="rounded-xl" />
            </div>
            <p className="text-[10px] text-gray-400 mb-4 font-latin">
              {l === "fr" ? "Scannez pour voir les prix en direct" : l === "ar" ? "امسح لرؤية الأسعار مباشرة" : "Scan to view live prices"}
            </p>
            <p className="text-[9px] text-gray-300 font-latin mb-4">mygreengoo.com/menu</p>
            <button onClick={() => setShowQR(false)}
              className="w-full rounded-xl py-2.5 text-sm font-bold text-white"
              style={{ background: DGREEN }}>
              {l === "fr" ? "Fermer" : l === "ar" ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
