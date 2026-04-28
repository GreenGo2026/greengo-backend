// src/App.tsx
import "./index.css";
import { useEffect }              from "react";
import CookieBanner               from "./components/ui/CookieBanner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider }       from "./contexts/LanguageContext";
import { useCartStore }           from "./store/cartStore";
import Header                     from "./components/layout/Header";
import Footer                     from "./components/layout/Footer";
import MobileBottomNav            from "./components/layout/MobileBottomNav";
import NewsletterModal            from "./components/ui/NewsletterModal";
import HeroLandingPage            from "./pages/HeroLandingPage";
import HomePage                   from "./pages/HomePage";
import CartPage                   from "./pages/CartPage";
import AdminPage                  from "./pages/AdminPage";
import AdminOrders                from "./pages/Admin/AdminOrders";
import POSPage                    from "./pages/Admin/POSPage";
import SuperAdminPage             from "./pages/SuperAdminPage";
import AboutPage                  from "./pages/AboutPage";
import ContactPage                from "./pages/ContactPage";
import PaymentGateway             from "./pages/Payment/PaymentGateway";
import UserDashboard              from "./pages/Profile/UserDashboard";
import LegalTemplate, { LEGAL_PAGES } from "./pages/Legal/LegalTemplate";

// ── Anti-scraping / anti-inspect protection ──────────────────────────────────
function useAntiScraping() {
  useEffect(() => {
    // 1. Disable right-click context menu
    const blockContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", blockContext);

    // 2. Block devtools / print shortcuts
    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;

      // F12
      if (key === "F12") { e.preventDefault(); return; }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
      if (ctrl && e.shiftKey && ["i","I","j","J","c","C"].includes(key)) { e.preventDefault(); return; }
      // Ctrl+U (view source)
      if (ctrl && ["u","U"].includes(key)) { e.preventDefault(); return; }
      // Ctrl+P (print)
      if (ctrl && ["p","P"].includes(key)) { e.preventDefault(); return; }
      // Ctrl+S (save page)
      if (ctrl && ["s","S"].includes(key)) { e.preventDefault(); return; }
      // PrintScreen — JS cannot fully block OS-level, but fires event
      if (key === "PrintScreen") { e.preventDefault(); return; }
    };
    document.addEventListener("keydown", blockKeys);

    // 3. Detect devtools open via size heuristic — blur content if opened
    const devtoolsCheck = setInterval(() => {
      const widthThreshold  = window.outerWidth  - window.innerWidth  > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      if (widthThreshold || heightThreshold) {
        document.body.style.filter = "blur(8px)";
      } else {
        document.body.style.filter = "";
      }
    }, 1000);

    // 4. Block drag-to-copy on images
    const blockDrag = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragstart", blockDrag);

    return () => {
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("dragstart", blockDrag);
      clearInterval(devtoolsCheck);
    };
  }, []);
}

