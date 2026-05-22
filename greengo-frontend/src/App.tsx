// src/App.tsx
import "./index.css";
import { Suspense, lazy } from "react";
import { useEffect }              from "react";
import StickyCartBar from "./components/ui/StickyCartBar";
import CookieBanner               from "./components/ui/CookieBanner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider }       from "./contexts/LanguageContext";
import { useCartStore }           from "./store/cartStore";
import Header                     from "./components/layout/Header";
import Footer                     from "./components/layout/Footer";
import MobileBottomNav            from "./components/layout/MobileBottomNav";
import NewsletterModal            from "./components/ui/NewsletterModal";
const HeroLandingPage  = lazy(() => import("./pages/HeroLandingPage"));
const HomePage         = lazy(() => import("./pages/HomePage"));
const CartPage         = lazy(() => import("./pages/CartPage"));
const AdminPage        = lazy(() => import("./pages/AdminPage"));
const AdminOrders      = lazy(() => import("./pages/Admin/AdminOrders"));
const POSPage          = lazy(() => import("./pages/Admin/POSPage"));
const SuperAdminPage   = lazy(() => import("./pages/SuperAdminPage"));
const AboutPage        = lazy(() => import("./pages/AboutPage"));
const ContactPage      = lazy(() => import("./pages/ContactPage"));
const PaymentGateway   = lazy(() => import("./pages/Payment/PaymentGateway"));
const UserDashboard    = lazy(() => import("./pages/Profile/UserDashboard"));
const PrivacyPage      = lazy(() => import("./pages/legal/PrivacyPage"));
const CGUPage          = lazy(() => import("./pages/legal/CGUPage"));
const RecrutementPage  = lazy(() => import("./pages/RecrutementPage"));
const TermsPage        = lazy(() => import("./pages/legal/TermsPage"));
const InfoPage         = lazy(() => import("./pages/legal/InfoPage"));
const ProductPage     = lazy(() => import("./pages/ProductPage"));
const MenuPage        = lazy(() => import("./pages/MenuPage"));
const PanierTypePage  = lazy(() => import("./pages/PanierTypePage"));
const OffresPage      = lazy(() => import("./pages/OffresPage"));
const TrackOrderPage  = lazy(() => import("./pages/TrackOrderPage"));
const FidelitePage     = lazy(() => import("./pages/FidelitePage"));
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
      // Use 300px threshold to avoid false positives on Android/iOS browsers
      // which have large native UI chrome (address bar, bottom nav, etc.)
      const widthThreshold  = window.outerWidth  - window.innerWidth  > 300;
      const heightThreshold = window.outerHeight - window.innerHeight > 300;
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


// Minimal full-screen spinner shown while lazy chunks load
function PageLoader() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a2318",
    }}>
      <div style={{
        width: 40, height: 40,
        border: "3px solid rgba(46,139,87,0.2)",
        borderTop: "3px solid #2E8B57",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Public shell (all routes that show Header + Footer) ──────────────────────
function PublicShell() {
  const cart       = useCartStore((s) => s.cart);
  const totalItems = cart.reduce((sum, i) => sum + (i.cartQuantity || 0), 0);
  void totalItems;

  return (
    <div
      className="flex min-h-screen flex-col pb-16 md:pb-0" style={{ overflowX: "hidden", background: "inherit" }}
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
          <Route path="/legal/cgu"     element={<CGUPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
          <Route path="/legal/terms"   element={<TermsPage />} />
          <Route path="/legal/info"    element={<InfoPage />} />
          <Route path="/legal/cookies" element={<LegalTemplate {...LEGAL_PAGES.privacy}     />} />
          <Route path="/recrutement"   element={<RecrutementPage />} />

          {/* ── Misc ── */}
          <Route path="/produit/:id"    element={<ProductPage />} />
          <Route path="/menu"           element={<MenuPage />} />
          <Route path="/panier-type"    element={<PanierTypePage />} />
          <Route path="/offres"         element={<OffresPage />} />
          <Route path="/track/:orderId?" element={<TrackOrderPage />} />
          <Route path="/fidelite"   element={<FidelitePage />} />
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
      <StickyCartBar />
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  useAntiScraping();

  return (
    <BrowserRouter>
      <LanguageProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Super-admin is fully standalone — no Header/Footer */}
            <Route path="/super-admin" element={<SuperAdminPage />} />
            {/* All other routes get the public shell */}
            <Route path="/*" element={<PublicShell />} />
          </Routes>
        </Suspense>
        <CookieBanner />
      </LanguageProvider>
    </BrowserRouter>
  );
}