// src/pages/legal/PrivacyPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";

interface Section { id:string; emoji:string; title:string; content:string[]; }

const SECTIONS: Section[] = [
  { id:"collecte", emoji:"🔍", title:"1. Donnees collectees",
    content:["GreenGo Market collecte : nom, adresse de livraison, telephone, coordonnees GPS (si accordees) et historique commandes. Ces donnees sont collectees directement lors de vos commandes via notre site ou WhatsApp.",
    "Nous ne collectons aucune donnee sensible. Les paiements sont traites par des prestataires certifies PCI-DSS.",
    "Aucune donnee n est collectee a votre insu ou pour des finalites non mentionnees dans cette politique."] },
  { id:"utilisation", emoji:"⚙️", title:"2. Utilisation des donnees",
    content:["Vos donnees sont utilisees pour : traitement et livraison de commandes, communication WhatsApp liee a votre commande, amelioration de nos services.",
    "Votre telephone est utilise uniquement pour les notifications de commande. Vous pouvez vous desinscrire a tout moment.",
    "Vos donnees ne sont jamais utilisees a des fins publicitaires tierces, ni vendues ni echangees."] },
  { id:"partage", emoji:"🤝", title:"3. Partage des informations",
    content:["Vos donnees sont partagees uniquement avec nos livreurs (nom, adresse, telephone) et prestataires de paiement, strictement pour executer votre commande.",
    "Nos partenaires sont contractuellement tenus de proteger vos donnees.",
    "GreenGo Market peut divulguer vos donnees aux autorites si la loi l exige."] },
  { id:"conservation", emoji:"🗂️", title:"4. Conservation des donnees",
    content:["Vos donnees sont conservees 3 ans apres votre derniere commande, conformement a la loi marocaine 09-08.",
    "Les donnees financieres sont conservees 10 ans selon les obligations comptables marocaines.",
    "A l expiration de ces delais, vos donnees sont supprimees de facon securisee ou anonymisees."] },
  { id:"securite", emoji:"🔒", title:"5. Securite des donnees",
    content:["GreenGo Market applique des mesures techniques appropriees : chiffrement HTTPS/TLS, acces restreint aux bases de donnees, hebergement securise.",
    "Les paiements en ligne sont traites par des prestataires certifies. Nous ne stockons aucune donnee bancaire.",
    "En cas de violation de donnees, vous serez informe dans les meilleurs delais."] },
  { id:"droits", emoji:"✅", title:"6. Vos droits",
    content:["Conformement a la loi 09-08, vous disposez des droits d acces, rectification, opposition et effacement de vos donnees personnelles.",
    "Pour exercer ces droits : team@mygreengoo.com ou courrier a Lot N 145, Lotissement EL MOUSTAKBAL, Laayayda, Sale.",
    "Reponse garantie sous 30 jours. En cas de litige, vous pouvez saisir la CNDP du Maroc."] },
  { id:"cookies", emoji:"🍪", title:"7. Cookies",
    content:["Nous utilisons des cookies techniques necessaires au fonctionnement (session, panier, langue). Ils ne necessitent pas votre consentement.",
    "Des cookies analytiques anonymises mesurent l audience. Vous pouvez les refuser via notre bandeau.",
    "Aucun cookie publicitaire tiers n est utilise sur notre plateforme."] },
  { id:"modifications", emoji:"📝", title:"8. Modifications",
    content:["GreenGo Market peut modifier cette politique pour s adapter aux evolutions legales ou techniques.",
    "Toute modification substantielle sera notifiee par WhatsApp ou sur le site 15 jours avant entree en vigueur.",
    "La version en vigueur est celle sur cette page. L utilisation continue de nos services vaut acceptation."] },
];

const LEGAL_LINKS = [
  { to:"/legal/cgu",     label:"CGU & CGV",       active:false },
  { to:"/legal/privacy", label:"Confidentialite", active:true  },
  { to:"/legal/terms",   label:"Conditions",      active:false },
  { to:"/legal/info",    label:"Informations",    active:false },
];

function Accordion({ section }: { section:Section }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`rounded-2xl border transition-all duration-300 overflow-hidden ${open?"border-green-500/40 bg-green-900/10":"border-amber-800/20 bg-white/[0.03]"}`}>
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center gap-4 p-5 text-left group" aria-expanded={open}>
        <span className="text-3xl shrink-0">{section.emoji}</span>
        <h2 className="flex-1 text-white font-bold text-base group-hover:text-green-300 transition-colors">{section.title}</h2>
        <span className={`text-lg shrink-0 transition-transform duration-300 ${open?"rotate-180 text-green-400":"text-white/30"}`}>▾</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-white/8">
          <div className="pt-4 space-y-3">
            {section.content.map((p,i)=><p key={i} className="text-white/60 text-sm leading-relaxed">{p}</p>)}
          </div>
        </div>
      )}
    </article>
  );
}

