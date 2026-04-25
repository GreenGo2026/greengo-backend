// src/pages/AdminPage.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Save, AlertCircle, CheckCircle, Loader2, Lock,
  ToggleLeft, ToggleRight, ShoppingBag, Clock, XCircle,
  Zap, TrendingUp, Package, CheckSquare, Ban, Globe,
  MessageCircle, MapPin, Phone, Star, DollarSign,
  ChevronDown, ChevronUp, Bike, RefreshCw,
} from "lucide-react";
import {
  updateProductById, updateOrderStatus, getOrders, getProducts,
  type DBProduct, type OrderStatus, type Order,
} from "../services/api";

const ADMIN_PIN = "greengo2026";
type AdminTab = "orders" | "prices";
type Lang     = "fr" | "ar";

interface EditableProduct extends DBProduct {
  edited_price:     number;
  edited_in_stock:  boolean;
  isDirty:          boolean;
  isSaving:         boolean;
  saveStatus:       "idle" | "success" | "error";
}
function toEditable(p: DBProduct): EditableProduct {
  return { ...p, edited_price: p.price_mad, edited_in_stock: p.in_stock, isDirty: false, isSaving: false, saveStatus: "idle" };
}

const I: Record<Lang, Record<string,string>> = {
  fr: {
    title:"Tableau de bord", subtitle:"GreenGo Market",
    tab_orders:"Commandes", tab_prices:"Prix du jour",
    pin_title:"Acc\u00e8s Admin", pin_sub:"Code PIN requis",
    pin_btn:"Ouvrir", pin_err:"PIN incorrect.", pin_ph:"\u2022\u2022\u2022\u2022",
    filter_all:"Toutes",
    approve:"Approuver", reject:"Refuser",
    assign_livreur:"Confier au Livreur", confirm_payment:"Confirmer le paiement",
    complete:"Terminer", approving:"En cours\u2026", rejecting:"Refus\u2026",
    payment_q:"Le client a re\u00e7u sa commande et pay\u00e9 en esp\u00e8ces\u00a0?",
    status_pending:"En attente", status_preparing:"Approuv\u00e9e",
    status_ofd:"En livraison", status_delivered:"Livr\u00e9",
    status_completed:"Termin\u00e9e", status_cancelled:"Refus\u00e9e",
    tl_ordered:"Command\u00e9", tl_approved:"Approuv\u00e9",
    tl_delivery:"En route", tl_done:"Livr\u00e9",
    no_orders:"Aucune commande.", no_orders_sub:"Les commandes apparaissent ici.",
    wa_btn:"WhatsApp", items_lbl:"Articles", total_lbl:"Total",
    addr_lbl:"Adresse", expand:"D\u00e9tails", collapse:"Masquer",
    refresh:"Actualiser", reload:"Recharger",
    publish_all:"Publier les changements", publishing:"Publication\u2026",
    unsaved_hint:" modifications", kbd_hint:"Tab / Entr\u00e9e pour passer",
    product:"Produit", curr_price:"Prix actuel", new_price:"Nouveau prix",
    unit_lbl:"Unit\u00e9", stock_lbl:"Stock", action_lbl:"Action",
    in_stock:"En stock", out_stock:"Rupture",
    save_btn:"Sauver", saving_btn:"\u2026", saved_lbl:"Sauvegard\u00e9", failed_lbl:"\u00c9chec",
    synced:"sync", total_orders:"Commandes", pending_lbl:"En attente",
    products_lbl:"Produits", unsaved_lbl:"Modifs",
    loading_orders:"Chargement des commandes\u2026",
    loading_products:"Chargement des produits\u2026",
    error_orders:"Impossible de charger les commandes.",
    error_products:"Impossible de charger les produits.",
    toast_approved:"\u2705 Commande approuv\u00e9e!", toast_rejected:"\u274c Commande refus\u00e9e.",
    toast_livreur:"\ud83d\udeb4 Confi\u00e9e au livreur!", toast_payment:"\ud83d\udcb0 Paiement confirm\u00e9!",
    toast_saved:" prix publi\u00e9s!", toast_no_dirty:"Aucun changement.",
    toast_partial:" sauvegard\u00e9s,", toast_failed:" \u00e9chou\u00e9s.",
    update_failed:"\u00c9chec \u2014 r\u00e9essayez.",
    price_manager:"Gestionnaire de prix",
    urgent_badge:"Urgent", oldest_badge:"Ancienne",
    completed_note:"Commande termin\u00e9e.", cancelled_note:"Commande refus\u00e9e.",
    customer_lbl:"Client",
  },
  ar: {
    title:"\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645", subtitle:"GreenGo \u0645\u0627\u0631\u0643\u062a",
    tab_orders:"\u0627\u0644\u0637\u0644\u0628\u0627\u062a", tab_prices:"\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u064a\u0648\u0645",
    pin_title:"\u062f\u062e\u0648\u0644 \u0627\u0644\u0625\u062f\u0627\u0631\u0629", pin_sub:"\u0623\u062f\u062e\u0644 \u0631\u0645\u0632 PIN",
    pin_btn:"\u0641\u062a\u062d", pin_err:"\u0631\u0645\u0632 \u062e\u0627\u0637\u0626.", pin_ph:"\u2022\u2022\u2022\u2022",
    filter_all:"\u0627\u0644\u0643\u0644",
    approve:"\u0642\u0628\u0648\u0644 \u0627\u0644\u0637\u0644\u0628", reject:"\u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628",
    assign_livreur:"\u062a\u0633\u0644\u064a\u0645 \u0644\u0644\u064a\u0641\u0631\u0648\u0631", confirm_payment:"\u062a\u0623\u0643\u064a\u062f \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u062f\u0641\u0639",
    complete:"\u0625\u062a\u0645\u0627\u0645", approving:"\u062c\u0627\u0631\u064d\u2026", rejecting:"\u0631\u0641\u0636\u2026",
    payment_q:"\u0647\u0644 \u0627\u0633\u062a\u0644\u0645 \u0627\u0644\u0639\u0645\u064a\u0644 \u0637\u0644\u0628\u0647 \u0648\u062f\u0641\u0639 \u0646\u0642\u062f\u0627\u064b\u061f",
    status_pending:"\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631", status_preparing:"\u0645\u0642\u0628\u0648\u0644",
    status_ofd:"\u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642", status_delivered:"\u062a\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644",
    status_completed:"\u0645\u0643\u062a\u0645\u0644", status_cancelled:"\u0645\u0631\u0641\u0648\u0636",
    tl_ordered:"\u0637\u064f\u0644\u0628", tl_approved:"\u0645\u0642\u0628\u0648\u0644",
    tl_delivery:"\u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642", tl_done:"\u062a\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644",
    no_orders:"\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a.", no_orders_sub:"\u0633\u062a\u0638\u0647\u0631 \u0628\u0639\u062f \u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0634\u0631\u0627\u0621.",
    wa_btn:"\u0648\u0627\u062a\u0633\u0627\u0628", items_lbl:"\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a", total_lbl:"\u0627\u0644\u0645\u062c\u0645\u0648\u0639",
    addr_lbl:"\u0627\u0644\u0639\u0646\u0648\u0627\u0646", expand:"\u062a\u0641\u0627\u0635\u064a\u0644", collapse:"\u0625\u062e\u0641\u0627\u0621",
    refresh:"\u062a\u062d\u062f\u064a\u062b", reload:"\u0625\u0639\u0627\u062f\u0629 \u062a\u062d\u0645\u064a\u0644",
    publish_all:"\u0646\u0634\u0631 \u062c\u0645\u064a\u0639 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a", publishing:"\u062c\u0627\u0631\u064d\u2026",
    unsaved_hint:" \u062a\u063a\u064a\u064a\u0631\u0627\u062a", kbd_hint:"Tab / Enter \u0644\u0644\u0627\u0646\u062a\u0642\u0627\u0644",
    product:"\u0627\u0644\u0645\u0646\u062a\u062c", curr_price:"\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062d\u0627\u0644\u064a", new_price:"\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062c\u062f\u064a\u062f",
    unit_lbl:"\u0627\u0644\u0648\u062d\u062f\u0629", stock_lbl:"\u0627\u0644\u0645\u062e\u0632\u0648\u0646", action_lbl:"\u0627\u0644\u0625\u062c\u0631\u0627\u0621",
    in_stock:"\u0645\u062a\u0648\u0641\u0631", out_stock:"\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631",
    save_btn:"\u062d\u0641\u0638", saving_btn:"\u062c\u0627\u0631\u064d\u2026", saved_lbl:"\u062a\u0645 \u0627\u0644\u062d\u0641\u0638", failed_lbl:"\u0641\u0634\u0644",
    synced:"\u062a\u0632\u0627\u0645\u0646", total_orders:"\u0625\u062c\u0645\u0627\u0644\u064a", pending_lbl:"\u0627\u0646\u062a\u0638\u0627\u0631",
    products_lbl:"\u0645\u0646\u062a\u062c\u0627\u062a", unsaved_lbl:"\u062a\u063a\u064a\u064a\u0631\u0627\u062a",
    loading_orders:"\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062a\u2026",
    loading_products:"\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a\u2026",
    error_orders:"\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062a.",
    error_products:"\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a.",
    toast_approved:"\u2705 \u062a\u0645 \u0642\u0628\u0648\u0644 \u0627\u0644\u0637\u0644\u0628!", toast_rejected:"\u274c \u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628.",
    toast_livreur:"\ud83d\udeb4 \u0633\u0644\u0645\u062a \u0644\u0644\u064a\u0641\u0631\u0648\u0631!", toast_payment:"\ud83d\udcb0 \u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062f\u0641\u0639!",
    toast_saved:" \u0633\u0639\u0631 \u062a\u0645 \u0646\u0634\u0631\u0647!", toast_no_dirty:"\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u063a\u064a\u064a\u0631\u0627\u062a.",
    toast_partial:" \u062a\u0645 \u062d\u0641\u0638\u0647\u0627\u060c", toast_failed:" \u0641\u0634\u0644\u062a.",
    update_failed:"\u0641\u0634\u0644 \u2014 \u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u0627\u064b.",
    price_manager:"\u0645\u062f\u064a\u0631 \u0627\u0644\u0623\u0633\u0639\u0627\u0631",
    urgent_badge:"\u0639\u0627\u062c\u0644", oldest_badge:"\u0642\u062f\u064a\u0645\u0629",
    completed_note:"\u0627\u0643\u062a\u0645\u0644 \u0627\u0644\u0637\u0644\u0628.", cancelled_note:"\u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628.",
    customer_lbl:"\u0627\u0644\u0639\u0645\u064a\u0644",
  },
};

