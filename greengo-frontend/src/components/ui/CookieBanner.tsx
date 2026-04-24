// src/components/ui/CookieBanner.tsx
import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const choice = localStorage.getItem("gg_cookie_consent");
    if (!choice) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem("gg_cookie_consent", "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem("gg_cookie_consent", "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"
      style={{ background: "linear-gradient(135deg, #0d3b36 0%, #0a2318 100%)" }}>
      <p className="text-sm text-white/70 max-w-2xl">
        <span className="font-semibold text-white">🍪 Cookies — </span>
        Nous utilisons des cookies pour améliorer votre expérience.{" "}
        <span className="text-white/50">/ We use cookies to improve your experience.</span>
      </p>
      <div className="flex shrink-0 gap-3">
        <button
          onClick={decline}
          className="rounded-xl border border-white/20 bg-white/5 px-5 py-2 text-sm font-semibold text-white/60 transition-all hover:bg-white/10 hover:text-white">
          Refuser / Decline
        </button>
        <button
          onClick={accept}
          className="rounded-xl px-5 py-2 text-sm font-extrabold text-white shadow-lg transition-all hover:shadow-xl active:scale-95"
          style={{ background: "linear-gradient(135deg, #2E8B57, #1a5c38)" }}>
          Accepter / Accept
        </button>
      </div>
    </div>
  );
}
