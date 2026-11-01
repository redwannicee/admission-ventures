'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/**
 * Pages are static, so auth state is detected on the client from the Supabase cookie
 * (no Supabase JS needed for public pages). Real validation happens in middleware.
 */
export function AuthButton() {
  const t = useTranslations('Nav');
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(/(?:^|;\s*)sb-[^=]*-auth-token/.test(document.cookie));
  }, []);

  return authed ? (
    <Button asChild size="sm">
      <Link href="/dashboard">{t('dashboard')}</Link>
    </Button>
  ) : (
    <Button asChild size="sm">
      <Link href="/login">{t('login')}</Link>
    </Button>
  );
}
