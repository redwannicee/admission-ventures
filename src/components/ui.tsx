import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useEffect, useId, useRef } from "react";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";
import { errorMessage } from "@/utils/messages";
import { useT } from "@/i18n";

export function Spinner({ label }: { label?: string }) {
  const { t } = useT();
  return <span role="status" className="inline-flex items-center gap-2 text-sm text-ink-mute"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t(label ?? "Loading")}…</span>;
}
export const PageLoader = () => <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>;

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-ink-mute" aria-hidden />
      <p className="font-display text-lg">{title}</p>
      {hint && <p className="max-w-md text-sm text-ink-mute">{hint}</p>}
      {action}
    </div>
  );
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 border-red-200 px-6 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-red-700" aria-hidden />
      <p className="text-sm text-ink-soft">{errorMessage(error)}</p>
      {onRetry && <button className="btn-ghost btn-sm" onClick={onRetry}>{t("Try again")}</button>}
    </div>
  );
}
export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const cls = kind === "error" ? "border-red-200 bg-red-50 text-red-900" : kind === "success" ? "border-brand-200 bg-brand-50 text-brand-900" : "border-amber/60 bg-amber-soft text-ink";
  return <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

/** Renders loading / error / empty / content for a useAsync result. */
export function AsyncView<T>({ state, isEmpty, empty, children }: {
  state: { data: T | undefined; error: unknown; loading: boolean; reload: () => void };
  isEmpty?: (d: T) => boolean; empty?: ReactNode; children: (d: T) => ReactNode;
}) {
  if (state.loading && state.data === undefined) return <PageLoader />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.data === undefined) return null;
  if (isEmpty?.(state.data)) return <>{empty}</>;
  return <>{children(state.data)}</>;
}

export function Button({ loading, children, className = "btn-primary", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return <button {...p} className={className} disabled={p.disabled || loading} aria-busy={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}</button>;
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const dId = error || hint ? `${id}-d` : undefined;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children(id, dId)}
      {(error || hint) && <p id={dId} className={`mt-1 text-xs ${error ? "text-red-700" : "text-ink-mute"}`}>{error ?? hint}</p>}
    </div>
  );
}
export const TextInput = ({ label, error, hint, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) =>
  <Field label={label} error={error} hint={hint}>{(id, d) => <input id={id} aria-describedby={d} aria-invalid={!!error} className="input" {...p} />}</Field>;
export const TextArea = ({ label, error, hint, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) =>
  <Field label={label} error={error} hint={hint}>{(id, d) => <textarea id={id} aria-describedby={d} aria-invalid={!!error} rows={4} className="input" {...p} />}</Field>;
export const Select = ({ label, error, hint, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string }) =>
  <Field label={label} error={error} hint={hint}>{(id, d) => <select id={id} aria-describedby={d} className="input" {...p}>{children}</select>}</Field>;

const TONES: Record<string, string> = {
  green: "bg-brand-100 text-brand-800", amber: "bg-amber-soft text-amber-deep", red: "bg-red-100 text-red-800", gray: "bg-stone-100 text-stone-700",
};
export const Badge = ({ tone = "gray", children }: { tone?: keyof typeof TONES; children: ReactNode }) =>
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;

export const statusTone = (s: string) =>
  ({ paid: "green", success: "green", active: "green", published: "green", submitted: "green", pending: "amber", initiated: "amber", in_progress: "amber", draft: "gray", failed: "red", cancelled: "gray", expired: "gray", refunded: "red", rejected: "red" } as Record<string, string>)[s] ?? "gray";

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav aria-label={t("Pagination")} className="mt-4 flex items-center justify-between gap-2 text-sm">
      <span className="text-ink-mute">{t("Page {p} of {n} · {total} items", { p: page + 1, n: pages, total })}</span>
      <div className="flex gap-2">
        <button className="btn-ghost btn-sm" disabled={page === 0} onClick={() => onPage(page - 1)}>{t("Previous")}</button>
        <button className="btn-ghost btn-sm" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>{t("Next")}</button>
      </div>
    </nav>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl">{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label={t("Close")}><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const PageHeader = ({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl sm:text-3xl">{title}</h1>{sub && <p className="mt-1 text-sm text-ink-mute">{sub}</p>}</div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-brand-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${v}%` }} /></div>;
}
