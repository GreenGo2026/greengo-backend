// src/pages/Profile/UserDashboard.tsx
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  User, Package, MapPin, ChevronRight, CheckCircle2,
  Clock, Truck, XCircle, Plus, Pencil, Phone,
  Mail, Leaf,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "profile" | "orders" | "addresses";

interface Order {
  id:      string;
  date:    string;
  items:   string;
  total:   number;
  status:  "En cours" | "Livré" | "Annulé" | "En préparation";
}

interface Address {
  id:    string;
  label: string;
  line:  string;
  phone: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_ORDERS: Order[] = [
  { id: "BGO-001", date: "12 Jan 2025", items: "Tomates, Poulet, Bananes", total: 106.50, status: "Livré"          },
  { id: "BGO-002", date: "19 Jan 2025", items: "Carottes, Courgettes",     total: 43.00,  status: "En cours"       },
  { id: "BGO-003", date: "25 Jan 2025", items: "Poulet entier × 2",        total: 136.00, status: "En préparation" },
  { id: "BGO-004", date: "02 Fév 2025", items: "Oranges, Pommes",          total: 55.00,  status: "Annulé"         },
];

const MOCK_ADDRESSES: Address[] = [
  { id: "a1", label: "Domicile",  line: "Hay Hassani, Rue 12, N°7, Casablanca",   phone: "0661 234 567" },
  { id: "a2", label: "Bureau",   line: "Maarif, Boulevard Anfa, Bureau 304",       phone: "0522 456 789" },
];

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Order["status"] }) {
  const config = {
    "En cours":        { icon: Clock,       bg: "bg-amber-50  border-amber-200",  text: "text-amber-700"  },
    "En préparation":  { icon: Truck,       bg: "bg-blue-50   border-blue-200",   text: "text-blue-700"   },
    "Livré":           { icon: CheckCircle2,bg: "bg-emerald-50 border-emerald-200",text: "text-[#2E8B57]"  },
    "Annulé":          { icon: XCircle,     bg: "bg-red-50    border-red-200",    text: "text-red-600"    },
  }[status];
  const Icon = config.icon;
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold " + config.bg + " " + config.text}>
      <Icon size={10} className="shrink-0" />
      {status}
    </span>
  );
}

