// src/pages/HomePage.tsx
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  ShoppingCart, Plus, Minus, Loader2, RefreshCw,
  AlertCircle, Search, SlidersHorizontal, Leaf,
  CheckCircle2, Flame, Star,
} from "lucide-react";
import { getProducts } from "../services/api";
import type { DBProduct } from "../services/api";
import { useCartStore, getUnitStep, formatQuantity } from "../store/cartStore";
import { useLanguage } from "../contexts/LanguageContext";

// ── Niche category definitions ───────────────────────────────────────────────
type NicheKey = "all" | "Fruits" | "Vegetables" | "Whole Chicken" | "Chicken Cuts";

interface NicheCategory {
  key:      NicheKey;
  emoji:    string;
  label_fr: string;
  label_ar: string;
  label_en: string;
  db_match: string[];
}

const NICHE_CATS: NicheCategory[] = [
  {
    key: "all",
    emoji: "✨",
    label_fr: "Tous les produits",
    label_ar: "كل المنتجات",
    label_en: "All",
    db_match: [],
  },
  {
    key: "Fruits",
    emoji: "🍎",
    label_fr: "Fruits",
    label_ar: "فواكه",
    label_en: "Fruits",
    db_match: ["Fruits", "fruits", "fruit"],
  },
  {
    key: "Vegetables",
    emoji: "🥕",
    label_fr: "Légumes",
    label_ar: "خضروات",
    label_en: "Vegetables",
    db_match: ["Vegetables", "vegetables", "légumes", "Légumes"],
  },
  {
    key: "Whole Chicken",
    emoji: "🍗",
    label_fr: "Poulet entier",
    label_ar: "دجاجة كاملة",
    label_en: "Whole Chicken",
    db_match: ["White Meats", "Whole Chicken", "Poulet entier", "poulet entier"],
  },
  {
    key: "Chicken Cuts",
    emoji: "🥩",
    label_fr: "Découpes poulet",
    label_ar: "قطع الدجاج",
    label_en: "Chicken Cuts",
    db_match: ["Chicken Cuts", "Découpes", "découpes", "Eggs", "Other"],
  },
];

function catLabel(cat: NicheCategory, lang: string): string {
  if (lang === "ar") return cat.label_ar;
  if (lang === "fr") return cat.label_fr;
  return cat.label_en;
}

