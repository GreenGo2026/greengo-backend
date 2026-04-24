// src/components/layout/Footer.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Leaf, Mail, MapPin, Phone, Send, CheckCircle,
  MessageCircle, ChevronRight, Heart,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";

// ── Contact constants ─────────────────────────────────────────────────────────
const WA_SUPPORT  = "https://wa.me/212664397031";
const WA_ORDERS   = "https://wa.me/212664500789";
const EMAIL       = "CONTACT@MYGRENGO.COM";
const PHONE_LABEL = "+212 664-500-789";
const PHONE_HREF  = "tel:+212664500789";
const REL         = "noopener noreferrer";

// ── Social links ──────────────────────────────────────────────────────────────
const SOCIALS = [
  {
    name: "YouTube",
    href: "https://www.youtube.com/channel/UC4HWgWncCpyCBP7peiR-2Dg",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/>
      </svg>
    ),
    hoverColor: "hover:text-red-500",
    hoverBg:    "hover:bg-red-500/10 hover:border-red-500/30",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@greengofficiel?lang=en",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.84 4.84 0 0 1-1.01-.07z"/>
      </svg>
    ),
    hoverColor: "hover:text-white",
    hoverBg:    "hover:bg-white/15 hover:border-white/30",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/greengoofficiel/?hl=fr",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
      </svg>
    ),
    hoverColor: "hover:text-pink-400",
    hoverBg:    "hover:bg-pink-500/10 hover:border-pink-500/30",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/people/GreenGo-Market/61570769673419/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.931-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.093 24 18.1 24 12.073z"/>
      </svg>
    ),
    hoverColor: "hover:text-blue-400",
    hoverBg:    "hover:bg-blue-500/10 hover:border-blue-500/30",
  },
];

