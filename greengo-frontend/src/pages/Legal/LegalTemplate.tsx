// src/pages/Legal/LegalTemplate.tsx
import { Link } from "react-router-dom";
import { ChevronRight, Leaf, FileText } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LegalSection {
  heading: string;
  body:    string;
}

interface LegalTemplateProps {
  title:       string;
  subtitle?:   string;
  lastUpdated?: string;
  sections:    LegalSection[];
}

// ── Preset page configs ───────────────────────────────────────────────────────
export const LEGAL_PAGES: Record<string, Omit<LegalTemplateProps, "sections"> & { sections: LegalSection[] }> = {
  cgu: {
    title: "Conditions Générales d'Utilisation",
    subtitle: "CGU & CGV - GreenGo Market",
    lastUpdated: "1er janvier 2025",
    sections: [
      {
        heading: "1. Objet",
        body: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme GreenGo Market, service de livraison de produits alimentaires frais opérant à Casablanca et dans les villes limitrophes.",
      },
      {
        heading: "2. Acceptation des conditions",
        body: "En accédant à notre site ou en passant une commande, vous acceptez sans réserve les présentes CGU. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.",
      },
      {
        heading: "3. Services proposés",
        body: "GreenGo Market propose la vente en ligne de fruits, légumes et viandes blanches fraîches avec livraison à domicile. Les prix sont indiqués en Dirhams Marocains (MAD) et sont susceptibles d'évoluer selon la disponibilité saisonnière.",
      },
      {
        heading: "4. Commandes",
        body: "Toute commande passée via notre plateforme constitue un contrat de vente entre l'acheteur et GreenGo Market. Les commandes sont confirmées par WhatsApp dans un délai de 30 minutes.",
      },
      {
        heading: "5. Livraison",
        body: "La livraison est assurée dans un rayon de 15 km autour de Casablanca, dans un délai de 2 à 4 heures selon la disponibilité. Les frais de livraison sont offerts pour tout premier mois d'abonnement.",
      },
      {
        heading: "6. Politique de retour",
        body: "En cas de produit défectueux ou non conforme, le client dispose de 24 heures pour signaler le problème via WhatsApp. GreenGo s'engage à procéder à un remplacement ou un remboursement.",
      },
      {
        heading: "7. Limitation de responsabilité",
        body: "GreenGo Market ne peut être tenu responsable des retards liés à des événements de force majeure (intempéries, grèves, etc.) ou des variations de disponibilité des produits frais.",
      },
    ],
  },
  privacy: {
    title: "Politique de Confidentialité",
    subtitle: "Protection de vos données personnelles",
    lastUpdated: "1er janvier 2025",
    sections: [
      {
        heading: "Collecte des données",
        body: "Nous collectons uniquement les données nécessaires à la réalisation de vos commandes : nom, numéro de téléphone, adresse de livraison et coordonnées GPS (optionnel). Aucune donnée bancaire n'est stockée sur nos serveurs.",
      },
      {
        heading: "Utilisation des données",
        body: "Vos données sont utilisées exclusivement pour le traitement de vos commandes, la communication via WhatsApp et l'amélioration de nos services. Elles ne sont jamais vendues à des tiers.",
      },
      {
        heading: "Conservation des données",
        body: "Vos données de commandes sont conservées pendant 3 ans conformément à la législation marocaine. Vous pouvez demander la suppression de vos données à tout moment via notre email.",
      },
      {
        heading: "Droits RGPD",
        body: "Conformément à la loi 09-08 relative à la protection des données personnelles au Maroc, vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles.",
      },
      {
        heading: "Contact",
        body: "Pour toute question relative à vos données personnelles, contactez-nous à : CONTACT@MYGRENGO.COM ou via WhatsApp au +212 664 397 031.",
      },
    ],
  },
  terms: {
    title: "Conditions Générales de Vente",
    subtitle: "CGV - GreenGo Market",
    lastUpdated: "1er janvier 2025",
    sections: [
      {
        heading: "Prix et paiement",
        body: "Tous les prix sont affichés en Dirhams Marocains (MAD) TTC. Le paiement est accepté en espèces à la livraison ou par carte bancaire via CMI (Visa / Mastercard).",
      },
      {
        heading: "Disponibilité des produits",
        body: "Les produits frais sont soumis à disponibilité saisonnière. En cas d'indisponibilité après la commande, notre équipe vous contactera pour proposer un produit de substitution ou un remboursement.",
      },
      {
        heading: "Livraison et délais",
        body: "Les livraisons sont effectuées entre 8h et 20h, du lundi au samedi. Le délai moyen est de 2 à 4 heures. GreenGo s'engage à vous informer en temps réel de l'avancement de votre livraison.",
      },
    ],
  },
  info: {
    title: "Informations Légales",
    subtitle: "Mentions légales - GreenGo Market",
    lastUpdated: "1er janvier 2025",
    sections: [
      {
        heading: "Éditeur du site",
        body: "GreenGo Market - Société à Responsabilité Limitée (SARL) au capital de 100 000 MAD. RC : Casablanca · Patente : XXXXXXXX · IF : XXXXXXXX",
      },
      {
        heading: "Siège social",
        body: "Lot N° 145 Lotissement EL MOUSTAKBAL, Laayayda, Salé - Maroc. Email : CONTACT@MYGRENGO.COM · Téléphone : +212 664 500 789",
      },
      {
        heading: "Hébergement",
        body: "Ce site est hébergé par des serveurs sécurisés en Europe, conformes aux standards RGPD et à la loi marocaine 09-08 sur la protection des données.",
      },
    ],
  },
  recrutement: {
    title: "Recrutement",
    subtitle: "Rejoignez l'équipe GreenGo 🌿",
    lastUpdated: undefined,
    sections: [
      {
        heading: "Notre vision",
        body: "GreenGo Market révolutionne la distribution alimentaire au Maroc en connectant les producteurs locaux directement aux consommateurs urbains. Nous cherchons des talents passionnés qui partagent cette vision.",
      },
      {
        heading: "Postes ouverts",
        body: "🛵 Livreurs (Casablanca, Rabat, Salé) - temps plein ou partiel.\n📱 Community Manager (réseaux sociaux + WhatsApp).\n💻 Développeur Full-Stack (React / Python / MongoDB).\n🥬 Responsable approvisionnement (marchés de gros).",
      },
      {
        heading: "Avantages",
        body: "Salaire compétitif · Panier repas · Mutuelle · Formation continue · Ambiance startup dynamique · Impact social direct sur l'agriculture locale marocaine.",
      },
      {
        heading: "Postuler",
        body: "Envoyez votre CV et une lettre de motivation à : CONTACT@MYGRENGO.COM avec l'objet « Candidature - [Poste] ».\nOu contactez-nous directement sur WhatsApp : +212 664 397 031.",
      },
    ],
  },
};

