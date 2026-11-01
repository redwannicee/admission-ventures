import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LangToggle } from '@/components/lang-toggle';
import { AuthButton } from '@/components/auth-button';
import { MobileMenu } from '@/components/mobile-menu';

export async function Navbar() {
  const common = await getTranslations('Common');
  const t = await getTranslations('Nav');
  const links = [
    { href: '/#courses', label: t('courses') },
    { href: '/#exams', label: t('exams') },
    { href: '/#mentors', label: t('mentors') },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="container relative flex h-16 items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold text-primary">
          {common('siteName')}
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LangToggle />
          <AuthButton />
          <MobileMenu links={links} />
        </div>
      </div>
    </header>
  );
}
