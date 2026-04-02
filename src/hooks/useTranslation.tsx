"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import ko from "@/locales/ko.json";
import en from "@/locales/en.json";

export type Locale = "ko" | "en";

const translations: Record<Locale, Record<string, string>> = { ko, en };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "ko",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "ko";
    return (localStorage.getItem("alpha_language") as Locale) || "ko";
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("alpha_language", newLocale);
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string>) => {
    const localeVal = translations[locale]?.[key];
    let text = localeVal !== undefined ? localeVal : (translations.ko[key] ?? key);
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      });
    }
    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