// ── LegalTemplate ─────────────────────────────────────────────────────────────
export default function LegalTemplate({ title, subtitle, lastUpdated, sections }: LegalTemplateProps) {
  return (
    <div className="min-h-screen" style={{ background: "#F6F7F9" }}>

      {/* Page hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0d3b36 0%,#1a5c4a 60%,#2E8B57 100%)" }}>
        <div className="absolute inset-0 zellige-bg-light opacity-10 pointer-events-none" />
        <div className="mx-auto max-w-4xl px-5 py-10">
          <div className="flex items-center gap-2 mb-4 text-white/40 text-xs">
            <Link to="/" className="hover:text-white/70 transition-colors">Accueil</Link>
            <ChevronRight size={12} />
            <span className="text-white/60">{title}</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white md:text-3xl" style={{ letterSpacing: "-0.02em" }}>{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
              {lastUpdated && <p className="mt-2 text-xs text-white/35">Dernière mise à jour : {lastUpdated}</p>}
            </div>
          </div>
        </div>
        <div className="zellige-border" />
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-5 py-10">
        <article className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm md:p-12">
          <div className="prose prose-sm max-w-none space-y-8">
            {sections.map((section, i) => (
              <section key={i} className="space-y-3">
                <h2 className="text-base font-extrabold text-gray-800 border-l-4 border-[#2E8B57] pl-4">
                  {section.heading}
                </h2>
                <div className="pl-4">
                  {section.body.split("\n").map((line, j) => (
                    <p key={j} className="text-sm leading-relaxed text-gray-600">{line}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-10 border-t border-gray-100 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2E8B57]">
                  <Leaf size={14} className="text-white" />
                </div>
                <span className="text-sm font-extrabold text-gray-700">GreenGo Market</span>
              </div>
              <p className="text-xs text-gray-400">
                Des questions ? Contactez-nous à{" "}
                <a href="mailto:CONTACT@MYGRENGO.COM" className="text-[#2E8B57] hover:underline">CONTACT@MYGRENGO.COM</a>
              </p>
              <Link to="/"
                className="flex items-center gap-1.5 rounded-xl bg-[#2E8B57] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1F6B40]">
                <Leaf size={11} />
                Retour à la boutique
              </Link>
            </div>
          </div>
        </article>
      </div>

    </div>
  );
}
