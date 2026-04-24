// src/components/ui/NewsletterModal.tsx
import { useEffect, useRef, useState } from "react";
import { X, Leaf, Mail, CheckCircle, Loader2, Shield } from "lucide-react";

// ── Config ────────────────────────────────────────────────────────────────────
const STORAGE_KEY   = "greengo_newsletter_v1";
const SHOW_DELAY_MS = 3500;

// ── Zellige SVG tile ──────────────────────────────────────────────────────────
const ZELLIGE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><g fill='none' stroke='%232E8B57' stroke-width='0.8' opacity='0.35'><polygon points='30,4 37,17 52,17 41,26 45,41 30,33 15,41 19,26 8,17 23,17'/><line x1='30' y1='4' x2='30' y2='56'/><line x1='4' y1='30' x2='56' y2='30'/><line x1='8' y1='8' x2='52' y2='52'/><line x1='52' y1='8' x2='8' y2='52'/></g></svg>`;
const ZELLIGE_BG    = `url("data:image/svg+xml,${encodeURIComponent(ZELLIGE_SVG)}")`;

// ── Simulated subscribe — replace with real API call ─────────────────────────
async function subscribeEmail(email: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (email.includes("error")) throw new Error("Simulated error");
}

// ── Component ─────────────────────────────────────────────────────────────────
function NewsletterModal() {
  const [visible,      setVisible]      = useState(false);
  const [email,        setEmail]        = useState("");
  const [status,       setStatus]       = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg,     setErrorMsg]     = useState("");
  const [honeypot,     setHoneypot]     = useState("");
  const openTimestamp                   = useRef<number>(0);

  // ── Show once per visitor ───────────────────────────────────────────────────
  useEffect(() => {
    const alreadySeen = localStorage.getItem(STORAGE_KEY);
    if (alreadySeen) return;

    const timer = setTimeout(() => {
      setVisible(true);
      openTimestamp.current = Date.now();
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  function handleClose() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) handleClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    // Anti-bot: honeypot must be empty
    if (honeypot.trim().length > 0) {
      setStatus("success");
      return;
    }

    // Anti-bot: form filled too quickly
    const elapsed = Date.now() - openTimestamp.current;
    if (elapsed < 800) {
      setStatus("success");
      return;
    }

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    try {
      await subscribeEmail(trimmed);
      setStatus("success");
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="newsletter-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">

        {/* Zellige texture strip */}
        <div
          className="relative h-36 w-full overflow-hidden"
          style={{
            background:          "#f0faf4",
            backgroundImage:     ZELLIGE_BG,
            backgroundSize:      "60px 60px",
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2E8B57] shadow-lg shadow-[#2E8B57]/30">
              <Leaf size={32} className="text-white" strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close newsletter modal"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-gray-800"
        >
          <X size={16} />
        </button>

        {/* Body */}
        <div className="px-6 pb-8 pt-2 text-center space-y-4">

          {status === "success" ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f0faf4]">
                <CheckCircle size={36} className="text-[#2E8B57]" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-800">
                  شكراً! أنت الآن من عائلتنا 🌿
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Check your inbox for your exclusive welcome offer.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-xl bg-[#2E8B57] px-8 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-[#1F6B40] active:scale-95"
              >
                Start Shopping 🛒
              </button>
            </div>

          ) : (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#FF9800]">
                  Exclusive Offer
                </p>
                <h2
                  id="newsletter-title"
                  className="mt-1 text-2xl font-extrabold leading-tight text-gray-800"
                >
                  Get 10% Off + Free Delivery 🛵
                </h2>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  Join the GreenGo community and be the first to know about
                  fresh arrivals, seasonal deals, and Salé-exclusive offers.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap">
                {["10% off your first order", "Free delivery in Salé", "Weekly fresh picks"].map((perk) => (
                  <span
                    key={perk}
                    className="rounded-full bg-[#f0faf4] px-3 py-1 text-[11px] font-semibold text-[#2E8B57]"
                  >
                    ✓ {perk}
                  </span>
                ))}
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-3">

                {/* Honeypot — visually hidden, filled only by bots */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left:     "-9999px",
                    width:    "1px",
                    height:   "1px",
                    overflow: "hidden",
                    opacity:  0,
                  } as React.CSSProperties}
                >
                  <label htmlFor="greengo_confirm">Leave this field empty</label>
                  <input
                    id="greengo_confirm"
                    name="greengo_confirm"
                    type="text"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    autoComplete="off"
                    tabIndex={-1}
                  />
                </div>

                {/* Email input */}
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrorMsg(""); }}
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                    className={[
                      "w-full rounded-xl border py-3 pl-10 pr-4 text-sm text-gray-800",
                      "placeholder-gray-300 outline-none transition-colors",
                      errorMsg
                        ? "border-red-400 bg-red-50 focus:border-red-400"
                        : "border-gray-200 bg-gray-50 focus:border-[#2E8B57] focus:bg-white",
                    ].join(" ")}
                  />
                </div>

                {errorMsg && (
                  <p className="text-left text-xs font-semibold text-red-500">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className={[
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3.5",
                    "text-sm font-extrabold text-white transition-all duration-150",
                    status === "loading"
                      ? "cursor-not-allowed bg-[#2E8B57]/70"
                      : "bg-[#2E8B57] shadow-lg shadow-[#2E8B57]/25 hover:bg-[#1F6B40] hover:shadow-xl active:scale-95",
                  ].join(" ")}
                >
                  {status === "loading" ? (
                    <><Loader2 size={16} className="animate-spin" />Subscribing…</>
                  ) : (
                    <>Claim My 10% Off 🎁</>
                  )}
                </button>

              </form>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
                <Shield size={11} />
                <span>No spam. Unsubscribe anytime. Your data stays private.</span>
              </div>

              <button
                onClick={handleClose}
                className="text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline transition-colors"
              >
                No thanks, I'll pay full price
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewsletterModal;