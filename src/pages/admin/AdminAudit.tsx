import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { AsyncView, EmptyState, PageHeader, Pagination, Select } from "@/components/ui";
import { listAudit } from "@/features/analytics/api";
import { formatDate } from "@/utils/format";
import { useT } from "@/i18n";

const SIZE = 25;
const ENTITIES = ["", "courses", "course_modules", "lessons", "enrollments", "orders", "payments", "questions", "quizzes", "profiles", "announcements"];

export default function AdminAudit() {
  const { t } = useT();
  const [entity, setEntity] = useState(""); const [page, setPage] = useState(0);
  const state = useAsync(() => listAudit(entity, page, SIZE), [entity, page]);
  return (
    <>
      <PageHeader title={t("Audit log")} sub={t("Append-only record of sensitive changes. It cannot be edited or deleted.")} />
      <div className="mb-4 max-w-xs"><Select label={t("Entity")} value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }}>{ENTITIES.map((x) => <option key={x} value={x}>{x || t("All")}</option>)}</Select></div>
      <AsyncView state={state} isEmpty={(d) => d.rows.length === 0} empty={<EmptyState title={t("No audit entries")} />}>
        {(d) => <>
          <div className="table-wrap"><table className="table"><thead><tr><th>{t("When")}</th><th>{t("Who")}</th><th>{t("Action")}</th><th>{t("Entity")}</th><th>{t("Details")}</th></tr></thead><tbody>
            {d.rows.map((r) => <tr key={r.id}><td className="whitespace-nowrap">{formatDate(r.created_at, true)}</td><td>{r.profiles?.full_name ?? (r.actor_id ? r.actor_id.slice(0, 8) : "system")}</td><td className="font-mono text-xs">{r.action}</td><td className="text-xs">{r.entity_type}<br /><span className="font-mono text-ink-mute">{r.entity_id?.slice(0, 8)}</span></td>
              <td><details><summary className="cursor-pointer text-xs text-brand-700">{t("View")}</summary><pre className="mt-1 max-w-xs overflow-auto whitespace-pre-wrap rounded bg-brand-50 p-2 text-[11px]">{JSON.stringify(r.metadata, null, 2)}</pre></details></td></tr>)}
          </tbody></table></div>
          <Pagination page={page} pageSize={SIZE} total={d.total} onPage={setPage} />
        </>}
      </AsyncView>
    </>
  );
}
