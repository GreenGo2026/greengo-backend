// src/contexts/LanguageContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  translations,
  type SupportedLanguage,
  type TranslationKeys,
} from "../utils/translations";

const STORAGE_KEY = "greengo_language";

function detectInitialLanguage(): SupportedLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
    if (stored && stored in translations) return stored;
    const browserLang = navigator.language?.slice(0, 2).toLowerCase();
    if (browserLang === "ar") return "ar";
    if (browserLang === "fr") return "fr";
  } catch {
    // ignore
  }
  return "fr";
}

interface LanguageContextValue {
  language:    SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: <K extends keyof TranslationKeys>(
    key: K,
    ...args: TranslationKeys[K] extends (n: number) => string ? [number] : []
  ) => string;
  isRTL: boolean;
  dir:   "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(
    detectInitialLanguage
  );

  const isRTL = language === "ar";
  const dir   = isRTL ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("dir",  dir);
    document.documentElement.setAttribute("lang", language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language, dir]);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    if (lang in translations) setLanguageState(lang);
  }, []);

  const t = useCallback(
    <K extends keyof TranslationKeys>(
      key: K,
      ...args: TranslationKeys[K] extends (n: number) => string ? [number] : []
    ): string => {
      const value = translations[language][key];
      if (typeof value === "function") {
        return (value as (n: number) => string)(args[0] as number);
      }
      if (typeof value === "string") return value;
      console.warn(`[i18n] Missing key "${String(key)}" for language "${language}"`);
      return String(key);
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside a <LanguageProvider>.");
  }
  return ctx;
}