function sCfg(lang: Lang): Record<OrderStatus,{label:string;color:string;bg:string;ring:string;dot:string;icon:React.ReactNode}> {
  const L = I[lang];
  return {
    pending:          {label:L.status_pending,   color:"text-amber-700",  bg:"bg-amber-100",   ring:"ring-amber-300",  dot:"#F59E0B",icon:<Clock size={11}/>},
    preparing:        {label:L.status_preparing, color:"text-blue-700",   bg:"bg-blue-100",    ring:"ring-blue-300",   dot:"#3B82F6",icon:<CheckSquare size={11}/>},
    out_for_delivery: {label:L.status_ofd,       color:"text-violet-700", bg:"bg-violet-100",  ring:"ring-violet-300", dot:"#7C3AED",icon:<Bike size={11}/>},
    delivered:        {label:L.status_delivered, color:"text-emerald-700",bg:"bg-emerald-100", ring:"ring-emerald-300",dot:"#10B981",icon:<CheckCircle size={11}/>},
    completed:        {label:L.status_completed, color:"text-[#2E8B57]",  bg:"bg-[#edfbf3]",   ring:"ring-[#a3ebca]",  dot:"#2E8B57",icon:<CheckCircle size={11}/>},
    cancelled:        {label:L.status_cancelled, color:"text-red-600",    bg:"bg-red-100",     ring:"ring-red-300",    dot:"#EF4444",icon:<XCircle size={11}/>},
  };
}

