import createMiddleware from 'next-intl/middleware';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

const PROTECTED = /^(?:\/en)?\/dashboard(?:\/|$)/;
const hasSessionCookie = (req: NextRequest) =>
  req.cookies.getAll().some((c) => /^sb-.+-auth-token/.test(c.name));

function toLogin(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isEn = pathname === '/en' || pathname.startsWith('/en/');
  const url = req.nextUrl.clone();
  url.pathname = `${isEn ? '/en' : ''}/login`;
  url.search = '';
  url.searchParams.set('next', pathname.replace(/^\/en(?=\/|$)/, '') || '/dashboard');
  return NextResponse.redirect(url);
}

// Public pages never touch Supabase here, so they stay edge-cacheable and fast.
// Only protected routes validate (and refresh) the session.
export default async function middleware(req: NextRequest) {
  const res = intl(req);
  if (!PROTECTED.test(req.nextUrl.pathname)) return res;

  if (!hasSessionCookie(req)) return toLogin(req);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return toLogin(req);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return toLogin(req);

  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}

export const config = {
  // Skip API routes, Next internals and any path with a file extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
