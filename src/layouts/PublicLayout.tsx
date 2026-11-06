import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/app/AuthProvider";
import { site } from "@/app/siteConfig";

const links = [["/courses", "Courses"], ["/about", "About"], ["/contact", "Contact"]] as const;

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-display text-lg font-bold ${light ? "text-white" : "text-brand-800"}`} aria-label={`${site.name} home`}>
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden><rect width="64" height="64" rx="14" fill="#0f3d3e" /><path d="M18 46 32 16l14 30M23.5 36h17" fill="none" stroke="#f2b84b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {site.name}
    </Link>
  );
}

export function PublicLayout() {
  const { session, isAdminRole, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = "rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-brand-50 aria-[current=page]:text-brand-800";
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map(([to, label]) => <NavLink key={to} to={to} className={nav}>{label}</NavLink>)}
            {!loading && (session
              ? <Link to={isAdminRole ? "/admin" : "/dashboard"} className="btn-primary btn-sm ml-2">{isAdminRole ? "Admin" : "My learning"}</Link>
              : <><Link to="/login" className="btn-ghost btn-sm ml-2">Log in</Link><Link to="/register" className="btn-primary btn-sm">Sign up</Link></>)}
          </nav>
          <button className="btn-ghost btn-sm md:hidden" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
        {open && (
          <nav className="border-t border-line bg-paper px-4 pb-4 md:hidden" aria-label="Mobile">
            <div className="flex flex-col py-2">{links.map(([to, label]) => <NavLink key={to} to={to} className={nav} onClick={() => setOpen(false)}>{label}</NavLink>)}</div>
            {session
              ? <Link to={isAdminRole ? "/admin" : "/dashboard"} className="btn-primary w-full" onClick={() => setOpen(false)}>{isAdminRole ? "Admin" : "My learning"}</Link>
              : <div className="grid grid-cols-2 gap-2"><Link to="/login" className="btn-ghost" onClick={() => setOpen(false)}>Log in</Link><Link to="/register" className="btn-primary" onClick={() => setOpen(false)}>Sign up</Link></div>}
          </nav>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="mt-16 bg-brand-900 text-brand-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div><Logo light /><p className="mt-3 text-sm text-brand-200">{site.tagline}</p></div>
          <div><p className="mb-2 text-sm font-semibold text-white">Explore</p><ul className="space-y-1 text-sm"><li><Link to="/courses">Courses</Link></li><li><Link to="/about">About us</Link></li><li><Link to="/contact">Contact</Link></li></ul></div>
          <div><p className="mb-2 text-sm font-semibold text-white">Legal</p><ul className="space-y-1 text-sm"><li><Link to="/terms">Terms of use</Link></li><li><Link to="/privacy">Privacy policy</Link></li></ul></div>
        </div>
        <p className="border-t border-brand-800 py-4 text-center text-xs text-brand-200">© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