const NEXT_STATES: Record<OrderStatus,OrderStatus[]> = {
  pending:["preparing","cancelled"], preparing:["out_for_delivery","cancelled"],
  out_for_delivery:["delivered","cancelled"], delivered:["completed"],
  completed:[], cancelled:[],
};

const CAT_STYLE: Record<string,{emoji:string;bg:string;text:string}> = {
  Vegetables:{emoji:"\ud83e\udd55",bg:"bg-emerald-50",text:"text-emerald-700"},
  Fruits:    {emoji:"\ud83c\udf4e",bg:"bg-orange-50", text:"text-orange-700"},
  "White Meats":{emoji:"\ud83c\udf57",bg:"bg-rose-50",text:"text-rose-700"},
  Eggs:      {emoji:"\ud83e\udd5a",bg:"bg-yellow-50",text:"text-yellow-700"},
  Other:     {emoji:"\ud83d\uded2",bg:"bg-gray-100", text:"text-gray-600"},
};

function formatTs(iso:string):string{try{return new Date(iso).toLocaleString("fr-MA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}catch{return iso;}}
function minutesAgo(iso:string):number{try{return Math.floor((Date.now()-new Date(iso).getTime())/60000);}catch{return 0;}}

interface ToastState{msg:string;type:"success"|"error"|"info"|"warn";}
function Toast({toast,onClose}:{toast:ToastState;onClose:()=>void}){
  const [,fr]=useState(0);const tr=useRef<ReturnType<typeof setTimeout>|null>(null);
  if(!tr.current){tr.current=setTimeout(()=>{fr(n=>n+1);onClose();},3800);}
  const bg=toast.type==="success"?"#2E8B57":toast.type==="error"?"#EF4444":toast.type==="warn"?"#F59E0B":"#0d3b36";
  return(<div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2.5 rounded-2xl px-6 py-3.5 shadow-2xl text-sm font-bold text-white" style={{background:bg}}>{toast.type==="success"?<CheckCircle size={15}/>:toast.type==="error"?<XCircle size={15}/>:<Zap size={15}/>}{toast.msg}</div>);
}

function LangToggle({lang,setLang}:{lang:Lang;setLang:(l:Lang)=>void}){
  return(<div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-1">{(["fr","ar"]as Lang[]).map(l=>(<button key={l} onClick={()=>setLang(l)} className={"flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all "+(lang===l?"bg-[#2E8B57] text-white":"text-white/50 hover:text-white")}>{l==="ar"&&<Globe size={10}/>}{l.toUpperCase()}</button>))}</div>);
}

function SBadge({status,lang}:{status:OrderStatus;lang:Lang}){
  const c=sCfg(lang)[status?.toLowerCase() as OrderStatus]||sCfg(lang)["pending"];
  return(<span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 "+c.color+" "+c.bg+" "+c.ring}><span className="h-1.5 w-1.5 rounded-full" style={{background:c.dot}}/>{c.label}</span>);
}

function Timeline({status,lang}:{status:OrderStatus;lang:Lang}){
  const L=I[lang];
  const steps=[{label:L.tl_ordered,icon:<ShoppingBag size={11}/>},{label:L.tl_approved,icon:<CheckSquare size={11}/>},{label:L.tl_delivery,icon:<Bike size={11}/>},{label:L.tl_done,icon:<CheckCircle size={11}/>}];
  const rank:Record<string,number>={pending:0,preparing:1,out_for_delivery:2,delivered:3,completed:3,cancelled:-1};
  const cur=rank[status?.toLowerCase()]??0;
  return(<div className="flex items-start gap-0 w-full">{steps.map((step,i)=>{const done=cur>i;const active=cur===i&&status!=="cancelled";return(<div key={i} className="flex flex-1 items-center"><div className="flex flex-col items-center gap-1 min-w-0"><div className={"flex h-7 w-7 items-center justify-center rounded-full transition-all "+(done?"bg-[#2E8B57] text-white":active?"bg-amber-400 text-white animate-pulse":"bg-gray-100 text-gray-400")}>{step.icon}</div><span className={"text-[9px] font-semibold text-center px-0.5 "+(done?"text-[#2E8B57]":active?"text-amber-600":"text-gray-400")}>{step.label}</span></div>{i<steps.length-1&&<div className={"flex-1 h-0.5 mx-1 mb-4 rounded-full "+(done?"bg-[#2E8B57]":active?"bg-amber-200":"bg-gray-100")}/>}</div>);})}</div>);
}

function OrderCard({order,lang,isOldest,onStatusChange,showToast,onRefresh}:{order:Order;lang:Lang;isOldest:boolean;onStatusChange:(id:string,s:OrderStatus)=>Promise<void>;showToast:(msg:string,type:ToastState["type"])=>void;onRefresh:()=>void;}){
  const [expanded,setExpanded]=useState(order.status==="pending"||order.status==="out_for_delivery");
  const [localStatus,setLocal]=useState<OrderStatus>((order.status?.toLowerCase() as OrderStatus)||"pending");
  const [loading,setLoading]=useState<OrderStatus|null>(null);
  const L=I[lang];const dir=lang==="ar"?"rtl":"ltr";const font=lang==="ar"?"font-arabic":"font-latin";
  const ago=minutesAgo(order.created_at);
  const shortId="#BGO-"+(order.id||"").slice(-4).toUpperCase();
  const phoneClean=(order.customer_phone||"").replace(/\D/g,"");
  const waMsg=encodeURIComponent("\u0645\u0631\u062d\u0628\u0627\u064b \u2014 GreenGo "+shortId+" \ud83c\udf43");
  const waHref="https://wa.me/212"+phoneClean.slice(phoneClean.startsWith("0")?1:0)+"?text="+waMsg;
  const init=(order.customer_name||order.customer_phone||"??").slice(0,2).toUpperCase();
  const nextStates=NEXT_STATES[localStatus]??[];
  const isTerminal=nextStates.length===0;
  const showTl=localStatus!=="pending"&&localStatus!=="cancelled";
  const isUrgent=localStatus==="pending"&&ago>20;
  const borderCls=localStatus==="pending"&&isUrgent?"border-amber-400":localStatus==="pending"?"border-amber-200":localStatus==="preparing"?"border-blue-200":localStatus==="out_for_delivery"?"border-violet-300":localStatus==="completed"?"border-emerald-300":localStatus==="cancelled"?"border-red-200":"border-gray-200";
  const topGrad=localStatus==="pending"?(isUrgent?"linear-gradient(90deg,#F59E0B,#FDE68A)":"linear-gradient(90deg,#FCD34D,#FEF9C3)"):localStatus==="preparing"?"linear-gradient(90deg,#3B82F6,#93C5FD)":localStatus==="out_for_delivery"?"linear-gradient(90deg,#7C3AED,#C4B5FD)":localStatus==="completed"?"linear-gradient(90deg,#2E8B57,#4DB882)":localStatus==="cancelled"?"linear-gradient(90deg,#EF4444,#FCA5A5)":"linear-gradient(90deg,#10B981,#6EE7B7)";
  async function go(s:OrderStatus){
    setLoading(s);
    try{await onStatusChange(order.id,s);setLocal(s);
      if(s==="preparing")showToast(L.toast_approved,"success");
      else if(s==="out_for_delivery")showToast(L.toast_livreur,"info");
      else if(s==="delivered"||s==="completed")showToast(L.toast_payment,"success");
      else if(s==="cancelled")showToast(L.toast_rejected,"error");
      onRefresh();
    }catch{showToast(L.update_failed,"error");}finally{setLoading(null);}
  }
  return(
    <div className={"overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-300 hover:shadow-lg "+borderCls}>
      <div className="h-1.5 w-full" style={{background:topGrad}}/>
      <div className="px-4 py-4 space-y-3">
        <div className={"flex items-start gap-3 "+(lang==="ar"?"flex-row-reverse":"")} dir={dir}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-extrabold text-sm text-white shadow-md" style={{background:"linear-gradient(135deg,#2E8B57,#0d3b36)"}}>{init}</div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className={"flex items-center flex-wrap gap-2 "+(lang==="ar"?"justify-end":"")}>
              <span className="text-[11px] font-extrabold text-gray-400 font-mono">{shortId}</span>
              <SBadge status={localStatus} lang={lang}/>
              {isUrgent&&<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-300"><Star size={8} className="fill-red-500"/>{L.urgent_badge}</span>}
              {isOldest&&localStatus==="pending"&&<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-300"><Clock size={8}/>{L.oldest_badge}</span>}
            </div>
            <div className={"flex items-center gap-3 flex-wrap "+(lang==="ar"?"flex-row-reverse":"")}>
              {order.customer_name&&<span className="text-xs font-bold text-gray-700">{order.customer_name}</span>}
              <div className={"flex items-center gap-1.5 "+(lang==="ar"?"flex-row-reverse":"")}><Phone size={11} className="text-[#2E8B57] shrink-0"/><span className="text-sm font-bold text-gray-700 font-latin">{order.customer_phone}</span></div>
              <div className={"flex items-center gap-1 "+(lang==="ar"?"flex-row-reverse":"")}><Clock size={10} className="text-gray-400"/><span className="text-xs text-gray-400 font-latin">{formatTs(order.created_at)}</span>{ago<120&&<span className="text-[10px] text-gray-400">({ago}min)</span>}</div>
            </div>
            <div dir="rtl" className={"flex flex-wrap gap-1.5 "+(lang==="ar"?"justify-end":"")}>
              {(order.items||[]).slice(0,3).map((item,i)=>{const nm=item.name||item.item_name||"";return(<span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600"><span className="font-arabic">{nm}</span><span className="font-latin text-gray-400">\u00d7{item.quantity}{item.unit}</span></span>);})}
              {(order.items||[]).length>3&&<span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">+{(order.items||[]).length-3}</span>}
            </div>
          </div>
          <div className="shrink-0 text-right space-y-1.5">
            <div><span className="text-xl font-extrabold text-gray-800 font-latin">{(order.total_price||0).toFixed(2)}</span><span className="ml-1 text-xs text-gray-400">MAD</span></div>
            <button onClick={()=>setExpanded(v=>!v)} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-100 transition-colors ml-auto">{expanded?<ChevronUp size={10}/>:<ChevronDown size={10}/>}{expanded?L.collapse:L.expand}</button>
          </div>
        </div>
        {showTl&&<Timeline status={localStatus} lang={lang}/>}
        {!isTerminal&&(
          <div className="space-y-2">
            {localStatus==="pending"&&(<div className={"flex gap-2.5 "+(lang==="ar"?"flex-row-reverse":"")}><button onClick={()=>go("preparing")} disabled={loading!==null} className={"flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white shadow-md transition-all hover:shadow-lg active:scale-95 "+font+(loading!==null?" opacity-60 cursor-not-allowed":"")} style={{background:loading==="preparing"?"#9ca3af":"linear-gradient(135deg,#2E8B57,#1a6b42)"}}>{loading==="preparing"?<Loader2 size={14} className="animate-spin"/>:<CheckSquare size={14}/>}{loading==="preparing"?L.approving:L.approve}</button><button onClick={()=>go("cancelled")} disabled={loading!==null} className={"flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-white px-5 py-3 text-sm font-extrabold text-red-500 transition-all hover:bg-red-50 hover:border-red-400 active:scale-95 "+font+(loading!==null?" opacity-60 cursor-not-allowed":"")}>{loading==="cancelled"?<Loader2 size={13} className="animate-spin"/>:<Ban size={13}/>}{loading==="cancelled"?L.rejecting:L.reject}</button></div>)}
            {localStatus==="preparing"&&(<button onClick={()=>go("out_for_delivery")} disabled={loading!==null} className={"flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white shadow-md transition-all hover:shadow-lg active:scale-95 "+font+(loading!==null?" opacity-60 cursor-not-allowed":"")} style={{background:loading?"#9ca3af":"linear-gradient(135deg,#FF9800,#e68900)"}}>{loading?<Loader2 size={14} className="animate-spin"/>:<Bike size={14}/>}{loading?L.approving:L.assign_livreur}</button>)}
            {localStatus==="out_for_delivery"&&(<div className="rounded-2xl bg-violet-50 p-4 ring-2 ring-violet-200 space-y-3"><p className={"text-center text-sm font-bold text-violet-700 "+font} dir={lang==="ar"?"rtl":"ltr"}>{L.payment_q}</p><button onClick={()=>go("delivered")} disabled={loading!==null} className={"flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white shadow-md transition-all hover:shadow-lg active:scale-95 "+font+(loading!==null?" opacity-60 cursor-not-allowed":"")} style={{background:loading?"#9ca3af":"linear-gradient(135deg,#7C3AED,#5B21B6)"}}>{loading?<Loader2 size={14} className="animate-spin"/>:<DollarSign size={14}/>}{loading?L.approving:L.confirm_payment}</button></div>)}
            {localStatus==="delivered"&&(<button onClick={()=>go("completed")} disabled={loading!==null} className={"flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white shadow-md transition-all hover:shadow-lg active:scale-95 "+font+(loading!==null?" opacity-60 cursor-not-allowed":"")} style={{background:loading?"#9ca3af":"linear-gradient(135deg,#2E8B57,#1a6b42)"}}>{loading?<Loader2 size={14} className="animate-spin"/>:<CheckCircle size={14}/>}{loading?L.approving:L.complete}</button>)}
          </div>
        )}
        {isTerminal&&(<div className={"flex items-center gap-2 rounded-xl px-3 py-2.5 "+(localStatus==="completed"?"bg-emerald-50 ring-1 ring-emerald-200":"bg-red-50 ring-1 ring-red-200")}>{localStatus==="completed"?<CheckCircle size={14} className="text-[#2E8B57] shrink-0"/>:<XCircle size={14} className="text-red-500 shrink-0"/>}<p className={"text-xs font-bold "+(localStatus==="completed"?"text-[#2E8B57]":"text-red-500")+" "+font}>{localStatus==="completed"?L.completed_note:L.cancelled_note}</p></div>)}
        {expanded&&(
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <div className={"flex flex-wrap items-center gap-3 "+(lang==="ar"?"flex-row-reverse":"")}>
              {order.delivery_address&&<div className={"flex items-center gap-1.5 "+(lang==="ar"?"flex-row-reverse":"")}><MapPin size={12} className="text-[#FF9800] shrink-0"/><p className="text-sm text-gray-700">{order.delivery_address}</p></div>}
              <a href={waHref} target="_blank" rel="noopener noreferrer" className={"flex items-center gap-1.5 rounded-full bg-[#2E8B57] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#1a6b42] transition-colors "+font}><MessageCircle size={11}/>{L.wa_btn}</a>
            </div>
            {(order.items||[]).length>0&&(<div><p className={"text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 "+font}>{L.items_lbl}</p><div className="space-y-1.5">{(order.items||[]).map((item,i)=>{const nm=item.name||item.item_name||"";return(<div key={i} className={"flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-200 "+(lang==="ar"?"flex-row-reverse":"")}><div className={"flex items-center gap-2.5 "+(lang==="ar"?"flex-row-reverse":"")}><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-base">\ud83d\uded2</div><div className={lang==="ar"?"text-right":""}><p dir="rtl" className="text-sm font-bold text-gray-800 font-arabic">{nm}</p><p className="text-[10px] text-gray-400 font-latin">\u00d7{item.quantity} {item.unit}</p></div></div><div className="text-right"><p className="text-sm font-extrabold text-[#2E8B57] font-latin">{((item.price_per_unit||0)*(item.quantity||0)).toFixed(2)}</p><p className="text-[10px] text-gray-400">MAD</p></div></div>);})}</div><div className={"mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 "+(lang==="ar"?"flex-row-reverse":"")} style={{background:"linear-gradient(135deg,#fdf8ef,#f9efda)"}}><span className={"text-sm font-bold text-gray-600 "+font}>{L.total_lbl}</span><span className="text-xl font-extrabold text-[#2E8B57] font-latin">{(order.total_price||0).toFixed(2)} <span className="text-xs font-semibold text-gray-400">MAD</span></span></div></div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceRow({item,rowIndex,totalRows,lang,onChange,onToggle,onSave,inputRef}:{item:EditableProduct;rowIndex:number;totalRows:number;lang:Lang;onChange:(id:string,val:number)=>void;onToggle:(id:string)=>void;onSave:(id:string)=>void;inputRef:(el:HTMLInputElement|null)=>void;}){
  const L=I[lang];const font=lang==="ar"?"font-arabic":"font-latin";
  const cs=CAT_STYLE[item.category]??CAT_STYLE.Other;
  const pct=item.isDirty&&item.price_mad>0?((item.edited_price-item.price_mad)/item.price_mad*100):0;
  return(
    <tr className={"border-b border-gray-100 transition-all "+(item.isDirty?"bg-amber-50/50":"bg-white hover:bg-emerald-50/20")}>
      <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl "+cs.bg}>{cs.emoji}</div><div><p dir="rtl" className="font-bold text-gray-800 text-sm font-arabic">{item.name_ar}</p>{item.name_fr&&<p className="text-[10px] text-gray-400 font-latin">{item.name_fr}</p>}<span className={"mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold "+cs.bg+" "+cs.text}>{item.category}</span></div></div></td>
      <td className="px-5 py-3.5"><span className="text-sm font-semibold text-gray-400 font-latin">{item.price_mad.toFixed(2)}</span></td>
      <td className="px-5 py-3.5"><div className="flex items-center gap-2"><input ref={inputRef} type="number" min="0" step="0.5" value={item.edited_price} onChange={e=>onChange(item.id,parseFloat(e.target.value)||0)} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Tab"){e.preventDefault();onSave(item.id);const inputs=document.querySelectorAll<HTMLInputElement>(".price-input");const idx=Array.from(inputs).indexOf(e.currentTarget);const nxt=inputs[idx+1];if(nxt){nxt.focus();nxt.select();}}}} className={"price-input w-24 rounded-xl border-2 px-2 py-2 text-center text-sm font-bold outline-none transition-all font-latin "+(item.isDirty?"border-amber-300 bg-amber-50 text-amber-800 focus:border-[#2E8B57] focus:bg-white focus:ring-2 focus:ring-[#2E8B57]/20":"border-gray-200 bg-white text-gray-800 focus:border-[#2E8B57] focus:ring-2 focus:ring-[#2E8B57]/20")}/><span className="text-xs text-gray-400">MAD</span>{item.isDirty&&item.price_mad>0&&item.edited_price!==item.price_mad&&(<span className={"text-[10px] font-bold rounded-full px-1.5 py-0.5 "+(pct>0?"bg-red-100 text-red-600":"bg-emerald-100 text-emerald-700")}>{pct>0?"\u2191":"\u2193"}{Math.abs(pct).toFixed(0)}%</span>)}</div></td>
      <td className="px-5 py-3.5"><span className="text-xs font-semibold text-gray-400 font-latin">{item.unit||"—"}</span></td>
      <td className="px-5 py-3.5"><button onClick={()=>onToggle(item.id)} className="flex items-center gap-2 rounded-xl px-2 py-1 transition-all hover:bg-gray-100">{item.edited_in_stock?<><ToggleRight size={22} className="text-[#2E8B57]"/><span className={"text-xs font-bold text-[#2E8B57] "+font}>{L.in_stock}</span></>:<><ToggleLeft size={22} className="text-gray-300"/><span className={"text-xs font-bold text-gray-400 "+font}>{L.out_stock}</span></>}</button></td>
      <td className="px-5 py-3.5">{item.saveStatus==="success"?<span className={"flex items-center gap-1 text-xs font-bold text-[#2E8B57] "+font}><CheckCircle size={13}/>{L.saved_lbl}</span>:item.saveStatus==="error"?<span className={"flex items-center gap-1 text-xs font-bold text-red-500 "+font}><AlertCircle size={13}/>{L.failed_lbl}</span>:(<button onClick={()=>onSave(item.id)} disabled={!item.isDirty||item.isSaving} className={"flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all "+font+" "+(item.isDirty&&!item.isSaving?"shadow-sm active:scale-95":"cursor-not-allowed bg-gray-200 text-gray-400")} style={item.isDirty&&!item.isSaving?{background:"linear-gradient(135deg,#2E8B57,#1a6b42)"}:{}}>{item.isSaving?<Loader2 size={11} className="animate-spin"/>:<Save size={11}/>}{item.isSaving?L.saving_btn:L.save_btn}</button>)}</td>
      <td className="px-2 py-3.5 text-center"><span className="text-[10px] font-mono text-gray-300">{rowIndex+1}/{totalRows}</span></td>
    </tr>
  );
}

function PinGate({onUnlock,lang,setLang}:{onUnlock:()=>void;lang:Lang;setLang:(l:Lang)=>void}){
  const [pin,setPin]=useState("");const [err,setErr]=useState(false);
  const L=I[lang];const font=lang==="ar"?"font-arabic":"font-latin";
  function submit(){if(pin===ADMIN_PIN){onUnlock();}else{setErr(true);setPin("");setTimeout(()=>setErr(false),2000);}}
  return(<div className="relative flex min-h-screen flex-col items-center justify-center" style={{background:"linear-gradient(160deg,#0d3b36 0%,#0a2318 50%,#1a3a0d 100%)"}}><div className="absolute inset-0 opacity-10 pointer-events-none zellige-bg-light"/><div className="absolute top-4 right-4"><LangToggle lang={lang} setLang={setLang}/></div><div className={"flex flex-col items-center gap-5 rounded-3xl bg-white/95 p-10 shadow-2xl w-full max-w-sm "+font}><div className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-xl" style={{background:"linear-gradient(135deg,#2E8B57,#0d3b36)"}}><Lock size={32} className="text-white"/></div><div className="text-center"><h1 className="text-2xl font-extrabold text-gray-800">{L.pin_title}</h1><p className="mt-1 text-sm text-gray-500">{L.pin_sub}</p></div><div className="w-full space-y-3"><input type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={L.pin_ph} dir="ltr" className={"w-full rounded-2xl border-2 bg-gray-50 px-4 py-3.5 text-center text-2xl font-bold tracking-widest outline-none transition-all "+(err?"border-red-400 text-red-500":"border-gray-200 text-gray-800 focus:border-[#2E8B57] focus:bg-white focus:ring-4 focus:ring-[#2E8B57]/10")}/>{err&&<p className={"text-center text-sm font-semibold text-red-500 "+font}>{L.pin_err}</p>}<button onClick={submit} className={"w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg active:scale-95 "+font} style={{background:"linear-gradient(135deg,#2E8B57,#1a6b42)"}}>{L.pin_btn}</button></div></div></div>);
}

export default function AdminPage() {
  const [lang,setLang]           = useState<Lang>("ar");
  const [unlocked,setUnlocked]   = useState(false);
  const [activeTab,setActiveTab] = useState<AdminTab>("orders");
  const [orders,setOrders]                   = useState<Order[]>([]);
  const [ordersLoading,setOrdersLoading]     = useState(false);
  const [ordersError,setOrdersError]         = useState("");
  const [statusFilter,setStatusFilter]       = useState<OrderStatus|"all">("all");
  const [lastSync,setLastSync]               = useState("");
  const [products,setProducts]               = useState<EditableProduct[]>([]);
  const [productsLoading,setProductsLoading] = useState(false);
  const [productsError,setProductsError]     = useState("");
  const [publishing,setPublishing]           = useState(false);
  const [toast,setToast] = useState<ToastState|null>(null);
  const inputRefs = useRef<Map<string,HTMLInputElement|null>>(new Map());
  const L=I[lang];const dir=lang==="ar"?"rtl":"ltr";const font=lang==="ar"?"font-arabic":"font-latin";
  const showToast = useCallback((msg:string,type:ToastState["type"])=>setToast({msg,type}),[]);

  const fetchOrders = useCallback(async()=>{
    setOrdersLoading(true);setOrdersError("");
    try{const data=await getOrders(statusFilter==="all"?undefined:statusFilter,100);setOrders(data);setLastSync(new Date().toLocaleTimeString());}
    catch{setOrdersError(L.error_orders);}finally{setOrdersLoading(false);}
  },[statusFilter,L.error_orders]);

  const fetchProducts = useCallback(async()=>{
    setProductsLoading(true);setProductsError("");
    try{const data=await getProducts();setProducts(data.map(toEditable));}
    catch{setProductsError(L.error_products);}finally{setProductsLoading(false);}
  },[L.error_products]);

  useEffect(()=>{if(unlocked&&activeTab==="orders")fetchOrders();},[unlocked,activeTab,fetchOrders]);
  useEffect(()=>{if(unlocked&&activeTab==="prices")fetchProducts();},[unlocked,activeTab,fetchProducts]);

  async function handleStatusChange(id:string,status:OrderStatus){await updateOrderStatus(id,status);setOrders(prev=>prev.map(o=>o.id===id?{...o,status}:o));}
  function handlePriceChange(id:string,val:number){setProducts(prev=>prev.map(p=>p.id===id?{...p,edited_price:val,isDirty:val!==p.price_mad||p.edited_in_stock!==p.in_stock,saveStatus:"idle"}:p));}
  function handleToggleStock(id:string){setProducts(prev=>prev.map(p=>p.id===id?{...p,edited_in_stock:!p.edited_in_stock,isDirty:true,saveStatus:"idle"}:p));}
  async function handleSave(id:string){
    const item=products.find(p=>p.id===id);if(!item||!item.isDirty)return;
    setProducts(prev=>prev.map(p=>p.id===id?{...p,isSaving:true}:p));
    try{const r=await updateProductById(id,{price_mad:item.edited_price,in_stock:item.edited_in_stock});setProducts(prev=>prev.map(p=>p.id===id?{...p,...toEditable(r),isDirty:false,isSaving:false,saveStatus:"success"}:p));setTimeout(()=>setProducts(prev=>prev.map(p=>p.id===id?{...p,saveStatus:"idle"}:p)),3000);}
    catch{setProducts(prev=>prev.map(p=>p.id===id?{...p,isSaving:false,saveStatus:"error"}:p));}
  }
  async function handlePublishAll(){
    const dirty=products.filter(p=>p.isDirty);if(dirty.length===0){showToast(L.toast_no_dirty,"info");return;}
    setPublishing(true);let saved=0,failed=0;
    for(const item of dirty){try{const r=await updateProductById(item.id,{price_mad:item.edited_price,in_stock:item.edited_in_stock});setProducts(prev=>prev.map(p=>p.id===item.id?{...p,...toEditable(r),isDirty:false,isSaving:false,saveStatus:"success"}:p));saved++;}catch{failed++;}}
    setPublishing(false);
    if(failed===0)showToast("\u2705 "+saved+L.toast_saved,"success");else showToast("\u26a0\ufe0f "+saved+L.toast_partial+" "+failed+L.toast_failed,"error");
    setTimeout(()=>setProducts(prev=>prev.map(p=>({...p,saveStatus:"idle"}))),3500);
  }

  if(!unlocked)return<PinGate onUnlock={()=>setUnlocked(true)} lang={lang} setLang={setLang}/>;

  const filterOptions:{value:OrderStatus|"all";label:string}[]=[
    {value:"all",label:L.filter_all},{value:"pending",label:L.status_pending},
    {value:"preparing",label:L.status_preparing},{value:"out_for_delivery",label:L.status_ofd},
    {value:"delivered",label:L.status_delivered},{value:"completed",label:L.status_completed},
    {value:"cancelled",label:L.status_cancelled},
  ];
  const pendingCount=orders.filter(o=>o.status==="pending").length;
  const dirtyCount=products.filter(p=>p.isDirty).length;
  const oldestPendingId=[...orders].filter(o=>o.status==="pending").sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime())[0]?.id;

  return(
    <div className={"min-h-screen "+font} style={{background:"linear-gradient(160deg,#f0fdf4 0%,#f8fafc 40%,#FAF7F2 100%)"}}>
      {toast&&<Toast toast={toast} onClose={()=>setToast(null)}/>}
      <div className="sticky top-0 z-30" style={{background:"linear-gradient(135deg,#0d3b36,#0a2318)"}}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3" dir={dir}>
          <div className={lang==="ar"?"text-right":""}><h1 className="text-base font-extrabold text-white">{L.title}</h1><p className="text-[11px] text-white/40">{L.subtitle}</p></div>
          <div className={"flex items-center gap-3 "+(lang==="ar"?"flex-row-reverse":"")}>
            <LangToggle lang={lang} setLang={setLang}/>
            <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-1">
              {(["orders","prices"]as AdminTab[]).map(tab=>(
                <button key={tab} onClick={()=>setActiveTab(tab)} className={"relative flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all "+(activeTab===tab?"bg-[#2E8B57] text-white":"text-white/50 hover:text-white")}>
                  {tab==="orders"?<ShoppingBag size={12}/>:<TrendingUp size={12}/>}
                  {tab==="orders"?L.tab_orders:L.tab_prices}
                  {tab==="orders"&&pendingCount>0&&<span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-extrabold text-white">{pendingCount}</span>}
                  {tab==="prices"&&dirtyCount>0&&<span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-extrabold text-white">{dirtyCount}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[{icon:ShoppingBag,label:L.total_orders,value:String(orders.length),from:"#2E8B57",to:"#1a6b42",id:"orders"},{icon:Clock,label:L.pending_lbl,value:String(pendingCount),from:"#F59E0B",to:"#d97706",id:"pending"},{icon:Package,label:L.products_lbl,value:String(products.length),from:"#C0614A",to:"#a04a36",id:"products"},{icon:TrendingUp,label:L.unsaved_lbl,value:String(dirtyCount),from:"#C9A96E",to:"#a07d42",id:"unsaved"}].map((s,i)=>{const Icon=s.icon;return(<div key={s.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md" style={{background:"linear-gradient(135deg,"+s.from+","+s.to+")"}}><Icon size={18}/></div><div className={lang==="ar"?"text-right":""}><p className="text-2xl font-extrabold text-gray-800">{s.value}</p><p className="text-[11px] text-gray-400">{s.label}</p></div></div>);})}
        </div>
        {activeTab==="orders"&&(
          <div className="space-y-4">
            <div className={"flex flex-wrap items-center justify-between gap-3 "+(lang==="ar"?"flex-row-reverse":"")}><p className="text-sm text-gray-500">{ordersLoading?L.loading_orders:orders.length+" "+L.tab_orders+(lastSync?" \u00b7 "+L.synced+" "+lastSync:"")}</p><button onClick={fetchOrders} disabled={ordersLoading} className={"flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50 "+font}>{ordersLoading?<Loader2 size={13} className="animate-spin"/>:<RefreshCw size={13}/>}{L.refresh}</button></div>
            <div className={"scrollbar-hide flex gap-2 overflow-x-auto pb-1 "+(lang==="ar"?"flex-row-reverse":"")}>{filterOptions.map(({value,label})=>(<button key={value} onClick={()=>setStatusFilter(value)} className={"shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all "+(statusFilter===value?"bg-[#2E8B57] text-white shadow-sm":"bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-[#2E8B57]/40 hover:text-[#2E8B57]")}>{label}</button>))}</div>
            {ordersLoading&&<div className="flex items-center justify-center gap-3 py-16 text-[#2E8B57]"><Loader2 size={28} className="animate-spin"/><p className={"font-semibold "+font}>{L.loading_orders}</p></div>}
            {!ordersLoading&&ordersError&&<div className="flex flex-col items-center gap-3 py-12 text-center"><AlertCircle size={32} className="text-red-400"/><p className={"text-gray-600 "+font}>{ordersError}</p><button onClick={fetchOrders} className={"flex items-center gap-2 rounded-xl bg-[#2E8B57] px-5 py-2 text-sm font-bold text-white "+font}><RefreshCw size={13}/>{L.refresh}</button></div>}
            {!ordersLoading&&!ordersError&&orders.length===0&&<div className={"flex flex-col items-center gap-3 py-16 text-gray-400 text-center "+font}><ShoppingBag size={44} className="opacity-20"/><p className="font-semibold">{L.no_orders}</p><p className="text-sm">{L.no_orders_sub}</p></div>}
            {!ordersLoading&&!ordersError&&orders.length>0&&<div className="space-y-4">{orders.map(o=><OrderCard key={o.id} order={o} lang={lang} isOldest={o.id===oldestPendingId} onStatusChange={handleStatusChange} showToast={showToast} onRefresh={fetchOrders}/>)}</div>}
          </div>
        )}
        {activeTab==="prices"&&(
          <div className="space-y-4">
            <div className={"flex flex-wrap items-center justify-between gap-3 "+(lang==="ar"?"flex-row-reverse":"")}><div className={lang==="ar"?"text-right":""}><p className="text-sm text-gray-500">{products.length} {L.products_lbl}</p>{dirtyCount>0&&<p className={"text-xs font-semibold text-amber-600 "+font}>{dirtyCount}{L.unsaved_hint}</p>}</div><div className={"flex gap-2 "+(lang==="ar"?"flex-row-reverse":"")}><button onClick={fetchProducts} disabled={productsLoading} className={"flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50 "+font}>{productsLoading?<Loader2 size={13} className="animate-spin"/>:<RefreshCw size={13}/>}{L.reload}</button><button onClick={handlePublishAll} disabled={publishing||productsLoading} className={"flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold text-white shadow-lg transition-all hover:shadow-xl active:scale-95 "+font+" "+(dirtyCount>0?"":"opacity-50 cursor-not-allowed")} style={{background:dirtyCount>0?"linear-gradient(135deg,#2E8B57,#1a6b42)":"#9ca3af"}}>{publishing?<Loader2 size={14} className="animate-spin"/>:<Zap size={14}/>}{publishing?L.publishing:L.publish_all}{dirtyCount>0&&<span className={"rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold "+(lang==="ar"?"mr-1":"ml-1")}>{dirtyCount}</span>}</button></div></div>
            {productsLoading&&<div className="flex items-center justify-center gap-3 py-16 text-[#2E8B57]"><Loader2 size={28} className="animate-spin"/><p className={"font-semibold "+font}>{L.loading_products}</p></div>}
            {!productsLoading&&productsError&&<div className="flex flex-col items-center gap-3 py-12 text-center"><AlertCircle size={32} className="text-red-400"/><p className={"text-gray-600 "+font}>{productsError}</p><button onClick={fetchProducts} className={"flex items-center gap-2 rounded-xl bg-[#2E8B57] px-5 py-2 text-sm font-bold text-white "+font}><RefreshCw size={13}/>{L.reload}</button></div>}
            {!productsLoading&&!productsError&&products.length>0&&(
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className={"flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3 "+(lang==="ar"?"flex-row-reverse":"")}><p className={"text-xs font-extrabold uppercase tracking-widest text-gray-400 "+font}>{L.price_manager}</p><p className="hidden text-[10px] text-gray-400 md:block"><kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-sm ring-1 ring-gray-200">Tab</kbd>{" / "}<kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-sm ring-1 ring-gray-200">Enter</kbd>{" \u2014 "}{L.kbd_hint}</p></div>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className={"border-b border-gray-100 bg-gray-50/50 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 "+(lang==="ar"?"text-right":"")} dir={dir}><th className="px-5 py-3">{L.product}</th><th className="px-5 py-3">{L.curr_price}</th><th className="px-5 py-3">{L.new_price}</th><th className="px-5 py-3">{L.unit_lbl}</th><th className="px-5 py-3">{L.stock_lbl}</th><th className="px-5 py-3">{L.action_lbl}</th><th className="px-2 py-3"></th></tr></thead><tbody>{products.map((item,i)=>(<PriceRow key={item.id} item={item} rowIndex={i} totalRows={products.length} lang={lang} onChange={handlePriceChange} onToggle={handleToggleStock} onSave={handleSave} inputRef={el=>inputRefs.current.set(item.id,el)}/>))}</tbody></table></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}