export default function PrivacyPage() {
  const { language } = useLanguage();
  return (
    <div className={language==="ar"?"font-arabic":"font-latin"} style={{minHeight:"100vh",background:"linear-gradient(160deg,#031409 0%,#061a12 40%,#0a2318 100%)"}}>
      <main>
        <section aria-label="Politique confidentialite GreenGo" className="relative overflow-hidden px-6 py-16 text-center">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{backgroundImage:"url(%22data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23C9A96E%22%20stroke-width%3D%220.5%22%3E%3Cpolygon%20points%3D%2240%2C5%2047%2C18%2062%2C18%2051%2C27%2055%2C42%2040%2C34%2025%2C42%2029%2C27%2018%2C18%2033%2C18%22/%3E%3C/g%3E%3C/svg%3E%22)",backgroundSize:"80px 80px"}} />
          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-full px-4 py-1.5 mb-5">
              <span>🔒</span>
              <span className="text-[11px] font-bold tracking-widest uppercase text-amber-300">Confidentialite · Mis a jour Mai 2026</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
              Politique de<br/>
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">Confidentialite</span>
            </h1>
            <div className="h-0.5 w-24 mx-auto my-4 bg-gradient-to-r from-amber-500 to-green-600" />
            <p className="text-white/45 text-base leading-relaxed max-w-md mx-auto font-light">
              Comment GreenGo Market collecte, utilise et protege vos donnees personnelles conformement a la loi marocaine 09-08.
            </p>
          </div>
        </section>
        <nav aria-label="Navigation legale" className="px-6 mb-8 max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {LEGAL_LINKS.map(l=>(
              <Link key={l.to} to={l.to} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${l.active?"bg-green-700/30 border-green-600/50 text-green-300":"bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70"}`}>{l.label}</Link>
            ))}
          </div>
        </nav>
        <section aria-label="Points cles" className="px-6 mb-8 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[{e:"🚫",t:"Zero vente",d:"Jamais revendues"},{e:"🔐",t:"Chiffrement",d:"HTTPS & TLS"},{e:"📅",t:"Conservation",d:"3 ans max"},{e:"✉️",t:"Vos droits",d:"Reponse 30j"}].map(x=>(
              <div key={x.t} className="bg-white/[0.04] border border-amber-800/15 rounded-xl p-3 text-center">
                <span className="text-2xl block mb-1">{x.e}</span>
                <p className="text-white font-bold text-xs">{x.t}</p>
                <p className="text-white/40 text-[10px]">{x.d}</p>
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Contenu politique" className="px-6 pb-8 max-w-3xl mx-auto">
          <p className="text-white/40 text-xs mb-4">{SECTIONS.length} sections</p>
          <div className="flex flex-col gap-3">{SECTIONS.map(s=><Accordion key={s.id} section={s}/>)}</div>
        </section>
        <section aria-label="Contact DPO" className="px-6 pb-24 max-w-xl mx-auto text-center">
          <div className="bg-gradient-to-br from-white/5 to-green-900/10 backdrop-blur-xl border border-amber-700/20 rounded-3xl p-8">
            <span className="text-4xl block mb-3">🛡️</span>
            <h2 className="text-lg font-black text-white mb-2">Exercer vos droits</h2>
            <p className="text-white/45 text-sm leading-relaxed mb-5">Contactez notre Delegue a la Protection des Donnees pour toute demande d acces, rectification ou suppression.</p>
            <a href="mailto:team@mygreengoo.com?subject=Donnees personnelles - GreenGo Market" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity">
              team@mygreengoo.com
            </a>
            <p className="text-white/25 text-xs mt-3">Reponse garantie sous 30 jours ouvrables</p>
          </div>
        </section>
      </main>
      <nav aria-label="Fil ariane" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2 rounded-full text-xs border border-amber-800/20" style={{background:"rgba(6,26,18,0.88)",backdropFilter:"blur(12px)"}}>
        <Link to="/" className="text-green-400 font-semibold hover:text-green-300">GreenGo</Link>
        <span className="text-white/25">/</span>
        <span className="text-white/40">Legal</span>
        <span className="text-white/25">/</span>
        <span className="text-amber-400 font-semibold">Confidentialite</span>
      </nav>
    </div>
  );
}