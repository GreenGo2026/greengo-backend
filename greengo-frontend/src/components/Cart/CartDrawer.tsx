// src/components/Cart/CartDrawer.tsx
import { useState, useEffect, useRef } from "react";
import {
  X, ShoppingCart, Plus, Minus, Trash2, MapPin,
  Phone, User, CheckCircle, Loader2, Navigation,
  ChevronRight, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useCartStore, formatQuantity, getUnitStep } from "../../store/cartStore";
import type { CartItem } from "../../store/cartStore";

const API_BASE  = `${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;
const WA_NUMBER = "212664500789";

// ── Types ─────────────────────────────────────────────────────────────────────
interface GPS { lat: number; lng: number; }
type DrawerStep    = "cart" | "checkout" | "success";
type LocationStatus = "idle" | "loading" | "success" | "error";

// ── Cart row ──────────────────────────────────────────────────────────────────
function CartRow({ item }: { item: CartItem }) {
  const add    = useCartStore((s) => s.addToCart);
  const remove = useCartStore((s) => s.removeFromCart);
  const step   = getUnitStep(item.unit);
  const qty    = item.cartQuantity;
  const line   = ((item.price_per_unit ?? 0) * qty).toFixed(2);

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-2xl select-none">
        🛒
      </div>
      <div className="flex-1 min-w-0">
        <p dir="rtl" className="truncate text-sm font-bold text-gray-800 font-arabic text-right">
          {item.name}
        </p>
        <p className="text-xs text-gray-400 font-latin">
          {(item.price_per_unit ?? 0).toFixed(2)} MAD / {item.unit}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-sm font-extrabold text-gray-800 font-latin">{line} MAD</p>
        <div className="flex items-center overflow-hidden rounded-xl border-2 border-[#2E8B57]/20 bg-[#2E8B57]/6">
          <button
            onClick={() => remove(item.name, step)}
            className="flex h-7 w-7 items-center justify-center text-[#2E8B57] transition-colors hover:bg-[#2E8B57]/12 active:scale-90">
            {qty <= step ? <Trash2 size={11} /> : <Minus size={11} />}
          </button>
          <span className="min-w-[3rem] text-center text-xs font-extrabold text-[#2E8B57] font-latin">
            {formatQuantity(qty, item.unit)}
          </span>
          <button
            onClick={() => add(
              { name: item.name, price_per_unit: item.price_per_unit, unit: item.unit, available: true },
              step
            )}
            className="flex h-7 w-7 items-center justify-center text-[#2E8B57] transition-colors hover:bg-[#2E8B57]/12 active:scale-90">
            <Plus size={11} />
          </button>
        </div>
      </div>
    </li>
  );
}

// ── GPS Button ────────────────────────────────────────────────────────────────
function GPSCapture({ status, onRequest }: {
  status:    LocationStatus;
  onRequest: () => void;
}) {
  if (status === "success") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
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
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <AlertCircle size={14} className="shrink-0 text-red-500" />
          <span className="text-sm font-semibold text-red-600">
            ❌ Erreur de localisation. Veuillez autoriser l'accès.
          </span>
        </div>
        <button
          type="button"
          onClick={onRequest}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 transition-all hover:bg-gray-100">
          <Navigation size={12} />
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={status === "loading"}
      className={"flex w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed " + (status === "loading"
        ? "border-[#2E8B57]/20 bg-[#2E8B57]/6 text-[#2E8B57]/60"
        : "border-[#2E8B57]/30 bg-[#2E8B57]/8 text-[#2E8B57] hover:bg-[#2E8B57]/15 active:scale-[0.98]")}>
      {status === "loading"
        ? <Loader2 size={15} className="animate-spin" />
        : <Navigation size={15} />}
      {status === "loading" ? "Chargement de votre position…" : "📍 Obtenir ma position GPS (Recommandé)"}
    </button>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#2E8B57]/12 shadow-inner">
        <CheckCircle size={40} className="text-[#2E8B57]" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-xl font-extrabold text-gray-800">Commande confirmée ! 🎉</p>
        <p className="mt-1 text-sm text-gray-500">
          Votre commande{" "}
          <span className="font-bold text-gray-700 font-latin">
            #{orderId.slice(-6).toUpperCase()}
          </span>{" "}
          a bien été reçue.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Notre équipe vous contactera sur WhatsApp sous peu pour confirmer la livraison.
        </p>
      </div>
      <a
        href={"https://wa.me/" + WA_NUMBER}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#25D366]/25 transition-all hover:brightness-105 active:scale-95">
        💬 Discuter sur WhatsApp
      </a>
      <button
        onClick={onClose}
        className="text-sm font-semibold text-gray-400 underline transition-colors hover:text-gray-600">
        Continuer mes achats
      </button>
    </div>
  );
}

// ── Main CartDrawer ───────────────────────────────────────────────────────────
interface CartDrawerProps {
  open:    boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const cart       = useCartStore((s) => s.cart);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const clearCart  = useCartStore((s) => s.clearCart);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step,           setStep]           = useState<DrawerStep>("cart");
  const [name,           setName]           = useState("");
  const [phone,          setPhone]          = useState("");
  const [address,        setAddress]        = useState("");
  const [location,       setLocation]       = useState<GPS | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [submitting,     setSubmitting]     = useState(false);
  const [serverErr,      setServerErr]      = useState("");
  const [orderId,        setOrderId]        = useState("");

  const drawerRef = useRef<HTMLDivElement>(null);

  // Reset form when drawer re-opens
  useEffect(() => {
    if (open) {
      setStep("cart");
      setServerErr("");
      setLocation(null);
      setLocationStatus("idle");
    }
  }, [open]);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // ── GPS handler ─────────────────────────────────────────────────────────────
  function handleGetLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("success");
      },
      () => {
        setLocationStatus("error");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const total      = totalPrice();
  const itemCount  = cart.length;
  const isFormValid =
    name.trim().length > 1 &&
    phone.trim().length >= 9 &&
    address.trim().length > 5;

  // ── Submit order ─────────────────────────────────────────────────────────────
  async function submitOrder() {
    if (!isFormValid) return;
    setSubmitting(true);
    setServerErr("");

    const normalizedPhone = phone.trim().startsWith("+212")
      ? phone.trim()
      : "+212" + phone.trim().replace(/^0/, "");

    const payload = {
      customer_name:   name.trim(),
      phone:           normalizedPhone,
      address:         address.trim(),
      gps_coordinates: location ?? undefined,
      items: cart.map((i) => ({
        name:           i.name,
        quantity:       i.cartQuantity,
        unit:           i.unit ?? "kg",
        price_per_unit: i.price_per_unit ?? 0,
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
      setOrderId(data.order_id ?? "");
      clearCart();
      setStep("success");
    } catch (err) {
      setServerErr(
        err instanceof Error
          ? err.message
          : "Requête échouée. Le serveur est-il démarré ?"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={handleBackdrop}>

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(180deg,#f8faf8 0%,#f3f7f3 100%)" }}>

        {/* ── Header ── */}
        <div
          className="flex items-center justify-between border-b border-white/10 px-5 py-4"
          style={{ background: "linear-gradient(135deg,#0d3b36 0%,#1a5c4a 100%)" }}>
          <div className="flex items-center gap-3">
            {step === "checkout" && (
              <button
                onClick={() => setStep("cart")}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20">
                <ChevronRight size={16} className="rotate-180" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2E8B57]">
                <ShoppingCart size={15} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-white">
                  {step === "cart"
                    ? "Mon Panier"
                    : step === "checkout"
                    ? "Finaliser la commande"
                    : "Commande confirmée"}
                </p>
                {step === "cart" && itemCount > 0 && (
                  <p className="text-[10px] text-white/50 font-latin">
                    {itemCount} article{itemCount > 1 ? "s" : ""} · {total.toFixed(2)} MAD
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* SUCCESS */}
          {step === "success" && (
            <SuccessScreen orderId={orderId} onClose={onClose} />
          )}

          {/* CART */}
          {step === "cart" && (
            <div className="px-4 py-4 space-y-3">
              {itemCount === 0 ? (
                <div className="flex flex-col items-center gap-4 py-20 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-4xl">
                    🛒
                  </div>
                  <p className="font-bold text-gray-600">Votre panier est vide</p>
                  <p className="text-sm text-gray-400">Ajoutez des produits frais pour commencer !</p>
                  <button
                    onClick={onClose}
                    className="rounded-xl bg-[#2E8B57] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1F6B40]">
                    Explorer les produits
                  </button>
                </div>
              ) : (
                <>
                  <ul className="space-y-2.5">
                    {cart.map((item, i) => <CartRow key={item.name + i} item={item} />)}
                  </ul>
                  <div className="my-2 border-t border-dashed border-gray-200" />
                  <div
                    className="flex items-center justify-between rounded-2xl px-4 py-3.5"
                    style={{ background: "linear-gradient(135deg,#fdf8ef,#f9efda)" }}>
                    <span className="text-base font-bold text-gray-600">Total</span>
                    <span className="text-2xl font-extrabold text-gray-900 font-latin">
                      {total.toFixed(2)}{" "}
                      <span className="text-sm font-semibold text-gray-400">MAD</span>
                    </span>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-[#2E8B57]">
                    🛵 Livraison gratuite à Casablanca pendant tout le premier mois !
                  </p>
                </>
              )}
            </div>
          )}

          {/* CHECKOUT FORM */}
          {step === "checkout" && (
            <div className="px-4 py-5 space-y-4">

              {/* Nom */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                  <User size={12} className="text-[#2E8B57]" />
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom et prénom"
                  className={"w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#2E8B57]/15 " +
                    (name.trim().length > 1
                      ? "border-[#2E8B57]/40 bg-[#2E8B57]/3"
                      : "border-gray-200 bg-white focus:border-[#2E8B57]/50")}
                />
              </div>

              {/* Téléphone */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                  <Phone size={12} className="text-[#2E8B57]" />
                  Numéro de téléphone *
                </label>
                <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white transition-all focus-within:border-[#2E8B57]/50 focus-within:ring-2 focus-within:ring-[#2E8B57]/15">
                  <div className="flex shrink-0 items-center border-r border-gray-200 bg-gray-50 px-3">
                    <span className="text-sm font-bold text-gray-500 font-latin">🇲🇦 +212</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="6XXXXXXXX"
                    dir="ltr"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none font-latin"
                  />
                </div>
              </div>

              {/* Adresse */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                  <MapPin size={12} className="text-[#2E8B57]" />
                  Adresse de livraison, Casablanca *
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex : Hay Hassani, Rue 5, N°12, près de la pharmacie…"
                  rows={3}
                  className={"w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#2E8B57]/15 " +
                    (address.trim().length > 5
                      ? "border-[#2E8B57]/40 bg-[#2E8B57]/3"
                      : "border-gray-200 bg-white focus:border-[#2E8B57]/50")}
                />
              </div>

              {/* GPS — right below address */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                  <Navigation size={11} className="text-[#2E8B57]" />
                  Localisation GPS
                  <span className="ml-1 rounded-full bg-[#2E8B57]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#2E8B57]">
                    Recommandé
                  </span>
                </label>
                <GPSCapture status={locationStatus} onRequest={handleGetLocation} />
                {locationStatus === "success" && location && (
                  <p className="text-[10px] text-gray-400 font-latin pl-1">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </p>
                )}
              </div>

              {/* Order summary mini */}
              <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Récapitulatif
                </p>
                <ul className="space-y-1">
                  {cart.map((item, i) => (
                    <li key={item.name + i} className="flex items-center justify-between text-xs">
                      <span dir="rtl" className="text-gray-600 font-arabic">
                        {item.name} × {formatQuantity(item.cartQuantity, item.unit)}
                      </span>
                      <span className="font-bold text-gray-800 font-latin">
                        {((item.price_per_unit ?? 0) * item.cartQuantity).toFixed(2)} MAD
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2.5">
                  <span className="text-sm font-bold text-gray-600">Total</span>
                  <span className="text-lg font-extrabold text-[#2E8B57] font-latin">
                    {total.toFixed(2)} MAD
                  </span>
                </div>
              </div>

              {/* Validation hint */}
              {!isFormValid && (name.length > 0 || phone.length > 0 || address.length > 0) && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <AlertCircle size={11} className="shrink-0" />
                  Veuillez remplir tous les champs obligatoires (nom, téléphone, adresse).
                </p>
              )}

              {/* Server error */}
              {serverErr && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-500">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span>{serverErr}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer CTA ── */}
        {step !== "success" && itemCount > 0 && (
          <div className="border-t border-gray-100 bg-white px-4 py-4 space-y-2.5 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">

            {step === "cart" && (
              <button
                onClick={() => setStep("checkout")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2E8B57] py-4 text-base font-extrabold text-white shadow-lg shadow-[#2E8B57]/20 transition-all hover:bg-[#1F6B40] hover:shadow-xl active:scale-[0.98]">
                Passer la commande
                <ChevronRight size={18} />
              </button>
            )}

            {step === "checkout" && (
              <button
                onClick={submitOrder}
                disabled={!isFormValid || submitting}
                className={"flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-lg transition-all " +
                  (isFormValid && !submitting
                    ? "bg-[#2E8B57] shadow-[#2E8B57]/20 hover:bg-[#1F6B40] hover:shadow-xl active:scale-[0.98]"
                    : "cursor-not-allowed bg-gray-200 text-gray-400")}>
                {submitting
                  ? <><Loader2 size={18} className="animate-spin" /> Envoi en cours…</>
                  : <><CheckCircle size={18} /> Confirmer · {total.toFixed(2)} MAD</>}
              </button>
            )}

            <p className="text-center text-[10px] text-gray-400">
              🔒 Commande sécurisée · Paiement à la livraison · Livraison gratuite à Casablanca
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
