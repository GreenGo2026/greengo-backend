// src/pages/legal/TermsPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";

type L = "fr" | "ar" | "en";
interface Sec { id:string; e:string; title:Record<L,string>; content:Record<L,string[]>; }

const SECTIONS: Sec[] = [
  { id:"achat", e:"🛒",
    title:{ fr:"1. Conditions d achat", ar:"1. شروط الشراء", en:"1. Purchase Conditions" },
    content:{ fr:["Tout achat sur www.mygreengoo.com implique l acceptation pleine des presentes CGV.","Les prix sont en Dirhams Marocains (MAD) TTC et peuvent etre modifies a tout moment.","Une commande est validee uniquement apres confirmation WhatsApp de GreenGo Market."],
               ar:["كل شراء على موقعنا يعني قبول هذه الشروط كاملة.","الأسعار بالدرهم المغربي شاملة للضريبة وقابلة للتغيير.","تُعدّ الطلبية نهائية بعد تأكيد واتساب من GreenGo Market."],
               en:["Any purchase on our site implies full acceptance of these terms.","Prices are in MAD including taxes and may change at any time.","An order is final only after WhatsApp confirmation from GreenGo Market."] } },
  { id:"livraison", e:"🛵",
    title:{ fr:"2. Livraison et delais", ar:"2. التوصيل والمواعيد", en:"2. Delivery & Timing" },
    content:{ fr:["Livraison disponible a Sale, Rabat et Temara, du lundi au samedi de 8h a 20h.","Delai moyen : 2 a 4 heures apres confirmation de commande.","Livraison offerte le premier mois, puis gratuite au-dessus de 200 MAD (sinon 15 MAD)."],
               ar:["التوصيل متاح في سلا والرباط وتمارة من الاثنين إلى السبت 8ص-8م.","المدة المتوسطة: 2 إلى 4 ساعات بعد التأكيد.","مجاني الشهر الأول، ثم مجاني فوق 200 درهم (وإلا 15 درهم)."],
               en:["Delivery in Sale, Rabat and Temara, Mon-Sat 8am-8pm.","Average time: 2-4 hours after order confirmation.","Free first month, then free above 200 MAD (otherwise 15 MAD)."] } },
  { id:"retour", e:"🔄",
    title:{ fr:"3. Retours et remboursements", ar:"3. الإرجاع والاسترداد", en:"3. Returns & Refunds" },
    content:{ fr:["Produit non conforme : signalez-le sous 24h via WhatsApp avec photo.","GreenGo Market remplace ou rembourse sous 48h.","Les produits frais conformes a la commande ne peuvent etre retournes."],
               ar:["منتج غير مطابق: أبلغ عنه خلال 24 ساعة عبر واتساب مع صورة.","تستبدل GreenGo Market أو تسترد المبلغ خلال 48 ساعة.","لا يمكن إرجاع المنتجات الطازجة المطابقة للطلب."],
               en:["Non-conforming product: report within 24h via WhatsApp with photo.","GreenGo Market replaces or refunds within 48h.","Fresh products matching the order cannot be returned."] } },
  { id:"paiement", e:"💳",
    title:{ fr:"4. Paiement", ar:"4. الدفع", en:"4. Payment" },
    content:{ fr:["Modes acceptes : especes a la livraison, virement bancaire, carte en ligne (SSL).","Aucune donnee bancaire n est conservee par GreenGo Market.","Tout litige de paiement doit etre signale sous 48h a team@mygreengoo.com."],
               ar:["طرق الدفع: نقداً، تحويل بنكي، بطاقة عبر واجهة SSL.","لا تحتفظ GreenGo Market بأي بيانات بنكية.","يجب الإبلاغ عن أي نزاع في الدفع خلال 48 ساعة."],
               en:["Accepted: cash on delivery, bank transfer, online card (SSL).","No banking data stored by GreenGo Market.","Payment disputes must be reported within 48h."] } },
  { id:"qualite", e:"🌿",
    title:{ fr:"5. Qualite produits", ar:"5. جودة المنتجات", en:"5. Product Quality" },
    content:{ fr:["Tous nos produits sont selectionnes chaque matin aupres de fournisseurs locaux certifies.","Produit abime ou de mauvaise qualite : remplacement sans frais.","Les dates de consommation sont verifiees avant chaque expedition."],
               ar:["جميع منتجاتنا مختارة يومياً من موردين محليين معتمدين.","منتج تالف أو رديء: استبدال مجاني.","يتم التحقق من صلاحية المنتجات قبل كل شحنة."],
               en:["All products selected daily from certified local suppliers.","Damaged or poor quality product: free replacement.","Expiry dates checked before each shipment."] } },
  { id:"droit", e:"⚖️",
    title:{ fr:"6. Droit applicable", ar:"6. القانون المطبق", en:"6. Applicable Law" },
    content:{ fr:["Les presentes CGV sont soumises au droit marocain.","Tout litige sera soumis aux tribunaux competents de Rabat-Sale.","Contact : team@mygreengoo.com | WhatsApp +212 664 397 031."],
               ar:["تخضع هذه الشروط للقانون المغربي.","أي نزاع يُحال إلى محاكم الرباط-سلا.","تواصل: team@mygreengoo.com | واتساب 212664397031+"],
               en:["These terms are governed by Moroccan law.","Disputes submitted to courts of Rabat-Sale.","Contact: team@mygreengoo.com | WhatsApp +212 664 397 031."] } },
];

