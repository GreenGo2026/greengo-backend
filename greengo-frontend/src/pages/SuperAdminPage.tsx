// src/pages/SuperAdminPage.tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  DollarSign, ShoppingBag, Activity, Target,
  RefreshCw, AlertCircle, Loader2, Lock,
  LogOut, Leaf, TrendingUp, Award, Globe,
} from "lucide-react";
import { getAnalytics } from "../services/api";
import type { AnalyticsData, TopItem, AnalyticsPeriod } from "../services/api";

// ── Brand tokens extracted from background image ──────────────────────────────
// Deep emerald left: #0d4a2a  Midnight navy right: #0a1628
// Glow accent: #4ade80         Morocco map: rgba(180,255,200,0.9)
const BRAND = {
  emerald:     "#059669",
  emeraldGlow: "#34d399",
  navy:        "#0a1628",
  glass:       "rgba(10,22,40,0.55)",
  glassBorder: "rgba(255,255,255,0.08)",
  activeNav:   "rgba(5,150,105,0.18)",
  activeNavBorder: "rgba(52,211,153,0.3)",
};

const SUPER_PIN = "9999";
type Lang = "ar" | "en";

// ── i18n ──────────────────────────────────────────────────────────────────────
const T: Record<Lang, Record<string, string>> = {
  en: {
    portal_title: "EXECUTIVE PORTAL",   portal_sub: "GreenGo · Super Admin",
    pin_placeholder: "— — — —",         pin_error: "INCORRECT PIN",
    pin_btn: "AUTHENTICATE",            back_store: "← Store",
    page_eyebrow: "GreenGo Market",     page_title: "Analytics Overview",
    updated: "Updated",                 loading: "Loading…",
    refresh: "REFRESH",                 retry: "Retry",
    error_msg: "Backend unreachable. Ensure uvicorn is running on port 8000.",
    kpi_revenue: "Revenue",             kpi_revenue_sub: "Completed orders",
    kpi_orders: "Total Orders",         kpi_avg: "Avg Order",
    kpi_completion: "Completion Rate",  chart_by_status: "Orders by Status",
    chart_dist: "Status Distribution",  top_title: "Top Products · Revenue (MAD)",
    top_items: "items",                 no_data_period: "No data for this period",
    no_sales: "No sales in this period",
    stat_pending: "Pending",   stat_preparing: "Preparing",
    stat_delivery: "Delivery", stat_delivered: "Delivered",
    stat_done: "Done",         stat_cancelled: "Cancelled",
    nav_analytics: "Analytics", nav_operations: "Operations", nav_storefront: "Storefront",
    signout: "Sign out",
    period_today: "Today", period_week: "This Week",
    period_month: "This Month", period_all: "All Time",
    units: "units",
  },
  ar: {
    portal_title: "\u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u062a\u0646\u0641\u064a\u0630\u064a\u0629",
    portal_sub: "GreenGo \u00b7 \u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0639\u0627\u0645",
    pin_placeholder: "\u2014 \u2014 \u2014 \u2014",
    pin_error: "\u0631\u0645\u0632 \u062e\u0627\u0637\u0626",
    pin_btn: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644",
    back_store: "\u0627\u0644\u0645\u062a\u062c\u0631 \u2190",
    page_eyebrow: "\u0633\u0648\u0642 GreenGo",
    page_title: "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u062f\u0627\u0621",
    updated: "\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b",
    loading: "\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0645\u064a\u0644\u2026",
    refresh: "\u062a\u062d\u062f\u064a\u062b",
    retry: "\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629",
    error_msg: "\u062a\u0639\u0630\u0651\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u062e\u0627\u062f\u0645.",
    kpi_revenue: "\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a",
    kpi_revenue_sub: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0645\u0643\u062a\u0645\u0644\u0629",
    kpi_orders: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0637\u0644\u0628\u0627\u062a",
    kpi_avg: "\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0637\u0644\u0628",
    kpi_completion: "\u0645\u0639\u062f\u0644 \u0627\u0644\u0625\u062a\u0645\u0627\u0645",
    chart_by_status: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u062d\u0633\u0628 \u0627\u0644\u062d\u0627\u0644\u0629",
    chart_dist: "\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u062d\u0627\u0644\u0627\u062a",
    top_title: "\u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u00b7 \u0627\u0644\u0625\u064a\u0631\u0627\u062f (\u062f\u0631\u0647\u0645)",
    top_items: "\u0645\u0646\u062a\u062c",
    no_data_period: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0644\u0647\u0630\u0647 \u0627\u0644\u0641\u062a\u0631\u0629",
    no_sales: "\u0644\u0627 \u0645\u0628\u064a\u0639\u0627\u062a \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0641\u062a\u0631\u0629",
    stat_pending: "\u0627\u0646\u062a\u0638\u0627\u0631",
    stat_preparing: "\u062a\u062d\u0636\u064a\u0631",
    stat_delivery: "\u062a\u0648\u0635\u064a\u0644",
    stat_delivered: "\u062a\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644",
    stat_done: "\u0645\u0643\u062a\u0645\u0644",
    stat_cancelled: "\u0645\u0644\u063a\u064a",
    nav_analytics: "\u0627\u0644\u062a\u062d\u0644\u064a\u0644\u0627\u062a",
    nav_operations: "\u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a",
    nav_storefront: "\u0627\u0644\u0645\u062a\u062c\u0631",
    signout: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c",
    period_today: "\u0627\u0644\u064a\u0648\u0645",
    period_week: "\u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639",
    period_month: "\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631",
    period_all: "\u0643\u0644 \u0627\u0644\u0648\u0642\u062a",
    units: "\u0648\u062d\u062f\u0629",
  },
};

