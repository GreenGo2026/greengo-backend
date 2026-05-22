// src/pages/PaniersTab.tsx — read-only admin view of basket compositions
import type { DBProduct } from "../services/api";

type Lang = "fr" | "ar";

const BASKETS = [
  { id:"famille", title:"Panier Famille", persons:4, accent:"#2E8B57",
    items:[
      {sku:"VEG-TOMATE-001",   label:"Tomate ronde",   qty:2, unit:"kg"},
      {sku:"VEG-PATATE-001",   label:"Pomme de terre", qty:2, unit:"kg"},
      {sku:"VEG-CAROTTE-001",  label:"Carotte",        qty:1, unit:"kg"},
      {sku:"VEG-OIGNON-001",   label:"Oignon rouge",   qty:1, unit:"kg"},
      {sku:"VEG-COURGETTE-001",label:"Courgette",      qty:1, unit:"kg"},
      {sku:"VND-POULET-001",   label:"Poulet entier",  qty:1, unit:"piece"},
      {sku:"OEF-BELDI-001",    label:"Oeufs beldi",    qty:1, unit:"boite"},
    ]},
  { id:"couple", title:"Panier Duo", persons:2, accent:"#C9A96E",
    items:[
      {sku:"VEG-TOMATE-001",  label:"Tomate ronde",   qty:1, unit:"kg"},
      {sku:"VEG-PATATE-001",  label:"Pomme de terre", qty:1, unit:"kg"},
      {sku:"VEG-CAROTTE-001", label:"Carotte",        qty:1, unit:"kg"},
      {sku:"OEF-BELDI-001",   label:"Oeufs beldi",    qty:1, unit:"boite"},
    ]},
  { id:"legumes", title:"Panier Legumes", persons:4, accent:"#16a34a",
    items:[
      {sku:"VEG-PATATE-001",    label:"Pomme de terre", qty:2, unit:"kg"},
      {sku:"VEG-CAROTTE-001",   label:"Carotte",        qty:1, unit:"kg"},
      {sku:"VEG-OIGNON-001",    label:"Oignon rouge",   qty:1, unit:"kg"},
      {sku:"VEG-COURGETTE-001", label:"Courgette",      qty:1, unit:"kg"},
      {sku:"VEG-POIVRON-001",   label:"Poivron vert",   qty:1, unit:"kg"},
      {sku:"VEG-BROCOLI-001",   label:"Brocoli",        qty:1, unit:"kg"},
    ]},
  { id:"tajine", title:"Panier Tajine", persons:4, accent:"#f97316",
    items:[
      {sku:"VND-POULET-001",   label:"Poulet entier",  qty:1, unit:"piece"},
      {sku:"VEG-PATATE-001",   label:"Pomme de terre", qty:1, unit:"kg"},
      {sku:"VEG-CAROTTE-001",  label:"Carotte",        qty:1, unit:"kg"},
      {sku:"VEG-OIGNON-001",   label:"Oignon rouge",   qty:1, unit:"kg"},
      {sku:"EPC-CUMIN-001",    label:"Cumin moulu",    qty:1, unit:"100g"},
      {sku:"EPC-RASELHANT-001",label:"Ras el hanout",  qty:1, unit:"100g"},
    ]},
  { id:"fruits", title:"Panier Fruits", persons:4, accent:"#a855f7",
    items:[
      {sku:"FRT-ORANGE-001", label:"Orange", qty:2, unit:"kg"},
      {sku:"FRT-BANANE-001", label:"Banane", qty:1, unit:"kg"},
      {sku:"FRT-POMME-001",  label:"Pomme",  qty:1, unit:"kg"},
    ]},
];

export default function PaniersTab({ products, lang, font }: {
  products: DBProduct[];
  lang: Lang;
  font: string;
}) {
  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div>
          <h2 className={"text-base font-extrabold text-gray-800 " + font}>
            {lang === "ar" ? "السلال الجاهزة" : "Paniers pre-composes"}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {lang === "ar" ? "للقراءة فقط — الأسعار مباشرة من الكتالوج" : "Lecture seule. Prix en direct depuis le catalogue."}
          </p>
        </div>
        <span className="text-xs font-bold text-[#2E8B57] bg-green-50 px-3 py-1.5 rounded-full">
          5 paniers
        </span>
      </div>

      {BASKETS.map(basket => {
        const liveItems = basket.items.map(bi => {
          const liveP     = (products as any[]).find((p: any) => p.sku === bi.sku);
          const livePrice = liveP ? liveP.price_mad : null;
          const lineTotal = livePrice !== null ? livePrice * bi.qty : null;
          return { ...bi, livePrice, lineTotal, inStock: liveP?.in_stock ?? null };
        });
        const liveTotal  = liveItems.reduce((s, i) => s + (i.lineTotal ?? 0), 0);
        const saving     = Math.round(liveTotal * 0.08);
        const finalPrice = liveTotal - saving;
        const hasOOS     = liveItems.some(i => i.inStock === false);

        return (
          <div key={basket.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: `2px solid ${basket.accent}25`, background: `${basket.accent}08` }}>
              <div>
                <h3 className={"font-extrabold text-gray-800 " + font}>{basket.title}</h3>
                <p className="text-xs text-gray-400 font-latin">
                  {basket.persons} pers. &bull; {basket.items.length} produits
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-300 line-through font-latin">{liveTotal.toFixed(2)} MAD</p>
                <p className="text-lg font-black font-latin" style={{ color: basket.accent }}>
                  {finalPrice.toFixed(2)} MAD
                </p>
                <p className="text-[9px] text-green-600 font-semibold">
                  -8% &bull; eco {saving.toFixed(0)} MAD
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-50">
              {liveItems.map((item, ii) => (
                <div key={ii}
                  className={"flex items-center justify-between px-5 py-2 " + (item.inStock === false ? "opacity-40" : "")}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[10px] text-gray-300 font-latin w-4 shrink-0">{ii + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 font-latin">{item.label}</p>
                      <p className="text-[10px] text-gray-400 font-latin">
                        {item.sku} &bull; {item.qty} {item.unit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.inStock === false && (
                      <span className="text-[9px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">
                        Rupture
                      </span>
                    )}
                    {item.livePrice !== null ? (
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-700 font-latin">
                          {item.livePrice.toFixed(2)} MAD/{item.unit}
                        </p>
                        <p className="text-[10px] text-gray-400 font-latin">
                          {item.lineTotal?.toFixed(2)} MAD total
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300 font-latin">SKU introuvable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* OOS warning */}
            {hasOOS && (
              <div className="px-5 py-2 bg-amber-50 border-t border-amber-100">
                <p className="text-[10px] font-bold text-amber-600">
                  Attention: produit(s) en rupture dans ce panier
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}