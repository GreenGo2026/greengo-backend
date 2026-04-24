import io
import os
import re
from datetime import datetime
from typing import Any

import pytz
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate,
    Spacer, Table, TableStyle,
)

# ── Arabic shaping (graceful fallback) ────────────────────────────────────────
try:
    import arabic_reshaper
    from bidi.algorithm import get_display as bidi_display
    _ARABIC_OK = True
except ImportError:
    _ARABIC_OK = False

# ── Brand colors ──────────────────────────────────────────────────────────────
G_GREEN  = colors.HexColor("#2E8B57")
G_DGREEN = colors.HexColor("#1A6640")
G_ORANGE = colors.HexColor("#FF9800")
G_LIGHT  = colors.HexColor("#F0F7F3")
G_LGRAY  = colors.HexColor("#F3F4F6")
G_MGRAY  = colors.HexColor("#D1D5DB")
G_DGRAY  = colors.HexColor("#6B7280")
G_BLACK  = colors.HexColor("#111827")
G_WHITE  = colors.white

# ── Timezone ──────────────────────────────────────────────────────────────────
TZ_MA = pytz.timezone("Africa/Casablanca")

# ── Font paths ────────────────────────────────────────────────────────────────
_FONT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts")
)

_REGISTERED: dict[str, bool] = {}

def _reg(name: str, filename: str) -> bool:
    if name in _REGISTERED:
        return _REGISTERED[name]
    path = os.path.join(_FONT_DIR, filename)
    if os.path.exists(path):
        try:
            pdfmetrics.registerFont(TTFont(name, path))
            _REGISTERED[name] = True
            return True
        except Exception:
            pass
    _REGISTERED[name] = False
    return False

def _get_fonts() -> dict[str, str]:
    have_poppins_r = _reg("Poppins",      "Poppins-Regular.ttf")
    have_poppins_b = _reg("Poppins-Bold", "Poppins-Bold.ttf")
    have_cairo_r   = _reg("Cairo",        "Cairo-Regular.ttf")
    have_cairo_b   = _reg("Cairo-Bold",   "Cairo-Bold.ttf")
    # Cairo is used as the universal table font because it renders
    # both Latin and Arabic glyphs — critical for mixed-language invoices.
    # Poppins is used only for headings/labels that are pure Latin/French/English.
    lat_r  = "Poppins"      if have_poppins_r else ("Cairo" if have_cairo_r else "Helvetica")
    lat_b  = "Poppins-Bold" if have_poppins_b else ("Cairo-Bold" if have_cairo_b else "Helvetica-Bold")
    ar_r   = "Cairo"        if have_cairo_r   else "Helvetica"
    ar_b   = "Cairo-Bold"   if have_cairo_b   else "Helvetica-Bold"
    # uni_r/uni_b = universal font safe for ANY cell content (Arabic or Latin)
    uni_r  = "Cairo"        if have_cairo_r   else "Helvetica"
    uni_b  = "Cairo-Bold"   if have_cairo_b   else "Helvetica-Bold"
    return {
        "lat_r": lat_r, "lat_b": lat_b,
        "ar_r":  ar_r,  "ar_b":  ar_b,
        "uni_r": uni_r, "uni_b": uni_b,
    }

# ── Translations ──────────────────────────────────────────────────────────────
_TR: dict[str, dict[str, str]] = {
    "en": {
        "invoice":    "INVOICE",
        "bill_to":    "BILL TO",
        "date":       "Date",
        "ref":        "Order Ref",
        "product":    "Product",
        "qty":        "Qty",
        "unit":       "Unit",
        "unit_price": "Unit Price",
        "subtotal":   "Subtotal",
        "amount_due": "Total Amount Due",
        "phone":      "Phone",
        "address":    "Address",
        "status":     "Status",
        "tagline":    "Fresh produce, delivered with care.",
        "footer1":    "GreenGo Market  .  Fresh produce delivered to your door  .  Morocco",
        "footer2":    "WhatsApp: +212 664 500 789  .  mygreengoo.com",
    },
    "fr": {
        "invoice":    "FACTURE",
        "bill_to":    "FACTURER A",
        "date":       "Date",
        "ref":        "Ref. Commande",
        "product":    "Produit",
        "qty":        "Qte",
        "unit":       "Unite",
        "unit_price": "Prix Unitaire",
        "subtotal":   "Sous-total",
        "amount_due": "Montant Total Du",
        "phone":      "Telephone",
        "address":    "Adresse",
        "status":     "Statut",
        "tagline":    "Produits frais, livres avec soin.",
        "footer1":    "GreenGo Market  .  Produits frais livres a votre porte  .  Maroc",
        "footer2":    "WhatsApp: +212 664 500 789  .  mygreengoo.com",
    },
    "ar": {
        "invoice":    "فاتورة",
        "bill_to":    "فاتورة إلى",
        "date":       "التاريخ",
        "ref":        "رقم الطلب",
        "product":    "المنتج",
        "qty":        "الكمية",
        "unit":       "الوحدة",
        "unit_price": "سعر الوحدة",
        "subtotal":   "المجموع الجزئي",
        "amount_due": "المبلغ الإجمالي المستحق",
        "phone":      "الهاتف",
        "address":    "العنوان",
        "status":     "الحالة",
        "tagline":    "منتجات طازجة، توصيل بعناية.",
        "footer1":    "GreenGo Market  .  منتجات طازجة تصل إلى بابك  .  المغرب",
        "footer2":    "واتساب: 789 500 664 212+  .  mygreengoo.com",
    },
}

