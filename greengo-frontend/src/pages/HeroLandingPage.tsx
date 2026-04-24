// src/pages/HeroLandingPage.tsx
// GreenGo Market — Real image background + glassmorphism hero

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

// ── Animated counter ───────────────────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 2000;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setVal(Math.floor(eased * target));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <>{val}{suffix}</>;
}

export default function HeroLandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden font-sans">

      {/* ═══════════════════════════════════════════════
          LAYER 1 — Real background image
          Uses the uploaded Moroccan pattern image.
          Falls back to the pattern image from /assets.
          ═══════════════════════════════════════════════ */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/assets/morocco-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          animation: "bg-zoom 20s ease-in-out infinite alternate",
        }}
      />

      {/* ═══════════════════════════════════════════════
          LAYER 2 — Multi-stop dark gradient overlay
          Keeps text readable over the image
          ═══════════════════════════════════════════════ */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              160deg,
              rgba(3,20,9,0.88)   0%,
              rgba(6,26,18,0.75)  35%,
              rgba(10,35,24,0.65) 55%,
              rgba(3,13,8,0.85)   100%
            )
          `,
        }}
      />

      {/* ═══════════════════════════════════════════════
          LAYER 3 — Zellige SVG tile overlay (very subtle)
          Adds the geometric texture visible in the ref
          ═══════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill='none' stroke='%23C9A96E' stroke-width='0.4' opacity='0.14'%3E%3Cpolygon points='50,6 58,22 76,22 62,34 67,52 50,42 33,52 38,34 24,22 42,22'/%3E%3Cpolygon points='50,14 55,24 67,24 58,32 61,44 50,38 39,44 42,32 33,24 45,24'/%3E%3Ccircle cx='50' cy='50' r='30' stroke-width='0.35'/%3E%3Ccircle cx='50' cy='50' r='16' stroke-width='0.35'/%3E%3Cline x1='50' y1='6' x2='50' y2='94'/%3E%3Cline x1='6' y1='50' x2='94' y2='50'/%3E%3Cline x1='14' y1='14' x2='86' y2='86'/%3E%3Cline x1='86' y1='14' x2='14' y2='86'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "100px 100px",
          backgroundRepeat: "repeat",
          opacity: 0.6,
        }}
      />

      {/* ═══════════════════════════════════════════════
          LAYER 4 — Radial colour atmosphere
          ═══════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 65% 50% at 12% 15%, rgba(46,139,87,0.28) 0%, transparent 55%),
            radial-gradient(ellipse 45% 60% at 88% 85%, rgba(15,61,34,0.40) 0%, transparent 55%)
          `,
          animation: "atmosphere-drift 15s ease-in-out infinite alternate",
        }}
      />

      {/* CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&family=DM+Sans:wght@300;400;500;600&display=swap');

        @keyframes bg-zoom {
          from { transform: scale(1.00); }
          to   { transform: scale(1.08); }
        }
        @keyframes atmosphere-drift {
          from { opacity: 0.7; }
          to   { opacity: 1.0; }
        }
        @keyframes glow-cta {
          0%,100% { box-shadow: 0 0 24px rgba(46,139,87,0.45), 0 0 60px rgba(46,139,87,0.18); }
          50%      { box-shadow: 0 0 40px rgba(46,139,87,0.70), 0 0 90px rgba(46,139,87,0.28); }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulse-dot {
          0%,100% { opacity: 0.35; transform: scale(1);    }
          50%      { opacity: 0.90; transform: scale(1.35); }
        }
        @keyframes zellige-border-flow {
          from { background-position: 0 0; }
          to   { background-position: 80px 0; }
        }

        .font-display { font-family: 'Cormorant Garamond', serif; }
        .font-body    { font-family: 'DM Sans', sans-serif; }

        .r1 { animation: rise 0.85s cubic-bezier(.16,1,.3,1) both; animation-delay: 0.05s; }
        .r2 { animation: rise 0.85s cubic-bezier(.16,1,.3,1) both; animation-delay: 0.20s; }
        .r3 { animation: rise 0.85s cubic-bezier(.16,1,.3,1) both; animation-delay: 0.36s; }
        .r4 { animation: rise 0.85s cubic-bezier(.16,1,.3,1) both; animation-delay: 0.52s; }
        .r5 { animation: rise 0.85s cubic-bezier(.16,1,.3,1) both; animation-delay: 0.68s; }

        /* Glassmorphism card */
        .glass {
          background: linear-gradient(135deg,
            rgba(255,255,255,0.07) 0%,
            rgba(255,255,255,0.03) 50%,
            rgba(46,139,87,0.04) 100%
          );
          backdrop-filter: blur(22px) saturate(1.4);
          -webkit-backdrop-filter: blur(22px) saturate(1.4);
          border: 1px solid rgba(201,169,110,0.20);
          border-radius: 1.75rem;
          box-shadow:
            0 0 0 0.5px rgba(201,169,110,0.08) inset,
            0 32px 64px rgba(0,0,0,0.45),
            0 0 80px rgba(46,139,87,0.06);
        }

        /* Glowing green CTA */
        .cta-primary {
          position: relative;
          background: linear-gradient(135deg, #2E8B57 0%, #1a5c38 60%, #2E8B57 100%);
          background-size: 200% 100%;
          border: 1px solid rgba(46,139,87,0.55);
          border-radius: 9999px;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          letter-spacing: 0.04em;
          overflow: hidden;
          transition: transform 0.2s ease, background-position 0.5s ease;
          animation: glow-cta 3.5s ease-in-out infinite;
        }
        .cta-primary:hover {
          transform: translateY(-2px) scale(1.03);
          background-position: 100% 0;
          box-shadow: 0 8px 40px rgba(46,139,87,0.65), 0 0 80px rgba(46,139,87,0.22);
        }
        .cta-primary::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 2.8s linear infinite;
          border-radius: inherit;
        }

        /* WhatsApp CTA */
        .cta-wa {
          border: 1px solid rgba(37,211,102,0.30);
          background: rgba(37,211,102,0.07);
          border-radius: 9999px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          color: #4ade80;
          letter-spacing: 0.04em;
          transition: all 0.22s ease;
        }
        .cta-wa:hover {
          background: rgba(37,211,102,0.16);
          border-color: rgba(37,211,102,0.55);
          transform: translateY(-1px);
          box-shadow: 0 4px 24px rgba(37,211,102,0.20);
        }

        /* Zellige stripe */
        .zstripe {
          height: 2px;
          background-image: repeating-linear-gradient(
            90deg,
            #C9A96E 0px, #C9A96E 8px,
            transparent 8px, transparent 12px,
            #2E8B57 12px, #2E8B57 20px,
            transparent 20px, transparent 24px
          );
          background-size: 80px 2px;
          opacity: 0.55;
          animation: zellige-border-flow 4s linear infinite;
        }

        /* Stat cards */
        .stat-glass {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(201,169,110,0.14);
          border-radius: 0.875rem;
          transition: all 0.3s ease;
        }
        .stat-glass:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(201,169,110,0.30);
          transform: translateY(-3px);
        }

        /* Feature pill */
        .feat-pill {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(201,169,110,0.14);
          border-radius: 9999px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.55);
          padding: 0.35rem 1rem;
          transition: all 0.2s ease;
        }
        .feat-pill:hover {
          background: rgba(46,139,87,0.12);
          border-color: rgba(46,139,87,0.35);
          color: rgba(255,255,255,0.85);
        }

        /* Nav link */
        .nav-link {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 400;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.42);
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .nav-link:hover { color: rgba(255,255,255,0.85); }
      `}</style>

      {/* ════════════════════════════════════
          NAVIGATION
          ════════════════════════════════════ */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-5 md:px-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg,#2E8B57,#1a5c38)",
            boxShadow: "0 0 18px rgba(46,139,87,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 18 }}>🌿</span>
          </div>
          <span className="font-display text-xl" style={{ color: "#fff", letterSpacing: "0.01em" }}>
            GreenGo <span style={{ color: "#C9A96E" }}>Market</span>
          </span>
        </div>

        {/* Links */}
        <div className="hidden md:flex items-center gap-7">
          <Link to="/shop"    className="nav-link">Catalogue</Link>
          <Link to="/about"   className="nav-link">À propos</Link>
          <Link to="/contact" className="nav-link">Contact</Link>
        </div>

        {/* Nav CTA */}
        <Link to="/shop" style={{
          fontFamily: "'DM Sans',sans-serif",
          fontSize: "0.78rem", fontWeight: 500,
          letterSpacing: "0.06em",
          color: "rgba(255,255,255,0.75)",
          padding: "0.45rem 1.1rem",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.13)",
          borderRadius: 9999,
          textDecoration: "none",
          transition: "all 0.2s",
        }}>
          Commander →
        </Link>
      </nav>

      {/* ════════════════════════════════════
          HERO CONTENT
          ════════════════════════════════════ */}
      <main className="relative z-20 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 pb-12">
        <div className="glass w-full max-w-3xl px-8 py-12 md:px-14 md:py-14 text-center">

          {/* Badge */}
          <div className="r1 inline-flex items-center gap-2 mb-7" style={{
            background: "rgba(201,169,110,0.10)",
            border: "1px solid rgba(201,169,110,0.24)",
            borderRadius: 9999,
            padding: "0.28rem 1rem",
          }}>
            <span style={{ fontSize: 13 }}>🇲🇦</span>
            <span className="font-body" style={{
              fontSize: "0.68rem", fontWeight: 600,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: "#e8c98a",
            }}>
              Fraîcheur du Maroc · Livraison Express
            </span>
          </div>

          {/* Headline */}
          <h1 className="r2 font-display" style={{
            fontSize: "clamp(2.8rem,7vw,5.8rem)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            textShadow: "0 2px 40px rgba(46,139,87,0.25)",
            marginBottom: "0.5rem",
          }}>
            Produits Frais,
          </h1>
          <h1 className="r2 font-display" style={{
            fontSize: "clamp(2.8rem,7vw,5.8rem)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#C9A96E",
            fontStyle: "italic",
            textShadow: "0 2px 40px rgba(201,169,110,0.20)",
            marginBottom: "1.5rem",
          }}>
            Livrés chez vous.
          </h1>

          {/* Animated zellige divider */}
          <div className="r2 flex justify-center mb-6">
            <div className="zstripe" style={{ width: 160 }} />
          </div>

          {/* Subtext */}
          <p className="r3 font-body mx-auto" style={{
            fontSize: "clamp(0.9rem,1.8vw,1.05rem)",
            fontWeight: 300,
            lineHeight: 1.75,
            color: "rgba(255,255,255,0.48)",
            maxWidth: 480,
            marginBottom: "2.5rem",
          }}>
            Fruits, légumes, viandes fraîches et herbes aromatiques —
            sélectionnés chaque matin, livrés en quelques heures dans tout le Maroc.
          </p>

          {/* CTA buttons */}
          <div className="r4 flex flex-wrap items-center justify-center gap-4 mb-10">
            <Link to="/shop" className="cta-primary inline-flex items-center gap-3 px-8 py-4"
              style={{ fontSize: "0.88rem" }}>
              <span>🛒</span>
              <span>Découvrir nos produits</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <a href="https://wa.me/212664500789" target="_blank" rel="noopener noreferrer"
              className="cta-wa inline-flex items-center gap-2.5 px-6 py-4"
              style={{ fontSize: "0.88rem", textDecoration: "none" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Commander via WhatsApp
            </a>
          </div>

          {/* Stats row */}
          <div className="r5 grid grid-cols-3 gap-3">
            {[
              { n: 15,  s: "+",  label: "Produits frais"      },
              { n: 2,   s: "h",  label: "Délai de livraison"  },
              { n: 100, s: "%",  label: "Qualité garantie"    },
            ].map((stat, i) => (
              <div key={i} className="stat-glass py-4 px-3 text-center">
                <p className="font-display" style={{
                  fontSize: "clamp(1.6rem,3.5vw,2.4rem)",
                  fontWeight: 700,
                  color: "#C9A96E",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}>
                  <Counter target={stat.n} suffix={stat.s} />
                </p>
                <p className="font-body mt-1.5" style={{
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.35)",
                }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* ════════════════════════════════════
          FEATURE PILLS — bottom bar
          ════════════════════════════════════ */}
      <div className="relative z-20 flex flex-wrap justify-center gap-2.5 pb-8 px-4">
        {["🌿 100% Frais", "🛵 Livraison Express", "💬 Support WhatsApp", "🔒 Paiement Sécurisé"].map((f, i) => (
          <span key={i} className="feat-pill" style={{ animationDelay: `${0.8 + i * 0.1}s` }}>
            {f}
          </span>
        ))}
      </div>

      {/* Footer */}
      <footer className="relative z-20 pb-5 text-center">
        <div className="zstripe mb-3 mx-auto" style={{ width: "100%", opacity: 0.25 }} />
        <p className="font-body" style={{
          fontSize: "0.7rem",
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.18)",
        }}>
          © 2025 GreenGo Market · mygreengoo.com · Maroc
        </p>
      </footer>

    </div>
  );
}