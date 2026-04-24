// src/pages/Payment/PaymentGateway.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard, Banknote, ShieldCheck, Lock,
  ChevronDown, CheckCircle2,
  Leaf, ArrowLeft, AlertCircle, Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type PayMethod = "card" | "cash";

interface CardForm {
  number:  string;
  name:    string;
  expiry:  string;
  cvv:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCard(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function fmtExpiry(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length >= 3 ? d.slice(0, 2) + "/" + d.slice(2) : d;
}

// ── CMI / Visa / Mastercard logos (SVG inline) ────────────────────────────────
function VisaLogo() {
  return (
    <svg viewBox="0 0 48 16" className="h-5 w-auto" aria-label="Visa">
      <rect width="48" height="16" rx="3" fill="#1A1F71"/>
      <text x="6" y="12" fill="#F7B600" fontSize="10" fontWeight="bold" fontFamily="Arial">VISA</text>
    </svg>
  );
}

function McardLogo() {
  return (
    <svg viewBox="0 0 38 24" className="h-5 w-auto" aria-label="Mastercard">
      <circle cx="14" cy="12" r="10" fill="#EB001B"/>
      <circle cx="24" cy="12" r="10" fill="#F79E1B"/>
      <path d="M19 5.5a10 10 0 0 1 0 13 10 10 0 0 1 0-13z" fill="#FF5F00"/>
    </svg>
  );
}

function CmiLogo() {
  return (
    <div className="flex h-6 items-center rounded border border-gray-200 bg-white px-2">
      <span className="text-[10px] font-black tracking-tight text-[#0066CC]">CMI</span>
    </div>
  );
}

// ── Order summary (mocked - in production pull from cart store) ───────────────
const MOCK_ITEMS = [
  { name: "طماطم طازجة",  qty: "2 kg",  price: 16.00 },
  { name: "دجاجة كاملة",  qty: "1 pièce", price: 68.00 },
  { name: "موز كاناريا",  qty: "1.5 kg",  price: 22.50 },
];
const SHIPPING = 0;

function OrderSummary() {
  const subtotal = MOCK_ITEMS.reduce((s, i) => s + i.price, 0);
  const total    = subtotal + SHIPPING;
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Récapitulatif</h2>
      <ul className="space-y-3">
        {MOCK_ITEMS.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl">🛒</div>
              <div>
                <p dir="rtl" className="text-sm font-bold text-gray-800 font-arabic">{item.name}</p>
                <p className="text-xs text-gray-400">{item.qty}</p>
              </div>
            </div>
            <p className="shrink-0 text-sm font-extrabold text-gray-800 font-latin">{item.price.toFixed(2)} MAD</p>
          </li>
        ))}
      </ul>
      <div className="border-t border-dashed border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-500">
          <span>Sous-total</span>
          <span className="font-semibold font-latin">{subtotal.toFixed(2)} MAD</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Livraison</span>
          <span className="font-semibold text-[#2E8B57]">Gratuite 🎉</span>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#fdf8ef] to-[#f9efda] px-4 py-3.5">
        <span className="text-base font-bold text-gray-700">Total à payer</span>
        <span className="text-2xl font-extrabold text-gray-900 font-latin">{total.toFixed(2)} <span className="text-sm font-semibold text-gray-400">MAD</span></span>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-[#2E8B57]/20 bg-[#2E8B57]/4 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[#2E8B57] shrink-0" />
          <span className="text-xs font-bold text-[#2E8B57]">Paiement 100% Sécurisé par CMI</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock size={12} className="text-gray-400 shrink-0" />
          <span className="text-[10px] text-gray-400">Cryptage SSL 256-bit · Certifié PCI DSS</span>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <CmiLogo />
          <VisaLogo />
          <McardLogo />
        </div>
      </div>
    </div>
  );
}

