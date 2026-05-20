// src/pages/RecrutementPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const JOBS = [
  { id:"livreur", title:"Livreur Express", dept:"Logistique", loc:"Sale / Rabat", type:"Temps plein", emoji:"🛵", desc:"Assurez la livraison rapide de nos produits frais chez nos clients a Sale et Rabat.", skills:["Permis conduire","Sens du service","Ponctualite","Connaissance Sale/Rabat"] },
  { id:"stock", title:"Responsable Stock", dept:"Operations", loc:"Sale", type:"Temps plein", emoji:"📦", desc:"Gerez reception, controle qualite et stocks de produits frais. Coordination avec fournisseurs.", skills:["Organisation","Rigueur","Gestion stock","Produits frais"] },
  { id:"support", title:"Agent Service Client", dept:"Support", loc:"Teletravail/Sale", type:"Mi-temps", emoji:"💬", desc:"Traitez les demandes clients via WhatsApp avec professionnalisme et rapidite.", skills:["Francais & darija","WhatsApp Business","Empathie","Reactivite"] },
  { id:"dev", title:"Developpeur Full-Stack", dept:"Tech", loc:"Teletravail", type:"Stage ou CDI", emoji:"💻", desc:"Developpez notre plateforme React/FastAPI/MongoDB a fort impact client.", skills:["React/TypeScript","Python/FastAPI","MongoDB","Git"] },
];

const BENEFITS = [
  { e:"🌿", t:"Mission avec du sens", d:"Rendez l alimentation saine accessible a tous les Marocains." },
  { e:"🚀", t:"Startup en croissance", d:"Evoluez dans une entreprise agile ou chaque idee compte." },
  { e:"💚", t:"Produits frais offerts", d:"Selection hebdomadaire de fruits et legumes offerte." },
  { e:"📈", t:"Evolution rapide", d:"Responsabilites reelles et plan de carriere clair." },
  { e:"🤝", t:"Equipe soudee", d:"Ambiance familiale et management de proximite." },
  { e:"🎯", t:"Impact direct", d:"Vos actions ont un effet immediat sur nos clients." },
];

