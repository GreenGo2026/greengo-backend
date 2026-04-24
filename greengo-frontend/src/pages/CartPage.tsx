// src/pages/CartPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Trash2, Plus, Minus, ShoppingCart, ArrowRight,
  MapPin, Phone, User, AlertCircle, Loader2,
  MessageCircle, Leaf, Navigation, CheckCircle2,
  XCircle,
} from "lucide-react";
import { useCartStore, getUnitStep, formatQuantity } from "../store/cartStore";
import type { CartItem } from "../store/cartStore";
import { useLanguage } from "../contexts/LanguageContext";

const API_BASE  = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/v1`;
const WA_NUMBER = "212664500789";

// ── Types ─────────────────────────────────────────────────────────────────────
interface GPS { lat: number; lng: number; }
type LocationStatus = "idle" | "loading" | "success" | "error";

// ── Pre-defined className strings (keeps JSX attribute lines short + safe) ────
const CLS = {
  waBtn:       "flex items-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:brightness-105 active:scale-95",
  submitValid: "mt-2 flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-extrabold text-white shadow-lg transition-all duration-150 bg-[#2E8B57] hover:bg-[#1F6B40] hover:shadow-xl active:scale-[0.98]",
  submitDisabled: "mt-2 flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-extrabold text-white shadow-lg transition-all duration-150 cursor-not-allowed bg-gray-200 text-gray-400",
  backBtn:     "flex items-center gap-2 rounded-2xl bg-[#2E8B57] px-6 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:bg-[#1F6B40] active:scale-95",
  borderBtn:   "flex items-center gap-2 rounded-2xl border-2 border-[#2E8B57] px-6 py-3 text-sm font-extrabold text-[#2E8B57] transition-all hover:bg-[#2E8B57] hover:text-white active:scale-95",
  gpsIdle:     "flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#2E8B57]/30 bg-[#2E8B57]/8 px-4 py-3 text-sm font-bold text-[#2E8B57] transition-all hover:bg-[#2E8B57]/15 active:scale-[0.98]",
  gpsLoading:  "flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#2E8B57]/20 bg-[#2E8B57]/6 px-4 py-3 text-sm font-bold text-[#2E8B57]/60 cursor-not-allowed",
} as const;

// ── Zellige decorative background ─────────────────────────────────────────────
const ZELLIGE_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><g fill='none' stroke='%23ffffff' stroke-width='0.6' opacity='0.12'><polygon points='30,4 37,17 52,17 41,26 45,41 30,33 15,41 19,26 8,17 23,17'/><line x1='30' y1='4' x2='30' y2='56'/><line x1='4' y1='30' x2='56' y2='30'/><line x1='8' y1='8' x2='52' y2='52'/><line x1='52' y1='8' x2='8' y2='52'/></g></svg>";
const ZELLIGE_BG  = 'url("data:image/svg+xml,' + encodeURIComponent(ZELLIGE_SVG) + '")';

function formatWhatsAppMessage(
  cart: CartItem[],
  total: number,
  name: string,
  phone: string,
  address: string
): string {
  const lines = cart.map((i) => {
    const cost = ((i.price_per_unit || 0) * (i.cartQuantity || 0)).toFixed(2);
    const qty  = formatQuantity(i.cartQuantity, i.unit);
    return "  - " + qty + " " + i.name + " (" + cost + " \u062f\u0631\u0647\u0645)";
  });
  return [
    "\u0645\u0631\u062d\u0628\u0627\u064b GreenGo \ud83c\udf43\u060c \u0628\u063a\u064a\u062a \u0646\u062f\u0648\u0632 \u0647\u0627\u062f \u0627\u0644\u0637\u0644\u0628:",
    "",
    ...lines,
    "",
    "\u0627\u0644\u0645\u062c\u0645\u0648\u0639: " + total.toFixed(2) + " \u062f\u0631\u0647\u0645",
    "\u0627\u0644\u0627\u0633\u0645: " + name,
    "\u0627\u0644\u0647\u0627\u062a\u0641: " + phone,
    "\u0627\u0644\u0639\u0646\u0648\u0627\u0646: " + address,
    "",
    "\u0634\u0643\u0631\u0627\u064b! \ud83c\udf3f",
  ].join("\n");
}

// ── Hero strip ────────────────────────────────────────────────────────────────
function CartHeroStrip() {
  const { t, dir, language } = useLanguage();
  const font = language === "ar" ? "font-arabic" : "font-latin";
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg,#0d3b36 0%,#1a5c4a 60%,#2E8B57 100%)",
        backgroundImage: ZELLIGE_BG + ",linear-gradient(135deg,#0d3b36 0%,#1a5c4a 60%,#2E8B57 100%)",
        backgroundSize: "60px 60px,100% 100%",
      }}>
      <div className={"mx-auto flex max-w-5xl items-center gap-3 px-4 py-6 " + font} dir={dir}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20">
          <ShoppingCart size={18} className="text-white" />
        </div>
        <div className={dir === "rtl" ? "text-right" : "text-left"}>
          <h1 className="text-lg font-extrabold text-white">{t("cart_title")}</h1>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#FF9800]/70">
            {t("hero_badge")}
          </p>
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-1.5 md:flex">
          <Leaf size={13} className="text-white/30" />
          <span className="text-xs font-semibold text-white/30">GreenGo Market</span>
        </div>
      </div>
      <div className="zellige-border" />
    </section>
  );
}

// ── Quantity stepper ──────────────────────────────────────────────────────────
function QuantityControl({ item }: { item: CartItem }) {
  const add    = useCartStore((s) => s.addToCart);
  const remove = useCartStore((s) => s.removeFromCart);
  const step   = getUnitStep(item.unit);
  const qty    = item.cartQuantity;

  const decCls = qty <= step
    ? "flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500 transition-all hover:bg-rose-100 active:scale-90"
    : "flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-all hover:border-[#2E8B57]/40 hover:bg-[#2E8B57]/6 hover:text-[#2E8B57] active:scale-90";

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={() => remove(item.name, step)} className={decCls}>
        {qty <= step ? <Trash2 size={12} /> : <Minus size={12} />}
      </button>
      <span className="min-w-[3.5rem] text-center text-sm font-bold text-gray-700">
        {formatQuantity(qty, item.unit)}
      </span>
      <button
        onClick={() => add({ name: item.name, price_per_unit: item.price_per_unit, unit: item.unit, available: true }, step)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-all hover:border-[#2E8B57]/40 hover:bg-[#2E8B57]/6 hover:text-[#2E8B57] active:scale-90">
        <Plus size={12} />
      </button>
    </div>
  );
}

// ── Cart row ──────────────────────────────────────────────────────────────────
function CartRow({ item }: { item: CartItem }) {
  const { dir, language } = useLanguage();
  const font      = language === "ar" ? "font-arabic" : "font-latin";
  const unitPrice = item.price_per_unit || 0;
  const lineTotal = unitPrice * item.cartQuantity;
  const nameCls   = "truncate text-sm font-bold text-gray-800 " + font + " " + (dir === "rtl" ? "text-right" : "text-left");

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#2E8B57]/8 text-2xl select-none">
        🛒
      </div>
      <div className="flex-1 min-w-0">
        <p dir={dir} className={nameCls}>{item.name || "\u2014"}</p>
        <p className="text-xs text-gray-400 font-latin">
          {unitPrice.toFixed(2)} MAD / {item.unit || "unité"}
        </p>
      </div>
      <QuantityControl item={item} />
      <div className="w-20 shrink-0 text-right">
        <p className="text-sm font-extrabold text-gray-800 font-latin">{lineTotal.toFixed(2)}</p>
        <p className="text-[10px] text-gray-400">MAD</p>
      </div>
    </li>
  );
}

// ── GPS capture widget ────────────────────────────────────────────────────────
function GPSCapture({ status, onRequest }: {
  status:    LocationStatus;
  onRequest: () => void;
}) {
  if (status === "success") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircle2 size={15} className="shrink-0 text-[#2E8B57]" />
        <span className="text-sm font-bold text-[#2E8B57]">
          ✅ Position GPS capturée avec succès
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <XCircle size={14} className="shrink-0 text-red-500" />
          <span className="text-sm font-semibold text-red-600">
            ❌ Erreur de localisation. Veuillez autoriser l'accès.
          </span>
        </div>
        <button type="button" onClick={onRequest}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 transition-all hover:bg-gray-100">
          <Navigation size={12} />
          Réessayer
        </button>
      </div>
    );
  }

  const btnCls = status === "loading" ? CLS.gpsLoading : CLS.gpsIdle;
  return (
    <button type="button" onClick={onRequest} disabled={status === "loading"} className={btnCls}>
      {status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
      {status === "loading" ? "Chargement de votre position\u2026" : "\ud83d\udccd Obtenir ma position GPS (Recommandé)"}
    </button>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ orderId }: { orderId: string }) {
  const shortId = orderId.slice(-6).toUpperCase();
  const [dlLoading, setDlLoading] = useState(false);
  const [dlError,   setDlError]   = useState("");

  async function downloadInvoice() {
    setDlLoading(true);
    setDlError("");
    try {
      const res = await fetch(
        `${API_BASE}/orders/${orderId}/invoice?lang=fr`
      );
      if (!res.ok) throw new Error("HTTP " + res.status.toString());
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "GreenGo_Facture_" + orderId.slice(-8).toUpperCase() + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setDlError("Erreur lors du téléchargement de la facture.");
    } finally {
      setDlLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: "#FAF7F2" }}>
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#2E8B57]/10 shadow-inner">
        <CheckCircle2 size={48} className="text-[#2E8B57]" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-gray-800">Commande confirmée ! 🎉</h2>
        <p className="mt-2 text-gray-500">
          Votre commande <span className="font-bold text-gray-700 font-latin">#{shortId}</span> a bien été reçue.
        </p>
        <p className="mt-1.5 text-sm text-gray-400">
          Notre équipe vous contactera sur WhatsApp pour confirmer la livraison.
        </p>
      </div>

      {/* Invoice download */}
      <div className="flex flex-col items-center gap-2 w-full max-w-xs">
        <button
          onClick={downloadInvoice}
          disabled={dlLoading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2E8B57] px-6 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:bg-[#1F6B40] active:scale-95 disabled:opacity-60">
          {dlLoading
            ? <><Loader2 size={15} className="animate-spin" /> Génération…</>
            : <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Télécharger la facture PDF
              </>
          }
        </button>
        {dlError && <p className="text-xs text-red-500">{dlError}</p>}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <a href={"https://wa.me/" + WA_NUMBER} target="_blank" rel="noopener noreferrer"
          className={CLS.waBtn}>
          <MessageCircle size={15} />
          Discuter sur WhatsApp
        </a>
        <Link to="/" className={CLS.borderBtn}>
          <Leaf size={15} />
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}

// ── CartPage ──────────────────────────────────────────────────────────────────
export default function CartPage() {
  const { t, dir, language } = useLanguage();
  const font = language === "ar" ? "font-arabic" : "font-latin";

  const cart       = useCartStore((s) => s.cart);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const clearCart  = useCartStore((s) => s.clearCart);

  const [name,           setName]           = useState("");
  const [phone,          setPhone]          = useState("");
  const [address,        setAddress]        = useState("");
  const [location,       setLocation]       = useState<GPS | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [submitError,    setSubmitError]    = useState("");
  const [orderId,        setOrderId]        = useState("");

  const total     = totalPrice();
  const itemCount = cart.length;
  const isValid   = itemCount > 0 && name.trim().length > 1 && phone.trim().length >= 9 && address.trim().length > 5;

  // ── GPS ──────────────────────────────────────────────────────────────────────
  function handleGetLocation() {
    if (!navigator.geolocation) { setLocationStatus("error"); return; }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("success");
      },
      () => setLocationStatus("error"),
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function submitOrder() {
    if (!isValid) return;
    setIsSubmitting(true);
    setSubmitError("");

    const normalizedPhone = phone.trim().startsWith("+212")
      ? phone.trim()
      : "+212" + phone.trim().replace(/^0/, "");

    const payload = {
      customer_name:   name.trim(),
      customer_phone:  normalizedPhone,
      delivery_address: address.trim(),
      gps_coordinates: location ?? undefined,
      items: cart.map((i) => ({
        name:           i.name,
        quantity:       Number(i.cartQuantity),
        unit:           (i.unit ?? "kg").trim(),
        price_per_unit: Number(i.price_per_unit ?? 0),
      })),
      total_price: total,
    };

    try {
      const res = await fetch(API_BASE + "/orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body?.detail ?? "Erreur serveur " + res.status));
      }
      const data = await res.json();
      const id   = data.order_id ?? "";
      // Order saved — show success screen (no auto WhatsApp redirect)
      clearCart();
      setOrderId(id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Requête échouée. Le serveur est-il démarré ?");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Derived className strings ─────────────────────────────────────────────────
  const rowDir    = dir === "rtl" ? "flex-row-reverse" : "";
  const nameInput = "w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#2E8B57]/15 " + (name.trim().length > 1 ? "border-[#2E8B57]/40 bg-[#2E8B57]/4" : "border-gray-200 bg-gray-50 focus:border-[#2E8B57]/50");
  const addrInput = "w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#2E8B57]/15 " + (address.trim().length > 5 ? "border-[#2E8B57]/40 bg-[#2E8B57]/4" : "border-gray-200 bg-gray-50 focus:border-[#2E8B57]/50");
  const submitCls = (isValid && !isSubmitting ? CLS.submitValid : CLS.submitDisabled) + " " + font;

  // ── Success ───────────────────────────────────────────────────────────────────
  if (orderId) {
    return (
      <>
        <CartHeroStrip />
        <SuccessScreen orderId={orderId} />
      </>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────────
  if (itemCount === 0) {
    return (
      <>
        <CartHeroStrip />
        <div dir={dir} className={"flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center " + font}>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#2E8B57]/8 shadow-inner">
            <ShoppingCart size={44} className="text-[#2E8B57] opacity-40" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-800">{t("cart_empty_title")}</h2>
          <p className="text-gray-500">{t("cart_empty_body")}</p>
          <Link to="/" className={CLS.backBtn}>
            <ArrowRight size={16} className={dir === "rtl" ? "" : "rotate-180"} />
            {t("back_to_catalog")}
          </Link>
        </div>
      </>
    );
  }

  // ── Full cart ─────────────────────────────────────────────────────────────────
  return (
    <>
      <CartHeroStrip />
      <div dir={dir} className={"min-h-screen px-4 py-6 md:py-8 " + font} style={{ background: "#FAF7F2" }}>
        <div className="mx-auto max-w-5xl space-y-6">

          <div className={"flex flex-wrap items-center justify-between gap-3 " + rowDir}>
            <p className="text-sm text-gray-500">
              {itemCount} article{itemCount > 1 ? "s" : ""} — {total.toFixed(2)} MAD
            </p>
            <button onClick={() => clearCart()}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-100">
              <Trash2 size={12} />
              {t("cart_clear")}
            </button>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-start">

            {/* Left: items */}
            <div className="flex-1 space-y-4">
              <ul className="space-y-3">
                {cart.map((item, i) => <CartRow key={item.name + i} item={item} />)}
              </ul>
              <div className="my-4 divider-zellige" />
              <Link to="/" className={"flex items-center gap-2 text-sm font-semibold text-[#2E8B57] transition-colors hover:underline " + (dir === "rtl" ? "justify-end" : "justify-start")}>
                <ArrowRight size={14} className={dir === "rtl" ? "" : "rotate-180"} />
                {t("continue_shopping")}
              </Link>
            </div>

            {/* Right: summary + form */}
            <div className="w-full md:w-[380px] shrink-0 space-y-4">

              {/* Order total */}
              <div className="rounded-2xl bg-white p-5 shadow-md" style={{ borderTop: "4px solid #C9A96E" }}>
                <h2 className={"mb-4 text-base font-bold text-gray-700 " + font} dir={dir}>
                  {t("order_summary")}
                </h2>
                <ul className="mb-4 space-y-2">
                  {cart.map((item, i) => (
                    <li key={item.name + i} className={"flex items-center justify-between text-sm " + rowDir}>
                      <span className="font-extrabold text-gray-800 font-latin">
                        {((item.price_per_unit || 0) * (item.cartQuantity || 0)).toFixed(2)} MAD
                      </span>
                      <span className={"text-gray-500 " + font}>
                        {item.name} × {formatQuantity(item.cartQuantity, item.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className={"flex items-center justify-between rounded-xl px-4 py-3 " + rowDir}
                  style={{ background: "linear-gradient(135deg,#fdf8ef,#f9efda)" }}>
                  <span className={"text-2xl font-extrabold text-[#2E8B57] " + font}>
                    {total.toFixed(2)} MAD
                  </span>
                  <span className={"text-sm font-semibold text-gray-500 " + font}>{t("total")}</span>
                </div>
              </div>

              {/* Delivery form */}
              <div className="rounded-2xl bg-white p-5 shadow-md space-y-4" style={{ borderTop: "4px solid #2E8B57" }}>
                <h2 className={"flex items-center gap-2 text-base font-bold text-gray-700 " + font} dir={dir}>
                  <MapPin size={15} className="text-[#FF9800]" />
                  {t("delivery_info")}
                </h2>

                {/* Nom */}
                <div className="space-y-1.5">
                  <label htmlFor="cp-name"
                    className={"flex items-center gap-1.5 text-xs font-semibold text-gray-600 " + font}
                    dir={dir}>
                    <User size={12} className="text-[#2E8B57]" />
                    {t("form_name")} *
                  </label>
                  <input id="cp-name" type="text" dir={dir} value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("form_name_placeholder")}
                    className={nameInput} />
                </div>

                {/* Téléphone */}
                <div className="space-y-1.5">
                  <label htmlFor="cp-phone"
                    className={"flex items-center gap-1.5 text-xs font-semibold text-gray-600 " + font}
                    dir={dir}>
                    <Phone size={12} className="text-[#2E8B57]" />
                    {t("form_phone_label")} *
                  </label>
                  <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-all focus-within:border-[#2E8B57]/50 focus-within:ring-2 focus-within:ring-[#2E8B57]/15">
                    <div className="flex shrink-0 items-center border-r border-gray-200 bg-gray-100 px-3">
                      <span className="text-sm font-bold text-gray-500 font-latin">🇲🇦 +212</span>
                    </div>
                    <input id="cp-phone" type="tel" dir="ltr" value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t("form_phone_placeholder")}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none font-latin" />
                  </div>
                </div>

                {/* Adresse */}
                <div className="space-y-1.5">
                  <label htmlFor="cp-addr"
                    className={"flex items-center gap-1.5 text-xs font-semibold text-gray-600 " + font}
                    dir={dir}>
                    <MapPin size={12} className="text-[#2E8B57]" />
                    {t("form_address_label")} *
                  </label>
                  <textarea id="cp-addr" dir={dir} rows={3} value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t("form_address_placeholder")}
                    className={addrInput} />
                </div>

                {/* GPS — directly under address */}
                <div className="space-y-1.5">
                  <label className={"flex items-center gap-1.5 text-xs font-semibold text-gray-500 " + font}>
                    <Navigation size={11} className="text-[#2E8B57]" />
                    Localisation GPS
                    <span className="ml-1.5 rounded-full bg-[#2E8B57]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#2E8B57]">
                      Recommandé
                    </span>
                  </label>
                  <GPSCapture status={locationStatus} onRequest={handleGetLocation} />
                  {locationStatus === "success" && location && (
                    <p className="pl-1 text-[10px] text-gray-400 font-latin">
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </p>
                  )}
                </div>

                {/* Free delivery */}
                <p className={"flex items-center gap-1.5 text-[11px] font-semibold text-[#2E8B57] " + font}>
                  🛵 {t("free_delivery_note")}
                </p>

                {/* Validation hint */}
                {!isValid && (name.length > 0 || phone.length > 0 || address.length > 0) && (
                  <p className={"flex items-center gap-1.5 text-xs font-medium text-amber-600 " + font} dir={dir}>
                    <AlertCircle size={11} className="shrink-0" />
                    {t("form_validation_hint")}
                  </p>
                )}

                {/* Server error */}
                {submitError && (
                  <div className={"flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-500 " + font} dir={dir}>
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Submit */}
                {/* PRIMARY: Confirmer la commande (saves to DB) */}
                <button onClick={submitOrder} disabled={!isValid || isSubmitting} className={submitCls}>
                  {isSubmitting
                    ? <><Loader2 size={18} className="animate-spin" /> Envoi en cours…</>
                    : <><CheckCircle2 size={18} /> Confirmer la commande</>}
                </button>

                <p className={"text-center text-[11px] text-gray-400 " + font}>
                  Votre commande sera enregistrée et une facture PDF sera disponible.
                </p>
              </div>

              {/* SECONDARY: Commander via WhatsApp (bypasses site confirmation) */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
                <p className="text-xs font-semibold text-gray-500 text-center">
                  Ou commandez directement via WhatsApp
                </p>
                <button
                  disabled={!isValid}
                  onClick={() => {
                    if (!isValid) return;
                    const normalizedPhone = phone.trim().startsWith("+212")
                      ? phone.trim()
                      : "+212" + phone.trim().replace(/^0/, "");
                    const msg = formatWhatsAppMessage(cart, total, name.trim(), normalizedPhone, address.trim());
                    window.open("https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg), "_blank", "noopener,noreferrer");
                  }}
                  className={"flex w-full items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-2.5 text-sm font-bold text-green-700 transition-colors hover:bg-green-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"}>
                  <MessageCircle size={14} />
                  Commander via WhatsApp 💬
                </button>
                <p className="text-[10px] text-gray-400 text-center">
                  Cette option envoie votre commande directement sans enregistrement sur le site.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}


