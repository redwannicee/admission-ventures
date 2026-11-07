import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenCheck, ChevronLeft, ChevronRight, MapPin, Phone, ClipboardCheck, FileDown, Facebook, Layers, MessageCircle, Send, PlayCircle, ShieldCheck, Smartphone, Youtube } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { AsyncView, EmptyState } from "@/components/ui";
import { CourseCard } from "@/features/courses/CourseCard";
import { getPublicStats, listPublishedCourses } from "@/features/courses/api";
import { site } from "@/app/siteConfig";
import { faqs, heroSlides, team, videos, vision } from "@/app/content";
import { useT } from "@/i18n";

const tracks = [
  { label: "Arts", q: "arts", tone: "bg-amber-soft text-amber-deep" },
  { label: "Science", q: "science", tone: "bg-brand-100 text-brand-800" },
  { label: "Exam batches", q: "exam", tone: "bg-brand-50 text-brand-700" },
  { label: "Recorded classes", q: "course", tone: "bg-stone-100 text-stone-800" },
];

const why = [
  { icon: PlayCircle, title: "Recorded classes", text: "Learn module by module, at your own pace, as many times as you need." },
  { icon: ClipboardCheck, title: "Timed online exams", text: "Practise under real exam conditions with a clock that cannot be tampered with." },
  { icon: FileDown, title: "Study materials", text: "Download PDF notes attached to lessons, available only to enrolled students." },
  { icon: Layers, title: "Progress tracking", text: "See completed lessons and course progress on your dashboard." },
  { icon: ShieldCheck, title: "Verified payments", text: "Pay through a hosted gateway. Access opens only after the payment is confirmed." },
  { icon: Smartphone, title: "Works on your phone", text: "Built for small screens first, so you can study anywhere." },
];


