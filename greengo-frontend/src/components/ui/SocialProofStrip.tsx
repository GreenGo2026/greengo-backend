// src/components/ui/SocialProofStrip.tsx
// Live social proof bar — shows on Shop, Offres, and Hero pages
import { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

type L = "fr" | "ar" | "en";

const CITIES = ["Salé", "Rabat", "Témara", "Hay Salam", "Bettana", "Laayayda"];

interface StripData {
  total_orders: number;
  today_orders: number;
}

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export default function SocialProofStrip() {
  const { language } = useLanguage();
  const l = language as L;
  const [data,    setData]    = useState<StripData | null>(null);
  const [cityIdx, setCityIdx] = useState(0);

  // Fetch order counts
  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`${API}/api/v1/analytics?period=today`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        setData({ total_orders: d.total_orders ?? 0, today_orders: d.total_orders ?? 0 });
      } catch {
        // Fallback to static count if analytics unavailable
        setData({ total_orders: 31, today_orders: 0 });
      }
    }
    load();
  }, []);

  // Rotate city names every 2.5s
  useEffect(() => {
    const id = setInterval(() => setCityIdx(i => (i + 1) % CITIES.length), 2500);
    return () => clearInterval(id);
  }, []);

  const city = CITIES[cityIdx];

  // Trust messages — rotate based on time of day
  const hour = new Date().getHours();
  const messages: Record<L, string[]> = {
    fr: [
      `🛵 Livraison rapide à ${city} — commandez avant 18h pour livraison aujourd'hui`,
      `✅ ${data?.total_orders ?? 31}+ commandes livrées avec succès au Maroc`,
      `🌿 Produits frais sélectionnés ce matin dans les marchés de gros`,
      `⭐ Qualité garantie — remboursement sous 24h si non conforme`,
    ],
    ar: [
      `🛵 توصيل سريع في ${city} — اطلب قبل 6 مساءً للتوصيل اليوم`,
      `✅ أكثر من ${data?.total_orders ?? 31} طلبية موصلة بنجاح في المغرب`,
      `🌿 منتجات طازجة مختارة هذا الصباح من أسواق الجملة`,
      `⭐ جودة مضمونة — استرداد خلال 24 ساعة إذا لم تطابق المواصفات`,
    ],
    en: [
      `🛵 Fast delivery in ${city} — order before 6pm for today's delivery`,
      `✅ ${data?.total_orders ?? 31}+ orders delivered successfully in Morocco`,
      `🌿 Fresh products selected this morning from wholesale markets`,
      `⭐ Quality guaranteed — refund within 24h if non-conforming`,
    ],
  };

  const msgList = messages[l];
  const msgIdx  = hour < 12 ? 2 : hour < 16 ? 0 : hour < 19 ? 3 : 1;
  const msg     = msgList[msgIdx % msgList.length];

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: "linear-gradient(90deg, #0d3b36 0%, #1a5c4a 50%, #0d3b36 100%)",
        borderBottom: "1px solid rgba(46,139,87,0.3)",
      }}
    >
      <div className="flex items-center justify-center gap-3 px-4 py-2">
        <span
          className="h-2 w-2 rounded-full bg-green-400 shrink-0"
          style={{ animation: "pulse 1.5s ease-in-out infinite" }}
        />
        <p className={`text-xs font-semibold text-white/80 text-center ${language === "ar" ? "font-arabic" : "font-latin"}`}>
          {msg}
        </p>
        <span
          className="h-2 w-2 rounded-full bg-green-400 shrink-0"
          style={{ animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.75s" }}
        />
      </div>
    </div>
  );
}
