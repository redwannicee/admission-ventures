import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider, LangToggle, tr, useT } from "@/i18n";
import { bn } from "@/i18n/bn";
import { en } from "@/i18n/en";

function Sample() {
  const { t, lang } = useT();
  return <p>{lang}:{t("Hello, {name}", { name: "Rafi" })}</p>;
}

describe("i18n", () => {
  it("toggles between Bangla and English and persists the choice", () => {
    render(<I18nProvider><LangToggle /><Sample /></I18nProvider>);
    expect(screen.getByText("en:Hello, Rafi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /বাংলায়|Switch to English/ }));
    expect(screen.getByText("bn:হ্যালো, Rafi")).toBeInTheDocument();
    expect(localStorage.getItem("av_lang")).toBe("bn");
    expect(document.documentElement.lang).toBe("bn");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("en:Hello, Rafi")).toBeInTheDocument();
  });

  it("falls back to the source text for unknown phrases and fills params", () => {
    expect(tr("Some phrase that is not translated {x}", { x: 1 })).toBe("Some phrase that is not translated 1");
  });

  it("keeps placeholders identical between English keys and Bangla values", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const bad = Object.entries(bn).filter(([k, v]) => ph(k) !== ph(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it("has no empty translations and an English phrase for every Bangla key", () => {
    expect(Object.values(bn).filter((v) => !v.trim())).toEqual([]);
    expect(Object.values(en).filter((v) => !v.trim())).toEqual([]);
  });

  it("translates every literal passed to t() in the source", () => {
    const keys = new Set<string>();
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) { if (!p.endsWith("i18n")) walk(p); continue; }
        if (!/\.tsx?$/.test(f)) continue;
        for (const m of readFileSync(p, "utf8").matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(m[1]);
      }
    };
    walk("src");
    const known = (k: string) => k in bn || k in en || /[ঀ-৿]/.test(k) || /^[a-z0-9\- /]+$/.test(k) || k.startsWith(".");
    const missing = [...keys].filter((k) => !known(k));
    expect(missing).toEqual([]);
  });
});
