import { useAsync } from "@/hooks/useAsync";
import { AsyncView, Badge, EmptyState, PageHeader } from "@/components/ui";
import { getCourseReport, getOverview, getQuizReport, getRevenue } from "@/features/analytics/api";
import { formatBDT, formatScore } from "@/utils/format";
import { useT } from "@/i18n";

const Tile = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="card p-4"><p className="text-xs uppercase tracking-wide text-ink-mute">{label}</p><p className="mt-1 font-display text-2xl text-brand-800">{value}</p>{sub && <p className="text-xs text-ink-mute">{sub}</p>}</div>
);

export default function AdminReports() {
  const { t } = useT();
  const o = useAsync(getOverview, []);
  const rev = useAsync(() => getRevenue(30), []);
  const courses = useAsync(getCourseReport, []);
  const quizzes = useAsync(getQuizReport, []);
  return (
    <>
      <PageHeader title={t("Reports")} sub={t("Live summaries from the database.")} />
      <AsyncView state={o}>{(d) => (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={t("Students")} value={d.students} />
          <Tile label={t("Active enrolments")} value={d.active_enrollments} />
          <Tile label={t("Revenue (30 days)")} value={d.revenue_30d === 0 ? "৳0" : formatBDT(d.revenue_30d)} sub={t("Total {v}", { v: formatBDT(d.revenue_total) })} />
          <Tile label={t("Paid / pending orders")} value={`${d.paid_orders} / ${d.pending_orders}`} />
          <Tile label={t("Exam attempts (30 days)")} value={d.attempts_30d} sub={t("Total {v}", { v: d.attempts_total })} />
          <Tile label={t("Rejected payment events")} value={d.rejected_payment_events} sub={d.rejected_payment_events ? t("Review in Orders") : t("None")} />
        </div>)}
      </AsyncView>
      <h2 className="mb-3 mt-10 text-xl">{t("Revenue, last 30 days")}</h2>
      <AsyncView state={rev} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t("No paid orders in the last 30 days")} />}>
        {(d) => {
          const max = Math.max(...d.map((x) => Number(x.revenue)), 1);
          return (
            <div className="card p-4">
              <div className="flex h-40 items-end gap-1" role="img" aria-label={t("Daily revenue, maximum {v}", { v: formatBDT(max) })}>
                {d.map((x) => <div key={x.day} title={t("{day}: {rev} ({n} orders)", { day: x.day, rev: formatBDT(Number(x.revenue)), n: x.orders })} className="flex-1 rounded-t bg-brand-600" style={{ height: `${Math.max(3, (Number(x.revenue) / max) * 100)}%` }} />)}
              </div>
              <div className="mt-2 flex justify-between text-xs text-ink-mute"><span>{d[0].day}</span><span>{d[d.length - 1].day}</span></div>
            </div>);
        }}
      </AsyncView>
      <h2 className="mb-3 mt-10 text-xl">{t("Courses")}</h2>
      <AsyncView state={courses} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t("No courses yet")} />}>
        {(d) => <div className="table-wrap"><table className="table"><thead><tr><th>{t("Course")}</th><th>{t("Status")}</th><th>{t("Enrolled")}</th><th>{t("Revenue")}</th><th>{t("Lessons")}</th><th>{t("Avg completion")}</th></tr></thead><tbody>
          {d.map((c) => <tr key={c.course_id}><td>{c.title}</td><td><Badge tone={c.published ? "green" : "gray"}>{c.published ? t("published") : t("draft")}</Badge></td><td>{c.active_enrollments}</td><td>{formatBDT(Number(c.revenue))}</td><td>{c.total_lessons}</td><td>{c.avg_completion_pct === null ? "—" : `${formatScore(c.avg_completion_pct)}%`}</td></tr>)}
        </tbody></table></div>}
      </AsyncView>
      <h2 className="mb-3 mt-10 text-xl">{t("Exams")}</h2>
      <AsyncView state={quizzes} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t("No exam attempts yet")} />}>
        {(d) => <div className="table-wrap"><table className="table"><thead><tr><th>{t("Exam")}</th><th>{t("Attempts")}</th><th>{t("Avg score")}</th><th>{t("Avg %")}</th><th>{t("Pass rate")}</th></tr></thead><tbody>
          {d.map((q) => <tr key={q.quiz_id}><td>{q.title}</td><td>{q.attempts}</td><td>{formatScore(q.avg_score)}</td><td>{q.avg_pct === null ? "—" : `${formatScore(q.avg_pct)}%`}</td><td>{q.pass_rate_pct === null ? "—" : `${formatScore(q.pass_rate_pct)}%`}</td></tr>)}
        </tbody></table></div>}
      </AsyncView>
    </>
  );
}