const STATUS_COLORS: Record<string, string> = {
  Pending: "#F59E0B", Preparing: "#3B82F6",
  "Out for Delivery": "#7C3AED", Delivered: "#10B981",
  Completed: "#059669", Cancelled: "#EF4444",
};
const PIE_COLORS = ["#059669","#34d399","#F59E0B","#EF4444","#10B981","#7C3AED"];

interface PeriodOption { label_en: string; label_ar: string; key: AnalyticsPeriod; }
const PERIODS: PeriodOption[] = [
  { key:"today", label_en:"Today",      label_ar:"\u0627\u0644\u064a\u0648\u0645"        },
  { key:"week",  label_en:"This Week",  label_ar:"\u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639" },
  { key:"month", label_en:"This Month", label_ar:"\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631"   },
  { key:"all",   label_en:"All Time",   label_ar:"\u0643\u0644 \u0627\u0644\u0648\u0642\u062a"    },
];

// ── Period toggle ─────────────────────────────────────────────────────────────
function PeriodToggle({ value, onChange, loading, lang }: {
  value: AnalyticsPeriod; onChange: (p: AnalyticsPeriod) => void;
  loading: boolean; lang: Lang;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl border p-0.5 backdrop-blur-md"
      style={{ background: BRAND.glass, borderColor: BRAND.glassBorder }}>
      {PERIODS.map((p) => {
        const active = value === p.key;
        const label  = lang === "ar" ? p.label_ar : p.label_en;
        return (
          <button key={p.key} disabled={loading} onClick={() => onChange(p.key)}
            className={"rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all duration-200 disabled:opacity-40 whitespace-nowrap " + (lang === "ar" ? "font-arabic" : "font-latin") + " " + (active ? "text-white shadow-sm" : "text-white/40 hover:text-white/70")}
            style={active ? { background: "linear-gradient(135deg," + BRAND.emerald + "," + BRAND.emeraldGlow + "22)", border: "1px solid " + BRAND.emeraldGlow + "40", color: "#fff" } : {}}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Lang toggle ───────────────────────────────────────────────────────────────
function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void; }) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl border p-0.5 backdrop-blur-md"
      style={{ background: BRAND.glass, borderColor: BRAND.glassBorder }}>
      {(["en","ar"] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)}
          className={"flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all " + (lang === l ? "text-white" : "text-white/35 hover:text-white/65")}
          style={lang === l ? { background: BRAND.activeNav, border: "1px solid " + BRAND.activeNavBorder } : {}}>
          <Globe size={11} strokeWidth={2} />
          {l === "en" ? "EN" : "\u0639"}
        </button>
      ))}
    </div>
  );
}

