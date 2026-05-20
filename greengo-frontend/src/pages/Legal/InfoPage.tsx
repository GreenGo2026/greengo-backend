// src/pages/legal/InfoPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";

type L = "fr" | "ar" | "en";
interface Sec { id:string; e:string; title:Record<L,string>; content:Record<L,string[]>; }

const SECTIONS: Sec[] = [
  { id:"societe", e:"🏢",
    title:{ fr:"Identite de la societe", ar:"هوية الشركة", en:"Company Identity" },
    content:{ fr:["Denomination : GreenGo Market","Siege : Lot N 145, Lotissement EL MOUSTAKBAL, Laayayda, Sale, Maroc","Email : team@mygreengoo.com | WhatsApp : +212 664 500 789","Forme juridique : Auto-entrepreneur / SARL en cours de constitution"],
               ar:["الاسم التجاري: GreenGo Market","المقر: قطعة رقم 145، تجزئة المستقبل، لعيايدة، سلا، المغرب","البريد: team@mygreengoo.com | واتساب: 212664500789+","الشكل القانوني: مقاول ذاتي / ش.م.م قيد التأسيس"],
               en:["Name: GreenGo Market","Office: Lot N 145, Lotissement EL MOUSTAKBAL, Laayayda, Sale, Morocco","Email: team@mygreengoo.com | WhatsApp: +212 664 500 789","Legal form: Self-employed / LLC being incorporated"] } },
  { id:"hebergement", e:"🌐",
    title:{ fr:"Hebergement", ar:"الاستضافة", en:"Hosting" },
    content:{ fr:["Frontend heberge par Vercel Inc., 340 Pine Street Suite 701, San Francisco, CA 94104, USA.","Backend API heberge par Railway Corp., San Francisco, California, USA.","Base de donnees sur MongoDB Atlas (serveurs europeens)."],
               ar:["الواجهة الأمامية مستضافة لدى Vercel Inc.، سان فرانسيسكو، الولايات المتحدة.","الـ API مستضاف لدى Railway Corp.، سان فرانسيسكو، كاليفورنيا.","قاعدة البيانات على MongoDB Atlas (خوادم أوروبية)."],
               en:["Frontend hosted by Vercel Inc., 340 Pine Street Suite 701, San Francisco, CA 94104, USA.","Backend API hosted by Railway Corp., San Francisco, California, USA.","Database on MongoDB Atlas (European servers)."] } },
  { id:"propriete", e:"©️",
    title:{ fr:"Propriete intellectuelle", ar:"الملكية الفكرية", en:"Intellectual Property" },
    content:{ fr:["Tout le contenu du site (textes, images, logo) est la propriete exclusive de GreenGo Market.","Toute reproduction sans autorisation ecrite est interdite.","Le logo et la marque GreenGo Market sont en cours de depot aupres de l OMPIC."],
               ar:["جميع محتويات الموقع ملك حصري لـ GreenGo Market.","يُمنع أي نسخ دون إذن كتابي.","الشعار والعلامة التجارية قيد التسجيل لدى OMPIC."],
               en:["All site content is the exclusive property of GreenGo Market.","Any reproduction without written permission is prohibited.","The logo and trademark are being registered with OMPIC."] } },
  { id:"cookies", e:"🍪",
    title:{ fr:"Politique de cookies", ar:"سياسة الكوكيز", en:"Cookie Policy" },
    content:{ fr:["Cookies techniques uniquement (session, panier, langue). Aucun cookie publicitaire tiers.","Un bandeau de consentement permet de gerer vos preferences.","Supprimez les cookies a tout moment via les parametres de votre navigateur."],
               ar:["ملفات ارتباط تقنية فقط (جلسة، سلة، لغة). لا ملفات إعلانية خارجية.","شريط الموافقة يتيح إدارة تفضيلاتك.","احذف الكوكيز في أي وقت من إعدادات متصفحك."],
               en:["Technical cookies only (session, cart, language). No third-party advertising cookies.","A consent banner lets you manage your preferences.","Delete cookies anytime via browser settings."] } },
  { id:"droit", e:"⚖️",
    title:{ fr:"Droit applicable", ar:"القانون المطبق", en:"Applicable Law" },
    content:{ fr:["Le site et ses conditions sont soumis au droit marocain.","Tout litige sera soumis aux tribunaux de Rabat-Sale.","GreenGo Market se conforme aux lois 09-08 (donnees personnelles) et 31-08 (protection consommateur)."],
               ar:["يخضع الموقع وشروطه للقانون المغربي.","أي نزاع يُحال إلى محاكم الرباط-سلا.","تلتزم GreenGo Market بالقانونين 09-08 و31-08."],
               en:["The site and its terms are governed by Moroccan law.","Disputes go to courts of Rabat-Sale.","GreenGo Market complies with laws 09-08 and 31-08."] } },
];

