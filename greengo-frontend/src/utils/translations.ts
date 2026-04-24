// src/utils/translations.ts

export type SupportedLanguage = "en" | "fr" | "ar";

export interface TranslationKeys {
  // Navigation
  nav_catalog:          string;
  nav_contact:          string;
  nav_cart:             string;
  nav_admin:            string;
  nav_whatsapp:         string;

  // Hero
  hero_badge:           string;
  hero_title:           string;
  hero_subtitle:        string;

  // Catalog / filter
  catalog_title:        string;
  catalog_subtitle:     (n: number) => string;
  filter_all:           string;
  search_placeholder:   string;

  // Product card
  add_to_cart:          string;
  out_of_stock:         string;
  price_per_unit:       string;

  // Categories
  cat_vegetables:       string;
  cat_fruits:           string;
  cat_white_meats:      string;
  cat_eggs:             string;
  cat_purified_greens:  string;
  cat_other:            string;

  // Cart page — list / header
  cart_title:           string;
  cart_clear:           string;
  cart_empty_title:     string;
  cart_empty_body:      string;
  cart_empty_sub:       string;
  back_to_catalog:      string;
  cart_back_catalog:    string;
  continue_shopping:    string;
  cart_summary:         string;
  cart_total:           string;
  cart_items_count:     (n: number) => string;
  cart_units_count:     (n: number) => string;
  cart_checkout_btn:    string;
  cart_direct_contact:  string;
  cart_direct_btn:      string;

  // Order summary panel
  order_summary:        string;
  total:                string;

  // Delivery form
  delivery_info:              string;
  form_name:                  string;
  form_name_placeholder:      string;
  form_phone:                 string;
  form_address:               string;
  form_address_placeholder:   string;
  free_delivery_note:         string;
  form_validation_hint:       string;
  form_delivery_title:        string;
  form_address_label:         string;
  form_phone_label:           string;
  form_phone_placeholder:     string;

  // Checkout submit
  submitting:           string;
  confirm_order:        string;
  order_save_note:      string;

  // WhatsApp fallback
  whatsapp_fallback_note: string;
  whatsapp_fallback_btn:  string;

  // Loading / errors
  loading_products:     string;
  error_load_products:  string;
  retry:                string;
  empty_filter:         string;

  // Order success
  order_success_title:  string;
  order_success_sub:    string;

  // Newsletter modal
  newsletter_badge:       string;
  newsletter_title:       string;
  newsletter_sub:         string;
  newsletter_perk_1:      string;
  newsletter_perk_2:      string;
  newsletter_perk_3:      string;
  newsletter_cta:         string;
  newsletter_success:     string;
  newsletter_success_sub: string;
  newsletter_skip:        string;
  newsletter_trust:       string;
  newsletter_shop_btn:    string;
  newsletter_error:       string;

  // Footer
  footer_tagline_1:       string;
  footer_tagline_2:       string;
  footer_quick_links:     string;
  footer_contact:         string;
  footer_delivery_badge:  string;
  footer_delivery_banner: string;
  footer_copyright:       string;
  footer_made_in:         string;
}

