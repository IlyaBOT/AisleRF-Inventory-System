import React, { createContext, useContext, useMemo, useState } from "react";
import en from "../locales/en.json";
import ru from "../locales/ru.json";

export type Language = "ru" | "en";

type Params = Record<string, string | number>;

type I18nState = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Params) => string;
};

const Ctx = createContext<I18nState | null>(null);
const STORAGE_KEY = "app_language";

const dictionaries: Record<Language, any> = { en, ru };

function getByPath(obj: any, path: string): string | null {
  const parts = path.split(".");
  let node = obj;
  for (const p of parts) {
    if (!node || typeof node !== "object" || !(p in node)) return null;
    node = node[p];
  }
  return typeof node === "string" ? node : null;
}

function applyParams(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

function detectLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "ru" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => detectLanguage());

  function setLanguage(next: Language) {
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  const t = useMemo(() => {
    return (key: string, params?: Params) => {
      const dict = dictionaries[language];
      const text = getByPath(dict, key) || getByPath(dictionaries.en, key) || key;
      return applyParams(text, params);
    };
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("I18nProvider missing");
  return v;
}