// ── Tab: Mon Profil ───────────────────────────────────────────────────────────
function ProfileTab() {
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState("Youssef El Amrani");
  const [email,   setEmail]   = useState("youssef@email.com");
  const [phone,   setPhone]   = useState("0661 234 567");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-800">Mon Profil</h2>
        <button
          onClick={() => setEditing((p) => !p)}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-600 transition-all hover:border-[#2E8B57]/40 hover:text-[#2E8B57]">
          <Pencil size={12} />
          {editing ? "Annuler" : "Modifier"}
        </button>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2E8B57] text-2xl font-extrabold text-white shadow-lg shadow-[#2E8B57]/20">
          {name.charAt(0)}
        </div>
        <div>
          <p className="text-base font-extrabold text-gray-800">{name}</p>
          <p className="text-sm text-gray-400">Client GreenGo 🌿</p>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {[
          { icon: User,  label: "Nom complet",       value: name,  set: setName,  type: "text" },
          { icon: Mail,  label: "Adresse e-mail",    value: email, set: setEmail, type: "email" },
          { icon: Phone, label: "Numéro de téléphone",value: phone, set: setPhone, type: "tel" },
        ].map(({ icon: Icon, label, value, set, type }) => (
          <div key={label} className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
              <Icon size={11} className="text-[#2E8B57]" />
              {label}
            </label>
            {editing ? (
              <input type={type} value={value} onChange={(e) => set(e.target.value)}
                className="w-full rounded-xl border border-[#2E8B57]/30 bg-[#2E8B57]/3 px-4 py-2.5 text-sm text-gray-800 outline-none transition-all focus:border-[#2E8B57]/60 focus:ring-2 focus:ring-[#2E8B57]/10" />
            ) : (
              <p className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 text-sm text-gray-700">{value}</p>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <button
          onClick={() => setEditing(false)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2E8B57] py-3 text-sm font-extrabold text-white shadow-lg shadow-[#2E8B57]/20 transition-all hover:bg-[#1F6B40] active:scale-[0.98]">
          <CheckCircle2 size={15} />
          Enregistrer les modifications
        </button>
      )}
    </div>
  );
}

// ── Tab: Mes Commandes ────────────────────────────────────────────────────────
function OrdersTab() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-extrabold text-gray-800">Mes Commandes</h2>
      {MOCK_ORDERS.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Package size={40} className="text-gray-200" />
          <p className="font-semibold text-gray-400">Aucune commande pour l'instant</p>
          <Link to="/" className="rounded-xl bg-[#2E8B57] px-5 py-2 text-sm font-bold text-white hover:bg-[#1F6B40] transition-colors">
            Commander maintenant
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {MOCK_ORDERS.map((order) => (
            <li key={order.id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-[#2E8B57]/20 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-gray-400 font-latin">#{order.id}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{order.date}</span>
                </div>
                <p className="text-sm font-semibold text-gray-700">{order.items}</p>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <p className="text-lg font-extrabold text-gray-900 font-latin">{order.total.toFixed(2)} <span className="text-xs text-gray-400">MAD</span></p>
                <button className="flex items-center gap-1 text-xs font-semibold text-[#2E8B57] hover:underline">
                  Détails <ChevronRight size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Tab: Mes Adresses ─────────────────────────────────────────────────────────
function AddressesTab() {
  const [addresses, setAddresses] = useState<Address[]>(MOCK_ADDRESSES);

  function remove(id: string) {
    setAddresses((p) => p.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-800">Mes Adresses</h2>
        <button className="flex items-center gap-1.5 rounded-xl bg-[#2E8B57] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#1F6B40] active:scale-95">
          <Plus size={13} />
          Ajouter
        </button>
      </div>
      {addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <MapPin size={40} className="text-gray-200" />
          <p className="font-semibold text-gray-400">Aucune adresse enregistrée</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {addresses.map((addr) => (
            <li key={addr.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-[#2E8B57]/20 hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2E8B57]/10">
                  <MapPin size={16} className="text-[#2E8B57]" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-800">{addr.label}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{addr.line}</p>
                  <p className="mt-1 text-xs text-gray-400 font-latin">{addr.phone}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                  Modifier
                </button>
                <button
                  onClick={() => remove(addr.id)}
                  className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-400 hover:bg-red-100 transition-colors">
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400">📍 Livraison disponible à Casablanca, Salé, et Rabat.</p>
    </div>
  );
}

// ── UserDashboard ─────────────────────────────────────────────────────────────
export default function UserDashboard() {
  const location = useLocation();

  // Derive active tab from URL
  const activeTab: Tab =
    location.pathname.includes("/orders")   ? "orders"    :
    location.pathname.includes("/addresses")? "addresses" :
    "profile";

  const NAV_ITEMS: { tab: Tab; to: string; icon: React.ElementType; label: string }[] = [
    { tab: "profile",   to: "/profile/user", icon: User,    label: "Mon Profil"     },
    { tab: "orders",    to: "/orders",        icon: Package, label: "Mes Commandes"  },
    { tab: "addresses", to: "/addresses",     icon: MapPin,  label: "Mes Adresses"   },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F6F7F9" }}>

      {/* Page header */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0d3b36 0%,#1a5c4a 60%,#2E8B57 100%)" }}>
        <div className="absolute inset-0 zellige-bg-light opacity-10 pointer-events-none" />
        <div className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <User size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">Mon Espace Client</h1>
              <p className="text-xs text-white/50">GreenGo Market · Casablanca</p>
            </div>
          </div>
        </div>
        <div className="zellige-border" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">

          {/* ── Sidebar ── */}
          <aside className="md:col-span-1">
            <nav className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {NAV_ITEMS.map(({ tab, to, icon: Icon, label }) => {
                const active = activeTab === tab;
                return (
                  <Link key={tab} to={to}
                    className={"flex items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-all " + (active ? "border-l-4 border-[#2E8B57] bg-[#2E8B57]/6 text-[#2E8B57]" : "border-l-4 border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800")}>
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1">{label}</span>
                    {active && <ChevronRight size={14} />}
                  </Link>
                );
              })}

              {/* Divider + logout */}
              <div className="border-t border-gray-100 p-3">
                <Link to="/"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-400 transition-colors hover:bg-gray-50 hover:text-[#2E8B57]">
                  <Leaf size={13} />
                  Retour à la boutique
                </Link>
              </div>
            </nav>
          </aside>

          {/* ── Content ── */}
          <main className="md:col-span-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              {activeTab === "profile"   && <ProfileTab />}
              {activeTab === "orders"    && <OrdersTab />}
              {activeTab === "addresses" && <AddressesTab />}
            </div>
          </main>

        </div>
      </div>
    </div>
  );
}
