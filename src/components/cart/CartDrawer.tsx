// src/components/cart/CartDrawer.tsx
import { useState } from "react";
import {
  X, Trash2, Plus, Minus, ShoppingBag,
  MapPin, Phone, User, Loader2, CheckCircle, AlertCircle,
} from "lucide-react";
import { useCartStore } from "../../store/cartStore";
import type { CartItem } from "../../store/cartStore";

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE  = "http://localhost:8000/api/v1";
const WA_NUMBER = "212600000000";

// ── Fallback WhatsApp message ─────────────────────────────────────────────────
function buildWaMessage(
  cart:    CartItem[],
  total:   number,
  name:    string,
  phone:   string,
  address: string,
): string {
  const lines = cart.map((i) => {
    const sub = ((i.price_per_unit || 0) * (i.cartQuantity || 0)).toFixed(2);
    return `  • ${i.cartQuantity} ${i.unit ?? ""} ${i.name} — ${sub} درهم`;
  });
  return [
    "السلام GreenGo! 🌿",
    "بغيت نطلب:",
    "",
    ...lines,
    "",
    `💰 المجموع: ${total.toFixed(2)} درهم`,
    `👤 الاسم: ${name}`,
    `📞 الهاتف: ${phone}`,
    `📍 العنوان: ${address}`,
    "",
    "شكراً! 🙏",
  ].join("\n");
}