// ── Public shell (all routes that show Header + Footer) ──────────────────────
function PublicShell() {
  const cart       = useCartStore((s) => s.cart);
  const totalItems = cart.reduce((sum, i) => sum + (i.cartQuantity || 0), 0);
  void totalItems;

  return (
    <div
      className="flex min-h-screen flex-col pb-16 md:pb-0"
      style={{
        background: "#FAF7F2",
        // Disable text selection on content container
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <Header />
      <main className="flex-grow">
        <Routes>
          {/* ── Storefront ── */}
          <Route path="/"             element={<HeroLandingPage />} />
          <Route path="/shop"         element={<HomePage />}        />
          <Route path="/cart"         element={<CartPage />}        />
          <Route path="/about"        element={<AboutPage />}       />
          <Route path="/contact"      element={<ContactPage />}     />

          {/* ── Admin ── */}
          <Route path="/admin"        element={<AdminPage />}       />
          <Route path="/admin/orders" element={<AdminOrders />}     />
          <Route path="/admin/pos"    element={<POSPage />}         />

          {/* ── Checkout / Payment ── */}
          <Route path="/payment"      element={<PaymentGateway />}  />

          {/* ── User account ── */}
          <Route path="/profile/user" element={<UserDashboard />}   />
          <Route path="/orders"       element={<UserDashboard />}   />
          <Route path="/addresses"    element={<UserDashboard />}   />

          {/* ── Legal pages ── */}
          <Route path="/legal/cgu"     element={<LegalTemplate {...LEGAL_PAGES.cgu}         />} />
          <Route path="/legal/privacy" element={<LegalTemplate {...LEGAL_PAGES.privacy}     />} />
          <Route path="/legal/terms"   element={<LegalTemplate {...LEGAL_PAGES.terms}       />} />
          <Route path="/legal/info"    element={<LegalTemplate {...LEGAL_PAGES.info}        />} />
          <Route path="/legal/cookies" element={<LegalTemplate {...LEGAL_PAGES.privacy}     />} />
          <Route path="/recrutement"   element={<LegalTemplate {...LEGAL_PAGES.recrutement} />} />

          {/* ── Misc ── */}
          <Route path="/fidelite" element={<LegalTemplate
            title="Programme Fidélité"
            subtitle="Récompenses GreenGo - Commandez et gagnez des points"
            sections={[
              { heading: "Comment ça marche ?",   body: "Chaque commande vous rapporte des points GreenGo. 10 MAD dépensés = 1 point. 100 points = 10 MAD de réduction sur votre prochaine commande." },
              { heading: "Avantages exclusifs",   body: "Accès prioritaire aux produits de saison · Livraison gratuite illimitée · Offres spéciales réservées aux membres fidèles." },
              { heading: "Rejoindre le programme", body: "L'inscription est automatique dès votre première commande. Contactez-nous sur WhatsApp pour consulter votre solde de points." },
            ]} />}
          />
          <Route path="/faq" element={<LegalTemplate
            title="Questions Fréquentes"
            subtitle="FAQ - GreenGo Market"
            sections={[
              { heading: "Comment passer une commande ?",       body: "Ajoutez vos produits au panier, remplissez le formulaire de livraison et confirmez. Vous recevrez une confirmation WhatsApp dans les 30 minutes." },
              { heading: "Quels sont les délais de livraison ?", body: "La livraison est assurée en 2 à 4 heures dans Salé et les villes environnantes, entre 8h et 20h du lundi au samedi." },
              { heading: "Comment annuler une commande ?",       body: "Contactez-nous sur WhatsApp au +212 664 397 031 dans les 30 minutes suivant votre commande." },
              { heading: "Les produits sont-ils garantis frais ?", body: "Tous nos produits sont sélectionnés chaque matin. En cas de produit non conforme, nous procédons au remplacement ou au remboursement sous 24h." },
            ]} />}
          />
          <Route path="/livraison" element={<LegalTemplate
            title="Livraison & Retours"
            subtitle="Politique de livraison - GreenGo Market"
            sections={[
              { heading: "Zones de livraison", body: "Salé, Rabat, Témara. Extension prévue à Mohammedia et Settat en 2025." },
              { heading: "Tarifs de livraison", body: "Livraison offerte pendant tout le premier mois. Ensuite : gratuite pour toute commande supérieure à 200 MAD, sinon 15 MAD." },
              { heading: "Politique de retour", body: "Signalez tout problème dans les 24h via WhatsApp avec une photo du produit. Nous remplaçons ou remboursons sans condition." },
            ]} />}
          />
        </Routes>
      </main>
      <Footer />
      <MobileBottomNav />
      <NewsletterModal />
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  useAntiScraping();

  return (
    <BrowserRouter>
      <LanguageProvider>
        <Routes>
          {/* Super-admin is fully standalone — no Header/Footer */}
          <Route path="/super-admin" element={<SuperAdminPage />} />
          {/* All other routes get the public shell */}
          <Route path="/*" element={<PublicShell />} />
        </Routes>
        <CookieBanner />
      </LanguageProvider>
    </BrowserRouter>
  );
}