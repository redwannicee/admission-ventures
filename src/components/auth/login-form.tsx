'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from '@/i18n/navigation';
import { normalizeBdPhone, toEnglishDigits } from '@/lib/phone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Step = 'phone' | 'otp' | 'name';

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('Auth');
  const router = useRouter();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [e164, setE164] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function finish() {
    router.replace(next);
    router.refresh();
  }

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const normalized = normalizeBdPhone(phone);
    if (!normalized) return setError(t('errInvalidPhone'));

    setLoading(true);
    const { error: err } = await createClient().auth.signInWithOtp({
      phone: normalized,
      options: { channel: 'sms' },
    });
    setLoading(false);
    if (err) return setError(err.status === 429 ? t('errRate') : t('errSend'));

    setE164(normalized);
    setOtp('');
    setCooldown(60);
    setStep('otp');
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = toEnglishDigits(otp).replace(/\D/g, '');
    if (token.length < 6) return setError(t('errInvalidOtp'));

    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.verifyOtp({ phone: e164, token, type: 'sms' });
    if (err || !data.user) {
      setLoading(false);
      return setError(t('errInvalidOtp'));
    }

    const { data: profile } = await supabase.from('users').select('name').eq('id', data.user.id).maybeSingle();
    setUserId(data.user.id);
    if (!profile?.name) {
      setLoading(false);
      return setStep('name');
    }
    finish();
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) return setError(t('errName'));

    setLoading(true);
    const { error: err } = await createClient().from('users').update({ name: trimmed }).eq('id', userId);
    if (err) {
      setLoading(false);
      return setError(t('errGeneric'));
    }
    finish();
  }

  const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 } };

  return (
    <LazyMotion features={domAnimation}>
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm sm:p-8">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'phone' && (
            <m.form key="phone" {...fade} onSubmit={sendOtp} className="space-y-5" noValidate>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  {t('phoneLabel')}
                </label>
                <div className="flex items-stretch gap-2" dir="ltr">
                  <span className="flex items-center rounded-md border bg-secondary px-3 text-sm font-semibold">+880</span>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    autoFocus
                    placeholder={t('phonePlaceholder')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? (<><Loader2 className="me-2 h-4 w-4 animate-spin" />{t('sending')}</>) : t('sendCode')}
              </Button>
            </m.form>
          )}

          {step === 'otp' && (
            <m.form key="otp" {...fade} onSubmit={verifyOtp} className="space-y-5" noValidate>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold">{t('otpTitle')}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('otpSentTo', { phone: e164 })}
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-medium">
                  {t('otpLabel')}
                </label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  dir="ltr"
                  className="text-center text-2xl tracking-[0.5em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? (<><Loader2 className="me-2 h-4 w-4 animate-spin" />{t('verifying')}</>) : t('verify')}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="text-primary hover:underline" onClick={() => { setError(null); setStep('phone'); }}>
                  {t('changeNumber')}
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                  disabled={cooldown > 0 || loading}
                  onClick={() => sendOtp()}
                >
                  {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
                </button>
              </div>
            </m.form>
          )}

          {step === 'name' && (
            <m.form key="name" {...fade} onSubmit={saveName} className="space-y-5" noValidate>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold">{t('nameTitle')}</h1>
                <p className="text-sm text-muted-foreground">{t('nameSubtitle')}</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  {t('nameLabel')}
                </label>
                <Input
                  id="name"
                  autoComplete="name"
                  autoFocus
                  placeholder={t('namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? (<><Loader2 className="me-2 h-4 w-4 animate-spin" />{t('saving')}</>) : t('continue')}
              </Button>
            </m.form>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}