// ── Column link helper ────────────────────────────────────────────────────────
function ColLink({ href, children, external = false }: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const cls = "group flex items-center gap-2 text-sm text-white/50 transition-all duration-200 hover:text-white hover:translate-x-0.5";
  if (external) {
    return (
      <a href={href} target="_blank" rel={REL} className={cls}>
        <ChevronRight size={11} className="shrink-0 text-[#2E8B57]/60 transition-transform group-hover:translate-x-0.5" />
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={cls}>
      <ChevronRight size={11} className="shrink-0 text-[#2E8B57]/60 transition-transform group-hover:translate-x-0.5" />
      {children}
    </Link>
  );
}

// ── Newsletter ────────────────────────────────────────────────────────────────
function Newsletter() {
  const { t, language, isRTL } = useLanguage();
  const font = language === "ar" ? "font-arabic" : "font-latin";
  const [email,     setEmail]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 900);
  }

  if (submitted) {
    return (
      <div className={"flex items-start gap-3 rounded-2xl bg-[#2E8B57]/10 p-4 border border-[#2E8B57]/20 " + (isRTL ? "flex-row-reverse" : "")}>
        <CheckCircle size={18} className="mt-0.5 shrink-0 text-[#2E8B57]" />
        <div className={isRTL ? "text-right" : ""}>
          <p className={"text-sm font-bold text-white " + font}>{t("newsletter_success")}</p>
          <p className={"mt-0.5 text-xs text-white/45 " + font}>{t("newsletter_success_sub")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className={"text-sm leading-relaxed text-white/50 " + font}>
        {language === "ar"
          ? "اشترك واحصل على 10% خصم وآخر العروض الأسبوعية."
          : language === "fr"
          ? "Abonnez-vous et recevez 10% de réduction + les offres hebdomadaires."
          : "Subscribe for 10% off your first order + weekly fresh deals."}
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com" dir="ltr" required
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-white/25 outline-none transition-all focus:border-[#2E8B57]/60 focus:bg-white/8 focus:ring-2 focus:ring-[#2E8B57]/15 font-latin"
        />
        <button type="submit" disabled={loading}
          className="flex shrink-0 items-center justify-center rounded-xl bg-[#2E8B57] px-4 py-2.5 text-white transition-all hover:bg-[#1F6B40] hover:shadow-lg hover:shadow-[#2E8B57]/20 disabled:opacity-50 active:scale-95">
          {loading
            ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            : <Send size={13} />
          }
        </button>
      </form>
      <p className={"text-[10px] text-white/20 " + font}>{t("newsletter_trust")}</p>
    </div>
  );
}

// ── Main Footer ───────────────────────────────────────────────────────────────
export default function Footer() {
  const { t, dir, language, isRTL } = useLanguage();
  const font  = language === "ar" ? "font-arabic" : "font-latin";
  const align = isRTL ? "text-right" : "text-left";
  const row   = isRTL ? "flex-row-reverse" : "";
  const year  = new Date().getFullYear();

  const headingCls = "mb-5 text-[10px] font-black uppercase tracking-[0.18em] text-white/35";

  return (
    <footer className={"w-full " + font} style={{ background: "#0b1120" }}>

      {/* Zellige accent top border */}
      <div className="zellige-border" />

      {/* ── Main grid ── */}
      <div className="mx-auto max-w-7xl px-5 py-14 md:py-16">
        <div dir={dir} className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">

          {/* ── Brand column (wider) ──────────────────────── lg:col-span-3 */}
          <div className={"space-y-5 lg:col-span-3 " + align}>

            {/* Logo — updated to use /greengo-logo.png */}
            <Link to="/" className="inline-flex items-center gap-2.5 no-underline group">
              <img
                src="/greengo-logo.png"
                alt="GreenGo Market"
                className="h-10 w-auto object-contain"
                style={{ maxWidth: 180 }}
                onError={(e) => {
                  const t = e.currentTarget;
                  t.style.display = "none";
                  const fallback = t.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              {/* Fallback: shown only if image fails to load */}
              <div className="hidden items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2E8B57] shadow-lg shadow-[#2E8B57]/25 transition-transform duration-200 group-hover:scale-105">
                  <Leaf size={20} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="leading-none">
                  <span className="block text-xl font-extrabold tracking-tight font-latin"
                    style={{ background: "linear-gradient(90deg,#4ade80 0%,#2E8B57 55%,#16a34a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    GreenGo
                  </span>
                  <span className={"block text-[9px] font-bold uppercase tracking-widest text-[#FF9800]/60 " + font}>
                    {language === "ar" ? "سوق طازج" : language === "fr" ? "Marché Frais" : "Fresh Market"}
                  </span>
                </div>
              </div>
            </Link>

            {/* Tagline */}
            <p className={"text-sm leading-relaxed text-white/50 max-w-xs " + (isRTL ? "mr-0 ml-auto md:ml-0" : "")}>
              {language === "ar"
                ? "بقالتك الإلكترونية الأولى في المغرب — خضرة وفواكه ودجاج طازج، نوصلها لباب الدار."
                : language === "fr"
                ? "L'épicerie en ligne N°1 au Maroc — légumes, fruits et poulet frais livrés à domicile."
                : "Morocco's #1 online grocery — fresh produce & poultry delivered to your door in Salé."}
            </p>

            {/* Address */}
            <div className={"flex items-start gap-2.5 " + row}>
              <MapPin size={13} className="mt-0.5 shrink-0 text-[#2E8B57]" />
              <div>
                <p className="text-xs font-semibold text-white/60 font-latin leading-snug">
                  Lot N° 145 Lotissement EL MOUSTAKBAL
                </p>
                <p className="text-xs text-white/38 font-latin">Laayayda, Salé — Maroc</p>
                <p className="mt-1 text-[11px] font-medium text-white/45 font-arabic" dir="rtl">
                  تجزئة المستقبل، لعيايدة، سلا
                </p>
              </div>
            </div>

            {/* Social icons */}
            <div>
              <p className={"mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25 " + font}>
                {language === "ar" ? "تابعنا" : "Suivez-nous"}
              </p>
              <div className={"flex items-center gap-2 " + (isRTL ? "flex-row-reverse" : "")}>
                {SOCIALS.map((s) => (
                  <a key={s.name} href={s.href} target="_blank" rel={REL}
                    title={s.name}
                    className={"flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition-all duration-200 " + s.hoverColor + " " + s.hoverBg}>
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* ── Legal column ──────────────────────────────── lg:col-span-2 */}
          <div className={"lg:col-span-2 " + align}>
            <p className={headingCls + " " + font}>
              {language === "ar" ? "قانوني" : "Légal"}
            </p>
            <ul className="space-y-2.5">
              {[
                { to: "/legal/cgu",     fr: "CGU & CGV",              ar: "شروط الاستخدام" },
                { to: "/legal/privacy", fr: "Politique de confidentialité", ar: "سياسة الخصوصية" },
                { to: "/legal/terms",   fr: "Conditions Générales",   ar: "الشروط العامة" },
                { to: "/legal/info",    fr: "Informations légales",   ar: "معلومات قانونية" },
              ].map((item) => (
                <li key={item.to}>
                  <ColLink href={item.to}>
                    <span className={font}>{language === "ar" ? item.ar : item.fr}</span>
                  </ColLink>
                </li>
              ))}
            </ul>
          </div>

          {/* ── About column ──────────────────────────────── lg:col-span-2 */}
          <div className={"lg:col-span-2 " + align}>
            <p className={headingCls + " " + font}>
              {language === "ar" ? "عن GreenGo" : "À propos"}
            </p>
            <ul className="space-y-2.5">
              {[
                { to: "/about",         fr: "Engagements GreenGo",    ar: "التزامات GreenGo" },
                { to: "/fidelite",      fr: "Programme Fidélité",     ar: "برنامج الولاء" },
                { to: "/about#story",   fr: "À propos de nous",       ar: "من نحن" },
                { to: "/recrutement",   fr: "Recrutement",            ar: "التوظيف" },
              ].map((item) => (
                <li key={item.to}>
                  <ColLink href={item.to}>
                    <span className={font}>{language === "ar" ? item.ar : item.fr}</span>
                  </ColLink>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Support column ────────────────────────────── lg:col-span-3 */}
          <div className={"lg:col-span-3 " + align}>
            <p className={headingCls + " " + font}>
              {language === "ar" ? "الدعم" : "Support"}
            </p>
            <ul className="space-y-3">

              {/* Customer Support WhatsApp */}
              <li>
                <a href={WA_SUPPORT} target="_blank" rel={REL}
                  className={"group flex items-start gap-3 rounded-xl border border-[#2E8B57]/15 bg-[#2E8B57]/6 p-3 transition-all hover:border-[#2E8B57]/35 hover:bg-[#2E8B57]/12 " + (isRTL ? "flex-row-reverse text-right" : "")}>
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2E8B57]/20">
                    <MessageCircle size={13} className="text-[#4DB882]" />
                  </div>
                  <div>
                    <p className={"text-xs font-bold text-white/80 " + font}>
                      {language === "ar" ? "دعم العملاء" : "Support client"}
                    </p>
                    <p className="text-[11px] text-white/40 font-latin">WhatsApp 0664397031</p>
                  </div>
                </a>
              </li>

              {/* Orders WhatsApp */}
              <li>
                <a href={WA_ORDERS} target="_blank" rel={REL}
                  className={"group flex items-start gap-3 rounded-xl border border-white/8 bg-white/4 p-3 transition-all hover:border-[#2E8B57]/25 hover:bg-[#2E8B57]/8 " + (isRTL ? "flex-row-reverse text-right" : "")}>
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/8">
                    <MessageCircle size={13} className="text-white/50" />
                  </div>
                  <div>
                    <p className={"text-xs font-bold text-white/65 " + font}>
                      {language === "ar" ? "طلبات الشراء" : "Commandes"}
                    </p>
                    <p className="text-[11px] text-white/40 font-latin">WhatsApp 0664500789</p>
                  </div>
                </a>
              </li>

              {/* Phone */}
              <li>
                <a href={PHONE_HREF}
                  className={"flex items-center gap-2.5 text-sm text-white/50 transition-colors hover:text-white " + row}>
                  <Phone size={12} className="shrink-0 text-[#2E8B57]" />
                  <span className="font-latin">{PHONE_LABEL}</span>
                </a>
              </li>

              {/* Email */}
              <li>
                <a href={"mailto:" + EMAIL}
                  className={"flex items-center gap-2.5 text-sm text-white/50 transition-colors hover:text-white " + row}>
                  <Mail size={12} className="shrink-0 text-[#2E8B57]" />
                  <span className="font-latin">{EMAIL}</span>
                </a>
              </li>

            </ul>
          </div>

          {/* ── Newsletter column ─────────────────────────── lg:col-span-2 */}
          <div className={"lg:col-span-2 " + align}>
            <p className={headingCls + " " + font}>
              {language === "ar" ? "النشرة البريدية" : "Newsletter"}
            </p>
            <Newsletter />

            {/* Payment badges */}
            <div className={"mt-5 flex flex-wrap gap-1.5 " + (isRTL ? "justify-end" : "")}>
              {["Visa", "CMI", "Cash", "CB"].map((b) => (
                <span key={b}
                  className="rounded-md border border-white/10 bg-white/4 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/25">
                  {b}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Delivery banner ── */}
      <div style={{ background: "linear-gradient(90deg,#0d3b36 0%,#1a5c4a 50%,#0d3b36 100%)" }}>
        <div dir={dir} className={"mx-auto flex max-w-7xl items-center justify-center gap-3 px-5 py-3 text-center " + font}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4DB882]" />
          <p className={"text-xs font-bold text-white/70 " + font}>
            {language === "ar"
              ? "توصيل سريع ومضمون لسلا 🛵 — اطلب الآن وتسلم اليوم!"
              : language === "fr"
              ? "Livraison rapide et garantie à Salé 🛵 — Commandez maintenant, livré aujourd'hui !"
              : "Fast & guaranteed delivery in Salé 🛵 — Order now, delivered today!"}
          </p>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4DB882]" style={{ animationDelay: "0.5s" }} />
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#080e19" }}>
        <div dir={dir}
          className={"mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-4 md:flex-row " + font}>

          <p className="text-xs text-white/25">
            © {year} {t("footer_copyright")}
          </p>

          {/* Inline legal links */}
          <div className={"flex flex-wrap items-center justify-center gap-4 text-[11px] text-white/25 " + row}>
            {[
              { href: "/legal/cgu",     fr: "CGU",              ar: "الشروط" },
              { href: "/legal/privacy", fr: "Confidentialité",  ar: "الخصوصية" },
              { href: "/legal/cookies", fr: "Cookies",          ar: "الكوكيز" },
            ].map((item) => (
              <Link key={item.href} to={item.href}
                className="transition-colors hover:text-white/60">
                {language === "ar" ? item.ar : item.fr}
              </Link>
            ))}
          </div>

          {/* Made with love */}
          <div className={"flex items-center gap-1.5 " + row}>
            <span className="text-[11px] text-white/20">{t("footer_made_in")}</span>
            <Heart size={10} className="text-[#C0614A]/50 fill-[#C0614A]/30" />
          </div>

        </div>
      </div>

    </footer>
  );
}