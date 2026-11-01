import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

// Self-hosted fonts: Latin via Inter (variable), Bangla via Hind Siliguri.
// Fontsource ships unicode-range slices, so the browser downloads only what a page uses.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/hind-siliguri/bengali-400.css';
import '@fontsource/hind-siliguri/bengali-600.css';
import '@fontsource/hind-siliguri/bengali-700.css';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Common' });
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admissionventures.com';
  return {
    metadataBase: new URL(base),
    title: { default: t('siteName'), template: `%s | ${t('siteName')}` },
    description: t('description'),
    alternates: {
      canonical: locale === 'bn' ? '/' : '/en',
      languages: { bn: '/', en: '/en' },
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e3a8a',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);

  // Send only the namespaces that client components use. Page-level strings
  // stay on the server, which keeps the hydration payload small on 3G.
  const all = await getMessages();
  const clientMessages = { Common: all.Common, Nav: all.Nav, Auth: all.Auth };

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
