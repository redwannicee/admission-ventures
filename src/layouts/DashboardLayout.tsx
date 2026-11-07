import { type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/app/AuthProvider";
import { Logo } from "./PublicLayout";
import { LangToggle, useT } from "@/i18n";

export interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean; }

/** Shared shell for the student area and the admin area: sidebar on desktop, bottom bar on phones. */
export function DashboardLayout({ items, area }: { items: NavItem[]; area: string }) {
  const { t } = useT();
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-800 text-white" : "text-ink-soft hover:bg-brand-50"}`;
  return (
    <div className="min-h-screen md:grid md:grid-cols-[230px_1fr]">
      <aside className="hidden border-r border-line bg-white md:flex md:flex-col">
        <div className="p-4"><Logo /><p className="mt-1 text-xs uppercase tracking-wider text-ink-mute">{area}</p></div>
        <nav className="flex-1 space-y-1 px-3" aria-label={area}>{items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={cls}>{i.icon}{t(i.label)}</NavLink>)}</nav>
        <div className="border-t border-line p-3 text-sm">
          <p className="truncate font-medium">{profile?.full_name ?? t("Account")}</p>
          <LangToggle className="btn-ghost btn-sm mt-2 w-full" />
          <button className="btn-ghost btn-sm mt-2 w-full" onClick={async () => { await signOut(); nav("/"); }}><LogOut className="h-4 w-4" />{t("Log out")}</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
          <Logo />
          <div className="flex gap-2"><LangToggle />
          <button className="btn-ghost btn-sm" onClick={async () => { await signOut(); nav("/"); }} aria-label={t("Log out")}><LogOut className="h-4 w-4" /></button></div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8"><Outlet /></main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-line bg-white md:hidden" aria-label={t("{area} menu", { area })}>
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `flex min-w-[72px] flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium ${isActive ? "text-brand-800" : "text-ink-mute"}`}>{i.icon}{t(i.label)}</NavLink>
        ))}
      </nav>
    </div>
  );
}
