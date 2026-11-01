'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function LangToggle() {
  const locale = useLocale();
  const t = useTranslations('Common');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const next = locale === 'bn' ? 'en' : 'bn';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={t('switchLanguage')}
      onClick={() => startTransition(() => router.replace(pathname, { locale: next }))}
    >
      {next === 'en' ? 'English' : 'বাংলা'}
    </Button>
  );
}
