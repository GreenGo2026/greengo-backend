// src/components/layout/Header.tsx
import { useState, useRef, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  ShoppingCart, Menu, X, MessageCircle,
  User, Package, MapPin, ChevronDown, Headphones,
} from "lucide-react";
import { useCartStore } from "../../store/cartStore";
import { useLanguage } from "../../contexts/LanguageContext";
import type { SupportedLanguage } from "../../utils/translations";

// ── Constants ────────────────────────────────────────────────────────────────
const WA_SUPPORT = "https://wa.me/212664397031";
const WA_ORDERS  = "https://wa.me/212664500789";
const REL        = "noopener noreferrer";

const LANGS: { code: SupportedLanguage; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

// ── Logo — guaranteed visible, never collapses ────────────────────────────────
function HeaderLogo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: 40,
          width: 150,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        <span style={{
          fontSize: 17,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          background: "linear-gradient(90deg,#4ade80 0%,#2E8B57 55%,#16a34a 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          fontFamily: "Poppins,sans-serif",
        }}>
          GreenGo
        </span>
        <span style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase" as const,
          color: "rgba(255,152,0,0.7)",
          fontFamily: "Poppins,sans-serif",
          marginTop: 1,
        }}>
          Fresh Market
        </span>
      </div>
    );
  }

  return (
    <div style={{ width: 150, height: 40, flexShrink: 0, display: "block" }}>
      <img
        src="/greengo-logo-header.png"
        alt="GreenGo Market"
        width={150}
        height={40}
        onError={() => setFailed(true)}
        style={{
          width: 150,
          height: 40,
          objectFit: "contain",
          objectPosition: "left center",
          display: "block",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// ── NavLink class helpers ─────────────────────────────────────────────────────
function desktopNavCls({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "rounded-lg px-4 py-2 text-sm font-semibold text-[#FF9800] transition-all"
    : "rounded-lg px-4 py-2 text-sm font-semibold text-white/65 transition-all hover:bg-white/8 hover:text-white";
}

function mobileNavCls({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "flex items-center rounded-xl px-4 py-3 text-sm font-semibold bg-white/10 text-white"
    : "flex items-center rounded-xl px-4 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white";
}

function dropCls(on: boolean): string {
  return on
    ? "flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-bold bg-[#2E8B57]/15 text-[#4DB882] transition-colors"
    : "flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/6 hover:text-white";
}

function pillCls(on: boolean): string {
  return on
    ? "flex-1 rounded-xl py-2.5 text-xs font-extrabold bg-[#2E8B57] text-white shadow-sm transition-colors text-center"
    : "flex-1 rounded-xl py-2.5 text-xs font-extrabold bg-white/5 text-white/55 transition-colors hover:bg-white/10 hover:text-white text-center";
}

// ── Account dropdown items ────────────────────────────────────────────────────
interface AccountItem {
  icon:      React.ElementType;
  href:      string;
  label_fr:  string;
  label_ar:  string;
  label_en:  string;
  external?: boolean;
  divider?:  boolean;
}

const ACCOUNT_ITEMS: AccountItem[] = [
  { icon: User,       href: "/profile/user", label_fr: "Mon profil",        label_ar: "ملفي الشخصي",     label_en: "My Profile"                    },
  { icon: Package,    href: "/orders",        label_fr: "Mes commandes",     label_ar: "طلبياتي",         label_en: "My Orders"                     },
  { icon: MapPin,     href: "/addresses",     label_fr: "Mes adresses",      label_ar: "عناويني",         label_en: "My Addresses",  divider: true   },
  { icon: Headphones, href: WA_SUPPORT,       label_fr: "Support client",    label_ar: "دعم العملاء",     label_en: "Customer Support", external: true },
];

function itemLabel(item: AccountItem, language: string): string {
  if (language === "ar") return item.label_ar;
  if (language === "fr") return item.label_fr;
  return item.label_en;
}

// ── Account Dropdown ──────────────────────────────────────────────────────────
function AccountDropdown({ language, isRTL, onClose }: {
  language: string;
  isRTL:    boolean;
  onClose:  () => void;
}) {
  const font        = language === "ar" ? "font-arabic" : "font-latin";
  const headerLabel = language === "ar" ? "حسابي" : language === "fr" ? "Mon compte" : "My Account";

  return (
    <div
      className={"absolute top-full mt-2.5 w-56 overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 " + (isRTL ? "left-0" : "right-0")}
      style={{ background: "linear-gradient(160deg,#0d2e28 0%,#091c26 100%)" }}>

      <div className="border-b border-white/8 px-4 py-3">
        <div className={"flex items-center gap-2.5 " + (isRTL ? "flex-row-reverse" : "")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#2E8B57]/20">
            <User size={14} className="text-[#4DB882]" />
          </div>
          <div className={isRTL ? "text-right" : ""}>
            <p className={"text-xs font-extrabold text-white " + font}>{headerLabel}</p>
            <p className={"text-[10px] text-white/35 " + font}>GreenGo Market</p>
          </div>
        </div>
      </div>

      <div className="py-1.5">
        {ACCOUNT_ITEMS.map((item) => {
          const Icon  = item.icon;
          const label = itemLabel(item, language);
          const cls   = "group flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-white/60 transition-all hover:bg-white/6 hover:text-white " + (isRTL ? "flex-row-reverse text-right" : "") + " " + font;

          return (
            <div key={item.href}>
              {item.divider && <div className="my-1.5 border-t border-white/8" />}
              {item.external ? (
                <a href={item.href} target="_blank" rel={REL} onClick={onClose} className={cls}>
                  <Icon size={14} className={"shrink-0 text-[#2E8B57] transition-colors group-hover:text-[#4DB882] " + (isRTL ? "order-last" : "")} />
                  <span className="flex-1">{label}</span>
                  {item.href.includes("wa.me") && (
                    <span className="rounded-full bg-[#2E8B57]/20 px-1.5 py-0.5 text-[9px] font-black text-[#4DB882]">WA</span>
                  )}
                </a>
              ) : (
                <Link to={item.href} onClick={onClose} className={cls}>
                  <Icon size={14} className={"shrink-0 text-[#2E8B57] transition-colors group-hover:text-[#4DB882] " + (isRTL ? "order-last" : "")} />
                  <span className="flex-1">{label}</span>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/8 p-3">
        <a href={WA_ORDERS} target="_blank" rel={REL} onClick={onClose}
          className={"flex items-center justify-center gap-2 rounded-xl bg-[#2E8B57]/15 border border-[#2E8B57]/25 px-3 py-2.5 text-xs font-bold text-[#4DB882] transition-all hover:bg-[#2E8B57]/25 " + font}>
          <MessageCircle size={12} />
          {language === "ar" ? "اطلب عبر واتساب" : language === "fr" ? "Commander via WhatsApp" : "Order via WhatsApp"}
        </a>
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
export default function Header() {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const cart       = useCartStore((s) => s.cart);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const totalItems = cart.reduce((n, i) => n + (i.cartQuantity || 0), 0);

  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [langOpen,    setLangOpen]    = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);
  const langRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
      if (langRef.current    && !langRef.current.contains(e.target as Node))    setLangOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setLangOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const dir      = isRTL ? "rtl" : "ltr";
  const font     = language === "ar" ? "font-arabic" : "font-latin";
  const hasItems = totalItems > 0;
  const badge    = totalItems > 99 ? "99+" : String(totalItems);

  const acctLabel =
    language === "ar" ? "حسابي"      :
    language === "fr" ? "Mon compte" :
    "My Account";

  const navLinks = [
    { to: "/shop",    label: language === "ar" ? "الكتالوج" : language === "fr" ? "Catalogue" : "Catalog" },
    { to: "/about",   label: language === "ar" ? "عنا"      : language === "fr" ? "À propos"  : "About"   },
    { to: "/contact", label: t("nav_contact") },
  ];

  const mobileAccountLabel =
    language === "ar" ? "حسابي"      :
    language === "fr" ? "Mon compte" :
    "My Account";

  function closeAll()     { setMobileOpen(false); setLangOpen(false); setAccountOpen(false); }
  function toggleMobile() { setMobileOpen((p) => !p); setLangOpen(false); setAccountOpen(false); }
  function toggleLang()   { setLangOpen((p) => !p); setAccountOpen(false); }
  function toggleAccount(){ setAccountOpen((p) => !p); setLangOpen(false); }
  function pickLang(code: SupportedLanguage)       { setLanguage(code); setLangOpen(false); }
  function pickMobileLang(code: SupportedLanguage) { setLanguage(code); closeAll(); }

  return (
    <header
      className={"sticky top-0 z-50 w-full " + font}
      style={{ background: "linear-gradient(180deg,#0d3b36 0%,#0a2e28 100%)" }}
    >
      {/* ── Top utility bar ── */}
      <div className="hidden border-b border-white/5 md:block" style={{ background: "rgba(0,0,0,0.2)" }}>
        <div dir={dir} className="mx-auto flex max-w-7xl items-center justify-between px-5 py-1.5">
          <p className={"text-[10px] text-white/30 " + font}>
            {language === "ar"
              ? "توصيل سريع لسلا | واتساب: 0664500789"
              : language === "fr"
              ? "Livraison rapide à Salé | WhatsApp: 0664500789"
              : "Fast delivery in Salé | WhatsApp: 0664500789"}
          </p>
          <div className={"flex items-center gap-4 " + (isRTL ? "flex-row-reverse" : "")}>
            <a href={WA_SUPPORT} target="_blank" rel={REL}
              className={"flex items-center gap-1 text-[10px] text-white/30 transition-colors hover:text-white/70 " + font}>
              <Headphones size={10} />
              {language === "ar" ? "دعم العملاء" : language === "fr" ? "Support client" : "Customer support"}
            </a>
            <Link to="/orders"
              className={"text-[10px] text-white/30 transition-colors hover:text-white/70 " + font}>
              {language === "ar" ? "طلبياتي" : language === "fr" ? "Mes commandes" : "My orders"}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main bar ── */}
      <div dir={dir} className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:py-3.5">

        {/* Brand logo — guaranteed visible */}
        <Link
          to="/"
          onClick={closeAll}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", textDecoration: "none" }}
        >
          <HeaderLogo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === "/"} className={desktopNavCls}>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right cluster */}
        <div className={"flex items-center gap-2 " + (isRTL ? "flex-row-reverse" : "")}>

          {/* Lang picker — desktop */}
          <div ref={langRef} className="relative hidden md:block">
            <button onClick={toggleLang}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white">
              <span>{language.toUpperCase()}</span>
              <ChevronDown size={11} className={"transition-transform duration-200 " + (langOpen ? "rotate-180" : "")} />
            </button>
            {langOpen && (
              <div
                className={"absolute top-full mt-2 w-40 overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 " + (isRTL ? "left-0" : "right-0")}
                style={{ background: "linear-gradient(160deg,#0d2e28 0%,#091c26 100%)" }}>
                {LANGS.map(({ code, label }) => (
                  <button key={code} onClick={() => pickLang(code)} className={dropCls(language === code)}>
                    <span className={"font-arabic " + (language === code ? "text-[#4DB882]" : "")}>{label}</span>
                    {language === code && <span className="ml-auto text-[10px] text-[#4DB882]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* WhatsApp — desktop */}
          <a href={WA_ORDERS} target="_blank" rel={REL}
            className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 transition-all hover:bg-white/10 hover:text-white md:flex">
            <MessageCircle size={13} />
            <span className={font}>{t("nav_whatsapp")}</span>
          </a>

          {/* My Account dropdown — desktop */}
          <div ref={accountRef} className="relative hidden md:block">
            <button onClick={toggleAccount}
              className={"flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white " + (isRTL ? "flex-row-reverse" : "")}>
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2E8B57]/30">
                <User size={11} className="text-[#4DB882]" />
              </div>
              <span className={font}>{acctLabel}</span>
              <ChevronDown size={11} className={"transition-transform duration-200 " + (accountOpen ? "rotate-180" : "")} />
            </button>
            {accountOpen && (
              <AccountDropdown
                language={language}
                isRTL={isRTL}
                onClose={() => setAccountOpen(false)}
              />
            )}
          </div>

          {/* Cart button */}
          <Link to="/cart" aria-label={t("nav_cart")}
            className="relative flex items-center gap-2 rounded-xl bg-[#2E8B57] px-3.5 py-2 text-sm font-bold text-white shadow-lg shadow-[#2E8B57]/25 transition-all hover:bg-[#1F6B40] hover:shadow-xl active:scale-95">
            <ShoppingCart size={18} strokeWidth={2} />
            {hasItems && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#FF9800] px-1 text-[10px] font-extrabold text-white shadow-md">
                {badge}
              </span>
            )}
            {hasItems && (
              <span className="hidden text-sm font-semibold md:inline">
                {totalPrice().toFixed(2)} MAD
              </span>
            )}
          </Link>

          {/* Hamburger */}
          <button onClick={toggleMobile} aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 lg:hidden">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

        </div>
      </div>

      {/* Zellige accent */}
      <div className="zellige-border" />

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div dir={dir} className={"border-t border-white/8 lg:hidden " + font}
          style={{ background: "linear-gradient(180deg,#0a2820 0%,#071a14 100%)" }}>
          <div className="flex flex-col space-y-1 px-4 py-4">

            {/* Nav links */}
            {navLinks.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === "/"} onClick={closeAll} className={mobileNavCls}>
                {label}
              </NavLink>
            ))}

            {/* My Account section */}
            <div className="border-t border-white/8 pt-3 pb-1">
              <div className={"mb-2 flex items-center gap-2 px-4 " + (isRTL ? "flex-row-reverse" : "")}>
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#2E8B57]/20">
                  <User size={12} className="text-[#4DB882]" />
                </div>
                <p className={"text-[10px] font-black uppercase tracking-widest text-white/30 " + font}>
                  {mobileAccountLabel}
                </p>
              </div>
              <div className="space-y-0.5">
                {ACCOUNT_ITEMS.map((item) => {
                  const Icon  = item.icon;
                  const label = itemLabel(item, language);
                  const cls   = "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/60 transition-colors hover:bg-white/8 hover:text-white " + (isRTL ? "flex-row-reverse" : "") + " " + font;
                  if (item.external) {
                    return (
                      <a key={item.href} href={item.href} target="_blank" rel={REL} onClick={closeAll} className={cls}>
                        <Icon size={15} className="shrink-0 text-[#2E8B57]" />
                        <span className="flex-1">{label}</span>
                        <span className="rounded-full bg-[#2E8B57]/15 px-2 py-0.5 text-[9px] font-black text-[#4DB882]">WA</span>
                      </a>
                    );
                  }
                  return (
                    <Link key={item.href} to={item.href} onClick={closeAll} className={cls}>
                      <Icon size={15} className="shrink-0 text-[#2E8B57]" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Language */}
            <div className="border-t border-white/8 pt-3 pb-1">
              <p className={"mb-2 px-4 text-[10px] font-black uppercase tracking-widest text-white/30 " + font}>
                {language === "ar" ? "اللغة" : "Langue"}
              </p>
              <div className="flex gap-2 px-2">
                {LANGS.map(({ code, label }) => (
                  <button key={code} onClick={() => pickMobileLang(code)}
                    className={pillCls(language === code) + " font-arabic"}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="border-t border-white/8 pt-3 space-y-1">
              <a href={WA_ORDERS} target="_blank" rel={REL} onClick={closeAll}
                className={"flex items-center gap-3 rounded-xl bg-[#2E8B57]/10 border border-[#2E8B57]/20 px-4 py-3 text-sm font-semibold text-[#4DB882] transition-colors hover:bg-[#2E8B57]/18 " + (isRTL ? "flex-row-reverse" : "") + " " + font}>
                <MessageCircle size={15} className="shrink-0" />
                <span>{t("nav_whatsapp")}</span>
              </a>
            </div>

          </div>
        </div>
      )}

    </header>
  );
}