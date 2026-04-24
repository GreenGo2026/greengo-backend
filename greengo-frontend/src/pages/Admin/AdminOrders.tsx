import { useEffect, useState, useCallback } from "react";

// ─── Google Fonts injected once ──────────────────────────────────────────────
const fontLink = document.getElementById("gg-fonts");
if (!fontLink) {
  const link = document.createElement("link");
  link.id = "gg-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  _id?: string;
  id?: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items: OrderItem[];
  total_price: number;
  status: string;
  created_at: string;
  gps_coordinates?: { lat: number; lng: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

// Terminal states — backend forbids any further transitions
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["completed", "cancelled"]);

// UI label -> exact backend enum value
const UI_TO_API: Record<string, string> = {
  pending:          "pending",
  preparing:        "preparing",
  out_for_delivery: "out_for_delivery",
  delivered:        "delivered",
  completed:        "completed",
  cancelled:        "cancelled",
};

interface StatusMeta {
  api: string;
  label: string;
  dot: string;
  pill: string;
  locked: string;
}

const STATUS_META: StatusMeta[] = [
  {
    api:    "pending",
    label:  "En attente",
    dot:    "bg-amber-400",
    pill:   "bg-amber-50 text-amber-700 border border-amber-200",
    locked: "bg-amber-50 text-amber-600 border border-amber-200",
  },
  {
    api:    "preparing",
    label:  "En preparation",
    dot:    "bg-blue-500",
    pill:   "bg-blue-50 text-blue-700 border border-blue-200",
    locked: "bg-blue-50 text-blue-600 border border-blue-200",
  },
  {
    api:    "out_for_delivery",
    label:  "En livraison",
    dot:    "bg-violet-500",
    pill:   "bg-violet-50 text-violet-700 border border-violet-200",
    locked: "bg-violet-50 text-violet-600 border border-violet-200",
  },
  {
    api:    "delivered",
    label:  "Livre",
    dot:    "bg-emerald-500",
    pill:   "bg-emerald-50 text-emerald-700 border border-emerald-200",
    locked: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  },
  {
    api:    "completed",
    label:  "Complete",
    dot:    "bg-green-600",
    pill:   "bg-green-50 text-green-700 border border-green-200",
    locked: "bg-green-100 text-green-700 border border-green-300",
  },
  {
    api:    "cancelled",
    label:  "Annule",
    dot:    "bg-red-400",
    pill:   "bg-red-50 text-red-600 border border-red-200",
    locked: "bg-red-100 text-red-600 border border-red-300",
  },
];

function getStatusMeta(apiValue: string): StatusMeta {
  return (
    STATUS_META.find((s) => s.api === apiValue) ?? {
      api:    apiValue,
      label:  apiValue,
      dot:    "bg-gray-400",
      pill:   "bg-gray-100 text-gray-600 border border-gray-200",
      locked: "bg-gray-100 text-gray-500 border border-gray-200",
    }
  );
}

// Safe ID extractor — never returns undefined
function getId(order: Order): string {
  return (order._id ?? order.id ?? "").toString();
}

// GPS URL built outside JSX — avoids any template-literal-in-attribute parse issues
function buildMapsUrl(order: Order): string | null {
  const coords = order.gps_coordinates;
  if (
    coords === undefined ||
    coords === null ||
    typeof coords.lat !== "number" ||
    typeof coords.lng !== "number"
  ) {
    return null;
  }
  return (
    "https://www.google.com/maps?q=" +
    coords.lat.toString() +
    "," +
    coords.lng.toString()
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  accent,
  delay,
}: {
  icon: string;
  label: string;
  value: string | number;
  accent: string;
  delay: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
      style={{ animationDelay: delay, fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className={"absolute top-0 left-0 right-0 h-0.5 " + accent} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">
            {label}
          </p>
          <p
            className="text-3xl font-bold text-gray-800"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            {value}
          </p>
        </div>
        <span className="text-2xl opacity-80">{icon}</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold " +
        meta.pill
      }
    >
      <span className={"w-1.5 h-1.5 rounded-full animate-pulse " + meta.dot} />
      {meta.label}
    </span>
  );
}

function LockedStatusBadge({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <span
        className={
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl " +
          "text-xs font-semibold select-none " +
          meta.locked
        }
        title="Statut final — aucune modification possible"
      >
        <svg
          className="w-3 h-3 opacity-60 flex-shrink-0"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5 7V5a3 3 0 116 0v2h.5A1.5 1.5 0 0113 8.5v5A1.5 1.5 0 0111.5 15h-7A1.5 1.5 0 013 13.5v-5A1.5 1.5 0 014.5 7H5zm2-2a1 1 0 112 0v2H7V5zm1 6a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        {meta.label}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminOrders() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch]     = useState("");

  // ── Fetch all orders ───────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE + "/orders");
      if (!res.ok) {
        throw new Error("HTTP " + res.status.toString());
      }
      const data: Order[] = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("[AdminOrders] fetchOrders:", err);
      setError("Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── PATCH /api/v1/orders/{order_id}/status ─────────────────────────────────
  async function handleStatusChange(
    orderId: string,
    newStatus: string
  ): Promise<void> {
    if (!orderId) {
      console.error("[AdminOrders] handleStatusChange: orderId is empty — aborting.");
      return;
    }
    if (TERMINAL_STATUSES.has(newStatus)) {
      console.warn("[AdminOrders] Attempted to change a terminal status — blocked client-side.");
      return;
    }
    const apiStatus = UI_TO_API[newStatus];
    if (!apiStatus) {
      console.error("[AdminOrders] Unknown status value:", newStatus);
      return;
    }

    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (getId(o) === orderId ? { ...o, status: apiStatus } : o))
    );
    setUpdating(orderId);

    try {
      const url = API_BASE + "/orders/" + orderId + "/status";
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: apiStatus }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error("HTTP " + res.status.toString() + ": " + detail);
      }
      showToast("Statut mis a jour", true);
    } catch (err) {
      console.error("[AdminOrders] handleStatusChange:", err);
      fetchOrders();
      showToast("Echec de la mise a jour.", false);
    } finally {
      setUpdating(null);
    }
  }

  // ── Toast helper ───────────────────────────────────────────────────────────
  function showToast(msg: string, ok: boolean): void {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // -- Download invoice


  async function downloadInvoice(orderId: string): Promise<void> {
    try {
      showToast("Generation...", true);
      const res = await fetch(API_BASE + "/orders/" + orderId + "/invoice?lang=fr");
      if (!res.ok) throw new Error("HTTP " + res.status.toString());
      const blob = await res.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "GreenGo_Facture_" + orderId.slice(-8).toUpperCase() + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Facture telechargee", true);
    } catch (err) {
      console.error("[AdminOrders] invoice:", err);
      showToast("Erreur telechargement.", false);
    }
  }

  // ── Derived / filtered data ────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (o.customer_name ?? "").toLowerCase().includes(q) ||
      (o.customer_phone ?? "").includes(q) ||
      getId(o).toLowerCase().includes(q)
    );
  });

  const revenue    = orders.reduce((sum, o) => sum + (o.total_price ?? 0), 0);
  const pending    = orders.filter((o) => o.status === "pending").length;
  const inProgress = orders.filter(
    (o) => o.status === "preparing" || o.status === "out_for_delivery"
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[#F7F8FA]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-row { animation: fadeSlideIn 0.32s ease both; }
        .gg-header-bg {
          background: linear-gradient(135deg, #1a5c38 0%, #2E8B57 60%, #34a368 100%);
        }
        .gps-btn {
          background: linear-gradient(135deg, #FF9800, #e68900);
          transition: box-shadow 0.2s ease, transform 0.15s ease;
        }
        .gps-btn:hover {
          box-shadow: 0 4px 18px rgba(255,152,0,0.45);
          transform: translateY(-1px);
        }
        .row-accent {
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        tr:hover .row-accent { opacity: 1; }
        select option { background: white; color: #1f2937; }
      `}</style>

      {toast !== null && (
        <div
          className={
            "fixed top-5 right-5 z-50 flex items-center gap-2 px-5 py-3 " +
            "rounded-2xl shadow-xl text-sm font-semibold transition-all " +
            (toast.ok ? "bg-[#2E8B57] text-white" : "bg-red-500 text-white")
          }
        >
          <span>{toast.ok ? "+" : "x"}</span>
          {toast.msg}
        </div>
      )}

      <header className="gg-header-bg shadow-lg px-8 py-5">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-xl shadow-inner">
              🥦
            </div>
            <div>
              <h1
                className="text-white text-2xl leading-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                GreenGo Market
              </h1>
              <p className="text-green-200 text-xs tracking-widest uppercase">
                Gestion des commandes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white/15 backdrop-blur text-white placeholder-green-200 text-sm rounded-xl px-4 py-2 pl-9 w-52 transition focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <span className="absolute left-3 top-2.5 text-green-200 text-sm">🔍</span>
            </div>

            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-medium px-4 py-2 rounded-xl transition disabled:opacity-40 border border-white/20"
            >
              <svg
                className={"w-4 h-4 " + (loading ? "animate-spin" : "")}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Actualiser
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon="📦"
            label="Total Commandes"
            value={orders.length}
            accent="bg-gradient-to-r from-[#2E8B57] to-[#34a368]"
            delay="0ms"
          />
          <KpiCard
            icon="⏳"
            label="En attente"
            value={pending}
            accent="bg-gradient-to-r from-amber-400 to-yellow-300"
            delay="60ms"
          />
          <KpiCard
            icon="🚚"
            label="En cours"
            value={inProgress}
            accent="bg-gradient-to-r from-violet-500 to-blue-400"
            delay="120ms"
          />
          <KpiCard
            icon="💰"
            label="Revenus (MAD)"
            value={revenue.toFixed(2)}
            accent="bg-gradient-to-r from-[#FF9800] to-[#e68900]"
            delay="180ms"
          />
        </div>

        {error !== null && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <span className="text-sm">{error}</span>
            <button
              onClick={fetchOrders}
              className="ml-auto text-xs underline hover:no-underline"
            >
              Reessayer
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-white border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && error === null && filtered.length === 0 && (
          <div className="text-center py-28">
            <span className="text-6xl block mb-4">🌿</span>
            <p
              className="text-2xl text-gray-400 mb-1"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Aucune commande trouvee
            </p>
            <p className="text-sm text-gray-400">
              {search.trim().length > 0
                ? "Essayez un autre terme de recherche."
                : "Les nouvelles commandes apparaitront ici."}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2
                className="text-lg text-gray-800"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Commandes recentes
              </h2>
              <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                {filtered.length} resultat{filtered.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-gray-400 border-b border-gray-50">
                    <th className="px-6 py-3 text-left font-semibold">Ref.</th>
                    <th className="px-6 py-3 text-left font-semibold">Client</th>
                    <th className="px-6 py-3 text-left font-semibold">Articles</th>
                    <th className="px-6 py-3 text-right font-semibold">Total</th>
                    <th className="px-6 py-3 text-left font-semibold">Date</th>
                    <th className="px-6 py-3 text-left font-semibold">Statut</th>
                    <th className="px-6 py-3 text-left font-semibold">Modifier</th>
                    <th className="px-6 py-3 text-center font-semibold">GPS</th>
                    <th className="px-6 py-3 text-center font-semibold">Facture</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((order, idx) => {
                    const orderId: string = getId(order);

                    const refLabel: string =
                      orderId.length > 0
                        ? "#" + orderId.slice(-6).toUpperCase()
                        : "——";

                    const totalLabel: string = (order.total_price ?? 0).toFixed(2);

                    const dateLabel: string = order.created_at
                      ? new Date(order.created_at).toLocaleDateString("fr-MA", {
                          day:   "2-digit",
                          month: "short",
                          year:  "numeric",
                        })
                      : "—";

                    const mapsUrl: string | null = buildMapsUrl(order);
                    const isUpdating: boolean    = updating === orderId;
                    const isTerminal: boolean    = TERMINAL_STATUSES.has(order.status);

                    return (
                      <tr
                        key={orderId.length > 0 ? orderId : idx.toString()}
                        className={
                          "border-b border-gray-50 last:border-0 anim-row " +
                          "transition-colors duration-200 " +
                          (isTerminal
                            ? "bg-gray-50/40 hover:bg-gray-50/70"
                            : "hover:bg-[#F0FAF4]")
                        }
                        style={{ animationDelay: (idx * 40).toString() + "ms" }}
                      >

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={
                                "row-accent w-1 h-8 rounded-full " +
                                (isTerminal
                                  ? "bg-gradient-to-b from-gray-300 to-gray-200"
                                  : "bg-gradient-to-b from-[#2E8B57] to-[#34a368]")
                              }
                            />
                            <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                              {refLabel}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-800 leading-tight">
                            {order.customer_name ?? "—"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {order.customer_phone ?? ""}
                          </p>
                          <p className="text-xs text-gray-400 truncate max-w-[150px]">
                            {order.delivery_address ?? ""}
                          </p>
                        </td>

                        <td className="px-6 py-4 max-w-[180px]">
                          <div className="flex flex-wrap gap-1">
                            {(order.items ?? []).slice(0, 3).map((item, i) => (
                              <span
                                key={i}
                                className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                              >
                                {item.quantity}x {item.name}
                              </span>
                            ))}
                            {(order.items ?? []).length > 3 && (
                              <span className="text-xs text-gray-400 px-1">
                                +{(order.items.length - 3).toString()}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span
                            className="font-bold text-gray-800"
                            style={{ fontFamily: "'DM Serif Display', serif" }}
                          >
                            {totalLabel}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">MAD</span>
                        </td>

                        <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {dateLabel}
                        </td>

                        <td className="px-6 py-4">
                          <StatusPill status={order.status} />
                        </td>

                        <td className="px-6 py-4">
                          {isTerminal ? (
                            <LockedStatusBadge status={order.status} />
                          ) : (
                            <div className="relative">
                              <select
                                value={order.status}
                                disabled={isUpdating}
                                onChange={(e) => {
                                  const selectedValue: string = e.target.value;
                                  handleStatusChange(orderId, selectedValue);
                                }}
                                className="appearance-none text-xs font-semibold bg-white border border-gray-200 text-gray-700 rounded-xl px-3 py-1.5 pr-7 cursor-pointer hover:border-[#2E8B57] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30 disabled:opacity-40 disabled:cursor-wait min-w-[130px]"
                              >
                                {STATUS_META
                                  .filter((s) => !TERMINAL_STATUSES.has(s.api))
                                  .map((s) => (
                                    <option key={s.api} value={s.api}>
                                      {s.label}
                                    </option>
                                  ))}
                              </select>
                              <span className="pointer-events-none absolute right-2.5 top-2 text-gray-400 text-xs">
                                {isUpdating ? (
                                  <span className="inline-block w-3 h-3 border-2 border-[#2E8B57] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  "v"
                                )}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          {mapsUrl !== null ? (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="gps-btn inline-flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm whitespace-nowrap"
                            >
                              📍 Maps
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          {orderId.length > 0 ? (
                            <button
                              onClick={() => downloadInvoice(orderId)}
                              title="Telecharger la facture PDF"
                              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:border-[#2E8B57] hover:bg-[#f0faf4] text-gray-600 hover:text-[#2E8B57] text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-200 whitespace-nowrap shadow-sm"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                              Facture
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </td>

                        

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>
                {orders.length} commande{orders.length > 1 ? "s" : ""} au total
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B57] animate-pulse" />
                Donnees en temps reel
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