export const translations: Record<SupportedLanguage, TranslationKeys> = {

  en: {
    nav_catalog:         "Catalog",
    nav_contact:         "Contact",
    nav_cart:            "Cart",
    nav_admin:           "Admin",
    nav_whatsapp:        "WhatsApp",

    hero_badge:          "GreenGo Market",
    hero_title:          "Farm fresh, delivered to your door 🌿",
    hero_subtitle:       "Hand-picked fruits and vegetables from Morocco's finest farms",

    catalog_title:       "Product Catalog",
    catalog_subtitle:    (n) => `${n} product${n !== 1 ? "s" : ""} available`,
    filter_all:          "All",
    search_placeholder:  "Search products…",

    add_to_cart:         "Add to Cart",
    out_of_stock:        "Out of Stock",
    price_per_unit:      "per",

    cat_vegetables:      "Vegetables",
    cat_fruits:          "Fruits",
    cat_white_meats:     "White Meats",
    cat_eggs:            "Eggs",
    cat_purified_greens: "Purified Greens",
    cat_other:           "Other",

    cart_title:          "My Cart",
    cart_clear:          "Clear All",
    cart_empty_title:    "Your cart is empty!",
    cart_empty_body:     "You haven't added anything yet — go explore the catalog 😊",
    cart_empty_sub:      "You haven't added anything yet — go explore the catalog 😊",
    back_to_catalog:     "Back to Catalog",
    cart_back_catalog:   "Back to Catalog",
    continue_shopping:   "Continue Shopping",
    cart_summary:        "Order Summary",
    cart_total:          "Total",
    cart_items_count:    (n) => `${n} item${n !== 1 ? "s" : ""}`,
    cart_units_count:    (n) => `${n} unit${n !== 1 ? "s" : ""}`,
    cart_checkout_btn:   "Send Order via WhatsApp 💬",
    cart_direct_contact: "Don't know how to order online? Contact us directly on WhatsApp 🟢",
    cart_direct_btn:     "Message us directly 💬",

    order_summary:       "Order Summary",
    total:               "Total",

    delivery_info:             "Delivery Information",
    form_name:                 "Full name",
    form_name_placeholder:     "Your full name",
    form_phone:                "Phone number",
    form_address:              "Delivery address",
    form_address_placeholder:  "E.g. Hay Al Massira, Street 5, No. 12, Salé",
    free_delivery_note:        "Free delivery within Salé for the entire first month",
    form_validation_hint:      "Please fill in all required fields to complete your order",
    form_delivery_title:       "Delivery Information",
    form_address_label:        "Delivery Address (Salé) *",
    form_phone_label:          "Phone Number *",
    form_phone_placeholder:    "06XXXXXXXX",

    submitting:          "Confirming your order…",
    confirm_order:       "Confirm & send via WhatsApp 💬",
    order_save_note:     "Your order is saved first, then WhatsApp opens automatically",

    whatsapp_fallback_note: "Prefer to message us directly on WhatsApp instead?",
    whatsapp_fallback_btn:  "Send via WhatsApp (alternative)",

    loading_products:    "Loading fresh products…",
    error_load_products: "Could not load products. Is the server running?",
    retry:               "Retry",
    empty_filter:        "No products in this category",

    order_success_title: "Order sent! 🎉",
    order_success_sub:   "We received your order. Check WhatsApp for confirmation from the GreenGo team. 🌿",

    newsletter_badge:       "Exclusive Offer",
    newsletter_title:       "Get 10% Off + Free Delivery 🛵",
    newsletter_sub:         "Join the GreenGo community and be the first to know about fresh arrivals and seasonal deals.",
    newsletter_perk_1:      "10% off your first order",
    newsletter_perk_2:      "Free delivery in Salé",
    newsletter_perk_3:      "Weekly fresh picks",
    newsletter_cta:         "Claim My 10% Off 🎁",
    newsletter_success:     "Thank you! You're now part of our family 🌿",
    newsletter_success_sub: "Check your inbox for your exclusive welcome offer.",
    newsletter_skip:        "No thanks, I'll pay full price",
    newsletter_trust:       "No spam. Unsubscribe anytime. Your data stays private.",
    newsletter_shop_btn:    "Start Shopping 🛒",
    newsletter_error:       "Something went wrong. Please try again.",

    footer_tagline_1:       "Morocco's first digital grocery.",
    footer_tagline_2:       "Fresh fruits and vegetables delivered fast.",
    footer_quick_links:     "Quick Links",
    footer_contact:         "Contact Us",
    footer_delivery_badge:  "Fast & guaranteed delivery 🛵",
    footer_delivery_banner: "Fast & guaranteed delivery 🛵 — straight to your door!",
    footer_copyright:       "GreenGo Market. All rights reserved.",
    footer_made_in:         "Made with ❤️ for Morocco",
  },

  fr: {
    nav_catalog:         "Catalogue",
    nav_contact:         "Contact",
    nav_cart:            "Panier",
    nav_admin:           "Admin",
    nav_whatsapp:        "WhatsApp",

    hero_badge:          "GreenGo Market",
    hero_title:          "Frais chaque jour, livré chez vous 🌿",
    hero_subtitle:       "Fruits et légumes sélectionnés des meilleures fermes du Maroc",

    catalog_title:       "Catalogue Produits",
    catalog_subtitle:    (n) => `${n} produit${n !== 1 ? "s" : ""} disponible${n !== 1 ? "s" : ""}`,
    filter_all:          "Tout",
    search_placeholder:  "Rechercher des produits…",

    add_to_cart:         "Ajouter au panier",
    out_of_stock:        "Rupture de stock",
    price_per_unit:      "par",

    cat_vegetables:      "Légumes",
    cat_fruits:          "Fruits",
    cat_white_meats:     "Viandes Blanches",
    cat_eggs:            "Œufs",
    cat_purified_greens: "Herbes Fraîches",
    cat_other:           "Autres",

    cart_title:          "Mon Panier",
    cart_clear:          "Tout effacer",
    cart_empty_title:    "Votre panier est vide !",
    cart_empty_body:     "Vous n'avez rien ajouté — explorez le catalogue 😊",
    cart_empty_sub:      "Vous n'avez rien ajouté — explorez le catalogue 😊",
    back_to_catalog:     "Retour au Catalogue",
    cart_back_catalog:   "Retour au Catalogue",
    continue_shopping:   "Continuer mes achats",
    cart_summary:        "Résumé de la commande",
    cart_total:          "Total",
    cart_items_count:    (n) => `${n} article${n !== 1 ? "s" : ""}`,
    cart_units_count:    (n) => `${n} unité${n !== 1 ? "s" : ""}`,
    cart_checkout_btn:   "Envoyer la commande via WhatsApp 💬",
    cart_direct_contact: "Vous ne savez pas commander en ligne ? Contactez-nous sur WhatsApp 🟢",
    cart_direct_btn:     "Nous écrire directement 💬",

    order_summary:       "Récapitulatif",
    total:               "Total",

    delivery_info:             "Informations de livraison",
    form_name:                 "Nom complet",
    form_name_placeholder:     "Votre prénom et nom",
    form_phone:                "Numéro de téléphone",
    form_address:              "Adresse de livraison",
    form_address_placeholder:  "Ex. Hay Al Massira, Rue 5, N°12, Salé",
    free_delivery_note:        "Livraison gratuite à Salé pendant tout le premier mois",
    form_validation_hint:      "Veuillez remplir tous les champs obligatoires",
    form_delivery_title:       "Informations de livraison",
    form_address_label:        "Adresse de livraison (Salé) *",
    form_phone_label:          "Numéro de téléphone *",
    form_phone_placeholder:    "06XXXXXXXX",

    submitting:          "Confirmation en cours…",
    confirm_order:       "Confirmer et envoyer via WhatsApp 💬",
    order_save_note:     "Votre commande sera enregistrée, puis WhatsApp s'ouvrira automatiquement",

    whatsapp_fallback_note: "Vous préférez nous contacter directement sur WhatsApp ?",
    whatsapp_fallback_btn:  "Envoyer via WhatsApp (alternative)",

    loading_products:    "Chargement des produits frais…",
    error_load_products: "Impossible de charger les produits. Le serveur est-il actif ?",
    retry:               "Réessayer",
    empty_filter:        "Aucun produit dans cette catégorie",

    order_success_title: "Commande envoyée ! 🎉",
    order_success_sub:   "Nous avons reçu votre commande. Vérifiez WhatsApp pour la confirmation. 🌿",

    newsletter_badge:       "Offre Exclusive",
    newsletter_title:       "10% de réduction + Livraison gratuite 🛵",
    newsletter_sub:         "Rejoignez la communauté GreenGo et soyez le premier informé des nouveautés et promotions.",
    newsletter_perk_1:      "10% sur votre première commande",
    newsletter_perk_2:      "Livraison gratuite à Salé",
    newsletter_perk_3:      "Sélections fraîches hebdomadaires",
    newsletter_cta:         "Obtenir ma réduction 🎁",
    newsletter_success:     "Merci ! Vous faites maintenant partie de notre famille 🌿",
    newsletter_success_sub: "Consultez votre boîte mail pour votre offre de bienvenue.",
    newsletter_skip:        "Non merci, je paie plein tarif",
    newsletter_trust:       "Pas de spam. Désabonnement à tout moment.",
    newsletter_shop_btn:    "Commencer mes achats 🛒",
    newsletter_error:       "Une erreur est survenue. Veuillez réessayer.",

    footer_tagline_1:       "Votre épicerie en ligne numéro 1 au Maroc.",
    footer_tagline_2:       "Fruits et légumes frais livrés rapidement.",
    footer_quick_links:     "Liens rapides",
    footer_contact:         "Contactez-nous",
    footer_delivery_badge:  "Livraison rapide et garantie 🛵",
    footer_delivery_banner: "Livraison rapide et garantie 🛵 — directement à votre porte !",
    footer_copyright:       "GreenGo Market. Tous droits réservés.",
    footer_made_in:         "Fait avec ❤️ pour le Maroc",
  },

  ar: {
    nav_catalog:         "الكتالوج",
    nav_contact:         "تواصل",
    nav_cart:            "السلة",
    nav_admin:           "الإدارة",
    nav_whatsapp:        "واتساب",

    hero_badge:          "GreenGo ماركت",
    hero_title:          "طازج كل يوم، يوصلك لباب الدار 🌿",
    hero_subtitle:       "خضرة وفواكه مختارة بعناية من أفضل المزارع المغربية",

    catalog_title:       "كتالوج المنتجات",
    catalog_subtitle:    (n) => `${n} منتج متاح`,
    filter_all:          "الكل",
    search_placeholder:  "ابحث عن منتج…",

    add_to_cart:         "أضف للسلة",
    out_of_stock:        "تسالات لينا",
    price_per_unit:      "لكل",

    cat_vegetables:      "خضروات",
    cat_fruits:          "فواكه",
    cat_white_meats:     "لحوم بيضاء",
    cat_eggs:            "بيض",
    cat_purified_greens: "أعشاب طازجة",
    cat_other:           "أخرى",

    cart_title:          "سلتي",
    cart_clear:          "مسح الكل",
    cart_empty_title:    "السلة خاوية!",
    cart_empty_body:     "ما زال ما خلطيش والو — رجع تقدى 😊",
    cart_empty_sub:      "ما زال ما خلطيش والو — رجع تقدى 😊",
    back_to_catalog:     "ارجع للكتالوج",
    cart_back_catalog:   "ارجع للكتالوج",
    continue_shopping:   "متابعة التسوق",
    cart_summary:        "ملخص الطلب",
    cart_total:          "المجموع الكلي",
    cart_items_count:    (n) => `${n} صنف`,
    cart_units_count:    (n) => `${n} وحدة`,
    cart_checkout_btn:   "إرسال الطلب عبر الواتساب 💬",
    cart_direct_contact: "ماعرفتيش كيفاش تطلب؟ تواصل معانا مباشرة فواتساب 🟢",
    cart_direct_btn:     "مراسلة مباشرة 💬",

    order_summary:       "ملخص الطلب",
    total:               "المجموع الكلي",

    delivery_info:             "معلومات التوصيل",
    form_name:                 "الاسم الكامل",
    form_name_placeholder:     "اسمك الكريم",
    form_phone:                "رقم الهاتف",
    form_address:              "عنوان التوصيل",
    form_address_placeholder:  "مثلاً: حي المسيرة، زنقة 5، رقم 12، سلا",
    free_delivery_note:        "توصيل مجاني داخل سلا طوال الشهر الأول",
    form_validation_hint:      "يرجى ملء جميع الحقول المطلوبة لإتمام الطلب",
    form_delivery_title:       "معلومات التوصيل",
    form_address_label:        "عنوان التوصيل (سلا) *",
    form_phone_label:          "رقم الهاتف *",
    form_phone_placeholder:    "06XXXXXXXX",

    submitting:          "جارٍ تأكيد الطلب…",
    confirm_order:       "تأكيد الطلب وإرساله للواتساب 💬",
    order_save_note:     "سيتم حفظ طلبك أولاً ثم يفتح واتساب تلقائياً",

    whatsapp_fallback_note: "تفضل مراسلتنا مباشرة عبر واتساب بدلاً من ذلك؟",
    whatsapp_fallback_btn:  "إرسال عبر واتساب (بديل)",

    loading_products:    "جارٍ تحميل المنتجات الطازجة…",
    error_load_products: "تعذّر تحميل المنتجات. تأكد من تشغيل الخادم.",
    retry:               "إعادة المحاولة",
    empty_filter:        "لا توجد منتجات في هذه الفئة",

    order_success_title: "تم إرسال طلبك! 🎉",
    order_success_sub:   "وصلنا طلبك وتم حفظه. تحقق من واتساب للتأكيد من فريق GreenGo. 🌿",

    newsletter_badge:       "عرض حصري",
    newsletter_title:       "احصل على 10% خصم + توصيل مجاني 🛵",
    newsletter_sub:         "انضم لعائلة GreenGo وكن أول من يعلم بالمنتجات الجديدة والعروض الموسمية.",
    newsletter_perk_1:      "خصم 10% على أول طلب",
    newsletter_perk_2:      "توصيل مجاني في سلا",
    newsletter_perk_3:      "منتجات طازجة أسبوعياً",
    newsletter_cta:         "احصل على خصمي 🎁",
    newsletter_success:     "شكراً! أنت الآن من عائلتنا 🌿",
    newsletter_success_sub: "تحقق من بريدك الإلكتروني للحصول على عرض الترحيب.",
    newsletter_skip:        "لا شكراً، سأدفع السعر الكامل",
    newsletter_trust:       "لا رسائل مزعجة. إلغاء الاشتراك في أي وقت.",
    newsletter_shop_btn:    "ابدأ التسوق 🛒",
    newsletter_error:       "وقع مشكل. عاود المحاولة من فضلك.",

    footer_tagline_1:       "بقالك الإلكتروني الأول فالمغرب.",
    footer_tagline_2:       "خضرة وفواكه طازجة وصلولك فالحال.",
    footer_quick_links:     "روابط سريعة",
    footer_contact:         "تواصل معانا",
    footer_delivery_badge:  "توصيل سريع ومضمون 🛵",
    footer_delivery_banner: "توصيل سريع ومضمون 🛵 — مباشرة لباب الدار!",
    footer_copyright:       "GreenGo Market. جميع الحقوق محفوظة.",
    footer_made_in:         "صنعناه بالمغرب ❤️",
  },
};