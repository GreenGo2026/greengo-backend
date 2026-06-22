// src/App.tsx
import "./index.css";
import { Suspense, lazy } from "react";
import { useEffect }              from "react";
import StickyCartBar from "./components/ui/StickyCartBar";
import CookieBanner               from "./components/ui/CookieBanner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
const PrivacyPage      = lazy(() => import("./pages/Legal/PrivacyPage"));
const CGUPage          = lazy(() => import("./pages/Legal/CGUPage"));
const RecrutementPage  = lazy(() => import("./pages/RecrutementPage"));
const TermsPage        = lazy(() => import("./pages/Legal/TermsPage"));
const InfoPage         = lazy(() => import("./pages/Legal/InfoPage"));
const ProductPage     = lazy(() => import("./pages/ProductPage"));
const MenuPage        = lazy(() => import("./pages/MenuPage"));
const PanierTypePage  = lazy(() => import("./pages/PanierTypePage"));
const OffresPage      = lazy(() => import("./pages/OffresPage"));
const TrackOrderPage  = lazy(() => import("./pages/TrackOrderPage"));
const FidelitePage     = lazy(() => import("./pages/FidelitePage"));
import LegalTemplate, { LEGAL_PAGES } from "./pages/Legal/LegalTemplate";
const LivraisonPage  = lazy(() => import("./pages/Legal/LivraisonPage"));
const FAQPage        = lazy(() => import("./pages/Legal/FAQPage"));

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
      className="flex min-h-screen flex-col pb-16 md:pb-0"
      style={{
        overflowX: "hidden",
        background: "#FAF7F2",
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

          {/* Admin routes are handled at the root level (outside this shell) */}

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
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/livraison" element={<LivraisonPage />} />
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
            {/* Legacy admin paths — silently redirect to home */}
            <Route path="/admin"        element={<Navigate to="/" replace />} />
            <Route path="/super-admin"  element={<Navigate to="/" replace />} />
            {/* Admin routes — fully standalone, no Header/Footer, no public shell */}
            <Route path="/gestion"        element={<AdminPage />}      />
            <Route path="/gestion/super"  element={<SuperAdminPage />} />
            <Route path="/gestion/orders" element={<AdminOrders />}    />
            <Route path="/gestion/pos"    element={<POSPage />}        />
            {/* All public-facing routes get the shell (Header + Footer) */}
            <Route path="/*" element={<PublicShell />} />
          </Routes>
        </Suspense>
        <CookieBanner />
      </LanguageProvider>
    </BrowserRouter>
  );
}