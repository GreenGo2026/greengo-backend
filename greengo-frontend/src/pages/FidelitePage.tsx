// src/pages/FidelitePage.tsx
import { useLanguage } from "../contexts/LanguageContext";
import { Link } from "react-router-dom";

const T = {
  badge:   { fr:"Programme exclusif · GreenGo Market",  ar:"برنامج حصري · GreenGo Market",    en:"Exclusive Program · GreenGo Market"  },
  h1a:     { fr:"Programme",                            ar:"برنامج",                           en:"Loyalty"                             },
  h1b:     { fr:"Fidelite GreenGo",                     ar:"الولاء GreenGo",                   en:"Program GreenGo"                     },
  sub:     { fr:"Commandez, cumulez des points et profitez de recompenses exclusives a chaque livraison.", ar:"اطلب، اجمع النقاط واستمتع بمكافآت حصرية مع كل توصيل.", en:"Order, earn points and enjoy exclusive rewards with every delivery." },
  how:     { fr:"Comment ca marche ?",                  ar:"كيف يعمل؟",                        en:"How does it work?"                   },
  how_sub: { fr:"Simple, automatique et avantageux.",   ar:"بسيط، تلقائي ومجزٍ.",              en:"Simple, automatic and rewarding."    },
  perks:   { fr:"Avantages membres",                    ar:"مزايا الأعضاء",                    en:"Member Perks"                        },
  cta:     { fr:"Consulter mon solde",                  ar:"الاستعلام عن رصيدي",               en:"Check my balance"                    },
  cta_sub: { fr:"Envoyez-nous un message WhatsApp pour connaitre votre solde de points.", ar:"أرسل لنا رسالة واتساب لمعرفة رصيد نقاطك.", en:"Send us a WhatsApp message to check your points balance." },
};

const STEPS = [
  { e:"🛒", title:{fr:"Commandez",       ar:"اطلب",          en:"Order"},      desc:{fr:"Passez une commande sur notre site ou via WhatsApp.", ar:"اطلب عبر موقعنا أو واتساب.", en:"Place an order on our site or via WhatsApp."} },
  { e:"⭐", title:{fr:"Gagnez",          ar:"اكسب",          en:"Earn"},       desc:{fr:"10 MAD depenses = 1 point GreenGo credite automatiquement.", ar:"10 درهم = نقطة GreenGo تُضاف تلقائياً.", en:"10 MAD spent = 1 GreenGo point credited automatically."} },
  { e:"🎁", title:{fr:"Echangez",        ar:"استبدل",        en:"Redeem"},     desc:{fr:"100 points = 10 MAD de reduction sur votre prochaine commande.", ar:"100 نقطة = 10 دراهم خصم على طلبيتك القادمة.", en:"100 points = 10 MAD discount on your next order."} },
  { e:"🚀", title:{fr:"Progressez",      ar:"ارتقِ",         en:"Progress"},   desc:{fr:"Debloquez le statut VIP des 500 points pour des offres exclusives.", ar:"افتح مستوى VIP من 500 نقطة للعروض الحصرية.", en:"Unlock VIP status at 500 points for exclusive offers."} },
];

const PERKS = [
  { e:"🚚", t:{fr:"Livraison gratuite illimitee", ar:"توصيل مجاني غير محدود", en:"Unlimited free delivery"}, level:"VIP" },
  { e:"🎯", t:{fr:"Acces prioritaire aux nouveautes", ar:"وصول أولوي للمنتجات الجديدة", en:"Priority access to new products"}, level:"VIP" },
  { e:"💰", t:{fr:"Remises exclusives membres", ar:"خصومات حصرية للأعضاء", en:"Exclusive member discounts"}, level:"All" },
  { e:"🎂", t:{fr:"Offre anniversaire speciale", ar:"عرض عيد ميلاد خاص", en:"Special birthday offer"}, level:"All" },
  { e:"📦", t:{fr:"Emballage premium offert", ar:"تغليف بريميوم مجاني", en:"Premium packaging included"}, level:"VIP" },
  { e:"⚡", t:{fr:"Livraison express prioritaire", ar:"توصيل سريع أولوي", en:"Priority express delivery"}, level:"VIP" },
];