// ── Card form ─────────────────────────────────────────────────────────────────
function CardForm({ form, onChange }: { form: CardForm; onChange: (k: keyof CardForm, v: string) => void }) {
  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-600">Numéro de carte *</label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={form.number}
            onChange={(e) => onChange("number", fmtCard(e.target.value))}
            placeholder="0000 0000 0000 0000"
            maxLength={19}
            dir="ltr"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-28 font-mono text-sm text-gray-800 placeholder-gray-300 outline-none transition-all focus:border-[#2E8B57]/50 focus:bg-white focus:ring-2 focus:ring-[#2E8B57]/12"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <VisaLogo />
            <McardLogo />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-600">Nom sur la carte *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value.toUpperCase())}
          placeholder="PRÉNOM NOM"
          dir="ltr"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-300 outline-none transition-all focus:border-[#2E8B57]/50 focus:bg-white focus:ring-2 focus:ring-[#2E8B57]/12"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-600">Date d'expiration *</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.expiry}
            onChange={(e) => onChange("expiry", fmtExpiry(e.target.value))}
            placeholder="MM/AA"
            maxLength={5}
            dir="ltr"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-800 placeholder-gray-300 outline-none transition-all focus:border-[#2E8B57]/50 focus:bg-white focus:ring-2 focus:ring-[#2E8B57]/12"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-600">CVV *</label>
          <input
            type="password"
            inputMode="numeric"
            value={form.cvv}
            onChange={(e) => onChange("cvv", e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="•••"
            maxLength={4}
            dir="ltr"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-800 placeholder-gray-300 outline-none transition-all focus:border-[#2E8B57]/50 focus:bg-white focus:ring-2 focus:ring-[#2E8B57]/12"
          />
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[10px] text-gray-400">
        <Lock size={10} className="shrink-0" />
        Vos données bancaires sont chiffrées et sécurisées par CMI Maroc.
      </p>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#2E8B57]/10 shadow-inner">
        <CheckCircle2 size={48} className="text-[#2E8B57]" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-gray-800">Commande confirmée ! 🎉</h2>
        <p className="mt-2 text-gray-500">Votre paiement a été traité avec succès.</p>
        <p className="mt-1 text-sm text-gray-400">Vous recevrez une confirmation sur WhatsApp dans quelques instants.</p>
      </div>
      <Link to="/"
        className="flex items-center gap-2 rounded-2xl bg-[#2E8B57] px-8 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#2E8B57]/25 transition-all hover:bg-[#1F6B40] hover:shadow-xl active:scale-95">
        <Leaf size={15} />
        Continuer mes achats
      </Link>
    </div>
  );
}

// ── PaymentGateway ────────────────────────────────────────────────────────────
export default function PaymentGateway() {
  const [method,    setMethod]    = useState<PayMethod>("card");
  const [card,      setCard]      = useState<CardForm>({ number: "", name: "", expiry: "", cvv: "" });
  const [submitting,setSubmitting]= useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  function handleCard(k: keyof CardForm, v: string) { setCard((p) => ({ ...p, [k]: v })); }

  const cardValid = card.number.replace(/\s/g,"").length === 16 && card.name.trim().length > 1 && card.expiry.length === 5 && card.cvv.length >= 3;
  const canSubmit = method === "cash" || cardValid;

  async function handlePay() {
    if (!canSubmit) return;
    setSubmitting(true); setError("");
    await new Promise((r) => setTimeout(r, 1800)); // mock latency
    setSubmitting(false);
    setDone(true);
  }

  return (
    <div className="min-h-screen" style={{ background: "#F6F7F9" }}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">

        {/* Back link */}
        <Link to="/cart" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-800">
          <ArrowLeft size={15} />
          Retour au panier
        </Link>

        {done ? <SuccessScreen /> : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">

            {/* ── Left - payment methods ── */}
            <div className="lg:col-span-3 space-y-4">
              <h1 className="text-2xl font-extrabold text-gray-800" style={{ letterSpacing: "-0.02em" }}>
                Paiement sécurisé
              </h1>
              <p className="text-sm text-gray-400">Choisissez votre mode de paiement préféré.</p>

              {/* Card option */}
              <div
                onClick={() => setMethod("card")}
                className={"cursor-pointer overflow-hidden rounded-3xl border-2 bg-white shadow-sm transition-all duration-200 " + (method === "card" ? "border-[#2E8B57] shadow-[#2E8B57]/10" : "border-gray-200 hover:border-gray-300")}>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={"flex h-10 w-10 items-center justify-center rounded-xl transition-colors " + (method === "card" ? "bg-[#2E8B57] text-white" : "bg-gray-100 text-gray-500")}>
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-gray-800">Carte Bancaire</p>
                      <p className="text-xs text-gray-400">CMI · Visa · Mastercard</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CmiLogo />
                    <VisaLogo />
                    <McardLogo />
                    <ChevronDown size={16} className={"ml-2 text-gray-400 transition-transform duration-200 " + (method === "card" ? "rotate-180 text-[#2E8B57]" : "")} />
                  </div>
                </div>
                {method === "card" && (
                  <div className="border-t border-gray-100 px-5 pb-5">
                    <CardForm form={card} onChange={handleCard} />
                  </div>
                )}
              </div>

              {/* Cash option */}
              <div
                onClick={() => setMethod("cash")}
                className={"cursor-pointer rounded-3xl border-2 bg-white shadow-sm transition-all duration-200 " + (method === "cash" ? "border-[#2E8B57] shadow-[#2E8B57]/10" : "border-gray-200 hover:border-gray-300")}>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={"flex h-10 w-10 items-center justify-center rounded-xl transition-colors " + (method === "cash" ? "bg-[#2E8B57] text-white" : "bg-gray-100 text-gray-500")}>
                      <Banknote size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-gray-800">Paiement à la livraison</p>
                      <p className="text-xs text-gray-400">Espèces remises au livreur</p>
                    </div>
                  </div>
                  {method === "cash" && <CheckCircle2 size={22} className="text-[#2E8B57]" />}
                </div>
                {method === "cash" && (
                  <div className="border-t border-gray-100 px-5 pb-4">
                    <div className="mt-3 flex items-start gap-3 rounded-2xl bg-[#2E8B57]/6 border border-[#2E8B57]/15 px-4 py-3">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#2E8B57]" />
                      <div>
                        <p className="text-sm font-bold text-[#2E8B57]">Aucun paiement en ligne requis</p>
                        <p className="text-xs text-gray-500 mt-0.5">Préparez le montant exact. Notre livreur ne rend pas toujours la monnaie.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-500">
                  <AlertCircle size={15} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handlePay}
                disabled={!canSubmit || submitting}
                className={"flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-extrabold text-white shadow-lg transition-all " + (canSubmit && !submitting ? "bg-[#2E8B57] shadow-[#2E8B57]/20 hover:bg-[#1F6B40] hover:shadow-xl active:scale-[0.98]" : "cursor-not-allowed bg-gray-200 text-gray-400")}>
                {submitting
                  ? <><Loader2 size={18} className="animate-spin" /> Traitement en cours…</>
                  : method === "card"
                  ? <><Lock size={16} /> Payer maintenant · {(MOCK_ITEMS.reduce((s,i)=>s+i.price,0)).toFixed(2)} MAD</>
                  : <><CheckCircle2 size={16} /> Confirmer la commande · COD</>}
              </button>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
                {[
                  { icon: ShieldCheck, text: "100% Sécurisé" },
                  { icon: Lock,        text: "SSL 256-bit"   },
                  { icon: CreditCard,  text: "PCI DSS"       },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Icon size={12} className="text-[#2E8B57]" />
                    {text}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right - order summary ── */}
            <div className="lg:col-span-2">
              <OrderSummary />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

