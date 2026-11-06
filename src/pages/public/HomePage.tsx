import { Link } from "react-router-dom";
import { ClipboardCheck, PlayCircle, ShieldCheck } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { AsyncView, EmptyState } from "@/components/ui";
import { CourseCard } from "@/features/courses/CourseCard";
import { listPublishedCourses } from "@/features/courses/api";

const steps = [
  { icon: PlayCircle, title: "Learn at your pace", text: "Recorded classes organised by module, with PDF materials and a progress tracker." },
  { icon: ClipboardCheck, title: "Practise under exam conditions", text: "Timed online exams, scored on the server, with a full answer review when released." },
  { icon: ShieldCheck, title: "Pay securely", text: "Checkout through a hosted payment gateway. Access opens once the payment is verified." },
];

export default function HomePage() {
  const courses = useAsync(listPublishedCourses, []);
  return (
    <>
      <section className="bg-brand-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:py-20 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <p className="mb-3 inline-block rounded-full bg-brand-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber">Admission preparation</p>
            <h1 className="text-4xl leading-tight sm:text-5xl">Prepare for admission tests with a clear plan.</h1>
            <p className="mt-4 max-w-xl text-brand-100">Study from recorded classes, download the materials, and test yourself with timed exams that are scored fairly on the server.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/courses" className="btn-accent">Browse courses</Link>
              <Link to="/register" className="btn border border-brand-500 text-white hover:bg-brand-800">Create free account</Link>
            </div>
          </div>
          <ul className="space-y-3">
            {steps.map(({ icon: I, title, text }) => (
              <li key={title} className="flex gap-3 rounded-2xl border border-brand-700 bg-brand-800/60 p-4">
                <I className="mt-0.5 h-6 w-6 shrink-0 text-amber" aria-hidden />
                <div><p className="font-semibold">{title}</p><p className="text-sm text-brand-200">{text}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="mb-6 flex items-end justify-between"><h2 className="text-2xl sm:text-3xl">Available courses</h2><Link to="/courses" className="text-sm font-semibold text-brand-700">View all</Link></div>
        <AsyncView state={courses} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Courses are coming soon" hint="New batches will appear here as soon as they are published." />}>
          {(d) => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{d.slice(0, 6).map((c) => <CourseCard key={c.id} course={c} />)}</div>}
        </AsyncView>
      </section>
    </>
  );
}