export default function FidelitePage() {
  const { language, isRTL } = useLanguage();
  const l = language as "fr"|"ar"|"en";
  return (
    <div className={language==="ar"?"font-arabic":"font-latin"} dir={isRTL?"rtl":"ltr"} style={{minHeight:"100vh",background:"linear-gradient(160deg,#031409 0%,#061a12 40%,#0a2318 100%)"}}>
      <main>
        {/* Hero */}
        <section aria-label="Programme fidelite GreenGo" className="relative overflow-hidden px-6 py-16 text-center">
          <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse 70% 50% at 50% 0%,rgba(201,169,110,0.15) 0%,transparent 60%)"}} />
          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-full px-4 py-1.5 mb-5"><span>⭐</span><span className="text-[11px] font-bold tracking-widest uppercase text-amber-300">{T.badge[l]}</span></div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">{T.h1a[l]}<br/><span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">{T.h1b[l]}</span></h1>
            <div className="h-0.5 w-24 mx-auto my-4 bg-gradient-to-r from-amber-500 to-green-600" />
            <p className="text-white/45 text-base leading-relaxed max-w-md mx-auto font-light">{T.sub[l]}</p>
            <div className="mt-6 inline-flex items-center gap-3 bg-amber-900/20 border border-amber-700/30 rounded-2xl px-5 py-3">
              <span className="text-2xl">💰</span>
              <div className={isRTL?"text-right":"text-left"}>
                <p className="text-amber-300 font-black text-sm">{language==="ar"?"10 درهم = نقطة واحدة":language==="fr"?"10 MAD = 1 Point":"10 MAD = 1 Point"}</p>
                <p className="text-white/40 text-xs">{language==="ar"?"100 نقطة = 10 دراهم خصم":language==="fr"?"100 Points = 10 MAD de reduction":"100 Points = 10 MAD discount"}</p>
              </div>
            </div>
          </div>
        </section>
        {/* Steps */}
        <section aria-label="Etapes programme fidelite" className="px-6 py-10 max-w-4xl mx-auto">
          <h2 className="text-2xl font-black text-amber-400 text-center mb-2">{T.how[l]}</h2>
          <p className="text-center text-white/40 text-sm mb-8">{T.how_sub[l]}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step,i)=>(
              <div key={i} className="relative bg-white/[0.04] border border-amber-800/20 rounded-2xl p-5 text-center hover:border-amber-600/40 transition-colors">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-green-600 flex items-center justify-center text-white text-xs font-black">{i+1}</div>
                <span className="text-4xl block mb-3 mt-2">{step.e}</span>
                <h3 className="text-white font-bold text-sm mb-2">{step.title[l]}</h3>
                <p className="text-white/45 text-xs leading-relaxed">{step.desc[l]}</p>
              </div>
            ))}
          </div>
        </section>
        {/* Perks */}
        <section aria-label="Avantages membres fidelite" className="px-6 py-10 max-w-4xl mx-auto">
          <h2 className="text-2xl font-black text-white text-center mb-8">{T.perks[l]}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PERKS.map((p,i)=>(
              <div key={i} className={`flex items-start gap-3 rounded-2xl p-4 border ${p.level==="VIP"?"bg-amber-900/10 border-amber-700/30":"bg-white/[0.03] border-white/10"} ${isRTL?"flex-row-reverse":""}`}>
                <span className="text-2xl shrink-0">{p.e}</span>
                <div>
                  <p className="text-white font-bold text-sm">{p.t[l]}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.level==="VIP"?"bg-amber-800/40 text-amber-300":"bg-green-900/40 text-green-400"}`}>{p.level}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        {/* CTA */}
        <section aria-label="Consulter points fidelite" className="px-6 pb-24 max-w-xl mx-auto text-center">
          <div className="bg-gradient-to-br from-amber-900/20 to-green-900/10 backdrop-blur-xl border border-amber-700/25 rounded-3xl p-8">
            <span className="text-5xl block mb-4">💎</span>
            <h2 className="text-xl font-black text-white mb-3">{T.cta[l]}</h2>
            <p className="text-white/45 text-sm leading-relaxed mb-6">{T.cta_sub[l]}</p>
            <a href="https://wa.me/212664397031?text=Bonjour%2C%20je%20voudrais%20connaitre%20mon%20solde%20de%20points%20fidelite" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 rounded-xl text-white font-bold hover:opacity-90 transition-opacity shadow-lg shadow-green-900/40">
              💬 WhatsApp
            </a>
            <div className="mt-4">
              <Link to="/shop" className="text-amber-400 text-sm font-semibold hover:text-amber-300 transition-colors">
                {language==="ar"?"ابدأ التسوق →":language==="fr"?"Commencer a shopper →":"Start shopping →"}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <nav aria-label="Fil ariane" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2 rounded-full text-xs border border-amber-800/20" style={{background:"rgba(6,26,18,0.88)",backdropFilter:"blur(12px)"}}>
        <Link to="/" className="text-green-400 font-semibold">GreenGo</Link><span className="text-white/25">/</span><span className="text-amber-400 font-semibold">{T.h1a[l]}</span>
      </nav>
    </div>
  );
}