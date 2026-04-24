// src/pages/ContactPage.tsx
import { useState } from "react";
import { Mail, MapPin, Phone, MessageCircle, Send, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

const WA_HREF    = "https://wa.me/212664500789";
const WA_REL     = "noopener noreferrer";
const PHONE      = "+212 664-500-789";
const PHONE_HREF = "tel:+212664500789";

export default function ContactPage() {
  const { dir, language, isRTL } = useLanguage();
  const font = language === "ar" ? "font-arabic" : "font-latin";
  const ar = language === "ar";
  const fr = language === "fr";

  const [form,      setForm]      = useState({ name: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [focused,   setFocused]   = useState("");

  const T = {
    heroTag:    ar ? "تواصل معنا"         : fr ? "Contactez-nous"               : "Contact us",
    heroTitle:  ar ? "نحن هنا لمساعدتك"  : fr ? "Nous sommes là pour vous"     : "We are here for you",
    heroSub:    ar ? "فريق GreenGo جاهز يرد عليك في أقرب وقت ممكن." : fr ? "L'équipe GreenGo est prête à vous répondre dans les plus brefs délais." : "The GreenGo team is ready to respond as quickly as possible.",
    waTitle:    ar ? "واتساب — الأسرع"   : fr ? "WhatsApp — Le plus rapide"     : "WhatsApp — Fastest",
    waSub:      ar ? "رد خلال دقائق"     : fr ? "Réponse en quelques minutes"   : "Reply within minutes",
    addrTitle:  ar ? "العنوان"           : fr ? "Adresse"                       : "Address",
    addrFr:     "Lot N° 145 Lotissement EL MOUSTAKBAL",
    addrCity:   "Laayayda, Salé — Maroc",
    addrAr:     "تجزئة المستقبل رقم 145",
    addrArCity: "لعيايدة، سلا — المغرب",
    phoneTitle: ar ? "الهاتف"            : fr ? "Téléphone"                     : "Phone",
    hoursTitle: ar ? "أوقات العمل"       : fr ? "Horaires"                      : "Working hours",
    hours:      ar ? "الإثنين — السبت: 8ص — 8م" : fr ? "Lun — Sam : 8h — 20h"  : "Mon — Sat: 8am — 8pm",
    formTitle:  ar ? "أرسل رسالة"        : fr ? "Envoyer un message"            : "Send a message",
    formSub:    ar ? "سنرد عليك في أقرب وقت." : fr ? "Nous vous répondrons rapidement." : "We will get back to you soon.",
    nameLbl:    ar ? "الاسم الكامل"      : fr ? "Nom complet"                   : "Full name",
    phoneLbl:   ar ? "رقم الهاتف"        : fr ? "Téléphone"                     : "Phone number",
    msgLbl:     ar ? "رسالتك"            : fr ? "Votre message"                 : "Your message",
    namePh:     ar ? "اسمك الكريم"       : fr ? "Votre prénom et nom"           : "Your full name",
    phonePh:    "06XXXXXXXX",
    msgPh:      ar ? "كتب لنا واش بغيتي..." : fr ? "Écrivez votre message ici..." : "Write your message here...",
    sendBtn:    ar ? "إرسال الرسالة"      : fr ? "Envoyer"                      : "Send message",
    sending:    ar ? "جارٍ الإرسال…"     : fr ? "Envoi en cours…"               : "Sending…",
    errAll:     ar ? "يرجى ملء جميع الحقول" : fr ? "Veuillez remplir tous les champs" : "Please fill in all fields",
    okTitle:    ar ? "تم إرسال رسالتك! 🎉" : fr ? "Message envoyé ! 🎉"          : "Message sent! 🎉",
    okBody:     ar ? "شكراً على تواصلك. سنرد عليك قريباً." : fr ? "Merci de nous avoir contactés. Nous vous répondrons bientôt." : "Thank you for reaching out. We will reply soon.",
    waBtn:      ar ? "تواصل عبر واتساب"  : fr ? "Contacter via WhatsApp"        : "Contact via WhatsApp",
    orLabel:    ar ? "أو"                : fr ? "ou"                            : "or",
  };

  function update(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      setError(T.errAll);
      return;
    }
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 1000);
  }

  const inputCls = (field: string) =>
    "w-full rounded-xl border bg-white/70 px-4 py-3 text-sm text-gray-800 outline-none transition-all duration-200 placeholder-gray-300 backdrop-blur-sm " +
    (focused === field
      ? "border-[#2E8B57] bg-white shadow-md ring-2 ring-[#2E8B57]/20"
      : "border-gray-200 hover:border-gray-300");

  return (
    <div className={"min-h-screen " + font} style={{ background: "linear-gradient(135deg, #f0faf4 0%, #FAF7F2 40%, #fff8e1 100%)" }}>

      <section className="hero-gradient zellige-bg-light relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.12) 100%)" }} />
        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center md:py-18">
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF9800]" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF9800]">{T.heroTag}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white md:text-4xl">{T.heroTitle}</h1>
          <p className="mx-auto mt-3 max-w-lg text-base text-white/65">{T.heroSub}</p>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12" style={{ background: "linear-gradient(to top, #f0faf4, transparent)" }} />
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div dir={dir} className="grid gap-6 md:grid-cols-5 md:gap-8">

          <div className="space-y-4 md:col-span-2">

            <a href={WA_HREF} target="_blank" rel={WA_REL} className="group flex items-center gap-4 rounded-2xl p-5 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl" style={{ background: "linear-gradient(135deg, #2E8B57 0%, #1a6b42 100%)" }}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 transition-transform duration-200 group-hover:scale-110">
                <MessageCircle size={22} className="text-white" />
              </div>
              <div className={isRTL ? "text-right" : "text-left"}>
                <p className="font-extrabold text-white">{T.waTitle}</p>
                <p className="mt-0.5 text-xs text-white/70">{T.waSub}</p>
              </div>
            </a>

            <div className="overflow-hidden rounded-2xl bg-white/80 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">

              <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #2E8B57, #FF9800, #C0614A)" }} />

              <div className="divide-y divide-gray-100 p-5 space-y-0">

                <div className={"flex items-start gap-3 py-4 " + (isRTL ? "flex-row-reverse text-right" : "text-left")}>
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edfbf3]">
                    <MapPin size={16} style={{ color: "#2E8B57" }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">{T.addrTitle}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-700 font-latin">{T.addrFr}</p>
                    <p className="text-xs text-gray-500 font-latin">{T.addrCity}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-600 font-arabic" dir="rtl">{T.addrAr}</p>
                    <p className="text-xs text-gray-400 font-arabic" dir="rtl">{T.addrArCity}</p>
                  </div>
                </div>

                <div className={"flex items-center gap-3 py-4 " + (isRTL ? "flex-row-reverse text-right" : "text-left")}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff8e1]">
                    <Phone size={16} style={{ color: "#FF9800" }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">{T.phoneTitle}</p>
                    <a href={PHONE_HREF} className="mt-1 block text-sm font-semibold text-gray-700 transition-colors hover:text-[#2E8B57] font-latin">{PHONE}</a>
                  </div>
                </div>

                <div className={"flex items-start gap-3 py-4 " + (isRTL ? "flex-row-reverse text-right" : "text-left")}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fdf3f0]">
                    <Mail size={16} style={{ color: "#C0614A" }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Email</p>
                    <a href="mailto:CONTACT@MYGRENGO.COM" className="mt-1 block text-sm font-semibold text-gray-700 hover:text-[#2E8B57] font-latin">CONTACT@MYGRENGO.COM</a>
                    <a href="mailto:support@greengo.ma" className="block text-xs text-gray-500 hover:text-[#2E8B57] font-latin">support@greengo.ma</a>
                  </div>
                </div>

                <div className={"flex items-center gap-3 py-4 " + (isRTL ? "flex-row-reverse text-right" : "text-left")}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f3ff]">
                    <Clock size={16} style={{ color: "#7B1FA2" }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">{T.hoursTitle}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-700">{T.hours}</p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="overflow-hidden rounded-2xl bg-white/80 shadow-md ring-1 ring-black/5 backdrop-blur-sm">
              <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #2E8B57, #4DB882)" }} />

              {submitted ? (
                <div className="flex flex-col items-center justify-center gap-5 px-8 py-16 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #edfbf3, #f0faf4)" }}>
                    <CheckCircle size={36} style={{ color: "#2E8B57" }} />
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-gray-800">{T.okTitle}</p>
                    <p className="mt-2 text-sm text-gray-500">{T.okBody}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{T.orLabel}</span>
                  </div>
                  <a href={WA_HREF} target="_blank" rel={WA_REL} className="flex items-center gap-2 rounded-full bg-[#2E8B57] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#1F6B40] hover:shadow-md active:scale-95">
                    <MessageCircle size={14} />
                    {T.waBtn}
                  </a>
                </div>
              ) : (
                <form onSubmit={handleSubmit} dir={dir} className="space-y-5 p-6 md:p-8">
                  <div className={isRTL ? "text-right" : "text-left"}>
                    <h2 className="text-xl font-extrabold text-gray-800">{T.formTitle}</h2>
                    <p className="mt-1 text-sm text-gray-500">{T.formSub}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className={"block text-xs font-bold text-gray-500 uppercase tracking-wide " + (isRTL ? "text-right" : "text-left")}>{T.nameLbl}</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      onFocus={() => setFocused("name")}
                      onBlur={() => setFocused("")}
                      placeholder={T.namePh}
                      dir={dir}
                      className={inputCls("name") + " " + font}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={"block text-xs font-bold text-gray-500 uppercase tracking-wide " + (isRTL ? "text-right" : "text-left")}>{T.phoneLbl}</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      onFocus={() => setFocused("phone")}
                      onBlur={() => setFocused("")}
                      placeholder={T.phonePh}
                      dir="ltr"
                      className={inputCls("phone") + " font-latin " + (isRTL ? "text-right" : "")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={"block text-xs font-bold text-gray-500 uppercase tracking-wide " + (isRTL ? "text-right" : "text-left")}>{T.msgLbl}</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      onFocus={() => setFocused("message")}
                      onBlur={() => setFocused("")}
                      rows={5}
                      placeholder={T.msgPh}
                      dir={dir}
                      className={inputCls("message") + " resize-none " + font}
                    />
                  </div>

                  {error && (
                    <div className={"flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-500 ring-1 ring-red-100 " + (isRTL ? "flex-row-reverse" : "")}>
                      <AlertCircle size={13} />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:shadow-lg active:scale-95 disabled:opacity-60"
                    style={{ background: loading ? "#9ca3af" : "linear-gradient(135deg, #2E8B57 0%, #1a6b42 100%)" }}>
                    {loading
                      ? <><Send size={14} className="animate-pulse" />{T.sending}</>
                      : <><Send size={14} />{T.sendBtn}</>}
                  </button>

                </form>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}