// ── CartRow ───────────────────────────────────────────────────────────────────
function CartRow({ item }: { item: CartItem }) {
  const addToCart      = useCartStore((s) => s.addToCart);
  const removeFromCart = useCartStore((s) => s.removeFromCart);

  const unitPrice = item.price_per_unit || 0;
  const qty       = item.cartQuantity   || 0;
  const lineTotal = (unitPrice * qty).toFixed(2);

  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f0faf4] text-2xl select-none">
        🛒
      </div>
      <div className="flex-1 min-w-0">
        <p dir="rtl" className="truncate text-right text-sm font-bold text-gray-800">
          {item.name || "—"}
        </p>
        <p className="text-xs text-gray-400">
          {unitPrice.toFixed(2)} MAD / {item.unit || ""}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => removeFromCart(item.name)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500"
        >
          {qty <= 1 ? <Trash2 size={11} /> : <Minus size={11} />}
        </button>
        <span className="w-5 text-center text-sm font-bold text-gray-700">{qty}</span>
        <button
          onClick={() => addToCart(item)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-[#2E8B57]"
        >
          <Plus size={11} />
        </button>
      </div>
      <div className="w-16 shrink-0 text-right">
        <p className="text-sm font-extrabold text-gray-800">{lineTotal}</p>
        <p className="text-[10px] text-gray-400">MAD</p>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface CartDrawerProps {
  isOpen:  boolean;
  onClose: () => void;
}

type Status = "idle" | "loading" | "success" | "error";

// ── CartDrawer ────────────────────────────────────────────────────────────────
export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const cart       = useCartStore((s) => s.cart);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const clearCart  = useCartStore((s) => s.clearCart);

  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");
  const [status,  setStatus]  = useState<Status>("idle");
  const [errMsg,  setErrMsg]  = useState("");

  const total      = totalPrice();
  const totalItems = cart.reduce((sum, i) => sum + (i.cartQuantity || 0), 0);

  const isFormValid =
    cart.length > 0 &&
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    address.trim().length > 0;

  function resetAndClose() {
    setName("");
    setPhone("");
    setAddress("");
    setStatus("idle");
    setErrMsg("");
    onClose();
  }

  async function handleSubmit() {
    if (!isFormValid) return;

    setStatus("loading");
    setErrMsg("");

    const payload = {
      customer_name:    name.trim(),
      customer_phone:   phone.trim(),
      delivery_address: address.trim(),
      total_price:      total,
      items: cart.map((i) => ({
        name:           i.name,
        quantity:       i.cartQuantity  || 0,
        price_per_unit: i.price_per_unit || 0,
      })),
    };

    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }

      const data = await res.json();
      console.log("[CartDrawer] ✅ Order saved:", data);

      const waUrl: string =
        data.whatsapp_url ??
        `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
          buildWaMessage(cart, total, name.trim(), phone.trim(), address.trim())
        )}`;

      window.open(waUrl, "_blank", "noopener,noreferrer");

      clearCart();
      setStatus("success");
      setTimeout(resetAndClose, 2500);

    } catch (err) {
      console.error("[CartDrawer] ❌ Submit failed:", err);
      setStatus("error");
      setErrMsg("تعذّر إرسال الطلب. تأكد من الاتصال وأعد المحاولة.");
    }
  }

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={[
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={resetAndClose}
      />

      {/* ── Sliding drawer panel ── */}
      <div
        className={[
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl",
          "transform transition-transform duration-300 ease-in-out md:w-[450px]",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-[#2E8B57] px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} className="text-white" />
            <h2 className="text-base font-extrabold text-white">سلتي</h2>
            {totalItems > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#FF9800] px-1.5 text-[11px] font-extrabold text-white">
                {totalItems}
              </span>
            )}
          </div>
          <button
            onClick={resetAndClose}
            aria-label="Close cart"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Success state */}
          {status === "success" && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f0faf4]">
                <CheckCircle size={44} className="text-[#2E8B57]" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-800">
                تم إرسال طلبك! 🎉
              </h3>
              <p className="max-w-xs text-sm text-gray-500">
                وصلنا طلبك. تحقق من واتساب للتأكيد من فريق GreenGo. 🌿
              </p>
            </div>
          )}

          {/* Empty state */}
          {status !== "success" && cart.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f0faf4]">
                <ShoppingBag size={36} className="text-[#2E8B57] opacity-40" />
              </div>
              <p className="text-lg font-bold text-gray-700">السلة خاوية!</p>
              <p className="text-sm text-gray-400">أضف منتجات من الكتالوج 😊</p>
              <button
                onClick={resetAndClose}
                className="mt-2 rounded-xl bg-[#2E8B57] px-6 py-2.5 text-sm font-bold text-white shadow transition-colors hover:bg-[#1F6B40] active:scale-95"
              >
                ارجع للكتالوج
              </button>
            </div>
          )}

          {/* Items */}
          {status !== "success" && cart.length > 0 && (
            <div className="px-5 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <button
                  onClick={() => clearCart()}
                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-100"
                >
                  <Trash2 size={11} />
                  مسح الكل
                </button>
                <p className="text-xs text-gray-400">{cart.length} صنف</p>
              </div>

              {cart.map((item, idx) => (
                <CartRow key={`${item.name}-${idx}`} item={item} />
              ))}

              <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f0faf4] px-4 py-3">
                <span className="text-xl font-extrabold text-[#2E8B57]">
                  {total.toFixed(2)} MAD
                </span>
                <span className="text-sm font-semibold text-gray-500">
                  المجموع الكلي
                </span>
              </div>
            </div>
          )}

          {/* Checkout form */}
          {status !== "success" && cart.length > 0 && (
            <div className="mt-4 space-y-4 border-t border-gray-100 px-5 pb-6 pt-5">

              <h3 className="text-sm font-bold text-gray-700">
                تفاصيل التوصيل
              </h3>

              {/* Name */}
              <div className="space-y-1.5">
                <label htmlFor="d-name" className="block text-xs font-semibold text-gray-600">
                  الاسم الكامل *
                </label>
                <div className="relative">
                  <User size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="d-name"
                    type="text"
                    dir="rtl"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسمك الكريم"
                    className={[
                      "w-full rounded-xl border pr-9 pl-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 outline-none transition-colors",
                      name.trim().length > 0
                        ? "border-[#2E8B57] bg-[#f0faf4]"
                        : "border-gray-200 bg-white focus:border-[#FF9800]",
                    ].join(" ")}
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label htmlFor="d-phone" className="block text-xs font-semibold text-gray-600">
                  رقم الهاتف *
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="d-phone"
                    type="tel"
                    dir="rtl"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06XXXXXXXX"
                    className={[
                      "w-full rounded-xl border pr-9 pl-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 outline-none transition-colors",
                      phone.trim().length > 0
                        ? "border-[#2E8B57] bg-[#f0faf4]"
                        : "border-gray-200 bg-white focus:border-[#FF9800]",
                    ].join(" ")}
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label htmlFor="d-address" className="block text-xs font-semibold text-gray-600">
                  عنوان التوصيل *
                </label>
                <div className="relative">
                  <MapPin size={13} className="absolute right-3 top-3 text-gray-400" />
                  <textarea
                    id="d-address"
                    dir="rtl"
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="الحي، الزنقة، الرقم…"
                    className={[
                      "w-full resize-none rounded-xl border pr-9 pl-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 outline-none transition-colors",
                      address.trim().length > 0
                        ? "border-[#2E8B57] bg-[#f0faf4]"
                        : "border-gray-200 bg-white focus:border-[#FF9800]",
                    ].join(" ")}
                  />
                </div>
                <p className="text-[11px] font-semibold text-[#FF9800]">
                  🛵 توصيل مجاني فسلا فقط للشهر الأول
                </p>
              </div>

              {/* Error */}
              {status === "error" && errMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-500">
                  <AlertCircle size={13} />
                  {errMsg}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Sticky CTA */}
        {status !== "success" && cart.length > 0 && (
          <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
            <button
              onClick={handleSubmit}
              disabled={!isFormValid || status === "loading"}
              className={[
                "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white transition-all duration-150",
                isFormValid && status !== "loading"
                  ? "bg-[#2E8B57] shadow-lg shadow-[#2E8B57]/30 hover:bg-[#1F6B40] hover:shadow-xl active:scale-95"
                  : "cursor-not-allowed bg-gray-200 text-gray-400",
              ].join(" ")}
            >
              {status === "loading" ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  جارٍ إرسال الطلب…
                </>
              ) : (
                <>💬 تأكيد الطلب وإرساله للواتساب</>
              )}
            </button>
          </div>
        )}

      </div>
    </>
  );
}