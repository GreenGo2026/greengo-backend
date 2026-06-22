// src/pages/OffresPage.tsx — real products from API
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { useCartStore, getUnitStep } from "../store/cartStore";
import { getProducts } from "../services/api";
import type { DBProduct } from "../services/api";
import SocialProofStrip from "../components/ui/SocialProofStrip";

type L = "fr" | "ar" | "en";

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function resolveImg(url: string | null | undefined): string {
  if (!url || url.trim() === "") return "";
  if (url.startsWith("http")) return url;
  return API + (url.startsWith("/") ? url : "/" + url);
}

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(expiresAt: Date) {
  const calc = () => {
    const diff = expiresAt.getTime() - Date.now();
    if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true };
    const s = Math.floor(diff / 1000);
    return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, expired: false };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

// ── Stock bar ─────────────────────────────────────────────────────────────────
function StockBar({ pct, lang }: { pct: number; lang: string }) {
  const l = lang as L;
  const color = pct < 30 ? "#ef4444" : pct < 60 ? "#f59e0b" : "#22c55e";
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] mb-1">
        <span style={{ color }} className="font-bold font-latin">{pct}%</span>
        <span className="text-white/30">
          {l === "ar" ? "متبقي" : l === "fr" ? "restant" : "left"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Deal Card ─────────────────────────────────────────────────────────────────
function DealCard({ product, lang, expiresAt }: {
  product: DBProduct & { discount_pct: number };
  lang: string;
  expiresAt: Date;
}) {
  const l         = lang as L;
  const time      = useCountdown(expiresAt);
  const addToCart = useCartStore(s => s.addToCart);
  const cart      = useCartStore(s => s.cart);
  const step      = getUnitStep(product.unit);
  const inCart    = cart.find(i => i.name === (product.name_ar || product.name_fr));
  const disc      = product.discount_pct || 0;
  const original  = product.price_mad;
  const dealPrice = Math.round(original * (1 - disc / 100) * 100) / 100;
  const img       = resolveImg(product.image_url);
  const name      = l === "ar" ? product.name_ar : (product.name_fr || product.name_ar);
  const urgent    = disc >= 20;

  function handleAdd() {
    addToCart({
      name:           product.name_ar || product.name_fr || "",
      price_per_unit: dealPrice,
      unit:           product.unit,
      available:      product.in_stock,
    }, step);
  }

  return (
    <article className={`relative rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
      urgent
        ? "border-red-700/40 bg-gradient-to-br from-red-900/10 to-black/20"
        : "border-amber-700/35 bg-gradient-to-br from-amber-900/10 to-black/20"
    }`}>

      {/* Hot badge */}
      <div className={`absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 shadow-lg ${
        urgent ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-gradient-to-r from-amber-500 to-orange-500"
      }`}>
        <span className="text-[10px]">{urgent ? "⚡" : "🔥"}</span>
        <span className="text-[10px] font-black text-white">
          {l === "ar" ? `خصم ${disc}%` : l === "fr" ? `Flash -${disc}%` : `Save -${disc}%`}
        </span>
      </div>

      {/* Discount bubble */}
      <div className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-600/40 border border-green-400/30">
        <span className="text-[10px] font-black text-white">-{disc}%</span>
      </div>

      {/* Image */}
      <div className={`flex items-center justify-center py-8 ${
        product.image_url?.endsWith('.jpg') ? "bg-white" : "bg-white/[0.03]"
      }`}>
        {img
          ? <img src={img} alt={name || ""} width={120} height={120}
              className={`object-${product.image_url?.endsWith('.jpg') ? 'cover' : 'contain'} drop-shadow-xl`}
              style={{ width: 100, height: 100 }}
              loading="lazy" />
          : <span className="text-6xl">🛒</span>
        }
      </div>

      <div className="p-4">
        <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-1">{product.category}</p>
        <h3 className={`text-white font-black text-base leading-tight mb-3 ${l === "ar" ? "font-arabic" : "font-latin"}`}>
          {name}
        </h3>

        {/* Pricing */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-black text-green-400 font-latin">{dealPrice.toFixed(2)}</span>
          <span className="text-xs text-white/40 font-latin">MAD/{product.unit}</span>
          <span className="text-xs text-white/25 line-through font-latin ml-auto">{original.toFixed(2)}</span>
        </div>

        {/* Countdown */}
        {!time.expired ? (
          <div className={`flex items-center gap-1.5 rounded-xl p-2.5 mb-3 ${
            time.h === 0 && time.m < 30
              ? "bg-red-900/20 border border-red-700/30"
              : "bg-white/[0.04] border border-white/8"
          }`}>
            <span className="text-xs">⏱️</span>
            <span className={`text-xs font-bold font-latin ${
              time.h === 0 && time.m < 30 ? "text-red-400" : "text-white/60"
            }`}>
              {pad(time.h)}:{pad(time.m)}:{pad(time.s)}
            </span>
            <span className="text-[10px] text-white/30 ml-1">
              {l === "ar" ? "متبقي" : l === "fr" ? "restant" : "left"}
            </span>
          </div>
        ) : (
          <div className="rounded-xl p-2.5 mb-3 bg-red-900/20 border border-red-700/30 text-center">
            <span className="text-xs font-bold text-red-400">
              {l === "ar" ? "انتهت المدة" : l === "fr" ? "Offre expirée" : "Deal expired"}
            </span>
          </div>
        )}

        <StockBar pct={Math.floor(Math.random() * 60) + 20} lang={lang} />

        <button onClick={handleAdd} disabled={time.expired || !product.in_stock}
          className={`mt-4 w-full rounded-xl py-3.5 text-sm font-extrabold text-white transition-all active:scale-[0.97] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed ${
            inCart
              ? "bg-green-700/50 border border-green-600/40"
              : "bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 shadow-lg shadow-green-900/30"
          }`}>
          {inCart
            ? (l === "ar" ? "✓ في السلة" : l === "fr" ? "✓ Dans le panier" : "✓ In cart")
            : (l === "ar" ? "أضف للسلة 🛒" : l === "fr" ? "Ajouter au panier 🛒" : "Add to cart 🛒")}
        </button>
      </div>
    </article>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OffresPage() {
  const { language, isRTL } = useLanguage();
  const l = language as L;
  const [products, setProducts] = useState<(DBProduct & { discount_pct: number })[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<"all" | "hot" | "urgent">("all");

  // Each deal expires at a different time today
  const BASE = new Date();
  const expiry = (hours: number) => new Date(BASE.getTime() + hours * 3600000);

  useEffect(() => {
    getProducts().then(all => {
      const deals = all
        .filter(p => (p as any).on_sale && p.in_stock && p.visible)
        .map((p, i) => ({ ...p, discount_pct: (p as any).discount_pct || 10 }));
      setProducts(deals as any);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const expiries = [expiry(2), expiry(5), expiry(8), expiry(1), expiry(6), expiry(3)];

  const filtered = products.filter(p => {
    if (filter === "hot")    return p.discount_pct >= 15;
    if (filter === "urgent") return p.discount_pct >= 20;
    return true;
  });

  const FILTERS = [
    { key: "all" as const,    emoji: "✨", label: { fr: "Toutes les offres", ar: "كل العروض",   en: "All deals"   } },
    { key: "hot" as const,    emoji: "🔥", label: { fr: "Offres flash",      ar: "عروض سريعة",  en: "Flash deals" } },
    { key: "urgent" as const, emoji: "⚡", label: { fr: "Stock critique",    ar: "مخزون محدود", en: "Low stock"   } },
  ];

  return (
    <div className={language === "ar" ? "font-arabic" : "font-latin"} dir={isRTL ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", background: "linear-gradient(160deg,#031409 0%,#061a12 40%,#0a2318 100%)" }}>
      <main>
        <SocialProofStrip />

        {/* Hero */}
        <section aria-label="Offres flash GreenGo Market" className="relative overflow-hidden px-6 py-14 text-center">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(251,146,60,0.12) 0%, transparent 60%)" }} />
          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-orange-900/20 border border-orange-700/30 rounded-full px-4 py-1.5 mb-5">
              <span className="animate-pulse">🔥</span>
              <span className="text-[11px] font-bold tracking-widest uppercase text-orange-300">
                {l === "ar" ? "عروض اليوم · GreenGo Market" : l === "fr" ? "Offres du jour · GreenGo Market" : "Today's Deals · GreenGo Market"}
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4"
              style={{ fontFamily: "var(--font-display)" }}>
              {l === "ar" ? "عروض" : l === "fr" ? "Offres" : "Flash"}<br />
              <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                {l === "ar" ? "حصرية اليوم" : l === "fr" ? "Flash du Jour" : "Deals Today"}
              </span>
            </h1>
            <div className="h-0.5 w-24 mx-auto my-4 bg-gradient-to-r from-orange-500 to-green-600" />
            <p className="text-white/55 text-base leading-relaxed max-w-md mx-auto font-light">
              {l === "ar"
                ? "أسعار مخفضة لفترة محدودة — اطلب قبل نفاد المخزون"
                : l === "fr"
                ? "Prix réduits pour une durée limitée — commandez avant rupture de stock"
                : "Reduced prices for a limited time — order before stock runs out"}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 bg-green-900/20 border border-green-700/25 rounded-full px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              <span className="text-xs font-semibold text-green-300">
                {l === "ar" ? "✅ منتجات طازجة مختارة هذا الصباح" : l === "fr" ? "✅ Produits frais sélectionnés ce matin" : "✅ Fresh products selected this morning"}
              </span>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="px-6 mb-8 max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold border transition-all ${
                  filter === f.key
                    ? "bg-orange-700/30 border-orange-600/50 text-orange-300"
                    : "bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                }`}>
                <span>{f.emoji}</span>{f.label[l]}
                {f.key === "all" && <span className="ml-1 bg-white/10 rounded-full px-1.5 text-[10px]">{products.length}</span>}
              </button>
            ))}
          </div>
        </section>

        {/* Grid */}
        <section className="px-4 pb-8 max-w-4xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 overflow-hidden">
                  <div className="h-40 gg-skeleton" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-3/4 gg-skeleton rounded" />
                    <div className="h-4 w-1/2 gg-skeleton rounded" />
                    <div className="h-8 w-full gg-skeleton rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-5xl block mb-4">😴</span>
              <p className="text-white/40 text-sm">
                {l === "ar" ? "لا توجد عروض حالياً" : l === "fr" ? "Aucune offre pour ce filtre" : "No deals for this filter"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((product, i) => (
                <DealCard key={product.id} product={product} lang={language} expiresAt={expiries[i % expiries.length]} />
              ))}
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="px-6 pb-24 max-w-xl mx-auto text-center">
          <div className="bg-gradient-to-br from-orange-900/15 to-green-900/10 border border-orange-700/20 rounded-3xl p-8">
            <span className="text-4xl block mb-3">🛒</span>
            <h2 className="text-lg font-black text-white mb-2">
              {l === "ar" ? "جاهز للطلب؟" : l === "fr" ? "Prêt à commander ?" : "Ready to order?"}
            </h2>
            <p className="text-white/45 text-sm mb-5">
              {l === "ar" ? "أضف المنتجات للسلة وأكد طلبيتك الآن"
                : l === "fr" ? "Ajoutez les produits au panier et confirmez maintenant"
                : "Add products to cart and confirm your order now"}
            </p>
            <Link to="/cart"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-green-900/30">
              {l === "ar" ? "عرض سلتي" : l === "fr" ? "Voir mon panier" : "View my cart"} →
            </Link>
          </div>
        </section>
      </main>

      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2 rounded-full text-xs border border-amber-800/20"
        style={{ background: "rgba(6,26,18,0.92)", backdropFilter: "blur(12px)" }}>
        <Link to="/" className="text-green-400 font-semibold">GreenGo</Link>
        <span className="text-white/25">/</span>
        <span className="text-orange-400 font-semibold">
          {l === "ar" ? "العروض" : l === "fr" ? "Offres" : "Deals"}
        </span>
      </nav>
    </div>
  );
}
