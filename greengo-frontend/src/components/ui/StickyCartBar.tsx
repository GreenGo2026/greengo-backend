// src/components/ui/StickyCartBar.tsx
// Floating cart bar — mobile only, appears when cart has items
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCartStore } from "../../store/cartStore";
import { useLanguage } from "../../contexts/LanguageContext";

type L = "fr" | "ar" | "en";

export default function StickyCartBar() {
  const { language, isRTL } = useLanguage();
  const l = language as L;
  const cart       = useCartStore(s => s.cart);
  const totalPrice = useCartStore(s => s.totalPrice);
  const totalItems = cart.reduce((n, i) => n + (i.cartQuantity || 0), 0);
  const [visible, setVisible] = useState(false);

  // Slight delay before showing so it doesn't flash on page load
  useEffect(() => {
    const t = setTimeout(() => setVisible(totalItems > 0), 300);
    return () => clearTimeout(t);
  }, [totalItems]);

  if (!visible) return null;

  const label = {
    fr: `Voir mon panier · ${totalItems} article${totalItems > 1 ? "s" : ""} · ${totalPrice().toFixed(2)} MAD`,
    ar: `عرض السلة · ${totalItems} منتج · ${totalPrice().toFixed(2)} درهم`,
    en: `View cart · ${totalItems} item${totalItems > 1 ? "s" : ""} · ${totalPrice().toFixed(2)} MAD`,
  }[l];

  return (
    <div
      className="md:hidden fixed z-50 px-4 pb-safe"
      style={{
        bottom: "72px", // above MobileBottomNav (h-16 = 64px + 8px gap)
        left: 0,
        right: 0,
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <Link
        to="/cart"
        dir={isRTL ? "rtl" : "ltr"}
        className={`flex items-center justify-between w-full rounded-2xl px-5 py-3.5 shadow-2xl shadow-green-900/40 ${language === "ar" ? "font-arabic" : "font-latin"}`}
        style={{
          background: "linear-gradient(135deg, #2E8B57 0%, #1a5c38 100%)",
          border: "1px solid rgba(46,139,87,0.6)",
        }}
      >
        {/* Left: cart icon + count bubble */}
        <div className={`flex items-center gap-2.5 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className="relative">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/>
            </svg>
            <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF9800] text-[9px] font-black text-white">
              {totalItems > 9 ? "9+" : totalItems}
            </span>
          </div>
          <span className="text-sm font-bold text-white">{label}</span>
        </div>

        {/* Right: arrow */}
        <span className={`text-white/70 text-lg font-bold ${isRTL ? "rotate-180" : ""}`}>→</span>
      </Link>
    </div>
  );
}
