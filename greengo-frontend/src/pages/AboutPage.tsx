// src/pages/AboutPage.tsx
import { Leaf, Truck, ShieldCheck, Users, Heart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

export default function AboutPage() {
  const { dir, language, isRTL } = useLanguage();
  const font = language === "ar" ? "font-arabic" : "font-latin";
  const ar = language === "ar";
  const fr = language === "fr";

  const T = {
    heroTag:     ar ? "قصتنا"                : fr ? "Notre histoire"              : "Our story",
    heroTitle:   ar ? "طازج من المزرعة لبابك" : fr ? "De la ferme à votre porte"   : "From the farm to your door",
    heroSub:     ar ? "GreenGo — بقالك الإلكتروني الأول فسلا. خضرة وفواكه طازجة مختارة بعناية كل يوم، نوصلها لباب دارك بسرعة وأمان." : fr ? "GreenGo — votre épicerie en ligne à Salé. Fruits et légumes frais sélectionnés chaque jour, livrés rapidement et en toute sécurité." : "GreenGo — Salé's first online grocery. Carefully selected fresh fruits and vegetables delivered fast and safely to your door every day.",
    shopNow:     ar ? "تسوق الآن"            : fr ? "Faire mes courses"            : "Shop now",
    contactUs:   ar ? "تواصل معنا"           : fr ? "Nous contacter"               : "Contact us",
    storyTitle:  ar ? "كيفاش بدات GreenGo؟"  : fr ? "Comment GreenGo a démarré ?"  : "How did GreenGo start?",
    storyP1:     ar ? "الفكرة بدات بسيطة: لقينا أن الزبون فسلا يستاهل يلقى خضرة وفواكه طازجة وهو جالس فدارو. السوق متعب، والوقت غالي. فبنينا GreenGo باش نحلو هاد المشكلة." : fr ? "L'idée est née d'un constat simple : le client à Salé mérite de trouver des fruits et légumes frais depuis chez lui. Le marché est fatiguant et le temps est précieux. Nous avons créé GreenGo pour résoudre ce problème." : "The idea was simple: customers in Salé deserve fresh fruit and vegetables without leaving home. The market is tiring and time is precious. We built GreenGo to solve that.",
    storyP2:     ar ? "بدأنا صغار، بس بقلب كبير. كل منتج نختارو بعناية، وكل زبون يهمنا. هدفنا ما كانش غير التوصيل — هدفنا نجيبو ليك الثقة والجودة لباب دارك." : fr ? "Nous avons commencé petit, mais avec un grand cœur. Chaque produit est soigneusement sélectionné, chaque client compte pour nous. Notre objectif n'est pas seulement la livraison — c'est vous apporter confiance et qualité." : "We started small but with a big heart. Every product is carefully chosen, every customer matters. Our goal isn't just delivery — it's bringing trust and quality to your door.",
    madeWith:    ar ? "صنعناه بحب للمغرب ❤️" : fr ? "Fait avec amour pour le Maroc ❤️" : "Made with love for Morocco ❤️",
    statsTitle:  ar ? "GreenGo بالأرقام"     : fr ? "GreenGo en chiffres"          : "GreenGo by the numbers",
    valuesTitle: ar ? "قيمنا"                : fr ? "Nos valeurs"                  : "Our values",
    ctaTitle:    ar ? "جاهز تطلب؟"           : fr ? "Prêt à commander ?"           : "Ready to order?",
    ctaSub:      ar ? "آلاف الزبائن يثقون فينا كل يوم — انضم لعائلة GreenGo." : fr ? "Des milliers de clients nous font confiance chaque jour — rejoignez la famille GreenGo." : "Thousands of customers trust us daily — join the GreenGo family.",
  };

  const stats = [
    { value: "500+", label: ar ? "زبون سعيد"    : fr ? "Clients satisfaits"  : "Happy customers", color: "#2E8B57" },
    { value: "50+",  label: ar ? "منتج طازج"     : fr ? "Produits frais"      : "Fresh products",  color: "#FF9800" },
    { value: "2",    label: ar ? "سنة من الخبرة"  : fr ? "Ans d'expérience"    : "Years experience", color: "#C0614A" },
    { value: "100%", label: ar ? "طازج يومياً"    : fr ? "Frais chaque jour"   : "Fresh daily",     color: "#4DB882" },
  ];

  const values = [
    { icon: Leaf,        color: "#2E8B57", bg: "#edfbf3", ring: "#a3ebca", title: ar ? "الطزاجة أولاً"   : fr ? "La fraîcheur avant tout"     : "Freshness first",     body: ar ? "كل منتج يوصلك طازج من المزرعة مباشرة يومياً." : fr ? "Chaque produit livré directement de la ferme chaque jour."    : "Every product delivered fresh from the farm daily." },
    { icon: Truck,       color: "#FF9800", bg: "#fff8e1", ring: "#ffe082", title: ar ? "توصيل سريع"      : fr ? "Livraison rapide"             : "Fast delivery",       body: ar ? "نوصلك لباب دارك فسلا بسرعة وأمان تام."              : fr ? "Livraison rapide et sécurisée à votre porte à Salé."         : "Fast and secure delivery to your door in Salé." },
    { icon: ShieldCheck, color: "#C0614A", bg: "#fdf3f0", ring: "#f8c6b8", title: ar ? "جودة مضمونة"     : fr ? "Qualité garantie"             : "Guaranteed quality",  body: ar ? "كل منتج مراقب ومفتش قبل ما يوصلك."                   : fr ? "Chaque produit est contrôlé avant livraison."                : "Every product is checked before it reaches you." },
    { icon: Users,       color: "#4DB882", bg: "#edfbf3", ring: "#6DDBA8", title: ar ? "عائلة GreenGo"   : fr ? "Famille GreenGo"              : "GreenGo family",      body: ar ? "مجتمع زبائن يثقون فينا ويرجعو كل يوم."               : fr ? "Une communauté de clients qui nous font confiance chaque jour." : "A community of customers who trust us every day." },
    { icon: Heart,       color: "#7B1FA2", bg: "#f5f3ff", ring: "#ddd6fe", title: ar ? "شغف بالمغرب"     : fr ? "Passion pour le Maroc"        : "Passion for Morocco", body: ar ? "كل شي بنيناه من حب للمغرب وللزبون المغربي."           : fr ? "Tout ce que nous avons construit vient de l'amour du Maroc." : "Everything we built comes from love for Morocco." },
    { icon: Star,        color: "#C9A96E", bg: "#fdf8ef", ring: "#f2ddb4", title: ar ? "تجربة فريدة"     : fr ? "Expérience unique"            : "Unique experience",   body: ar ? "ما كنقدموش غير منتجات — كنقدمو راحة البال."            : fr ? "Nous n'offrons pas que des produits — nous offrons la sérénité." : "We offer more than products — we offer peace of mind." },
  ];

  return (
    <div className={"min-h-screen " + font} style={{ background: "#FAF7F2" }}>

      <section className="hero-gradient zellige-bg-light relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.12) 100%)" }} />
        <div className="relative mx-auto max-w-5xl px-4 py-16 md:py-24">
          <div dir={dir} className={"grid gap-10 md:grid-cols-2 md:items-center"}>
            <div className={isRTL ? "text-right" : "text-left"}>
              <div className={"mb-4 flex items-center gap-2 " + (isRTL ? "justify-end" : "justify-start")}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF9800]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF9800]">{T.heroTag}</span>
              </div>
              <h1 className="text-3xl font-extrabold leading-tight text-white md:text-4xl lg:text-5xl">{T.heroTitle}</h1>
              <p className="mt-4 text-base leading-relaxed text-white/65 md:text-lg">{T.heroSub}</p>
              <div className={"mt-8 flex flex-wrap gap-3 " + (isRTL ? "justify-end" : "justify-start")}>
                <Link to="/" className="rounded-full bg-white px-6 py-2.5 text-sm font-extrabold text-[#2E8B57] shadow-md transition-all hover:shadow-lg active:scale-95">{T.shopNow}</Link>
                <Link to="/contact" className="rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95">{T.contactUs}</Link>
              </div>
            </div>
            <div className="hidden md:grid grid-cols-2 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col items-center justify-center rounded-2xl bg-white/10 p-6 text-center backdrop-blur-sm ring-1 ring-white/15 transition-transform hover:-translate-y-1">
                  <span className="text-4xl font-extrabold text-white">{s.value}</span>
                  <span className="mt-2 text-xs font-semibold text-white/60">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-14" style={{ background: "linear-gradient(to top, #FAF7F2, transparent)" }} />
      </section>

      <div className="grid grid-cols-2 gap-4 px-4 py-8 mx-auto max-w-5xl md:hidden">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center justify-center rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <span className="text-3xl font-extrabold" style={{ color: s.color }}>{s.value}</span>
            <span className="mt-1 text-xs font-semibold text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div dir={dir} className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className="relative order-2 md:order-none">
              <div className="zellige-bg-dark absolute inset-0 rounded-3xl opacity-30" />
              <div className="relative overflow-hidden rounded-3xl shadow-xl" style={{ background: "linear-gradient(135deg, #0d3b36 0%, #1a5c4a 60%, #2E8B57 100%)", minHeight: "320px" }}>
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
                  <Leaf size={64} className="text-white/20" strokeWidth={0.8} />
                  <div className="h-px w-16 bg-white/20" />
                  <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                    {["🥕 Carottes", "🍅 Tomates", "🥬 Légumes", "🍊 Fruits"].map((item) => (
                      <div key={item} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 backdrop-blur-sm">{item}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF9800]" />
                    <span className="text-xs font-bold text-[#FF9800] uppercase tracking-widest">Fresh Daily</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={isRTL ? "text-right" : "text-left"}>
              <h2 className="text-2xl font-extrabold text-gray-800 md:text-3xl">{T.storyTitle}</h2>
              <div className="mt-2 h-1 w-12 rounded-full" style={{ background: "linear-gradient(90deg, #2E8B57, #FF9800)", marginLeft: isRTL ? "auto" : "0" }} />
              <p className="mt-5 text-base leading-relaxed text-gray-600">{T.storyP1}</p>
              <p className="mt-3 text-base leading-relaxed text-gray-600">{T.storyP2}</p>
              <div className={"mt-6 flex items-center gap-2 " + (isRTL ? "justify-end" : "justify-start")}>
                <Heart size={16} className="text-[#C0614A]" />
                <span className="text-sm font-bold text-[#C0614A]">{T.madeWith}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20" style={{ background: "linear-gradient(135deg, #f0faf4 0%, #FAF7F2 50%, #fff8e1 100%)" }}>
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-extrabold text-gray-800 md:text-3xl">{T.valuesTitle}</h2>
            <div className="mx-auto mt-3 h-1 w-12 rounded-full" style={{ background: "linear-gradient(90deg, #2E8B57, #FF9800)" }} />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((v, i) => {
              const Icon = v.icon;
              return (
                <div key={i} dir={dir} className={"group flex gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg " + (isRTL ? "flex-row-reverse text-right" : "text-left")}>
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110" style={{ background: v.bg, boxShadow: "0 0 0 2px " + v.ring }}>
                    <Icon size={20} style={{ color: v.color }} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-800">{v.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{v.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="hero-gradient zellige-bg-light relative overflow-hidden py-16 text-center">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.1) 0%, transparent 60%)" }} />
        <div className="relative mx-auto max-w-xl px-4">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/20">
            <Leaf size={32} className="text-white/60" strokeWidth={1.5} />
          </div>
          <h2 className={"text-2xl font-extrabold text-white md:text-3xl " + font}>{T.ctaTitle}</h2>
          <p className={"mt-3 text-base text-white/65 " + font}>{T.ctaSub}</p>
          <Link to="/" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-extrabold text-[#2E8B57] shadow-lg transition-all hover:shadow-xl active:scale-95">
            <Leaf size={15} />
            {T.shopNow}
          </Link>
        </div>
      </section>

    </div>
  );
}