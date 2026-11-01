import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, BookOpenCheck, CalendarDays, Medal, MinusCircle, Quote, ListChecks, Timer, Trophy } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Carousel } from '@/components/carousel';
import { formatPrice, pick } from '@/lib/format';
import type { Course, Mentor, Testimonial } from '@/lib/content';

function SectionHeading({ id, title, subtitle }: { id?: string; title: string; subtitle?: string }) {
  return (
    <div id={id} className="mb-8 scroll-mt-24 text-center">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {subtitle && <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export async function Hero() {
  const t = await getTranslations('Home');
  return (
    <section className="bg-gradient-to-b from-secondary to-background">
      <div className="container flex flex-col items-center gap-6 py-14 text-center md:py-24">
        <span className="rounded-full bg-accent/25 px-4 py-1 text-sm font-semibold">{t('heroBadge')}</span>
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">{t('title')}</h1>
        <p className="max-w-xl text-pretty text-lg text-muted-foreground">{t('subtitle')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="accent">
            <Link href="/#courses">
              {t('ctaPrimary')}
              <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">{t('ctaSecondary')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export async function Stats() {
  const t = await getTranslations('Home');
  const items = [
    { v: t('statCoursesValue'), l: t('statCourses') },
    { v: t('statMentorsValue'), l: t('statMentors') },
    { v: t('statExamsValue'), l: t('statExams') },
  ];
  return (
    <section className="container -mt-6">
      <dl className="grid grid-cols-3 divide-x rounded-lg border bg-card text-center shadow-sm rtl:divide-x-reverse">
        {items.map((s) => (
          <div key={s.l} className="px-2 py-5 sm:py-6">
            <dd className="text-2xl font-bold text-primary sm:text-4xl">{s.v}</dd>
            <dt className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.l}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

export async function Courses({ courses }: { courses: Course[] }) {
  const locale = await getLocale();
  const t = await getTranslations('Home');
  return (
    <section className="container py-14">
      <SectionHeading id="courses" title={t('coursesTitle')} subtitle={t('coursesSubtitle')} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <article key={c.slug} className="flex flex-col rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
            {c.category && (
              <span className="mb-3 w-fit rounded-full bg-secondary px-3 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                {c.category}
              </span>
            )}
            <h3 className="text-lg font-semibold">{pick(locale, c.title_en, c.title_bn)}</h3>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{pick(locale, c.description_en, c.description_bn)}</p>
            {c.features.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {c.features.slice(0, 4).map((f, i) => (
                  <li key={i} className="rounded-md bg-secondary px-2 py-1 text-xs">
                    {pick(locale, f.en, f.bn)}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto flex items-end justify-between pt-6">
              <div>
                <span className="text-2xl font-bold text-primary">{formatPrice(Number(c.price), locale)}</span>
                {c.compare_at_price && Number(c.compare_at_price) > Number(c.price) && (
                  <span className="ms-2 text-sm text-muted-foreground line-through">
                    {formatPrice(Number(c.compare_at_price), locale)}
                  </span>
                )}
              </div>
              <Button asChild size="sm">
                <Link href={`/courses/${c.slug}`}>{t('viewCourse')}</Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export async function ExamSystem() {
  const t = await getTranslations('Home');
  const types = [
    { icon: CalendarDays, title: t('examDaily'), desc: t('examDailyDesc') },
    { icon: ListChecks, title: t('examWeekly'), desc: t('examWeeklyDesc') },
    { icon: BookOpenCheck, title: t('examSubject'), desc: t('examSubjectDesc') },
    { icon: Medal, title: t('examPaper'), desc: t('examPaperDesc') },
  ];
  const feats = [
    { icon: Timer, label: t('featTimer') },
    { icon: MinusCircle, label: t('featNegative') },
    { icon: BookOpenCheck, label: t('featSolutions') },
    { icon: Trophy, label: t('featLeaderboard') },
  ];
  return (
    <section className="bg-secondary/60 py-14">
      <div className="container">
        <SectionHeading id="exams" title={t('examsTitle')} subtitle={t('examsSubtitle')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {types.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-lg border bg-card p-5">
              <Icon className="h-7 w-7 text-primary" aria-hidden />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {feats.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export async function Mentors({ mentors }: { mentors: Mentor[] }) {
  const locale = await getLocale();
  const t = await getTranslations('Home');
  return (
    <section className="container py-14">
      <SectionHeading id="mentors" title={t('mentorsTitle')} subtitle={t('mentorsSubtitle')} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {mentors.map((m) => {
          const name = pick(locale, m.name_en, m.name_bn);
          return (
            <div key={m.id} className="rounded-lg border bg-card p-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground" aria-hidden>
                {name.trim().charAt(0)}
              </div>
              <p className="mt-3 font-semibold">{name}</p>
              <p className="text-sm font-medium text-primary">{m.institution}</p>
              {(m.bio_en || m.bio_bn) && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{pick(locale, m.bio_en, m.bio_bn)}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export async function Testimonials({ items }: { items: Testimonial[] }) {
  const locale = await getLocale();
  const t = await getTranslations('Home');
  return (
    <section className="bg-secondary/60 py-14">
      <div className="container">
        <SectionHeading title={t('testimonialsTitle')} subtitle={t('testimonialsSubtitle')} />
        <Carousel prevLabel={t('prev')} nextLabel={t('next')}>
          {items.map((r) => (
            <figure
              key={r.id}
              className="min-w-[85%] snap-start rounded-lg border bg-card p-6 sm:min-w-[48%] lg:min-w-[32%]"
            >
              <Quote className="h-6 w-6 text-accent" aria-hidden />
              <blockquote className="mt-3 text-sm leading-relaxed">{pick(locale, r.quote_en, r.quote_bn)}</blockquote>
              <figcaption className="mt-4">
                <p className="font-semibold">{r.student_name}</p>
                <p className="text-xs text-muted-foreground">{pick(locale, r.achievement_en, r.achievement_bn)}</p>
              </figcaption>
            </figure>
          ))}
        </Carousel>
      </div>
    </section>
  );
}

export async function CtaBand() {
  const t = await getTranslations('Home');
  const nav = await getTranslations('Nav');
  return (
    <section className="container pt-14">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-primary px-6 py-10 text-center text-primary-foreground">
        <h2 className="text-2xl font-bold sm:text-3xl">{t('ctaBandTitle')}</h2>
        <p className="max-w-md opacity-90">{t('ctaBandText')}</p>
        <Button asChild size="lg" variant="accent">
          <Link href="/login">{nav('login')}</Link>
        </Button>
      </div>
    </section>
  );
}