def _t(lang: str, key: str) -> str:
    return _TR.get(lang, _TR["fr"]).get(key, key)

# ── Text shaping ──────────────────────────────────────────────────────────────
def _shape(text: str, lang: str = "") -> str:
    """
    Reshape + BiDi any string containing Arabic characters,
    regardless of invoice language. Skips HTML markup strings.
    """
    if not _ARABIC_OK:
        return str(text)
    t = str(text)
    if "<" in t:
        return t
    if bool(re.search(r"[\u0600-\u06FF]", t)):
        try:
            return bidi_display(arabic_reshaper.reshape(t))
        except Exception:
            return t
    return t

def _p(text: str, lang: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(_shape(str(text), lang), style)

# ── Style builder ─────────────────────────────────────────────────────────────
def _styles(lang: str, f: dict[str, str]) -> dict[str, ParagraphStyle]:
    is_ar = lang == "ar"
    reg   = f["ar_r"]  if is_ar else f["lat_r"]
    bold  = f["ar_b"]  if is_ar else f["lat_b"]
    # uni_r/uni_b: always Cairo (or fallback) — safe for Arabic product names
    # even when the invoice language is "fr" or "en"
    uni_r = f["uni_r"]
    uni_b = f["uni_b"]
    n_aln = TA_RIGHT   if is_ar else TA_LEFT
    o_aln = TA_LEFT    if is_ar else TA_RIGHT
    base  = getSampleStyleSheet()

    def s(nm: str, **kw) -> ParagraphStyle:
        return ParagraphStyle(nm, parent=base["Normal"], **kw)

    return {
        # Headers / labels — language-specific font
        "brand":   s("brand",   fontName=bold,  fontSize=23, textColor=G_GREEN,  leading=27),
        "tagline": s("tagline", fontName=reg,   fontSize=8,  textColor=G_DGRAY,  leading=11),
        "inv":     s("inv",     fontName=bold,  fontSize=21, textColor=G_DGREEN, leading=25, alignment=o_aln),
        "invmeta": s("invmeta", fontName=reg,   fontSize=8,  textColor=G_DGRAY,  leading=13, alignment=o_aln),
        "sec":     s("sec",     fontName=bold,  fontSize=7,  textColor=G_DGRAY,  leading=10, spaceAfter=2),
        "body":    s("body",    fontName=uni_r, fontSize=9,  textColor=G_BLACK,  leading=14),
        "bbold":   s("bbold",   fontName=uni_b, fontSize=10, textColor=G_BLACK,  leading=14),
        "status":  s("status",  fontName=bold,  fontSize=8,  textColor=G_ORANGE, leading=11, alignment=TA_CENTER),
        "footer":  s("footer",  fontName=reg,   fontSize=7,  textColor=G_DGRAY,  leading=10, alignment=TA_CENTER),
        # Table header row
        "th":      s("th",      fontName=uni_b, fontSize=8,  textColor=G_WHITE,  leading=11, alignment=TA_CENTER),
        # Table data cells — ALL use uni_r (Cairo) so Arabic product names render
        "td_c":    s("td_c",    fontName=uni_r, fontSize=9,  textColor=G_BLACK,  leading=12, alignment=TA_CENTER),
        "td_l":    s("td_l",    fontName=uni_r, fontSize=9,  textColor=G_BLACK,  leading=12, alignment=n_aln),
        "td_r":    s("td_r",    fontName=uni_r, fontSize=9,  textColor=G_BLACK,  leading=12, alignment=o_aln),
        # Total bar
        "tot_l":   s("tot_l",   fontName=uni_b, fontSize=11, textColor=G_WHITE,  leading=14, alignment=n_aln),
        "tot_r":   s("tot_r",   fontName=uni_b, fontSize=13, textColor=G_WHITE,  leading=16, alignment=o_aln),
    }

# ── Public API ────────────────────────────────────────────────────────────────
def generate_invoice_pdf(order_data: dict[str, Any], lang: str | None = None) -> bytes:
    """
    Generate a professional, localized A4 PDF invoice.
    Clean white background. Returns raw bytes — never writes to disk.
    """
    if not lang:
        lang = str(order_data.get("lang", order_data.get("locale", "fr"))).lower()
    if lang not in _TR:
        lang = "fr"
    is_ar = lang == "ar"

    f  = _get_fonts()
    st = _styles(lang, f)
    pw = A4[0] - 36 * mm

    now_ma = datetime.now(TZ_MA)
    raw_dt = order_data.get("created_at", now_ma)
    if isinstance(raw_dt, str):
        try:
            raw_dt = datetime.fromisoformat(raw_dt)
            if raw_dt.tzinfo is None:
                raw_dt = pytz.utc.localize(raw_dt)
            raw_dt = raw_dt.astimezone(TZ_MA)
        except Exception:
            raw_dt = now_ma
    date_str = raw_dt.strftime("%d/%m/%Y  %H:%M")

    order_id = str(order_data.get("_id", order_data.get("order_id", "---")))
    short_id = order_id[-8:].upper() if len(order_id) >= 8 else order_id.upper()

    cname  = order_data.get("customer_name", order_data.get("customer_name", "---"))
    # Keep only latin chars if name contains Arabic
    if re.search(r"[\u0600-\u06FF]", str(cname)):
        cname = order_data.get("name_fr", cname)
    cphone = order_data.get("phone",            order_data.get("customer_phone",   "---"))
    caddr  = order_data.get("address",          order_data.get("delivery_address", "---"))
    status = order_data.get("status", "pending")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=14*mm,  bottomMargin=14*mm,
    )
    els = []

    # ── 1. Header ─────────────────────────────────────────────────────────────
    brand = _p("GreenGo Market", lang, st["brand"])
    inv   = _p(_t(lang, "invoice"), lang, st["inv"])
    h_row = [[inv, brand]] if is_ar else [[brand, inv]]
    h_tbl = Table(h_row, colWidths=[pw * .55, pw * .45])
    h_tbl.setStyle(TableStyle([
        ("VALIGN",       (0,0),(-1,-1), "MIDDLE"),
        ("LEFTPADDING",  (0,0),(-1,-1), 0),
        ("RIGHTPADDING", (0,0),(-1,-1), 0),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ]))
    els.append(h_tbl)

    meta_txt = (f'{_t(lang, "ref")}: #{short_id}'
                f'     {_t(lang, "date")}: {date_str}')
    tag  = _p(_t(lang, "tagline"), lang, st["tagline"])
    meta = _p(meta_txt, lang, st["invmeta"])
    m_row = [[meta, tag]] if is_ar else [[tag, meta]]
    m_tbl = Table(m_row, colWidths=[pw * .55, pw * .45])
    m_tbl.setStyle(TableStyle([
        ("VALIGN",       (0,0),(-1,-1), "TOP"),
        ("LEFTPADDING",  (0,0),(-1,-1), 0),
        ("RIGHTPADDING", (0,0),(-1,-1), 0),
    ]))
    els.append(m_tbl)
    els.append(Spacer(1, 4*mm))
    els.append(HRFlowable(width="100%", thickness=2, color=G_GREEN, spaceAfter=5*mm))

    # ── 2. Bill-to ────────────────────────────────────────────────────────────
    lpad = "RIGHTPADDING" if is_ar else "LEFTPADDING"
    bill = [
        [_p(_t(lang, "bill_to"),             lang, st["sec"]),    ""],
        [_p(cname,                           lang, st["bbold"]),  ""],
        [_p(f'{_t(lang,"phone")}: {cphone}', lang, st["body"]),   ""],
        [_p(f'{_t(lang,"address")}: {caddr}',lang, st["body"]),   ""],
        [_p(f'{_t(lang,"status")}: {status}',lang, st["status"]), ""],
    ]
    b_tbl = Table(bill, colWidths=[pw * .65, pw * .35])
    b_tbl.setStyle(TableStyle([
        (lpad,           (0,0),(-1,-1), 12),
        ("LEFTPADDING",  (0,0),(-1,-1), 12),
        ("TOPPADDING",   (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("BACKGROUND",   (0,0),(-1,-1), G_LIGHT),
        ("BOX",          (0,0),(-1,-1), 1,   G_GREEN),
        ("LINEBELOW",    (0,0),(-1, 0), 0.5, G_GREEN),
    ]))
    els.append(b_tbl)
    els.append(Spacer(1, 6*mm))

    # ── 3. Items table ────────────────────────────────────────────────────────
    items = order_data.get("items", [])
    col_w = [pw*.37, pw*.12, pw*.11, pw*.19, pw*.21]

    def th(key: str) -> Paragraph:
        return _p(_t(lang, key), lang, st["th"])

    thead = [th("product"), th("qty"), th("unit"), th("unit_price"), th("subtotal")]
    if is_ar:
        thead = list(reversed(thead))

    rows = []
    for item in items:
        # Force FR/EN name — Arabic causes ????? in PDF
        name = (
            item.get("name_fr")
            or item.get("name_en")
            or item.get("name", "")
            or item.get("item_name", "---")
        )
        import re as _re
        name = _re.sub(r"[؀-ۿ]+", "", str(name)).strip() or "---"
        qty   = float(item.get("quantity", 0))
        unit  = item.get("unit", "kg")
        ppu   = float(item.get("price_per_unit", 0))
        ltot  = float(item.get("line_total", round(qty * ppu, 2)))
        q_str = str(int(qty)) if qty == int(qty) else f"{qty:.2f}"
        row = [
            _p(name,              lang, st["td_l"]),
            _p(q_str,             lang, st["td_c"]),
            _p(unit,              lang, st["td_c"]),
            _p(f"{ppu:.2f} MAD",  lang, st["td_r"]),
            _p(f"{ltot:.2f} MAD", lang, st["td_r"]),
        ]
        rows.append(list(reversed(row)) if is_ar else row)

    tdata  = [thead] + rows
    n_rows = len(tdata)
    i_tbl  = Table(tdata, colWidths=col_w, repeatRows=1)
    i_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1,  0),  G_GREEN),
        ("FONTSIZE",      (0, 0), (-1, -1),  9),
        ("ALIGN",         (0, 0), (-1, -1),  "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1),  "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1),  7),
        ("BOTTOMPADDING", (0, 0), (-1, -1),  7),
        ("LEFTPADDING",   (0, 0), ( 0, -1),  10),
        ("LINEBELOW",     (0, 0), (-1,  0),  1.5, G_DGREEN),
        ("LINEBELOW",     (0,-1), (-1, -1),  1.5, G_GREEN),
        ("GRID",          (0, 0), (-1, -1),  0.4, G_MGRAY),
        *[("BACKGROUND",  (0, r), (-1,  r),  G_LGRAY)
          for r in range(2, n_rows, 2)],
    ]))
    els.append(i_tbl)
    els.append(Spacer(1, 4*mm))

    # ── 4. Total bar ──────────────────────────────────────────────────────────
    total = float(order_data.get("total_price", 0))
    t_l   = _p(_t(lang, "amount_due"), lang, st["tot_l"])
    t_r   = _p(f"{total:.2f} MAD",    lang, st["tot_r"])
    t_row = [[t_r, t_l]] if is_ar else [[t_l, t_r]]
    t_tbl = Table(t_row, colWidths=[pw * .6, pw * .4])
    t_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), G_GREEN),
        ("TOPPADDING",    (0,0),(-1,-1), 10),
        ("BOTTOMPADDING", (0,0),(-1,-1), 10),
        ("LEFTPADDING",   (0,0),( 0, 0), 14),
        ("RIGHTPADDING",  (1,0),( 1, 0), 14),
        ("LINEABOVE",     (0,0),(-1, 0),  2, G_ORANGE),
    ]))
    els.append(t_tbl)
    els.append(Spacer(1, 10*mm))

    # ── 5. Footer ─────────────────────────────────────────────────────────────
    els.append(HRFlowable(width="100%", thickness=0.5, color=G_MGRAY, spaceAfter=3*mm))
    els.append(_p(_t(lang, "footer1"), lang, st["footer"]))
    els.append(_p(_t(lang, "footer2"), lang, st["footer"]))

    # ── Clean build — no background callbacks ─────────────────────────────────
    doc.build(els)
    return buf.getvalue()