// ── Category visual metadata ─────────────────────────────────────────────────
const CAT_META: Record<string, { emoji: string; bg: string; text: string; border: string }> = {
  Fruits:          { emoji: "🍎", bg: "bg-orange-50",  text: "text-orange-600",  border: "border-orange-100" },
  Vegetables:      { emoji: "🥕", bg: "bg-green-50",   text: "text-green-700",   border: "border-green-100"  },
  "White Meats":   { emoji: "🍗", bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-100"   },
  "Whole Chicken": { emoji: "🍗", bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-100"   },
  "Chicken Cuts":  { emoji: "🥩", bg: "bg-red-50",     text: "text-red-600",     border: "border-red-100"    },
  Eggs:            { emoji: "🥚", bg: "bg-yellow-50",  text: "text-yellow-700",  border: "border-yellow-100" },
  Other:           { emoji: "🛒", bg: "bg-gray-50",    text: "text-gray-600",    border: "border-gray-100"   },
};

function getCatMeta(category: string) {
  return CAT_META[category] ?? CAT_META.Other;
}

// Fresh-produce categories that show the Morocco origin badge
const FRESH_CATS = ["Fruits", "Vegetables", "fruits", "vegetables", "Légumes", "légumes"];

// ── Sort options ──────────────────────────────────────────────────────────────
type SortKey = "default" | "price_asc" | "price_desc" | "name_az";

interface SortOption {
  key:      SortKey;
  label_fr: string;
  label_ar: string;
  label_en: string;
}

const SORT_OPTIONS: SortOption[] = [
  { key: "default",   label_fr: "Par défaut",      label_ar: "افتراضي",           label_en: "Default"           },
  { key: "price_asc", label_fr: "Prix croissant",  label_ar: "سعر تصاعدي",        label_en: "Price: Low → High" },
  { key: "price_desc",label_fr: "Prix décroissant",label_ar: "سعر تنازلي",        label_en: "Price: High → Low" },
  { key: "name_az",   label_fr: "Nom A → Z",       label_ar: "الاسم أ → ي",       label_en: "Name A → Z"        },
];

function sortLabel(opt: SortOption, lang: string): string {
  if (lang === "ar") return opt.label_ar;
  if (lang === "fr") return opt.label_fr;
  return opt.label_en;
}

// ── QtyControl ────────────────────────────────────────────────────────────────
function QtyControl({ product }: { product: DBProduct }) {
  const cart       = useCartStore((s) => s.cart);
  const add        = useCartStore((s) => s.addToCart);
  const remove     = useCartStore((s) => s.removeFromCart);
  const { language } = useLanguage();
  const font = language === "ar" ? "font-arabic" : "font-latin";

  const proxy = {
    name:           product.name_ar,
    price_per_unit: product.price_mad,
    unit:           product.unit,
    available:      product.in_stock,
  };
  const step = getUnitStep(product.unit);
  const item = cart.find((i) => i.name === product.name_ar);
  const qty  = item?.cartQuantity ?? 0;

  if (!product.in_stock) {
    return (
      <div className={"flex h-10 w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-400 " + font}>
        {language === "ar" ? "غير متوفر" : language === "fr" ? "Épuisé" : "Out of stock"}
      </div>
    );
  }

  if (qty === 0) {
    return (
      <button
        onClick={() => add(proxy, step)}
        className={"group flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#2E8B57] text-xs font-extrabold text-white shadow-md shadow-[#2E8B57]/20 transition-all duration-200 hover:bg-[#1F6B40] hover:shadow-lg hover:shadow-[#2E8B57]/25 active:scale-[0.97] " + font}>
        <ShoppingCart size={14} strokeWidth={2.5} className="transition-transform group-hover:-rotate-6" />
        {language === "ar" ? "أضف للسلة" : language === "fr" ? "Ajouter" : "Add to cart"}
      </button>
    );
  }

  return (
    <div className="flex h-10 items-center overflow-hidden rounded-xl border-2 border-[#2E8B57]/25 bg-[#2E8B57]/6">
      <button
        onClick={() => remove(product.name_ar, step)}
        className="flex h-full w-10 shrink-0 items-center justify-center text-[#2E8B57] transition-colors hover:bg-[#2E8B57]/12 active:scale-90">
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <span className="flex flex-1 items-center justify-center text-sm font-extrabold text-[#2E8B57] font-latin">
        {formatQuantity(qty, product.unit)}
      </span>
      <button
        onClick={() => add(proxy, step)}
        className="flex h-full w-10 shrink-0 items-center justify-center text-[#2E8B57] transition-colors hover:bg-[#2E8B57]/12 active:scale-90">
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ── Magnifier hook ───────────────────────────────────────────────────────────
function useMagnifier(zoomFactor: number = 2.8) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const size = { w: 130, h: 130 };
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPos({
      x: Math.max(size.w / 2, Math.min(x, rect.width  - size.w / 2)),
      y: Math.max(size.h / 2, Math.min(y, rect.height - size.h / 2)),
    });
  }, []);
  return { imgRef, active, setActive, pos, size, onMove, zoomFactor };
}

// ── Premium Gallery Modal ─────────────────────────────────────────────────────
function ProductGalleryModal({
  product, onClose, onAddToCart, inCart,
}: {
  product: DBProduct;
  onClose: () => void;
  onAddToCart: () => void;
  inCart: boolean;
}) {
  const { language } = useLanguage();
  const font   = language === "ar" ? "font-arabic" : "font-latin";
  const meta   = getCatMeta(product.category);
  const mg     = useMagnifier(2.8);
  const [zoomed, setZoomed] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const hasImg = !!product.image_url && !imgErr;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "rgba(8,18,12,0.72)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div
        className={"relative w-full md:max-w-3xl bg-white shadow-2xl overflow-hidden rounded-t-3xl md:rounded-3xl flex flex-col md:flex-row " + font}
        style={{ maxHeight: "92vh" }}
        onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose}
          className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/8 hover:bg-black/15 transition-colors">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1 1l11 11M12 1L1 12" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* LEFT panel */}
        <div className={"relative flex flex-col items-center justify-center overflow-hidden md:w-1/2 shrink-0 " + meta.bg}
          style={{ minHeight: "240px" }}>
          {hasImg ? (
            <>
              {/* Desktop magnifier */}
              <div
                className="hidden md:flex relative items-center justify-center w-full select-none"
                style={{ height: "400px", cursor: mg.active ? "none" : "crosshair" }}
                onMouseEnter={() => mg.setActive(true)}
                onMouseLeave={() => mg.setActive(false)}
                onMouseMove={mg.onMove}>
                <img
                  ref={mg.imgRef}
                  src={product.image_url}
                  alt={product.name_fr || "product"}
                  className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                  style={{ padding: "9%", filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.10))" }}
                  onError={() => setImgErr(true)}
                  draggable={false}
                />
                {mg.active && (
                  <div className="absolute rounded-full pointer-events-none z-20"
                    style={{
                      width: mg.size.w, height: mg.size.h,
                      left: mg.pos.x - mg.size.w / 2,
                      top:  mg.pos.y - mg.size.h / 2,
                      border: "2px solid rgba(46,139,87,0.65)",
                      background: "rgba(255,255,255,0.06)",
                    }} />
                )}
                {mg.active && mg.imgRef.current && (() => {
                  const iw = mg.imgRef.current.offsetWidth;
                  const ih = mg.imgRef.current.offsetHeight;
                  const bw = iw * mg.zoomFactor;
                  const bh = ih * mg.zoomFactor;
                  const bx = -(mg.pos.x / iw * bw - 110);
                  const by = -(mg.pos.y / ih * bh - 110);
                  return (
                    <div className="absolute bottom-0 right-0 z-30 rounded-2xl overflow-hidden shadow-2xl border border-[#2E8B57]/20 pointer-events-none bg-white"
                      style={{ width: 220, height: 220 }}>
                      <div style={{
                        width: "100%", height: "100%",
                        backgroundImage: `url(${product.image_url})`,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: `${bw}px ${bh}px`,
                        backgroundPosition: `${bx}px ${by}px`,
                      }} />
                      <div className="absolute bottom-2 right-2 rounded-full bg-[#2E8B57]/10 px-2 py-0.5 text-[9px] font-bold text-[#2E8B57]">
                        {mg.zoomFactor}x
                      </div>
                    </div>
                  );
                })()}
                {!mg.active && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/18 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm pointer-events-none">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
                    </svg>
                    {language === "ar" ? "حرك للتكبير" : language === "fr" ? "Survolez pour zoomer" : "Hover to zoom"}
                  </div>
                )}
              </div>
              {/* Mobile */}
              <div
                className="md:hidden flex items-center justify-center w-full relative"
                style={{ height: "52vw", minHeight: "200px" }}
                onClick={() => setZoomed(true)}>
                <img
                  src={product.image_url}
                  alt={product.name_fr || "product"}
                  className="h-full w-full object-contain select-none"
                  style={{ padding: "8%", filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.10))" }}
                  onError={() => setImgErr(true)}
                />
                <div className="absolute bottom-2.5 right-3 flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                  {language === "ar" ? "تكبير" : "Agrandir"}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center" style={{ height: "360px" }}>
              <span className="text-[96px] select-none">{meta.emoji}</span>
            </div>
          )}
        </div>

        {/* RIGHT panel */}
        <div className="flex flex-col gap-4 overflow-y-auto p-5 md:p-6 md:w-1/2">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <span className={"rounded-full border px-3 py-1 text-[11px] font-bold " + meta.bg + " " + meta.text + " " + meta.border}>
              {product.category}
            </span>
            {product.in_stock ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-[#2E8B57]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2E8B57] animate-pulse shrink-0" />
                {language === "ar" ? "متوفر" : language === "fr" ? "En stock" : "In stock"}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-400">
                {language === "ar" ? "نفذ" : language === "fr" ? "Epuise" : "Out of stock"}
              </span>
            )}
          </div>
          <div>
            <h2 dir="rtl" className={"text-xl font-extrabold text-gray-900 leading-tight font-arabic " + (language === "ar" ? "text-right" : "text-left")}>
              {product.name_ar || product.name_fr}
            </h2>
            {product.name_fr && product.name_fr !== product.name_ar && (
              <p className={"text-sm text-gray-400 font-latin mt-1 " + (language === "ar" ? "text-right" : "text-left")}>
                {product.name_fr}
              </p>
            )}
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#f0f7f3] to-[#e8f4ec] border border-[#2E8B57]/12 px-4 py-3.5">
            <p className="text-[10px] text-[#2E8B57]/70 font-latin font-semibold mb-1 uppercase tracking-wide">
              {language === "ar" ? "السعر" : language === "fr" ? "Prix" : "Price"}
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#1A6640] font-latin leading-none">
                {product.price_mad.toFixed(2)}
              </span>
              <span className="text-sm font-semibold text-[#2E8B57]/60 font-latin">MAD / {product.unit}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: "🌿", fr: "Produit frais",    ar: "منتج طازج",   en: "Fresh product"   },
              { icon: "🛵", fr: "Livraison rapide", ar: "توصيل سريع",  en: "Fast delivery"   },
              { icon: "🇲🇦", fr: "Origine Maroc",   ar: "من المغرب",   en: "From Morocco"    },
              { icon: "✅", fr: "Qualite garantie", ar: "جودة مضمونة", en: "Quality assured" },
            ].map(f => (
              <div key={f.en} className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 px-2.5 py-2">
                <span className="text-sm leading-none">{f.icon}</span>
                <span className={"text-[10px] font-semibold text-gray-600 " + font}>
                  {language === "ar" ? f.ar : language === "fr" ? f.fr : f.en}
                </span>
              </div>
            ))}
          </div>
          <button
            disabled={!product.in_stock}
            onClick={() => { onAddToCart(); onClose(); }}
            className={"mt-auto w-full rounded-2xl py-4 text-sm font-extrabold text-white flex items-center justify-center gap-2.5 transition-all duration-200 " +
              (product.in_stock
                ? "bg-[#2E8B57] hover:bg-[#1A6640] shadow-lg shadow-[#2E8B57]/20 active:scale-[0.98]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed") + " " + font}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/>
            </svg>
            {inCart
              ? (language === "ar" ? "اضافة مرة اخرى" : language === "fr" ? "Ajouter encore" : "Add again")
              : (language === "ar" ? "اضف للسلة" : language === "fr" ? "Ajouter au panier" : "Add to cart")}
          </button>
        </div>
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.96)", zIndex: 60 }}
          onClick={() => setZoomed(false)}>
          <img
            src={product.image_url}
            alt={product.name_fr || "product"}
            className="max-h-[88vh] max-w-[92vw] object-contain select-none"
            style={{ cursor: "zoom-out" }}
          />
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/22 transition-colors"
            onClick={() => setZoomed(false)}>
            <svg width="15" height="15" viewBox="0 0 13 13" fill="none">
              <path d="M1 1l11 11M12 1L1 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product, rank }: { product: DBProduct; rank: number }) {
  const { language } = useLanguage();
  const font    = language === "ar" ? "font-arabic" : "font-latin";
  const meta    = getCatMeta(product.category);
  const isFresh = FRESH_CATS.some((c) => product.category?.toLowerCase() === c.toLowerCase());
  const name    = product.name_ar || product.name_fr || "—";
  const isTop3  = rank < 3;
  const [showModal, setShowModal] = useState(false);
  const [imgError,  setImgError]  = useState(false);
  const add    = useCartStore((s) => s.addToCart);
  const cart   = useCartStore((s) => s.cart);
  const step   = getUnitStep(product.unit);
  const proxy  = { name: product.name_ar, price_per_unit: product.price_mad, unit: product.unit, available: product.in_stock };
  const inCart = !!cart.find((i) => i.name === product.name_ar);

  return (
    <>
      <article
        className="gg-product-card group relative flex flex-col overflow-hidden"
        style={{ minHeight: "340px" }}>
        <div
          className={"relative overflow-hidden cursor-pointer " + meta.bg}
          style={{ aspectRatio: "1 / 1", width: "100%" }}
          onClick={() => product.image_url && !imgError && setShowModal(true)}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/6 via-transparent to-transparent pointer-events-none z-10" />
          {product.image_url && !imgError ? (
            <img
              src={product.image_url}
              alt={product.name_fr || product.name_ar || "product"}
              className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.07] select-none pointer-events-none"
              style={{ padding: "10%", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.09))" }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="select-none text-[64px] drop-shadow-sm transition-transform duration-300 group-hover:scale-110">
                {meta.emoji}
              </span>
            </div>
          )}
          {product.image_url && !imgError && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
              <div className="rounded-full bg-black/28 px-3 py-1.5 backdrop-blur-sm flex items-center gap-1.5 text-white text-[11px] font-bold shadow-lg">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
                </svg>
                {language === "ar" ? "عرض سريع" : language === "fr" ? "Aperçu" : "Quick view"}
              </div>
            </div>
          )}
          {isTop3 && (
            <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1 rounded-full bg-[#FF9800] px-2.5 py-1 shadow-lg shadow-[#FF9800]/30">
              <Star size={9} className="fill-white text-white" />
              <span className="text-[9px] font-extrabold text-white tracking-wide">
                {rank === 0 ? "TOP" : "#" + (rank + 1)}
              </span>
            </div>
          )}
          <div className="absolute right-2.5 top-2.5 z-20">
            {product.in_stock ? (
              <span className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#2E8B57] shadow-sm backdrop-blur-sm border border-[#2E8B57]/12">
                <CheckCircle2 size={9} className="shrink-0" />
                {language === "ar" ? "متوفر" : language === "fr" ? "Dispo" : "In stock"}
              </span>
            ) : (
              <span className="rounded-full bg-gray-900/55 px-2.5 py-1 text-[10px] font-bold text-white/85 backdrop-blur-sm">
                {language === "ar" ? "نفذ" : "Out"}
              </span>
            )}
          </div>
          <div className="absolute bottom-2.5 left-2.5 z-20">
            <span className={"rounded-full border px-2 py-0.5 text-[9px] font-bold backdrop-blur-sm bg-white/75 " + meta.text + " " + meta.border}>
              {product.category}
            </span>
          </div>
          {isFresh && (
            <div className="absolute bottom-2.5 right-2.5 z-20">
              <span className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold text-gray-700 backdrop-blur-sm border border-white/50">
                🇲🇦 <span className="font-latin">Maroc</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-3.5">
          <div>
            <h3 dir="rtl" className={"line-clamp-2 text-sm font-extrabold leading-snug text-gray-900 font-arabic " + (language === "ar" ? "text-right" : "text-left")}>
              {name}
            </h3>
            {product.name_fr && product.name_fr !== product.name_ar && (
              <p className={"mt-0.5 text-[11px] text-gray-400 font-latin truncate " + (language === "ar" ? "text-right" : "text-left")}>
                {product.name_fr}
              </p>
            )}
          </div>
          <div className={"flex items-end justify-between " + (language === "ar" ? "flex-row-reverse" : "")}>
            <div className={language === "ar" ? "text-right" : "text-left"}>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-extrabold text-[#1A6640] font-latin leading-none">
                  {product.price_mad.toFixed(2)}
                </span>
                <span className="text-xs font-semibold text-gray-400 font-latin ml-0.5">MAD</span>
              </div>
              <p className={"text-[10px] text-gray-400 font-latin mt-0.5 " + font}>
                {language === "ar" ? "لكل " : language === "fr" ? "par " : "per "}{product.unit || "kg"}
              </p>
            </div>
            {isFresh && (
              <div className="flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-100 px-2 py-1">
                <Leaf size={9} className="text-[#2E8B57] shrink-0" />
                <span className={"text-[10px] font-bold text-[#2E8B57] " + font}>
                  {language === "ar" ? "طازج" : language === "fr" ? "Frais" : "Fresh"}
                </span>
              </div>
            )}
          </div>
          <div className="mt-auto">
            <QtyControl product={product} />
          </div>
        </div>
      </article>
      {showModal && (
        <ProductGalleryModal
          product={product}
          onClose={() => setShowModal(false)}
          onAddToCart={() => add(proxy, step)}
          inCart={inCart}
        />
      )}
    </>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm animate-pulse">
      <div className="h-48 bg-gray-100" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-4 w-3/4 rounded-lg bg-gray-100" />
        <div className="h-3 w-1/2 rounded-lg bg-gray-100" />
        <div className="h-6 w-1/3 rounded-lg bg-gray-100" />
        <div className="h-10 w-full rounded-xl bg-gray-100" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onReset, lang }: { onReset: () => void; lang: string }) {
  const font = lang === "ar" ? "font-arabic" : "font-latin";
  return (
    <div className={"flex flex-col items-center gap-4 py-24 text-center " + font}>
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-4xl">
        🔍
      </div>
      <div>
        <p className="text-lg font-bold text-gray-700">
          {lang === "ar" ? "لا توجد منتجات" : lang === "fr" ? "Aucun produit trouvé" : "No products found"}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {lang === "ar" ? "جرب تصنيفاً آخر أو ابحث بكلمة مختلفة" : lang === "fr" ? "Essayez une autre catégorie ou recherche" : "Try a different category or search term"}
        </p>
      </div>
      <button onClick={onReset}
        className={"mt-1 rounded-xl bg-[#2E8B57] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1F6B40] " + font}>
        {lang === "ar" ? "عرض الكل" : lang === "fr" ? "Voir tout" : "Show all"}
      </button>
    </div>
  );
}

// ── HomePage ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { language, isRTL } = useLanguage();
  const font = language === "ar" ? "font-arabic" : "font-latin";
  const dir  = isRTL ? "rtl" : "ltr";

  const [products,  setProducts]  = useState<DBProduct[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [activeKey, setActiveKey] = useState<NicheKey>("all");
  const [search,    setSearch]    = useState("");
  const [sortKey,   setSortKey]   = useState<SortKey>("default");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getProducts();
      setProducts(data);
    } catch {
      setError(
        language === "ar"
          ? "تعذّر تحميل المنتجات. هل الخادم يعمل؟"
          : language === "fr"
          ? "Impossible de charger les produits. Le serveur est-il actif ?"
          : "Could not load products. Is the server running?"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = [...products];

    // Category filter
    if (activeKey !== "all") {
      const cat = NICHE_CATS.find((c) => c.key === activeKey);
      if (cat) {
        list = list.filter((p) =>
          cat.db_match.some((m) => (p.category ?? "").toLowerCase() === m.toLowerCase())
        );
      }
    }

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        (p.name_ar  ?? "").toLowerCase().includes(q) ||
        (p.name_fr  ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortKey === "price_asc")  list.sort((a, b) => a.price_mad - b.price_mad);
    if (sortKey === "price_desc") list.sort((a, b) => b.price_mad - a.price_mad);
    if (sortKey === "name_az")    list.sort((a, b) => (a.name_ar ?? "").localeCompare(b.name_ar ?? ""));

    return list;
  }, [products, activeKey, search, sortKey]);

  const inStockCount = filtered.filter((p) => p.in_stock).length;

  function resetFilters() {
    setActiveKey("all");
    setSearch("");
    setSortKey("default");
  }

  return (
    <div className={"min-h-screen " + font} style={{ background: "var(--gg-dark)" }}>

      {/* ── Page hero strip ── */}
      <div className="gg-hero relative overflow-hidden">
        <div className="absolute inset-0 zellige-bg-light opacity-12 pointer-events-none" />
        <div className="mx-auto max-w-7xl px-5 py-8 md:py-10" dir={dir}>
          <div className={language === "ar" ? "text-right" : "text-left"}>
            <div className={"inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 mb-3 " + (isRTL ? "flex-row-reverse" : "")}>
              <Flame size={12} className="text-[#FF9800]" />
              <span className={"text-[10px] font-bold uppercase tracking-widest text-[#FF9800]/80 " + font}>
                {language === "ar" ? "طازج يومياً" : language === "fr" ? "Frais chaque jour" : "Fresh every day"}
              </span>
            </div>
            <h1 className={"text-2xl font-extrabold text-white md:text-3xl " + font} style={{ letterSpacing: "-0.02em" }}>
              {language === "ar" ? "تسوّق المنتجات الطازجة" : language === "fr" ? "Nos Produits Frais" : "Fresh Product Catalog"}
            </h1>
            <p className={"mt-1.5 text-sm text-white/50 " + font}>
              {loading
                ? (language === "ar" ? "جارٍ التحميل…" : "Chargement…")
                : inStockCount + " " + (language === "ar" ? "منتج متاح للطلب" : language === "fr" ? "produits disponibles" : "products available")}
            </p>
          </div>
        </div>
        <div className="zellige-border" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-5">

        {/* ── Category pills ── */}
        <div className="relative">
          <div className={"flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide " + (isRTL ? "flex-row-reverse" : "")}>
            {NICHE_CATS.map((cat) => {
              const active  = activeKey === cat.key;
              const count   = cat.key === "all"
                ? products.length
                : products.filter((p) => cat.db_match.some((m) => (p.category ?? "").toLowerCase() === m.toLowerCase())).length;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveKey(cat.key)}
                  className={"gg-pill flex shrink-0 items-center gap-2 " + font + " " + (active ? "active" : "")}>
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span>{catLabel(cat, language)}</span>
                  {count > 0 && (
                    <span className={"flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-extrabold " + (active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Search + sort toolbar ── */}
        <div className={"flex flex-wrap items-center gap-3 " + (isRTL ? "flex-row-reverse" : "")}>

          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search size={14} className={"absolute top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none " + (isRTL ? "right-3.5" : "left-3.5")} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              dir={dir}
              placeholder={language === "ar" ? "ابحث عن منتج…" : language === "fr" ? "Rechercher un produit…" : "Search products…"}
              className={"w-full rounded-2xl border border-white/10 bg-white/8 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white/12 shadow-sm " + (isRTL ? "pr-10 pl-4" : "pl-10 pr-4") + " " + font}
            />
          </div>

          {/* Sort */}
          <div className={"flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3.5 py-2.5 shadow-sm " + (isRTL ? "flex-row-reverse" : "")}>
            <SlidersHorizontal size={13} className="text-gray-400 shrink-0" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              dir={dir}
              className={"bg-transparent text-sm text-white/70 outline-none cursor-pointer " + font}>
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{sortLabel(opt, language)}</option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white/40 shadow-sm transition-all hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-40">
            {loading
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />
            }
          </button>

          {/* Active filters summary */}
          {(activeKey !== "all" || search) && (
            <button
              onClick={resetFilters}
              className={"flex items-center gap-1.5 rounded-2xl border border-[#2E8B57]/25 bg-[#2E8B57]/8 px-3.5 py-2.5 text-xs font-bold text-[#2E8B57] transition-all hover:bg-[#2E8B57]/15 " + font}>
              ✕ {language === "ar" ? "إزالة الفلاتر" : language === "fr" ? "Effacer" : "Clear filters"}
            </button>
          )}
        </div>

        {/* ── Error state ── */}
        {error && !loading && (
          <div className={"flex flex-col items-center gap-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-10 text-center " + font}>
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm font-semibold text-gray-600">{error}</p>
            <button
              onClick={load}
              className={"flex items-center gap-2 rounded-xl bg-[#2E8B57] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1F6B40] " + font}>
              <RefreshCw size={13} />
              {language === "ar" ? "إعادة المحاولة" : language === "fr" ? "Réessayer" : "Retry"}
            </button>
          </div>
        )}

        {/* ── Skeleton grid ── */}
        {loading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState onReset={resetFilters} lang={language} />
        )}

        {/* ── Product grid ── */}
        {!loading && !error && filtered.length > 0 && (
          <>
            {/* Result count */}
            <p className={"text-xs text-emerald-400/70 " + font + " " + (isRTL ? "text-right" : "text-left")}>
              {filtered.length} {language === "ar" ? "نتيجة" : language === "fr" ? "résultats" : "results"}
              {inStockCount < filtered.length && (
                <span className="ml-1 text-[#2E8B57]">
                  ({inStockCount} {language === "ar" ? "متاح" : language === "fr" ? "disponibles" : "in stock"})
                </span>
              )}
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((product, i) => (
                <ProductCard key={product.id} product={product} rank={i} />
              ))}
            </div>
          </>
        )}

        {/* ── Trust strip ── */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-6 sm:grid-cols-4">
            {[
              { emoji: "🛵", label_fr: "Livraison rapide",     label_ar: "توصيل سريع",          label_en: "Fast delivery"       },
              { emoji: "🌿", label_fr: "100% frais",           label_ar: "طازج 100%",            label_en: "100% fresh"          },
              { emoji: "💬", label_fr: "Support WhatsApp",     label_ar: "دعم عبر واتساب",       label_en: "WhatsApp support"    },
              { emoji: "🔒", label_fr: "Paiement sécurisé",    label_ar: "دفع آمن",              label_en: "Secure payment"      },
            ].map((item) => (
              <div key={item.label_en}
                className={"flex items-center gap-2.5 rounded-2xl border border-white/8 bg-white/5 p-3.5 shadow-sm " + (isRTL ? "flex-row-reverse" : "")}>
                <span className="text-2xl leading-none">{item.emoji}</span>
                <span className={"text-xs font-semibold text-white/60 " + font}>
                  {language === "ar" ? item.label_ar : language === "fr" ? item.label_fr : item.label_en}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