function HeroSlider() {
  const { t } = useT();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setI((n) => (n + 1) % heroSlides.length), 5000);
    return () => clearInterval(timer);
  }, [paused]);
  const go = (d: number) => setI((n) => (n + d + heroSlides.length) % heroSlides.length);
  return (
    <section aria-roledescription="carousel" aria-label={t("Highlights")} className="mx-auto max-w-6xl px-4 pt-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-2xl bg-brand-100 shadow-card">
        <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${i * 100}%)` }}>
          {heroSlides.map((s, n) => (
            <img key={s.src} src={s.src} alt={t(s.title)} loading={n === 0 ? "eager" : "lazy"} className="aspect-[16/7] w-full shrink-0 object-cover" aria-hidden={n !== i} />
          ))}
        </div>
        <button className="btn-ghost btn-sm absolute left-2 top-1/2 -translate-y-1/2 !px-2" onClick={() => go(-1)} aria-label={t("Previous slide")}><ChevronLeft className="h-4 w-4" /></button>
        <button className="btn-ghost btn-sm absolute right-2 top-1/2 -translate-y-1/2 !px-2" onClick={() => go(1)} aria-label={t("Next slide")}><ChevronRight className="h-4 w-4" /></button>
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {heroSlides.map((s, n) => <button key={s.src} onClick={() => setI(n)} aria-label={t("Slide {n}: {title}", { n: n + 1, title: t(s.title) })} aria-current={n === i} className={`h-2 rounded-full transition-all ${n === i ? t("w-6 bg-amber") : t("w-2 bg-white/80")}`} />)}
        </div>
      </div>
    </section>
  );
}

const Heading = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-6"><h2 className="text-2xl sm:text-3xl">{title}</h2>{sub && <p className="mt-1 text-sm text-ink-mute">{sub}</p>}</div>
);

export default function HomePage() {
  const { t } = useT();
  const courses = useAsync(listPublishedCourses, []);
  const stats = useAsync(getPublicStats, []);
  const social = [
    { href: site.social.facebook, label: t("Facebook page"), icon: Facebook },
    { href: site.social.facebookGroup, label: t("Facebook group"), icon: Facebook },
    { href: site.social.youtube, label: t("YouTube"), icon: Youtube },
    { href: site.social.telegram, label: t("Telegram"), icon: Send },
    { href: site.social.whatsappChannel, label: t("WhatsApp channel"), icon: MessageCircle },
  ];

  return (
    <>
      {/* 1. Hero */}
      <section className="bg-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:py-20">
          <p className="mx-auto mb-3 inline-block rounded-full bg-brand-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber">{t("Premium Admissions Coaching 2026")}</p>
          <h1 className="mx-auto max-w-3xl text-4xl leading-tight sm:text-5xl">{t("Your Gateway to Excellence. Explore, Learn, and Succeed.")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-brand-100">{t("Expert-guided programs, recorded classes, study materials and timed exams to help you secure your dream university seat.")}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/courses" className="btn-accent">{t("Browse courses")}</Link>
            <Link to="/register" className="btn border border-brand-500 text-white hover:bg-brand-800">{t("Create free account")}</Link>
          </div>
        </div>
        {/* 2. Live numbers (real counts from the database; hidden if they cannot load) */}
        {stats.data && (
          <div className="border-t border-brand-800">
            <dl className="mx-auto grid max-w-4xl grid-cols-3 divide-x divide-brand-800 px-4 py-6 text-center">
              {[[t("Courses"), stats.data.courses], [t("Modules"), stats.data.modules], [t("Lessons"), stats.data.lessons]].map(([k, v]) => (
                <div key={k as string} className="px-2"><dd className="font-display text-3xl text-amber sm:text-4xl">{v}</dd><dt className="text-xs uppercase tracking-wider text-brand-200">{k}</dt></div>
              ))}
            </dl>
          </div>
        )}
      </section>

      <HeroSlider />

      {/* 3. Exam / track tiles */}
      <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="tracks">
        <Heading title={t("Choose your track")} sub={t("Jump straight to the batches that fit you.")} />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tracks.map((k) => (
            <li key={k.q}><Link to={`/courses?q=${k.q}`} className={`flex min-h-[88px] items-center justify-center rounded-2xl p-4 text-center font-display text-lg shadow-card transition hover:-translate-y-0.5 ${k.tone}`}>{t(k.label)}</Link></li>
          ))}
        </ul>
      </section>

      {/* 4. Course grid */}
      <section className="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="courses">
        <div className="flex items-end justify-between"><Heading title={t("Featured courses")} sub={t("Enrol today and start learning right away.")} /><Link to="/courses" className="mb-6 text-sm font-semibold text-brand-700">{t("View all")}</Link></div>
        <AsyncView state={courses} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t("Courses are coming soon")} hint={t("New batches will appear here as soon as they are published.")} />}>
          {(d) => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{d.slice(0, 8).map((c) => <CourseCard key={c.id} course={c} />)}</div>}
        </AsyncView>
      </section>

      {/* 5. Why choose us */}
      <section className="mx-auto max-w-6xl px-4 pt-16" aria-labelledby="why">
        <Heading title={t("Why study with us")} />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {why.map(({ icon: I, title, text }, i) => (
            <li key={title} className="card flex gap-4 p-5">
              <span className="font-display text-3xl text-brand-200" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
              <div><p className="flex items-center gap-2 font-semibold"><I className="h-5 w-5 text-brand-600" aria-hidden />{t(title)}</p><p className="mt-1 text-sm text-ink-mute">{t(text)}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* 6. Exam platform feature */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="grid items-center gap-6 rounded-3xl bg-brand-50 p-6 sm:p-10 md:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-700"><BookOpenCheck className="h-5 w-5" aria-hidden />{t("Online exams")}</p>
            <h2 className="text-2xl sm:text-3xl">{t("Practise like it is the real test.")}</h2>
            <p className="mt-3 text-ink-soft">{t("Timed papers, negative marking where the exam uses it, instant scores, and a full answer review once it is released. Your answers save as you go, so a dropped connection does not cost you the exam.")}</p>
            <Link to="/exams" className="btn-primary mt-5">{t("Open exams")}</Link>
          </div>
          <ul className="space-y-2 text-sm">
            {[t("Server-side timer you cannot change from your phone"), t("Answers saved after every question"), t("Automatic submission when time ends"), t("Clear result with correct, wrong and unanswered counts")].map((t) => (
              <li key={t} className="flex items-start gap-2 rounded-xl bg-white p-3 shadow-card"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber" aria-hidden />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Videos */}
      <section className="mx-auto max-w-6xl px-4 pt-16" aria-labelledby="videos">
        <Heading title={t("Watch and get to know us")} />
        <div className="grid gap-4 md:grid-cols-3">
          {videos.map((id, n) => (
            <div key={id} className="overflow-hidden rounded-2xl bg-ink shadow-card">
              <iframe title={t("Admission Ventures video {n}", { n: n + 1 })} src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`} loading="lazy" className="aspect-video w-full" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          ))}
        </div>
      </section>

      {/* Vision */}
      <section className="mx-auto max-w-3xl px-4 pt-16 text-center">
        <Heading title={t("Our vision")} />
        <p className="font-display text-xl leading-relaxed text-ink-soft">{t(vision)}</p>
      </section>

      {/* Team preview */}
      <section className="mx-auto max-w-6xl px-4 pt-16" aria-labelledby="team">
        <div className="flex items-end justify-between"><Heading title={t("Meet the team")} sub={t("Mentors from BUET, Dhaka University, Chittagong University and leading medical and agricultural institutions.")} /><Link to="/team" className="mb-6 shrink-0 text-sm font-semibold text-brand-700">{t("See all")}</Link></div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {team.slice(0, 8).map((m) => (
            <li key={m.name} className="card overflow-hidden text-center">
              <img src={m.photo} alt={m.name} loading="lazy" className="aspect-square w-full object-cover" />
              <div className="p-3"><p className="font-semibold leading-tight">{t(m.name)}</p><p className="mt-0.5 text-xs text-ink-mute">{t(m.role)}</p>{m.edu && <p className="text-xs text-brand-700">{t(m.edu)}</p>}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pt-16" aria-labelledby="faq">
        <Heading title={t("Frequently asked questions")} />
        <div className="space-y-2">
          {faqs.map((f) => (
            <details key={f.q} className="card group px-4 py-3">
              <summary className="cursor-pointer list-none font-medium marker:hidden">{t(f.q)}</summary>
              <p className="mt-2 text-sm text-ink-soft">{t(f.a)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Community + contact */}
      <section className="mx-auto max-w-6xl px-4 pt-16 text-center">
        <Heading title={t("Join our community")} sub={t("Updates, tips and announcements.")} />
        <div className="flex flex-wrap justify-center gap-3">
          {social.map(({ href, label, icon: I }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="btn-ghost"><I className="h-4 w-4" aria-hidden />{label}</a>)}
        </div>
        <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-ink-soft">
          <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-600" aria-hidden />{site.phones.map((p, i) => <span key={p}>{i > 0 && " · "}<a href={`tel:${p}`}>{p}</a></span>)}</li>
          <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-600" aria-hidden />{site.office}</li>
        </ul>
      </section>

      {/* 8. Final call to action */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="rounded-3xl bg-brand-900 p-8 text-center text-white sm:p-12">
          <h2 className="text-2xl sm:text-3xl">{t("Ready to start?")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-brand-100">{t("Create a free account, look around, and enrol when you are ready.")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3"><Link to="/register" className="btn-accent">{t("Create free account")}</Link><Link to="/courses" className="btn border border-brand-500 text-white hover:bg-brand-800">{t("See courses")}</Link></div>
        </div>
      </section>
    </>
  );
}
