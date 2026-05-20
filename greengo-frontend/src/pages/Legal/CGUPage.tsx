// src/pages/legal/CGUPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";

interface Section { id:string; emoji:string; title:string; content:string[]; }

const SECTIONS: Section[] = [
  { id:"intro", emoji:"📋", title:"1. Objet et champ d application",
    content:["Les presentes CGU regissent l utilisation du site GreenGo Market, specialise dans la livraison de produits frais a domicile au Maroc.","En accedant a www.mygreengoo.com et en passant une commande, vous acceptez sans reserve les presentes CGU dans leur integralite.","GreenGo Market se reserve le droit de modifier ces conditions. Les modifications prennent effet des leur publication sur le site."] },
  { id:"compte", emoji:"👤", title:"2. Compte client et responsabilites",
    content:["Pour commander, utilisez notre formulaire en ligne ou contactez-nous via WhatsApp au +212 664 500 789.","Vous etes responsable de l exactitude des informations fournies (nom, adresse, telephone). Toute erreur entrainant un echec de livraison ne peut etre imputee a GreenGo Market.","GreenGo Market traite vos donnees conformement a la loi marocaine 09-08 sur la protection des donnees personnelles."] },
  { id:"commandes", emoji:"🛒", title:"3. Passation et confirmation des commandes",
    content:["Toute commande est soumise a la disponibilite des produits. GreenGo Market peut annuler ou modifier une commande en cas de rupture de stock, avec notification immediate.","La confirmation est envoyee par WhatsApp dans les 30 minutes. Sans confirmation, contactez-nous au +212 664 500 789.","Les prix sont en Dirhams Marocains (MAD) et peuvent varier selon les cours du marche. Le prix applicable est celui affiche a la confirmation."] },
  { id:"livraison", emoji:"🛵", title:"4. Livraison",
    content:["GreenGo Market livre a Sale, Rabat et Temara du lundi au samedi de 8h00 a 20h00.","Delai de livraison : 2 a 4 heures apres confirmation, sous reserve de disponibilite des livreurs.","Livraison offerte le premier mois. Ensuite : gratuite au-dessus de 200 MAD, sinon 15 MAD. En cas d absence, le livreur vous contacte. Sans reponse sous 10 minutes, un nouveau creneau est convenu."] },
  { id:"paiement", emoji:"💳", title:"5. Modalites de paiement",
    content:["Modes acceptes : especes a la livraison (COD), virement bancaire, paiement en ligne par carte via interface securisee.","Tous les paiements en ligne sont chiffres. GreenGo Market ne conserve aucune donnee bancaire.","Pour tout litige de paiement, contactez-nous sous 48h a team@mygreengoo.com."] },
  { id:"qualite", emoji:"🌿", title:"6. Qualite et fraicheur des produits",
    content:["GreenGo Market livre uniquement des produits frais selectionnes chaque matin aupres de fournisseurs locaux certifies.","Produit non conforme ? Signalez-le sous 24h via WhatsApp avec photo. Nous procedons au remplacement ou remboursement.","La fraicheur et la qualite de chaque produit sont controlees avant expedition."] },
  { id:"responsabilite", emoji:"⚖️", title:"7. Limitation de responsabilite",
    content:["GreenGo Market n est pas responsable des dommages indirects ou retards lies a des circonstances exceptionnelles (meteo, greves, etc.).","La responsabilite totale de GreenGo Market ne peut exceder le montant de la commande concernee.","La disponibilite ininterrompue du site n est pas garantie. Les maintenances sont annoncees 24h a l avance."] },
  { id:"droit", emoji:"🏛️", title:"8. Droit applicable et litiges",
    content:["Les presentes CGU sont soumises au droit marocain. En cas de litige, les parties cherchent une solution amiable sous 30 jours.","A defaut d accord, tout litige est soumis aux tribunaux de Rabat-Sale, Maroc.","Contact : team@mygreengoo.com ou WhatsApp +212 664 397 031."] },
];

