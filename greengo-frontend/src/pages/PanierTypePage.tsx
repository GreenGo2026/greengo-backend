// src/pages/PanierTypePage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { useCartStore, getUnitStep } from "../store/cartStore";

type L = "fr" | "ar" | "en";

interface BasketItem {
  sku:      string;
  name_fr:  string;
  name_ar:  string;
  qty:      number;
  unit:     string;
  price:    number;
  emoji:    string;
}

interface Basket {
  id:          string;
  emoji:       string;
  badge:       Record<L, string>;
  title:       Record<L, string>;
  subtitle:    Record<L, string>;
  description: Record<L, string>;
  items:       BasketItem[];
  persons:     number;
  color:       string;
  accent:      string;
}

// ── Basket definitions with real prices ──────────────────────────────────────
const BASKETS: Basket[] = [
  {
    id: "famille",
    emoji: "👨‍👩‍👧‍👦",
    badge:       { fr:"Le plus populaire", ar:"الأكثر طلباً", en:"Most popular" },
    title:       { fr:"Panier Famille",    ar:"سلة العائلة",  en:"Family Basket" },
    subtitle:    { fr:"4 personnes · 1 semaine", ar:"4 أشخاص · أسبوع", en:"4 people · 1 week" },
    description: { fr:"Légumes frais, fruits de saison et poulet entier pour une semaine complète.", ar:"خضروات طازجة وفواكه موسمية ودجاجة كاملة لأسبوع كامل.", en:"Fresh vegetables, seasonal fruits and whole chicken for a full week." },
    persons: 4,
    color: "from-green-900/30 to-emerald-900/20",
    accent: "#2E8B57",
    items: [
      { sku:"VEG-TOMATE-001",   name_fr:"Tomate ronde",    name_ar:"طماطم",       qty:2,   unit:"kg",     price:5.00,  emoji:"🍅" },
      { sku:"VEG-PATATE-001",   name_fr:"Pomme de terre",  name_ar:"بطاطس",       qty:2,   unit:"kg",     price:4.50,  emoji:"🥔" },
      { sku:"VEG-CAROTTE-001",  name_fr:"Carotte",         name_ar:"جزر",         qty:1,   unit:"kg",     price:4.00,  emoji:"🥕" },
      { sku:"VEG-OIGNON-001",   name_fr:"Oignon rouge",    name_ar:"بصل أحمر",    qty:1,   unit:"kg",     price:11.50, emoji:"🧅" },
      { sku:"VEG-COURGETTE-001",name_fr:"Courgette",       name_ar:"كوسة",        qty:1,   unit:"kg",     price:6.00,  emoji:"🥒" },
      { sku:"VEG-PERSIL-001",   name_fr:"Persil",          name_ar:"معدنوس",      qty:1,   unit:"bundle", price:2.00,  emoji:"🌿" },
      { sku:"VEG-CORIANDRE-001",name_fr:"Coriandre",       name_ar:"كزبرة",       qty:1,   unit:"bundle", price:2.00,  emoji:"🌿" },
      { sku:"FRT-POMME-001",    name_fr:"Pomme verte",     name_ar:"تفاح أخضر",   qty:1,   unit:"kg",     price:7.00,  emoji:"🍎" },
      { sku:"FRT-ORANGE-001",   name_fr:"Orange",          name_ar:"برتقال",      qty:1,   unit:"kg",     price:8.00,  emoji:"🍊" },
      { sku:"FRT-BANANE-001",   name_fr:"Banane",          name_ar:"موز",         qty:1,   unit:"kg",     price:8.00,  emoji:"🍌" },
      { sku:"VND-POULET-001",   name_fr:"Poulet entier",   name_ar:"دجاج كامل",   qty:1,   unit:"piece",  price:45.00, emoji:"🍗" },
      { sku:"OEF-BELDI-001",    name_fr:"Oeufs beldi (12)",name_ar:"بيض بلدي",    qty:1,   unit:"boite",  price:24.00, emoji:"🥚" },
    ],
  },
  {
    id: "couple",
    emoji: "👫",
    badge:       { fr:"Idéal débutants",   ar:"مثالي للمبتدئين", en:"Great for beginners" },
    title:       { fr:"Panier Duo",        ar:"سلة الثنائي",     en:"Duo Basket"          },
    subtitle:    { fr:"2 personnes · 1 semaine", ar:"شخصان · أسبوع", en:"2 people · 1 week" },
    description: { fr:"L essentiel pour deux — légumes, fruits et protéines pour la semaine.", ar:"الأساسيات لشخصين — خضروات وفواكه وبروتينات للأسبوع.", en:"The essentials for two — vegetables, fruits and proteins for the week." },
    persons: 2,
    color: "from-amber-900/25 to-orange-900/15",
    accent: "#C9A96E",
    items: [
      { sku:"VEG-TOMATE-001",   name_fr:"Tomate ronde",    name_ar:"طماطم",       qty:1,   unit:"kg",     price:5.00,  emoji:"🍅" },
      { sku:"VEG-PATATE-001",   name_fr:"Pomme de terre",  name_ar:"بطاطس",       qty:1,   unit:"kg",     price:4.50,  emoji:"🥔" },
      { sku:"VEG-CAROTTE-001",  name_fr:"Carotte",         name_ar:"جزر",         qty:1,   unit:"kg",     price:4.00,  emoji:"🥕" },
      { sku:"VEG-PERSIL-001",   name_fr:"Persil",          name_ar:"معدنوس",      qty:1,   unit:"bundle", price:2.00,  emoji:"🌿" },
      { sku:"FRT-POMME-001",    name_fr:"Pomme verte",     name_ar:"تفاح أخضر",   qty:1,   unit:"kg",     price:7.00,  emoji:"🍎" },
      { sku:"FRT-BANANE-001",   name_fr:"Banane",          name_ar:"موز",         qty:1,   unit:"kg",     price:8.00,  emoji:"🍌" },
      { sku:"VND-BLANC-001",    name_fr:"Blanc de poulet", name_ar:"صدر الدجاج",  qty:0.5, unit:"kg",     price:32.00, emoji:"🍗" },
      { sku:"OEF-BELDI-001",    name_fr:"Oeufs beldi (12)",name_ar:"بيض بلدي",    qty:1,   unit:"boite",  price:24.00, emoji:"🥚" },
    ],
  },
  {
    id: "legumes",
    emoji: "🥗",
    badge:       { fr:"100% végétal",      ar:"100% نباتي",      en:"100% plant-based"    },
    title:       { fr:"Panier Légumes",    ar:"سلة الخضروات",    en:"Veggie Basket"        },
    subtitle:    { fr:"Fraîcheur garantie · 10 variétés", ar:"طازجة مضمونة · 10 أنواع", en:"Guaranteed fresh · 10 varieties" },
    description: { fr:"Dix légumes frais sélectionnés ce matin — idéal pour cuisiner marocain toute la semaine.", ar:"عشرة خضروات طازجة مختارة هذا الصباح — مثالية للطبخ المغربي طوال الأسبوع.", en:"Ten fresh vegetables selected this morning — ideal for Moroccan cooking all week." },
    persons: 4,
    color: "from-emerald-900/25 to-green-900/15",
    accent: "#4ade80",
    items: [
      { sku:"VEG-TOMATE-001",    name_fr:"Tomate ronde",   name_ar:"طماطم",       qty:2, unit:"kg",     price:5.00,  emoji:"🍅" },
      { sku:"VEG-PATATE-001",    name_fr:"Pomme de terre", name_ar:"بطاطس",       qty:2, unit:"kg",     price:4.50,  emoji:"🥔" },
      { sku:"VEG-CAROTTE-001",   name_fr:"Carotte",        name_ar:"جزر",         qty:1, unit:"kg",     price:4.00,  emoji:"🥕" },
      { sku:"VEG-OIGNON-001",    name_fr:"Oignon rouge",   name_ar:"بصل أحمر",    qty:1, unit:"kg",     price:11.50, emoji:"🧅" },
      { sku:"VEG-COURGETTE-001", name_fr:"Courgette",      name_ar:"كوسة",        qty:1, unit:"kg",     price:6.00,  emoji:"🥒" },
      { sku:"VEG-POIVRON-001",   name_fr:"Poivron vert",   name_ar:"فلفل أخضر",   qty:1, unit:"kg",     price:8.00,  emoji:"🫑" },
      { sku:"VEG-BROCOLI-001",   name_fr:"Brocoli",        name_ar:"بروكلي",      qty:1, unit:"kg",     price:12.00, emoji:"🥦" },
      { sku:"VEG-BETTERAVE-001", name_fr:"Betterave",      name_ar:"شمندر",       qty:1, unit:"kg",     price:5.00,  emoji:"🫚" },
      { sku:"VEG-PERSIL-001",    name_fr:"Persil",         name_ar:"معدنوس",      qty:1, unit:"bundle", price:2.00,  emoji:"🌿" },
      { sku:"VEG-CORIANDRE-001", name_fr:"Coriandre",      name_ar:"كزبرة",       qty:1, unit:"bundle", price:2.00,  emoji:"🌿" },
    ],
  },
  {
    id: "tajine",
    emoji: "🫕",
    badge:       { fr:"Spécial Maroc",     ar:"خاص بالمغرب",    en:"Moroccan special"    },
    title:       { fr:"Panier Tajine",     ar:"سلة الطاجين",    en:"Tajine Basket"        },
    subtitle:    { fr:"Tout pour 2 tajines maison", ar:"كل ما تحتاجه لطاجينين", en:"Everything for 2 home tajines" },
    description: { fr:"Les ingrédients parfaits pour cuisiner deux tajines authentiques — poulet, légumes et épices inclus.", ar:"المكونات المثالية لطهي طاجينين أصيلين — دجاج وخضروات وتوابل مشمولة.", en:"Perfect ingredients for two authentic tajines — chicken, vegetables and spices included." },
    persons: 4,
    color: "from-rose-900/20 to-orange-900/15",
    accent: "#f97316",
    items: [
      { sku:"VND-POULET-001",    name_fr:"Poulet entier",  name_ar:"دجاج كامل",   qty:1, unit:"piece",  price:45.00, emoji:"🍗" },
      { sku:"VEG-PATATE-001",    name_fr:"Pomme de terre", name_ar:"بطاطس",       qty:1, unit:"kg",     price:4.50,  emoji:"🥔" },
      { sku:"VEG-CAROTTE-001",   name_fr:"Carotte",        name_ar:"جزر",         qty:1, unit:"kg",     price:4.00,  emoji:"🥕" },
      { sku:"VEG-OIGNON-001",    name_fr:"Oignon rouge",   name_ar:"بصل أحمر",    qty:1, unit:"kg",     price:11.50, emoji:"🧅" },
      { sku:"VEG-COURGETTE-001", name_fr:"Courgette",      name_ar:"كوسة",        qty:1, unit:"kg",     price:6.00,  emoji:"🥒" },
      { sku:"VEG-TOMATE-001",    name_fr:"Tomate ronde",   name_ar:"طماطم",       qty:1, unit:"kg",     price:5.00,  emoji:"🍅" },
      { sku:"EPC-CUMIN-001",     name_fr:"Cumin moulu",    name_ar:"كمون مطحون",  qty:1, unit:"100g",   price:12.00, emoji:"🌶️" },
      { sku:"EPC-PAPRIKA-001",   name_fr:"Paprika doux",   name_ar:"بابريكا",     qty:1, unit:"100g",   price:14.00, emoji:"🌶️" },
      { sku:"EPC-RASELHANT-001", name_fr:"Ras el hanout",  name_ar:"راس الحانوت", qty:1, unit:"100g",   price:20.00, emoji:"✨" },
      { sku:"VEG-CORIANDRE-001", name_fr:"Coriandre",      name_ar:"كزبرة",       qty:1, unit:"bundle", price:2.00,  emoji:"🌿" },
    ],
  },
  {
    id: "fruits",
    emoji: "🍇",
    badge:       { fr:"Vitamines & énergie", ar:"فيتامينات وطاقة", en:"Vitamins & energy" },
    title:       { fr:"Panier Fruits",       ar:"سلة الفواكه",     en:"Fruit Basket"       },
    subtitle:    { fr:"6 fruits de saison · famille", ar:"6 فواكه موسمية · للعائلة", en:"6 seasonal fruits · family" },
    description: { fr:"Une sélection de six fruits frais de saison — idéal pour toute la famille.", ar:"تشكيلة من ستة فواكه طازجة موسمية — مثالية للعائلة بأكملها.", en:"A selection of six fresh seasonal fruits — ideal for the whole family." },
    persons: 4,
    color: "from-purple-900/20 to-pink-900/15",
    accent: "#a855f7",
    items: [
      { sku:"FRT-POMME-001",   name_fr:"Pomme verte",  name_ar:"تفاح أخضر",  qty:2, unit:"kg", price:7.00,  emoji:"🍎" },
      { sku:"FRT-ORANGE-001",  name_fr:"Orange",       name_ar:"برتقال",     qty:2, unit:"kg", price:8.00,  emoji:"🍊" },
      { sku:"FRT-BANANE-001",  name_fr:"Banane",       name_ar:"موز",        qty:1, unit:"kg", price:8.00,  emoji:"🍌" },
      { sku:"FRT-GRENADE-001", name_fr:"Grenade",      name_ar:"رمان",       qty:1, unit:"kg", price:10.00, emoji:"🍎" },
      { sku:"FRT-RAISIN-001",  name_fr:"Raisin blanc", name_ar:"عنب أبيض",   qty:1, unit:"kg", price:12.00, emoji:"🍇" },
      { sku:"FRT-PECHE-001",   name_fr:"Peche",        name_ar:"خوخ",        qty:1, unit:"kg", price:15.00, emoji:"🍑" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcTotal(items: BasketItem[]): number {
  return items.reduce((s, i) => s + i.price * i.qty, 0);
}

function calcSaving(total: number): number {
  return Math.round(total * 0.08); // 8% basket discount
}

// ── Basket Card ───────────────────────────────────────────────────────────────
function BasketCard({ basket, lang }: { basket: Basket; lang: string }) {
  const l          = lang as L;
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const addToCart  = useCartStore(s => s.addToCart);
  const total      = calcTotal(basket.items);
  const saving     = calcSaving(total);
  const discounted = total - saving;

  function handleAddAll() {
    basket.items.forEach(item => {
      addToCart({
        name:           item.name_ar,
        price_per_unit: item.price,
        unit:           item.unit,
        available:      true,
      }, item.qty);
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <article
      className={`rounded-3xl border overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl bg-gradient-to-br ${basket.color}`}
      style={{ border: `1px solid ${basket.accent}30` }}
    >
      {/* Header */}
      <div className="p-5 pb-4">
        <div className={`flex items-start justify-between mb-3 ${l === "ar" ? "flex-row-reverse" : ""}`}>
          <div>
            {/* Badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-2"
              style={{ background: `${basket.accent}20`, color: basket.accent, border: `1px solid ${basket.accent}40` }}>
              ⭐ {basket.badge[l]}
            </span>
            <h2 className={`text-xl font-black text-white leading-tight ${l === "ar" ? "font-arabic text-right" : "font-latin"}`} style={l !== "ar" ? { fontFamily: "var(--font-display)", fontSize: "1.4rem" } : {}}>
              {basket.emoji} {basket.title[l]}
            </h2>
            <p className={`text-xs text-white/50 mt-0.5 ${l === "ar" ? "font-arabic text-right" : "font-latin"}`}>
              {basket.subtitle[l]}
            </p>
          </div>
          {/* Persons pill */}
          <div className="flex flex-col items-center shrink-0 rounded-2xl px-3 py-2"
            style={{ background: `${basket.accent}15`, border: `1px solid ${basket.accent}30` }}>
            <span className="text-2xl">👥</span>
            <span className="text-[10px] font-bold text-white/60 mt-0.5">{basket.persons} pers.</span>
          </div>
        </div>

        <p className={`text-sm text-white/55 leading-relaxed mb-4 ${l === "ar" ? "font-arabic text-right" : "font-latin"}`}>
          {basket.description[l]}
        </p>

        {/* Items preview */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {basket.items.map(item => (
            <span key={item.sku}
              className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-white/70"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {item.emoji} {l === "ar" ? item.name_ar : item.name_fr}
              {item.qty > 1 && <span className="text-white/40 font-latin">×{item.qty}</span>}
            </span>
          ))}
        </div>

        {/* Pricing */}
        <div className={`flex items-center gap-3 mb-4 ${l === "ar" ? "flex-row-reverse" : ""}`}>
          <div>
            <div className={`flex items-baseline gap-1.5 ${l === "ar" ? "flex-row-reverse" : ""}`}>
              <span className="text-4xl font-black text-white font-latin" style={{ fontFamily: "var(--font-body)", letterSpacing: "-0.03em" }}>{discounted.toFixed(0)}</span>
              <span className="text-sm text-white/50 font-latin">MAD</span>
            </div>
            <div className={`flex items-center gap-2 ${l === "ar" ? "flex-row-reverse" : ""}`}>
              <span className="text-sm text-white/30 line-through font-latin">{total.toFixed(0)} MAD</span>
              <span className="text-xs font-bold rounded-full px-2 py-0.5"
                style={{ background: `${basket.accent}25`, color: basket.accent }}>
                -{saving} MAD
              </span>
            </div>
          </div>
          <div className="flex-1" />
          {/* Toggle details */}
          <button onClick={() => setOpen(!open)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${l === "ar" ? "font-arabic" : "font-latin"}`}
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
            {open
              ? (l === "ar" ? "إخفاء" : l === "fr" ? "Masquer" : "Hide")
              : (l === "ar" ? "التفاصيل" : l === "fr" ? "Détails" : "Details")}
          </button>
        </div>

        {/* Expanded items detail */}
        {open && (
          <div className="mb-4 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {basket.items.map((item, i) => (
              <div key={item.sku}
                className={`flex items-center justify-between px-3 py-2 text-xs ${i % 2 === 0 ? "bg-white/[0.03]" : ""} ${l === "ar" ? "flex-row-reverse" : ""}`}>
                <span className="text-white/70 flex items-center gap-1.5">
                  <span>{item.emoji}</span>
                  <span className={l === "ar" ? "font-arabic" : "font-latin"}>
                    {l === "ar" ? item.name_ar : item.name_fr}
                  </span>
                  {item.qty !== 1 && <span className="text-white/35 font-latin">×{item.qty} {item.unit}</span>}
                </span>
                <span className="text-white/40 font-latin">{(item.price * item.qty).toFixed(2)} MAD</span>
              </div>
            ))}
            <div className={`flex justify-between px-3 py-2 font-bold text-xs border-t border-white/10 ${l === "ar" ? "flex-row-reverse" : ""}`}>
              <span className={`text-white/50 ${l === "ar" ? "font-arabic" : "font-latin"}`}>
                {l === "ar" ? "المجموع قبل الخصم" : l === "fr" ? "Total avant réduction" : "Total before discount"}
              </span>
              <span className="text-white/50 font-latin">{total.toFixed(2)} MAD</span>
            </div>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex gap-2">
          <button onClick={handleAddAll}
            className={`flex-1 rounded-2xl py-4 text-sm font-extrabold text-white transition-all duration-200 active:scale-[0.97] hover:brightness-110 ${l === "ar" ? "font-arabic" : "font-latin"}`}
            style={{
              background: added
                ? "linear-gradient(135deg,#16a34a,#15803d)"
                : `linear-gradient(135deg,${basket.accent},${basket.accent}cc)`,
              boxShadow: `0 4px 20px ${basket.accent}35`,
            }}>
            {added
              ? (l === "ar" ? "✓ تمت الإضافة للسلة" : l === "fr" ? "✓ Ajouté au panier !" : "✓ Added to cart!")
              : (l === "ar" ? "🛒 إضافة الكل للسلة" : l === "fr" ? "🛒 Ajouter tout au panier" : "🛒 Add all to cart")}
          </button>
          {added && (
            <Link to="/cart"
              className={`flex items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition-all ${l === "ar" ? "font-arabic" : "font-latin"}`}
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PanierTypePage() {
  const { language, isRTL } = useLanguage();
  const l = language as L;
  const cart       = useCartStore(s => s.cart);
  const totalItems = cart.reduce((n, i) => n + (i.cartQuantity || 0), 0);

  return (
    <div className={language === "ar" ? "font-arabic" : "font-latin"} dir={isRTL ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", background: "linear-gradient(160deg,#031409 0%,#061a12 40%,#0a2318 100%)" }}>
      <main>

        {/* Hero */}
        <section aria-label="Paniers types GreenGo Market" className="relative overflow-hidden px-6 py-14 text-center">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(46,139,87,0.18) 0%, transparent 65%)" }} />
          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-green-900/20 border border-green-700/30 rounded-full px-4 py-1.5 mb-5">
              <span>🛒</span>
              <span className="text-[11px] font-bold tracking-widest uppercase text-green-300">
                {l === "ar" ? "سلات جاهزة · GreenGo Market" : l === "fr" ? "Paniers prêts · GreenGo Market" : "Ready baskets · GreenGo Market"}
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {l === "ar" ? "سلاتنا" : l === "fr" ? "Nos Paniers"  : "Our Baskets"}<br/>
              <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                {l === "ar" ? "الجاهزة" : l === "fr" ? "Prêts à Commander" : "Ready to Order"}
              </span>
            </h1>
            <div className="h-0.5 w-24 mx-auto my-4 bg-gradient-to-r from-green-500 to-amber-500" />
            <p className="text-white/45 text-base leading-relaxed max-w-lg mx-auto font-light">
              {l === "ar"
                ? "اختر سلتك الجاهزة وأضف كل المنتجات للسلة بنقرة واحدة. توفير مضمون على كل سلة."
                : l === "fr"
                ? "Choisissez votre panier et ajoutez tous les produits en un clic. Économie garantie sur chaque panier."
                : "Choose your basket and add all products in one click. Guaranteed savings on every basket."}
            </p>

            {/* Trust pills */}
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              {[
                { e:"💰", fr:"8% de réduction",       ar:"خصم 8%",              en:"8% discount"        },
                { e:"🛵", fr:"Livraison incluse",      ar:"التوصيل مشمول",       en:"Delivery included"  },
                { e:"🌿", fr:"100% frais ce matin",   ar:"طازج 100% هذا الصباح",en:"100% fresh today"   },
                { e:"✅", fr:"Qualité garantie",       ar:"جودة مضمونة",         en:"Quality guaranteed" },
              ].map(p => (
                <span key={p.en} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white/60"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {p.e} {l === "ar" ? p.ar : l === "fr" ? p.fr : p.en}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Baskets grid */}
        <section aria-label="Liste des paniers types" className="px-4 pb-8 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {BASKETS.map(basket => (
              <BasketCard key={basket.id} basket={basket} lang={language} />
            ))}
          </div>
        </section>

        {/* Cart shortcut — shows when items added */}
        {totalItems > 0 && (
          <section className="px-4 pb-24 max-w-xl mx-auto text-center">
            <Link to="/cart"
              className="flex items-center justify-center gap-3 w-full rounded-2xl py-4 text-sm font-extrabold text-white"
              style={{ background: "linear-gradient(135deg,#2E8B57,#1a5c38)", border: "1px solid rgba(46,139,87,0.5)", boxShadow: "0 4px 24px rgba(46,139,87,0.3)" }}>
              🛒
              {l === "ar"
                ? `عرض سلتي · ${totalItems} منتج`
                : l === "fr"
                ? `Voir mon panier · ${totalItems} article${totalItems > 1 ? "s" : ""}`
                : `View cart · ${totalItems} item${totalItems > 1 ? "s" : ""}`}
              →
            </Link>
          </section>
        )}

      </main>

      {/* Breadcrumb */}
      <nav aria-label="Fil d ariane" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2 rounded-full text-xs border border-green-800/30"
        style={{ background: "rgba(6,26,18,0.92)", backdropFilter: "blur(12px)" }}>
        <Link to="/"     className="text-green-400 font-semibold hover:text-green-300">GreenGo</Link>
        <span className="text-white/25">/</span>
        <span className="text-green-300 font-semibold">
          {l === "ar" ? "السلات الجاهزة" : l === "fr" ? "Paniers" : "Baskets"}
        </span>
      </nav>
    </div>
  );
}
