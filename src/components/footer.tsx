import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { formatNumber } from '@/lib/format';

export async function Footer() {
  const locale = await getLocale();
  const common = await getTranslations('Common');
  const nav = await getTranslations('Nav');
  const t = await getTranslations('Footer');
  const year = formatNumber(new Date().getFullYear(), locale, false);

  return (
    <footer className="mt-16 border-t bg-secondary/50">
      <div className="container grid gap-8 py-10 sm:grid-cols-3">
        <div className="space-y-2">
          <p className="text-lg font-bold text-primary">{common('siteName')}</p>
          <p className="max-w-xs text-sm text-muted-foreground">{t('tagline')}</p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">{t('explore')}</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/#courses" className="hover:text-foreground">{nav('courses')}</Link></li>
            <li><Link href="/#exams" className="hover:text-foreground">{nav('exams')}</Link></li>
            <li><Link href="/#mentors" className="hover:text-foreground">{nav('mentors')}</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">{t('account')}</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/login" className="hover:text-foreground">{nav('login')}</Link></li>
            <li><Link href="/dashboard" className="hover:text-foreground">{nav('dashboard')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        {t('rights', { year, name: common('siteName') })}
      </div>
    </footer>
  );
}