// ── PIN gate ──────────────────────────────────────────────────────────────────
function PinGate({ onUnlock }: { onUnlock: () => void; }) {
  const navigate        = useNavigate();
  const [lang, setLang] = useState<Lang>("ar");
  const [pin,  setPin]  = useState("");
  const [err,  setErr]  = useState(false);
  const [shk,  setShk]  = useState(false);
  const t    = T[lang];
  const dir  = lang === "ar" ? "rtl" : "ltr";
  const font = lang === "ar" ? "font-arabic" : "font-latin";

  function submit() {
    if (pin === SUPER_PIN) { onUnlock(); }
    else {
      setErr(true); setShk(true); setPin("");
      setTimeout(() => { setErr(false); setShk(false); }, 600);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
      style={{ backgroundImage: "url('/greengo-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0" style={{ background: "rgba(8,18,32,0.72)", backdropFilter: "blur(1px)" }}/>
      <div className="absolute top-5 right-5 z-10"><LangToggle lang={lang} setLang={setLang}/></div>
      <button onClick={() => navigate("/")}
        className={"absolute top-5 left-5 z-10 flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold text-white/50 hover:text-white transition-all backdrop-blur-md " + font}
        style={{ background: BRAND.glass, borderColor: BRAND.glassBorder }}
        dir={dir}>
        {t.back_store}
      </button>
      <div className={"relative z-10 w-full max-w-sm mx-4 transition-all duration-150 " + (shk ? "translate-x-2" : "")}>
        <div className="rounded-3xl border p-8 backdrop-blur-2xl space-y-6"
          style={{ background: "rgba(8,20,36,0.65)", borderColor: "rgba(52,211,153,0.15)", boxShadow: "0 0 60px rgba(5,150,105,0.15), inset 0 1px 0 rgba(255,255,255,0.08)" }}>
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-2xl"
              style={{ background: "linear-gradient(135deg," + BRAND.emerald + " 0%,#065f46 100%)", boxShadow: "0 0 30px " + BRAND.emerald + "60" }}>
              <Lock size={26} className="text-white" strokeWidth={1.5}/>
            </div>
            <div className="text-center" dir={dir}>
              <h1 className={"text-xl font-black text-white " + font}
                style={{ letterSpacing: lang === "en" ? "-0.03em" : "normal" }}>
                {t.portal_title}
              </h1>
              <p className={"mt-1 text-xs text-white/40 " + font}>{t.portal_sub}</p>
            </div>
          </div>
          <div className="space-y-3">
            <input type="password" inputMode="numeric" maxLength={6} value={pin} autoFocus
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t.pin_placeholder} dir="ltr"
              className={"w-full rounded-2xl border px-4 py-4 text-center text-2xl font-black tracking-[0.5em] text-white outline-none transition-all placeholder:text-white/15 placeholder:tracking-widest " +
                (err ? "bg-red-500/10 border-red-500/50" : "border-white/10 focus:border-emerald-500/50 focus:bg-white/5")}
              style={{ background: err ? undefined : "rgba(255,255,255,0.04)" }}
            />
            {err && <p className={"text-center text-xs font-semibold text-red-400 tracking-wide " + font} dir={dir}>{t.pin_error}</p>}
            <button onClick={submit}
              className={"w-full rounded-2xl py-3.5 text-sm font-black text-white shadow-2xl transition-all active:scale-[0.98] hover:brightness-110 " + font}
              style={{ background: "linear-gradient(135deg," + BRAND.emerald + " 0%,#065f46 100%)", letterSpacing: lang === "en" ? "0.1em" : "normal", boxShadow: "0 4px 24px " + BRAND.emerald + "50" }}>
              {t.pin_btn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent, font }: {
  icon: React.ElementType; label: string; value: string;
  sub?: string; accent: string; font: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border p-6 backdrop-blur-md transition-all duration-300 hover:scale-[1.02]"
      style={{ background: BRAND.glass, borderColor: BRAND.glassBorder, minHeight: "140px", boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
      <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full opacity-15 transition-opacity group-hover:opacity-30"
        style={{ background: accent, filter: "blur(24px)" }}/>
      <div className="relative h-full flex flex-col justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: accent + "25", border: "1px solid " + accent + "40" }}>
          <Icon size={20} style={{ color: accent }} strokeWidth={1.8}/>
        </div>
        <div className="mt-4">
          <p className="text-3xl font-black text-white font-latin" style={{ letterSpacing: "-0.03em" }}>{value}</p>
          <p className={"mt-1.5 text-xs font-bold text-white/40 uppercase tracking-widest " + font}>{label}</p>
          {sub && <p className={"mt-1 text-[10px] text-white/25 " + font}>{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
function BarTip({ active, payload, label }: { active?: boolean; payload?: {value:number;fill:string}[]; label?: string; }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-3 py-2 backdrop-blur-xl shadow-2xl"
      style={{ background: "rgba(8,20,36,0.95)", borderColor: BRAND.glassBorder }}>
      <p className="font-bold text-white/60 text-xs">{label}</p>
      <p className="font-black text-xl" style={{ color: payload[0].fill }}>{payload[0].value}</p>
    </div>
  );
}
function PieTip({ active, payload }: { active?: boolean; payload?: {name:string;value:number}[]; }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-3 py-2 backdrop-blur-xl shadow-2xl"
      style={{ background: "rgba(8,20,36,0.95)", borderColor: BRAND.glassBorder }}>
      <p className="font-bold text-white text-xs">{payload[0].name}</p>
      <p className="font-black text-lg text-white">{payload[0].value}</p>
    </div>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function OrdersBarChart({ data, lang }: { data: AnalyticsData["orders_by_status"]; lang: Lang; }) {
  const t = T[lang];
  const chartData = [
    { name: t.stat_pending,   value: data.pending,          fill: STATUS_COLORS.Pending },
    { name: t.stat_preparing, value: data.preparing,        fill: STATUS_COLORS.Preparing },
    { name: t.stat_delivery,  value: data.out_for_delivery, fill: STATUS_COLORS["Out for Delivery"] },
    { name: t.stat_delivered, value: data.delivered,        fill: STATUS_COLORS.Delivered },
    { name: t.stat_done,      value: data.completed,        fill: STATUS_COLORS.Completed },
    { name: t.stat_cancelled, value: data.cancelled,        fill: STATUS_COLORS.Cancelled },
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} barSize={30} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false}/>
        <Tooltip content={<BarTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }}/>
        <Bar dataKey="value" radius={[6,6,0,0]}>
          {chartData.map((e, i) => <Cell key={i} fill={e.fill} fillOpacity={0.85}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Pie chart ─────────────────────────────────────────────────────────────────
function StatusPieChart({ data, lang }: { data: AnalyticsData["orders_by_status"]; lang: Lang; }) {
  const t = T[lang];
  const pieData = [
    { name: t.stat_pending,   value: data.pending          },
    { name: t.stat_preparing, value: data.preparing        },
    { name: t.stat_delivery,  value: data.out_for_delivery },
    { name: t.stat_delivered, value: data.delivered        },
    { name: t.stat_done,      value: data.completed        },
    { name: t.stat_cancelled, value: data.cancelled        },
  ].filter(d => d.value > 0);

  if (pieData.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-white/25 text-sm">{t.no_data_period}</div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={pieData} cx="50%" cy="45%" innerRadius={65} outerRadius={95} paddingAngle={3} dataKey="value" strokeWidth={0}>
          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.88}/>)}
        </Pie>
        <Tooltip content={<PieTip />}/>
        <Legend iconType="circle" iconSize={7}
          formatter={(v: string) => <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600 }}>{v}</span>}/>
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Top items ─────────────────────────────────────────────────────────────────
function TopItemsTable({ items, lang }: { items: TopItem[]; lang: Lang; }) {
  const t   = T[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-white/20">
        <Award size={30} strokeWidth={1.5}/>
        <p className="text-xs font-semibold tracking-widest uppercase">{t.no_sales}</p>
      </div>
    );
  }
  const maxQty = Math.max(...items.map(i => i.qty_sold), 1);
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-white/5" dir={dir}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-black text-white"
            style={{ background:
              i === 0 ? "linear-gradient(135deg,#f59e0b,#d97706)"
              : i === 1 ? "linear-gradient(135deg,#9ca3af,#6b7280)"
              : i === 2 ? "linear-gradient(135deg,#c0614a,#a04a36)"
              : "rgba(255,255,255,0.08)" }}>
            {i + 1}
          </span>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className={"flex items-center justify-between " + (lang === "ar" ? "flex-row-reverse" : "")}>
              <span dir="rtl" className="text-sm font-bold text-white/85 font-arabic truncate max-w-[12rem]">{item.name}</span>
              <div className={"flex items-center gap-4 text-xs font-latin shrink-0 " + (lang === "ar" ? "mr-3" : "ml-3")}>
                <span className="text-white/35">{item.qty_sold.toFixed(1)} {t.units}</span>
                <span className="font-black text-sm" style={{ color: BRAND.emeraldGlow }}>{item.revenue.toFixed(0)} MAD</span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: (item.qty_sold / maxQty * 100) + "%", background: "linear-gradient(90deg," + BRAND.emerald + "," + BRAND.emeraldGlow + ")" }}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stat strip ────────────────────────────────────────────────────────────────
function StatStrip({ data, lang }: { data: AnalyticsData["orders_by_status"]; lang: Lang; }) {
  const t    = T[lang];
  const font = lang === "ar" ? "font-arabic" : "font-latin";
  const items: [string, number, string][] = [
    [t.stat_pending,   data.pending,          "#F59E0B"],
    [t.stat_preparing, data.preparing,        "#3B82F6"],
    [t.stat_delivery,  data.out_for_delivery, "#7C3AED"],
    [t.stat_delivered, data.delivered,        "#10B981"],
    [t.stat_done,      data.completed,        BRAND.emerald],
    [t.stat_cancelled, data.cancelled,        "#EF4444"],
  ];
  return (
    <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
      {items.map(([label, count, color]) => (
        <div key={label} className="rounded-2xl border p-4 text-center transition-all hover:border-white/15 backdrop-blur-md"
          style={{ background: BRAND.glass, borderColor: BRAND.glassBorder }}>
          <p className="text-2xl font-black font-latin" style={{ color, letterSpacing: "-0.02em" }}>{count}</p>
          <p className={"mt-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest " + font}>{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon, title, badge, children }: {
  icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-6 backdrop-blur-md"
      style={{ background: BRAND.glass, borderColor: BRAND.glassBorder, boxShadow: "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[10px] font-black uppercase tracking-widest text-white/35">{title}</h2>
        </div>
        {badge && <span className="text-[10px] text-white/20 font-semibold">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

// ── BarChart2 inline icon ─────────────────────────────────────────────────────
function BarChart2Icon({ size = 16, className = "" }: { size?: number; className?: string; }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
      <line x1="2"  y1="20" x2="22" y2="20"/>
    </svg>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
// NOTE: navigate() calls are defined INLINE on each button — no indirection.
function Sidebar({ onLogout, lang }: { onLogout: () => void; lang: Lang; }) {
  const navigate = useNavigate();
  const t    = T[lang];
  const font = lang === "ar" ? "font-arabic" : "font-latin";

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-16 flex-col justify-between border-r py-6 backdrop-blur-2xl md:w-60 md:px-4"
      style={{ background: "rgba(6,15,28,0.85)", borderColor: "rgba(52,211,153,0.12)", boxShadow: "1px 0 20px rgba(0,0,0,0.4)" }}>

      {/* Logo */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-1 md:px-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg"
            style={{ background: "linear-gradient(135deg," + BRAND.emerald + ",#065f46)", boxShadow: "0 0 16px " + BRAND.emerald + "50" }}>
            <Leaf size={15} className="text-white" strokeWidth={2}/>
          </div>
          <div className="hidden md:block">
            <p className={"text-sm font-black text-white " + font} style={{ letterSpacing: "-0.02em" }}>GreenGo</p>
            <p className={"text-[9px] text-white/30 " + font}>{t.portal_sub}</p>
          </div>
        </div>

        {/* Nav items — each button has its own explicit onClick */}
        <nav className="space-y-1">

          {/* Analytics — scrolls to top, stays on page */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={"flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all " + font}
            style={{ background: BRAND.activeNav, borderColor: BRAND.activeNavBorder, color: BRAND.emeraldGlow }}>
            <BarChart2Icon size={15} className="shrink-0"/>
            <span className="hidden md:block">{t.nav_analytics}</span>
          </button>

          {/* Operations → /admin */}
          <button
            onClick={() => navigate("/admin")}
            className={"flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-xs font-bold text-white/40 transition-all hover:bg-white/8 hover:text-white/80 hover:border-white/10 active:scale-95 " + font}>
            <ShoppingBag size={15} className="shrink-0" strokeWidth={1.8}/>
            <span className="hidden md:block">{t.nav_operations}</span>
          </button>

          {/* Storefront → / */}
          <button
            onClick={() => navigate("/")}
            className={"flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-xs font-bold text-white/40 transition-all hover:bg-white/8 hover:text-white/80 hover:border-white/10 active:scale-95 " + font}>
            <Leaf size={15} className="shrink-0" strokeWidth={1.8}/>
            <span className="hidden md:block">{t.nav_storefront}</span>
          </button>

        </nav>
      </div>

      {/* Sign out — calls onLogout which navigates to / AND resets PIN */}
      <button
        onClick={onLogout}
        className={"flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-xs font-bold text-white/30 transition-all hover:border-red-500/25 hover:bg-red-500/12 hover:text-red-400 active:scale-95 " + font}>
        <LogOut size={15} className="shrink-0" strokeWidth={1.8}/>
        <span className="hidden md:block">{t.signout}</span>
      </button>

    </aside>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ onLock }: { onLock: () => void; }) {
  const [lang,    setLang]    = useState<Lang>("ar");
  const [period,  setPeriod]  = useState<AnalyticsPeriod>("all");
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [sync,    setSync]    = useState("");

  const t    = T[lang];
  const dir  = lang === "ar" ? "rtl" : "ltr";
  const font = lang === "ar" ? "font-arabic" : "font-latin";

  const load = useCallback(async (p: AnalyticsPeriod) => {
    setLoading(true); setError("");
    try {
      setData(await getAnalytics(p));
      setSync(new Date().toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setError(t.error_msg);
    } finally {
      setLoading(false);
    }
  }, [t.error_msg]);

  useEffect(() => { load(period); }, [load, period]);

  const periodLabel = PERIODS.find(p => p.key === period)?.[lang === "ar" ? "label_ar" : "label_en"] ?? "";

  return (
    <div className="flex min-h-screen"
      style={{ backgroundImage: "url('/greengo-bg.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      {/* Dark overlay so text stays readable over the image */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: "rgba(6,14,26,0.82)" }}/>
      {/* Subtle emerald glow top-left matching image */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse 60% 50% at 10% 20%,rgba(5,150,105,0.08) 0%,transparent 60%)" }}/>

      <Sidebar onLogout={onLock} lang={lang}/>

      <main className="relative flex-1 pl-16 md:pl-60 min-h-screen" dir={dir}>
        <div className="mx-auto w-full max-w-[1400px] px-6 py-7 space-y-6">

          {/* ── Header ── */}
          <div className={"flex flex-wrap items-start gap-4 " + (lang === "ar" ? "flex-row-reverse" : "justify-between")}>
            <div className={lang === "ar" ? "text-right" : ""}>
              <p className={"text-[10px] font-bold tracking-widest text-white/30 uppercase " + font}>{t.page_eyebrow}</p>
              <h1 className={"mt-0.5 text-3xl font-black text-white " + font}
                style={{ letterSpacing: lang === "en" ? "-0.04em" : "-0.01em" }}>
                {t.page_title}
              </h1>
              <div className={"mt-1.5 flex items-center gap-2 " + (lang === "ar" ? "flex-row-reverse justify-end" : "")}>
                {loading
                  ? <span className={"text-xs text-white/20 " + font}>{t.loading}</span>
                  : sync
                  ? <span className={"text-xs text-white/30 " + font}>{t.updated} {sync}</span>
                  : null
                }
                {!loading && data && (
                  <span className={"rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border " + font}
                    style={{ background: BRAND.activeNav, borderColor: BRAND.activeNavBorder, color: BRAND.emeraldGlow }}>
                    {periodLabel}
                  </span>
                )}
              </div>
            </div>
            <div className={"flex flex-wrap items-center gap-2 " + (lang === "ar" ? "flex-row-reverse" : "")}>
              <LangToggle lang={lang} setLang={setLang}/>
              <PeriodToggle value={period} onChange={setPeriod} loading={loading} lang={lang}/>
              <button onClick={() => load(period)} disabled={loading}
                className={"flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold text-white/50 hover:text-white/90 transition-all disabled:opacity-30 backdrop-blur-md " + font}
                style={{ background: BRAND.glass, borderColor: BRAND.glassBorder }}>
                {loading ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
                <span className="hidden sm:block">{t.refresh}</span>
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && !data && (
            <div className="flex items-center justify-center gap-3 py-32" style={{ color: BRAND.emeraldGlow }}>
              <Loader2 size={24} className="animate-spin"/>
              <p className={"text-sm font-bold tracking-widest uppercase " + font}>{t.loading}</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <AlertCircle size={28} className="text-red-400/60" strokeWidth={1.5}/>
              <p className={"text-sm text-white/35 max-w-xs " + font} dir={dir}>{error}</p>
              <button onClick={() => load(period)}
                className={"flex items-center gap-2 rounded-xl border px-5 py-2 text-xs font-bold text-white/60 hover:text-white transition-all backdrop-blur-md " + font}
                style={{ background: BRAND.glass, borderColor: BRAND.glassBorder }}>
                <RefreshCw size={12}/> {t.retry}
              </button>
            </div>
          )}

          {/* Data */}
          {data && (
            <div className="space-y-6 transition-opacity duration-300" style={{ opacity: loading ? 0.3 : 1 }}>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard icon={DollarSign}  label={t.kpi_revenue}    value={data.total_revenue.toFixed(0)   + " MAD"} sub={t.kpi_revenue_sub} accent={BRAND.emerald} font={font}/>
                <KpiCard icon={ShoppingBag} label={t.kpi_orders}     value={String(data.total_orders)}                                          accent="#4f46e5"      font={font}/>
                <KpiCard icon={Activity}    label={t.kpi_avg}        value={data.avg_order_value.toFixed(0) + " MAD"}                           accent="#C9A96E"      font={font}/>
                <KpiCard icon={Target}      label={t.kpi_completion} value={data.completion_rate.toFixed(1) + "%"}                              accent="#0d9488"      font={font}/>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Section icon={<TrendingUp size={13} strokeWidth={2} style={{ color: BRAND.emeraldGlow }}/>} title={t.chart_by_status}>
                  <OrdersBarChart data={data.orders_by_status} lang={lang}/>
                </Section>
                <Section icon={<Activity size={13} className="text-teal-400" strokeWidth={2}/>} title={t.chart_dist}>
                  <StatusPieChart data={data.orders_by_status} lang={lang}/>
                </Section>
              </div>

              <Section icon={<Award size={13} className="text-amber-400" strokeWidth={2}/>}
                title={t.top_title} badge={data.top_selling_items.length + " " + t.top_items}>
                <TopItemsTable items={data.top_selling_items} lang={lang}/>
              </Section>

              <StatStrip data={data.orders_by_status} lang={lang}/>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Entry point — hooks BEFORE early return ───────────────────────────────────
export default function SuperAdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const navigate = useNavigate();   // ← declared before any conditional return

  function handleLock() {
    setUnlocked(false);
    navigate("/");                  // ← logout redirects to homepage
  }

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)}/>;
  return <Dashboard onLock={handleLock}/>;
}