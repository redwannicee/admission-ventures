import { Link } from "react-router-dom";
import { BookOpenCheck, ClipboardCheck, FileDown, Facebook, Instagram, Layers, PlayCircle, ShieldCheck, Smartphone, Youtube } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { AsyncView, EmptyState } from "@/components/ui";
import { CourseCard } from "@/features/courses/CourseCard";
import { getPublicStats, listPublishedCourses } from "@/features/courses/api";
import { site } from "@/app/siteConfig";

const tracks = [
  { label: "Arts", q: "arts", tone: "bg-amber-soft text-amber-deep" },
  { label: "Science", q: "science", tone: "bg-brand-100 text-brand-800" },
  { label: "Commerce", q: "commerce", tone: "bg-stone-100 text-stone-800" },
  { label: "Exam batches", q: "exam", tone: "bg-brand-50 text-brand-700" },
  { label: "Recorded classes", q: "recorded", tone: "bg-amber-soft text-ink" },
];

const why = [
  { icon: PlayCircle, title: "Recorded classes", text: "Learn module by module, at your own pace, as many times as you need." },
  { icon: ClipboardCheck, title: "Timed online exams", text: "Practise under real exam conditions with a clock that cannot be tampered with." },
  { icon: FileDown, title: "Study materials", text: "Download PDF notes attached to lessons, available only to enrolled students." },
  { icon: Layers, title: "Progress tracking", text: "See completed lessons and course progress on your dashboard." },
  { icon: ShieldCheck, title: "Verified payments", text: "Pay through a hosted gateway. Access opens only after the payment is confirmed." },
  { icon: Smartphone, title: "Works on your phone", text: "Built for small screens first, so you can study anywhere." },
];

const Heading = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-6"><h2 className="text-2xl sm:text-3xl">{title}</h2>{sub && <p className="mt-1 text-sm text-ink-mute">{sub}</p>}</div>
);

export default function HomePage() {
  const courses = useAsync(listPublishedCourses, []);
  const stats = useAsync(getPublicStats, []);
  const social = [
    { href: site.social.facebook, label: "Facebook", icon: Facebook },
    { href: site.social.youtube, label: "YouTube", icon: Youtube },
    { href: site.social.instagram, label: "Instagram", icon: Instagram },
  ].filter((s) => s.href);

  return (
    <>
      {/* 1. Hero */}
      <section className="bg-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:py-20">
          <p className="mx-auto mb-3 inline-block rounded-full bg-brand-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber">Admission preparation</p>
          <h1 className="mx-auto max-w-3xl text-4xl leading-tight sm:text-5xl">Prepare for admission tests with a clear plan.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-brand-100">Study from recorded classes, download the materials, and test yourself with timed exams that are scored fairly on the server.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/courses" className="btn-accent">Browse courses</Link>
            <Link to="/register" className="btn border border-brand-500 text-white hover:bg-brand-800">Create free account</Link>
          </div>
        </div>
        {/* 2. Live numbers (real counts from the database; hidden if they cannot load) */}
        {stats.data && (
          <div className="border-t border-brand-800">
            <dl className="mx-auto grid max-w-4xl grid-cols-3 divide-x divide-brand-800 px-4 py-6 text-center">
              {[["Courses", stats.data.courses], ["Modules", stats.data.modules], ["Lessons", stats.data.lessons]].map(([k, v]) => (
                <div key={k as string} className="px-2"><dd className="font-display text-3xl text-amber sm:text-4xl">{v}</dd><dt className="text-xs uppercase tracking-wider text-brand-200">{k}</dt></div>
              ))}
            </dl>
          </div>
        )}
      </section>

      {/* 3. Exam / track tiles */}
      <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="tracks">
        <Heading title="Choose your track" sub="Jump straight to the batches that fit you." />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tracks.map((t) => (
            <li key={t.q}><Link to={`/courses?q=${t.q}`} className={`flex min-h-[88px] items-center justify-center rounded-2xl p-4 text-center font-display text-lg shadow-card transition hover:-translate-y-0.5 ${t.tone}`}>{t.label}</Link></li>
          ))}
        </ul>
      </section>

      {/* 4. Course grid */}
      <section className="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="courses">
        <div className="flex items-end justify-between"><Heading title="Featured courses" sub="Enrol today and start learning right away." /><Link to="/courses" className="mb-6 text-sm font-semibold text-brand-700">View all</Link></div>
        <AsyncView state={courses} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Courses are coming soon" hint="New batches will appear here as soon as they are published." />}>
          {(d) => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{d.slice(0, 8).map((c) => <CourseCard key={c.id} course={c} />)}</div>}
        </AsyncView>
      </section>

      {/* 5. Why choose us */}
      <section className="mx-auto max-w-6xl px-4 pt-16" aria-labelledby="why">
        <Heading title="Why study with us" />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {why.map(({ icon: I, title, text }, i) => (
            <li key={title} className="card flex gap-4 p-5">
              <span className="font-display text-3xl text-brand-200" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
              <div><p className="flex items-center gap-2 font-semibold"><I className="h-5 w-5 text-brand-600" aria-hidden />{title}</p><p className="mt-1 text-sm text-ink-mute">{text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* 6. Exam platform feature */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="grid items-center gap-6 rounded-3xl bg-brand-50 p-6 sm:p-10 md:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-700"><BookOpenCheck className="h-5 w-5" aria-hidden />Online exams</p>
            <h2 className="text-2xl sm:text-3xl">Practise like it is the real test.</h2>
            <p className="mt-3 text-ink-soft">Timed papers, negative marking where the exam uses it, instant scores, and a full answer review once it is released. Your answers save as you go, so a dropped connection does not cost you the exam.</p>
            <Link to="/exams" className="btn-primary mt-5">Open exams</Link>
          </div>
          <ul className="space-y-2 text-sm">
            {["Server-side timer you cannot change from your phone", "Answers saved after every question", "Automatic submission when time ends", "Clear result with correct, wrong and unanswered counts"].map((t) => (
              <li key={t} className="flex items-start gap-2 rounded-xl bg-white p-3 shadow-card"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber" aria-hidden />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7. Community (only when real links are configured) */}
      {social.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16 text-center">
          <Heading title="Join our community" sub="Updates, tips and announcements." />
          <div className="flex flex-wrap justify-center gap-3">
            {social.map(({ href, label, icon: I }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="btn-ghost"><I className="h-4 w-4" aria-hidden />{label}</a>)}
          </div>
        </section>
      )}

      {/* 8. Final call to action */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="rounded-3xl bg-brand-900 p-8 text-center text-white sm:p-12">
          <h2 className="text-2xl sm:text-3xl">Ready to start?</h2>
          <p className="mx-auto mt-2 max-w-xl text-brand-100">Create a free account, look around, and enrol when you are ready.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3"><Link to="/register" className="btn-accent">Create free account</Link><Link to="/courses" className="btn border border-brand-500 text-white hover:bg-brand-800">See courses</Link></div>
        </div>
      </section>
    </>
  );
}
