import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

interface T { id: number; kind: "success" | "error"; text: string; }
const Ctx = createContext<(kind: T["kind"], text: string) => void>(() => undefined);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: T["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto max-w-md rounded-lg px-4 py-2 text-sm text-white shadow-card ${t.kind === "error" ? "bg-red-800" : "bg-brand-800"}`}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
