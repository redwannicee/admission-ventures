import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAsync } from "@/hooks/useAsync";
import { AsyncView, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { CourseCard } from "@/features/courses/CourseCard";
import { listPublishedCourses } from "@/features/courses/api";
import { useT } from "@/i18n";

const PAGE = 9;
export default function CatalogPage() {
  const { t } = useT();
  const state = useAsync(listPublishedCourses, []);
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => (state.data ?? []).filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase())), [state.data, q]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title={t("Courses")} sub={t("Choose a batch and start learning.")} />
      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-mute" aria-hidden />
        <input className="input pl-9" type="search" placeholder={t("Search courses")} aria-label={t("Search courses")} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      </div>
      <AsyncView state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t("No courses yet")} hint={t("Please check back soon.")} />}>
        {() => filtered.length === 0
          ? <EmptyState title={t("No matching courses")} hint={t("Try a different search.")} />
          : <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.slice(page * PAGE, page * PAGE + PAGE).map((c) => <CourseCard key={c.id} course={c} />)}</div>
              <Pagination page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
            </>}
      </AsyncView>
    </div>
  );
}