const LEGAL_LINKS = [
  { to:"/legal/cgu",     label:"CGU & CGV",       active:true  },
  { to:"/legal/privacy", label:"Confidentialite", active:false },
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

export default function CGUPage() {
  const { language } = useLanguage();
  return (
    <div className={language==="ar"?"font-arabic":"font-latin"} style={{minHeight:"100vh",background:"linear-gradient(160deg,#031409 0%,#061a12 40%,#0a2318 100%)"}}>
      <main>
        <section aria-label="CGU GreenGo Market" className="relative overflow-hidden px-6 py-16 text-center">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{backgroundImage:"url(%22data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23C9A96E%22%20stroke-width%3D%220.5%22%3E%3Cpolygon%20points%3D%2240%2C5%2047%2C18%2062%2C18%2051%2C27%2055%2C42%2040%2C34%2025%2C42%2029%2C27%2018%2C18%2033%2C18%22/%3E%3C/g%3E%3C/svg%3E%22)",backgroundSize:"80px 80px"}} />
          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-full px-4 py-1.5 mb-5">
              <span>📜</span>
              <span className="text-[11px] font-bold tracking-widest uppercase text-amber-300">Document legal · Mis a jour Mai 2026</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
              Conditions Generales<br/>
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">d Utilisation</span>
            </h1>
            <div className="h-0.5 w-24 mx-auto my-4 bg-gradient-to-r from-amber-500 to-green-600" />
            <p className="text-white/45 text-base leading-relaxed max-w-md mx-auto font-light">Regles encadrant votre utilisation des services GreenGo Market et vos droits en tant que client.</p>
          </div>
        </section>
        <nav aria-label="Navigation legale" className="px-6 mb-8 max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {LEGAL_LINKS.map(l=>(
              <Link key={l.to} to={l.to} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${l.active?"bg-green-700/30 border-green-600/50 text-green-300":"bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70"}`}>{l.label}</Link>
            ))}
          </div>
        </nav>
        <section aria-label="Resume CGU" className="px-6 mb-8 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[{e:"🛵",t:"Livraison",d:"2 a 4 heures"},{e:"🌿",t:"Qualite",d:"Fraicheur garantie"},{e:"💳",t:"Paiement",d:"Cash ou en ligne"},{e:"📞",t:"Support",d:"WhatsApp 24/7"}].map(x=>(
              <div key={x.t} className="bg-white/[0.04] border border-amber-800/15 rounded-xl p-3 text-center">
                <span className="text-2xl block mb-1">{x.e}</span>
                <p className="text-white font-bold text-xs">{x.t}</p>
                <p className="text-white/40 text-[10px]">{x.d}</p>
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Contenu CGU" className="px-6 pb-8 max-w-3xl mx-auto">
          <p className="text-white/40 text-xs mb-4">{SECTIONS.length} sections</p>
          <div className="flex flex-col gap-3">{SECTIONS.map(s=><Accordion key={s.id} section={s}/>)}</div>
        </section>
        <section aria-label="Contact legal" className="px-6 pb-24 max-w-xl mx-auto text-center">
          <div className="bg-gradient-to-br from-white/5 to-green-900/10 backdrop-blur-xl border border-amber-700/20 rounded-3xl p-8">
            <span className="text-4xl block mb-3">⚖️</span>
            <h2 className="text-lg font-black text-white mb-2">Une question juridique ?</h2>
            <p className="text-white/45 text-sm leading-relaxed mb-5">Notre equipe est disponible pour toute question relative a vos droits et obligations.</p>
            <a href="mailto:team@mygreengoo.com?subject=Question CGU - GreenGo Market" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity">team@mygreengoo.com</a>
          </div>
        </section>
      </main>
      <nav aria-label="Fil ariane" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2 rounded-full text-xs border border-amber-800/20" style={{background:"rgba(6,26,18,0.88)",backdropFilter:"blur(12px)"}}>
        <Link to="/" className="text-green-400 font-semibold hover:text-green-300">GreenGo</Link>
        <span className="text-white/25">/</span>
        <span className="text-white/40">Legal</span>
        <span className="text-white/25">/</span>
        <span className="text-amber-400 font-semibold">CGU</span>
      </nav>
    </div>
  );
}