function JobCard({ job }: { job: typeof JOBS[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`rounded-2xl border transition-all duration-300 overflow-hidden ${open ? "border-green-500/40 bg-green-900/10" : "border-amber-800/20 bg-white/[0.03]"}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 p-5 text-left">
        <span className="text-4xl shrink-0">{job.emoji}</span>
        <div className="flex-1">
          <h3 className="text-white font-bold text-base mb-1.5">{job.title}</h3>
          <div className="flex flex-wrap gap-2">
            {[{l:job.dept,c:"text-green-400 bg-green-900/30 border-green-700/40"},{l:job.loc,c:"text-amber-300 bg-amber-900/20 border-amber-700/30"},{l:job.type,c:"text-white/50 bg-white/5 border-white/10"}].map(({l,c})=>(
              <span key={l} className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${c}`}>{l}</span>
            ))}
          </div>
        </div>
        <span className={`text-lg shrink-0 transition-transform duration-300 ${open ? "rotate-180 text-green-400" : "text-white/30"}`}>▾</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-white/8">
          <p className="text-white/60 text-sm leading-relaxed mt-4 mb-4">{job.desc}</p>
          <p className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-2">Competences</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {job.skills.map(s => <span key={s} className="text-xs font-semibold px-3 py-1 rounded-lg bg-green-900/20 border border-green-700/30 text-green-400">+ {s}</span>)}
          </div>
          <a href={`mailto:team@mygreengoo.com?subject=Candidature - ${job.title}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity">
            📩 Postuler maintenant
          </a>
        </div>
      )}
    </article>
  );
}

export default function RecrutementPage() {
  const { language } = useLanguage();
  return (
    <div className={language === "ar" ? "font-arabic" : "font-latin"} style={{ minHeight:"100vh", background:"linear-gradient(160deg,#031409 0%,#061a12 40%,#0a2318 100%)" }}>
      <main>

        {/* Hero */}
        <section aria-label="Rejoindre GreenGo Market" className="relative overflow-hidden px-6 py-20 text-center">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{backgroundImage:"url(%22data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23C9A96E%22%20stroke-width%3D%220.5%22%3E%3Cpolygon%20points%3D%2240%2C5%2047%2C18%2062%2C18%2051%2C27%2055%2C42%2040%2C34%2025%2C42%2029%2C27%2018%2C18%2033%2C18%22/%3E%3C/g%3E%3C/svg%3E%22)",backgroundSize:"80px 80px"}} />
          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-full px-4 py-1.5 mb-6">
              <span>🇲🇦</span>
              <span className="text-[11px] font-bold tracking-widest uppercase text-amber-300">Carrieres · GreenGo Market · Sale, Maroc</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight mb-4">
              Construisons l avenir<br/>
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">de l epicerie marocaine</span>
            </h1>
            <div className="h-0.5 w-28 mx-auto my-5 bg-gradient-to-r from-amber-500 to-green-600" />
            <p className="text-white/50 text-lg leading-relaxed max-w-md mx-auto font-light">
              Startup marocaine en pleine croissance. Rejoignez une equipe passionnee et ayez un impact reel des le premier jour.
            </p>
          </div>
        </section>

        {/* Benefits */}
        <section aria-label="Avantages employes GreenGo" className="px-6 py-12 max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-amber-400 text-center mb-2 tracking-tight">Pourquoi rejoindre GreenGo ?</h2>
          <p className="text-center text-white/40 text-sm mb-10">Ce que nous offrons a chaque membre de l equipe</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map(b => (
              <div key={b.t} className="bg-white/[0.03] border border-amber-800/15 rounded-2xl p-6 hover:border-green-700/30 transition-colors">
                <span className="text-3xl block mb-3">{b.e}</span>
                <h3 className="text-white font-bold text-sm mb-2">{b.t}</h3>
                <p className="text-white/45 text-xs leading-relaxed">{b.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Jobs */}
        <section aria-label="Offres emploi GreenGo Market" className="px-6 py-12 max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-2 tracking-tight">Nos offres d emploi</h2>
          <p className="text-center text-white/40 text-sm mb-8">Cliquez sur une offre pour postuler</p>
          <div className="flex flex-col gap-3">{JOBS.map(job => <JobCard key={job.id} job={job} />)}</div>
        </section>

        {/* Spontaneous */}
        <section aria-label="Candidature spontanee" className="px-6 py-12 pb-24 max-w-xl mx-auto text-center">
          <div className="bg-gradient-to-br from-white/5 to-green-900/10 backdrop-blur-xl border border-amber-700/20 rounded-3xl p-10">
            <span className="text-5xl block mb-4">📩</span>
            <h2 className="text-xl font-black text-white mb-3">Vous ne trouvez pas votre poste ?</h2>
            <p className="text-white/45 text-sm leading-relaxed mb-6">Envoyez une candidature spontanee. Nous vous contacterons des qu une opportunite se presente.</p>
            <a href="mailto:team@mygreengoo.com?subject=Candidature spontanee - GreenGo Market" className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-green-700 to-green-900 border border-green-600/50 rounded-xl text-white font-bold hover:opacity-90 transition-opacity shadow-lg shadow-green-900/40">
              team@mygreengoo.com
            </a>
          </div>
        </section>
      </main>
      <nav aria-label="Fil ariane" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2 rounded-full text-xs border border-amber-800/20" style={{background:"rgba(6,26,18,0.88)",backdropFilter:"blur(12px)"}}>
        <Link to="/" className="text-green-400 font-semibold hover:text-green-300 transition-colors">GreenGo</Link>
        <span className="text-white/25">/</span>
        <span className="text-amber-400 font-semibold">Recrutement</span>
      </nav>
    </div>
  );
}