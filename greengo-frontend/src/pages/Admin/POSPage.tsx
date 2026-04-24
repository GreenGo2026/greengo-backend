// src/pages/admin/POSPage.tsx
import { useState } from "react";
import { Star, CheckCircle2, Loader2, AlertCircle, Leaf } from "lucide-react";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/v1`;

interface POSResponse {
  phone:         string;
  points_earned: number;
  total_points:  number;
  message:       string;
}

interface SuccessBanner {
  customerName:  string;
  phone:         string;
  amountPaid:    number;
  pointsEarned:  number;
  totalPoints:   number;
}

export default function POSPage() {
  const [customerName, setCustomerName] = useState("");
  const [phone,        setPhone]        = useState("");
  const [amountPaid,   setAmountPaid]   = useState("");
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState<SuccessBanner | null>(null);

  const isValid =
    customerName.trim().length > 1 &&
    phone.trim().length >= 9 &&
    parseFloat(amountPaid) > 0;

  function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("212")) return "+" + digits;
    if (digits.startsWith("0"))   return "+212" + digits.slice(1);
    return "+212" + digits;
  }

  async function handleSubmit() {
    if (!isValid || isLoading) return;
    setIsLoading(true);
    setError("");
    setSuccess(null);

    const normalizedPhone = normalizePhone(phone.trim());
    const amount          = parseFloat(amountPaid);

    try {
      const res = await fetch(`${API_BASE}/customers/offline-points`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone:         normalizedPhone,
          customer_name: customerName.trim(),
          amount_paid:   amount,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body?.detail ?? `Server error ${res.status}`));
      }

      const data: POSResponse = await res.json();

      setSuccess({
        customerName: customerName.trim(),
        phone:        normalizedPhone,
        amountPaid:   amount,
        pointsEarned: data.points_earned,
        totalPoints:  data.total_points,
      });

      // Clear form for next customer
      setCustomerName("");
      setPhone("");
      setAmountPaid("");

    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed. Is the server running?");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0d3b36 0%,#1a5c4a 60%,#2E8B57 100%)" }}
        className="px-4 py-5">
        <div className="mx-auto max-w-lg flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
            <Star size={18} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">POS — Loyalty Points</h1>
            <p className="text-xs text-white/50 uppercase tracking-widest font-semibold">
              GreenGo Market · Physical Store
            </p>
          </div>
          <div className="flex-1" />
          <Leaf size={13} className="text-white/20 hidden md:block" />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">

        {/* Success Banner */}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="text-[#2E8B57] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#1F6B40] text-sm">
                  Points awarded to {success.customerName}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {success.amountPaid.toFixed(2)} MAD · {success.phone}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white border border-emerald-100 p-3 text-center">
                <p className="text-2xl font-extrabold text-[#2E8B57]">
                  +{success.pointsEarned}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">Earned today</p>
              </div>
              <div className="rounded-xl bg-white border border-orange-100 p-3 text-center">
                <p className="text-2xl font-extrabold text-[#FF9800]">
                  {success.totalPoints}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">Total balance</p>
              </div>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-2xl bg-white shadow-md p-5 space-y-4"
          style={{ borderTop: "4px solid #2E8B57" }}>

          <h2 className="text-sm font-bold text-gray-600">New in-store transaction</h2>

          {/* Customer Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">
              Customer name *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Ahmed Benali"
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#2E8B57]/15"
              style={{ borderColor: customerName.trim().length > 1 ? "#2E8B57" : undefined }}
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">
              Phone number *
            </label>
            <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-all focus-within:border-[#2E8B57]/50 focus-within:ring-2 focus-within:ring-[#2E8B57]/15">
              <div className="flex shrink-0 items-center border-r border-gray-200 bg-gray-100 px-3">
                <span className="text-sm font-bold text-gray-500">🇲🇦 +212</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="6XXXXXXXX"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none"
              />
            </div>
          </div>

          {/* Amount Paid */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">
              Amount paid *
            </label>
            <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-all focus-within:border-[#2E8B57]/50 focus-within:ring-2 focus-within:ring-[#2E8B57]/15">
              <input
                type="number"
                min="1"
                step="0.5"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
                className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none"
              />
              <div className="flex shrink-0 items-center border-l border-gray-200 bg-gray-100 px-3">
                <span className="text-sm font-bold text-gray-500">MAD</span>
              </div>
            </div>
            {amountPaid && parseFloat(amountPaid) > 0 && (
              <p className="text-xs text-[#2E8B57] font-semibold pl-1">
                = {Math.floor(parseFloat(amountPaid) / 10)} point{Math.floor(parseFloat(amountPaid) / 10) !== 1 ? "s" : ""} will be awarded
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-500">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="mt-1 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-extrabold text-white shadow-md transition-all duration-150"
            style={{
              background: isValid && !isLoading
                ? "linear-gradient(135deg,#2E8B57,#1F6B40)"
                : undefined,
              backgroundColor: !isValid || isLoading ? "#e5e7eb" : undefined,
              color: !isValid || isLoading ? "#9ca3af" : "white",
              cursor: !isValid || isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading
              ? <><Loader2 size={16} className="animate-spin" /> Awarding points…</>
              : <><Star size={16} fill="currentColor" /> Award Loyalty Points</>
            }
          </button>

          <p className="text-center text-[11px] text-gray-400">
            10 MAD = 1 point · Points are added instantly to the customer's balance
          </p>
        </div>
      </div>
    </div>
  );
}