const NAV = [
  {to:"/legal/cgu",     l:{fr:"CGU",ar:"شروط",en:"TOU"}},
  {to:"/legal/privacy", l:{fr:"Confidentialite",ar:"الخصوصية",en:"Privacy"}},
  {to:"/legal/terms",   l:{fr:"Conditions",ar:"الشروط العامة",en:"Terms"}},
  {to:"/legal/info",    l:{fr:"Informations",ar:"معلومات",en:"Info"}, active:true},
];

function Acc({ s, lang }:{ s:Sec; lang:string }) {
  const [open, setOpen] = useState(false);
  const l = lang as L;
  return (
    <article className={`rounded-2xl border transition-all duration-300 overflow-hidden ${open?"border-green-500/40 bg-green-900/10":"border-amber-800/20 bg-white/[0.03]"}`}>
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center gap-4 p-5 text-left group" aria-expanded={open}>
        <span className="text-3xl shrink-0">{s.e}</span>
        <h2 className="flex-1 text-white font-bold text-base group-hover:text-green-300 transition-colors">{s.title[l]}</h2>
        <span className={`text-lg shrink-0 transition-transform duration-300 ${open?"rotate-180 text-green-400":"text-white/30"}`}>▾</span>
      </button>
      {open && <div className="px-5 pb-5 border-t border-white/8"><div className="pt-4 space-y-3">{s.content[l].map((p,i)=><p key={i} className="text-white/60 text-sm leading-relaxed">{p}</p>)}</div></div>}
    </article>
  );
}

export default function InfoPage() {
  const { language, isRTL } = useLanguage();
  const l = language as L;
  return (
    <div className={language==="ar"?"font-arabic":"font-latin"} dir={isRTL?"rtl":"ltr"} style={{minHeight:"100vh",background:"linear-gradient(160deg,#031409 0%,#061a12 40%,#0a2318 100%)"}}>
      <main>
        <section aria-label="Informations legales GreenGo" className="relative overflow-hidden px-6 py-16 text-center">
                <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23C9A96E%22%20stroke-width%3D%220.5%22%3E%3Cpolygon%20points%3D%2240%2C5%2047%2C18%2062%2C18%2051%2C27%2055%2C42%2040%2C34%2025%2C42%2029%2C27%2018%2C18%2033%2C18%22/%3E%3C/g%3E%3C/svg%3E")',backgroundSize:'80px 80px'}} />
          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-full px-4 py-1.5 mb-5">
              <span>🏛️</span><span className="text-[11px] font-bold tracking-widest uppercase text-amber-300">{l==="ar"?"معلومات قانونية · مايو 2026":l==="fr"?"Informations Legales · Mai 2026":"Legal Information · May 2026"}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
              {l==="ar"?"معلومات":l==="fr"?"Informations":"Legal"}<br/>
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">{l==="ar"?"قانونية":l==="fr"?"Legales":"Information"}</span>
            </h1>
            <div className="h-0.5 w-24 mx-auto my-4 bg-gradient-to-r from-amber-500 to-green-600" />
            <p className="text-white/45 text-base leading-relaxed max-w-md mx-auto font-light">{l==="ar"?"البيانات القانونية ومعلومات شركة GreenGo Market.":l==="fr"?"Mentions legales et informations sur la societe GreenGo Market.":"Legal notices and information about GreenGo Market."}</p>
          </div>
        </section>
        <nav aria-label="Navigation legale" className="px-6 mb-8 max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {NAV.map(x=><Link key={x.to} to={x.to} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${"active" in x?"bg-green-700/30 border-green-600/50 text-green-300":"bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70"}`}>{x.l[l]}</Link>)}
          </div>
        </nav>
        <section aria-label="Contenu informations legales" className="px-6 pb-8 max-w-3xl mx-auto">
          <div className="flex flex-col gap-3">{SECTIONS.map(s=><Acc key={s.id} s={s} lang={language}/>)}</div>
        </section>
        <section aria-label="Contact informations legales" className="px-6 pb-24 max-w-xl mx-auto text-center">
          <div className="bg-gradient-to-br from-white/5 to-green-900/10 backdrop-blur-xl border border-amber-700/20 rounded-3xl p-8">
            <span className="text-4xl block mb-3">🏛️</span>
            <h2 className="text-lg font-black text-white mb-2">{l==="ar"?"اتصل بنا":l==="fr"?"Nous contacter":"Contact Us"}</h2>
            <p className="text-white/45 text-sm mb-5">{l==="ar"?"فريقنا متاح لأي سؤال قانوني.":l==="fr"?"Notre equipe est disponible pour toute question.":"Our team is available for any question."}</p>
            <a href="mailto:team@mygreengoo.com?subject=Information legale" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity">team@mygreengoo.com</a>
          </div>
        </section>
      </main>
      <nav aria-label="Fil ariane" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2 rounded-full text-xs border border-amber-800/20" style={{background:"rgba(6,26,18,0.88)",backdropFilter:"blur(12px)"}}>
        <Link to="/" className="text-green-400 font-semibold">GreenGo</Link><span className="text-white/25">/</span><span className="text-amber-400 font-semibold">{l==="ar"?"معلومات":"Informations"}</span>
      </nav>
    </div>
  );
}