const NAV = [
  {to:"/legal/cgu",     l:{fr:"CGU",ar:"شروط",en:"TOU"}},
  {to:"/legal/privacy", l:{fr:"Confidentialite",ar:"الخصوصية",en:"Privacy"}},
  {to:"/legal/terms",   l:{fr:"Conditions",ar:"الشروط العامة",en:"Terms"}, active:true},
  {to:"/legal/info",    l:{fr:"Informations",ar:"معلومات",en:"Info"}},
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

export default function TermsPage() {
  const { language, isRTL } = useLanguage();
  const l = language as L;
  return (
    <div className={language==="ar"?"font-arabic":"font-latin"} dir={isRTL?"rtl":"ltr"} style={{minHeight:"100vh",background:"linear-gradient(160deg,#031409 0%,#061a12 40%,#0a2318 100%)"}}>
      <main>
        <section aria-label="Conditions generales de vente GreenGo" className="relative overflow-hidden px-6 py-16 text-center">
                <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23C9A96E%22%20stroke-width%3D%220.5%22%3E%3Cpolygon%20points%3D%2240%2C5%2047%2C18%2062%2C18%2051%2C27%2055%2C42%2040%2C34%2025%2C42%2029%2C27%2018%2C18%2033%2C18%22/%3E%3C/g%3E%3C/svg%3E")',backgroundSize:'80px 80px'}} />
          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-full px-4 py-1.5 mb-5">
              <span>📄</span><span className="text-[11px] font-bold tracking-widest uppercase text-amber-300">{l==="ar"?"الشروط العامة · مايو 2026":l==="fr"?"Conditions Generales · Mai 2026":"General Terms · May 2026"}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
              {l==="ar"?"الشروط العامة":l==="fr"?"Conditions Generales":"General"}<br/>
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">{l==="ar"?"للبيع":l==="fr"?"de Vente":"Terms of Sale"}</span>
            </h1>
            <div className="h-0.5 w-24 mx-auto my-4 bg-gradient-to-r from-amber-500 to-green-600" />
            <p className="text-white/45 text-base leading-relaxed max-w-md mx-auto font-light">{l==="ar"?"الإطار الكامل للعلاقة التجارية بين GreenGo Market وعملائه.":l==="fr"?"Encadrement de la relation commerciale entre GreenGo Market et ses clients.":"Complete framework of the commercial relationship between GreenGo Market and its customers."}</p>
          </div>
        </section>
        <nav aria-label="Navigation legale" className="px-6 mb-8 max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {NAV.map(x=><Link key={x.to} to={x.to} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${"active" in x?"bg-green-700/30 border-green-600/50 text-green-300":"bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70"}`}>{x.l[l]}</Link>)}
          </div>
        </nav>
        <section aria-label="Contenu CGV" className="px-6 pb-8 max-w-3xl mx-auto">
          <div className="flex flex-col gap-3">{SECTIONS.map(s=><Acc key={s.id} s={s} lang={language}/>)}</div>
        </section>
        <section aria-label="Contact CGV" className="px-6 pb-24 max-w-xl mx-auto text-center">
          <div className="bg-gradient-to-br from-white/5 to-green-900/10 backdrop-blur-xl border border-amber-700/20 rounded-3xl p-8">
            <span className="text-4xl block mb-3">📋</span>
            <h2 className="text-lg font-black text-white mb-2">{l==="ar"?"سؤال قانوني؟":l==="fr"?"Une question ?":"A question?"}</h2>
            <p className="text-white/45 text-sm mb-5">{l==="ar"?"فريقنا القانوني متاح.":l==="fr"?"Notre equipe juridique est disponible.":"Our legal team is available."}</p>
            <a href="mailto:team@mygreengoo.com?subject=Question CGV" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity">team@mygreengoo.com</a>
          </div>
        </section>
      </main>
      <nav aria-label="Fil ariane" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2 rounded-full text-xs border border-amber-800/20" style={{background:"rgba(6,26,18,0.88)",backdropFilter:"blur(12px)"}}>
        <Link to="/" className="text-green-400 font-semibold">GreenGo</Link><span className="text-white/25">/</span><span className="text-amber-400 font-semibold">{l==="ar"?"الشروط":"Conditions"}</span>
      </nav>
    </div>
  );
}
