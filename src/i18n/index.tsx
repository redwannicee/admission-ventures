import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { bn } from "./bn";
import { en } from "./en";

export type Lang = "bn" | "en";
const KEY = "av_lang";

function readStored(): Lang {
  try { const v = localStorage.getItem(KEY); if (v === "en" || v === "bn") return v; } catch { /* storage unavailable */ }
  return "bn"; // Bangla is the default language of the site
}

let current: Lang = readStored();
export const getLang = (): Lang => current;

/** Looks up a phrase. English text is the key; unknown phrases fall back to English. `{name}` placeholders are filled from `params`. */
export function tr(text: string, params?: Record<string, string | number>): string {
  let s = current === "bn" ? (bn[text] ?? text) : (en[text] ?? text);
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
  return s;
}

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: typeof tr; }
const I18nCtx = createContext<Ctx>({ lang: current, setLang: () => undefined, t: tr });
export const useT = (): Ctx => useContext(I18nCtx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  const setLang = useCallback((l: Lang) => {
    current = l;
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    setLangState(l);
  }, []);
  useEffect(() => { document.documentElement.lang = lang === "bn" ? "bn" : "en"; }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: tr }), [lang, setLang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

/** Button that switches between Bangla and English. */
export function LangToggle({ className = "btn-ghost btn-sm" }: { className?: string }) {
  const { lang, setLang } = useT();
  const next: Lang = lang === "bn" ? "en" : "bn";
  return (
    <button type="button" className={className} onClick={() => setLang(next)} lang={next}
      aria-label={next === "en" ? "Switch to English" : "বাংলায় দেখুন"}>
      {next === "en" ? "English" : "বাংলা"}
    </button>
  );
}
