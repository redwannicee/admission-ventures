import { Link, useNavigate, useParams } from "react-router-dom";
import { Clock, FileText, Lock, PlayCircle } from "lucide-react";
import { useAuth } from "@/app/AuthProvider";
import { useAsync } from "@/hooks/useAsync";
import { AsyncView, Badge, EmptyState } from "@/components/ui";
import { amEnrolled } from "@/features/enrollments/api";
import { getCourseBySlug, getSyllabus, thumbnailUrl } from "@/features/courses/api";
import { formatBDT, formatDuration } from "@/utils/format";
import { useT } from "@/i18n";

export default function CourseDetailPage() {
  const { t } = useT();
  const { slug = "" } = useParams();
  const { session } = useAuth();
  const nav = useNavigate();
  const state = useAsync(async () => {
    const course = await getCourseBySlug(slug);
    if (!course) return null;
    const [syllabus, enrolled] = await Promise.all([getSyllabus(course.id), session ? amEnrolled(course.id) : Promise.resolve(false)]);
    return { course, syllabus, enrolled };
  }, [slug, session?.user.id]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <AsyncView state={state} isEmpty={(d) => d === null} empty={<EmptyState title={t("Course not found")} hint={t("It may have been unpublished.")} action={<Link to="/courses" className="btn-primary btn-sm">{t("All courses")}</Link>} />}>
        {(d) => {
          if (!d) return null;
          const { course, syllabus, enrolled } = d;
          const img = thumbnailUrl(course.thumbnail_path);
          const total = syllabus.lessons.length;
          return (
            <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
              <div>
                <h1 className="text-3xl sm:text-4xl">{course.title}</h1>
                {course.description && <p className="mt-3 whitespace-pre-line text-ink-soft">{course.description}</p>}
                <h2 className="mb-3 mt-10 text-2xl">{t("Syllabus")}</h2>
                {syllabus.modules.length === 0
                  ? <EmptyState title={t("Syllabus coming soon")} />
                  : <div className="space-y-4">{syllabus.modules.map((m) => (
                      <section key={m.id} className="card p-4">
                        <h3 className="text-lg">{m.title}</h3>
                        <ul className="mt-2 divide-y divide-line">
                          {syllabus.lessons.filter((l) => l.module_id === m.id).map((l) => (
                            <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                              <span className="flex items-center gap-2">{l.is_free_preview || enrolled ? <PlayCircle className="h-4 w-4 text-brand-600" aria-hidden /> : <Lock className="h-4 w-4 text-ink-mute" aria-hidden />}{l.title}</span>
                              <span className="flex items-center gap-2 text-ink-mute">{l.is_free_preview && <Badge tone="green">{t("Free preview")}</Badge>}{formatDuration(l.duration_seconds)}</span>
                            </li>
                          ))}
                        </ul>
                      </section>))}</div>}
              </div>
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <div className="card overflow-hidden">
                  {img && <img src={img} alt="" className="aspect-[16/9] w-full object-cover" />}
                  <div className="space-y-4 p-5">
                    <p className="font-display text-3xl text-brand-800">{formatBDT(course.price_amount)}</p>
                    {enrolled
                      ? <Link to={`/learn/${course.slug}`} className="btn-primary w-full">{t("Continue learning")}</Link>
                      : <button className="btn-accent w-full" onClick={() => nav(session ? `/checkout/${course.id}` : `/login?next=${encodeURIComponent(`/checkout/${course.id}`)}`)}>{course.price_amount === 0 ? t("Enrol for free") : t("Enrol now")}</button>}
                    <ul className="space-y-2 text-sm text-ink-soft">
                      <li className="flex items-center gap-2"><PlayCircle className="h-4 w-4" aria-hidden />{total} lessons</li>
                      <li className="flex items-center gap-2"><Clock className="h-4 w-4" aria-hidden />{formatDuration(syllabus.lessons.reduce((a, l) => a + (l.duration_seconds ?? 0), 0))} of video</li>
                      <li className="flex items-center gap-2"><FileText className="h-4 w-4" aria-hidden />{t("Downloadable materials where provided")}</li>
                    </ul>
                  </div>
                </div>
              </aside>
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}
