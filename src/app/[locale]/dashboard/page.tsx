import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { pick } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/auth/logout-button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { robots: { index: false, follow: false } };

type EnrollmentRow = { id: string; courses: { slug: string; title_en: string; title_bn: string } | { slug: string; title_en: string; title_bn: string }[] | null };

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Dashboard');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login?next=/dashboard', locale });

  const [{ data: profile }, { data: enrollments }] = await Promise.all([
    supabase.from('users').select('name, phone_number').eq('id', user.id).maybeSingle(),
    supabase.from('enrollments').select('id, courses(slug, title_en, title_bn)').eq('status', 'active'),
  ]);

  const courses = ((enrollments ?? []) as EnrollmentRow[])
    .map((e) => (Array.isArray(e.courses) ? e.courses[0] : e.courses))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div className="container py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {profile?.name ? t('welcome', { name: profile.name }) : t('welcomeNoName')}
          </h1>
          {profile?.phone_number && (
            <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
              {t('phone', { phone: profile.phone_number })}
            </p>
          )}
        </div>
        <LogoutButton label={t('logout')} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t('myCourses')}</h2>
        {courses.length === 0 ? (
          <div className="mt-4 rounded-lg border bg-card p-6">
            <p className="text-muted-foreground">{t('noCourses')}</p>
            <Button asChild className="mt-4">
              <Link href="/#courses">{t('browse')}</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <li key={c.slug} className="rounded-lg border bg-card p-4 font-medium">
                {pick(locale, c.title_en, c.title_bn)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-8 text-sm text-muted-foreground">{t('soon')}</p>
      </section>
    </div>
  );
}
