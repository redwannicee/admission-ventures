import { type FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/app/AuthProvider";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Badge, Button, EmptyState, Modal, PageHeader, Pagination, Select, TextInput } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { adminListCourses } from "@/features/courses/api";
import { adminListStudents, grantEnrollment, setRole } from "@/features/enrollments/api";
import { firstIssue, grantSchema } from "@/lib/validation/schemas";
import { errorMessage } from "@/utils/messages";
import { formatDate, fromLocalInput } from "@/utils/format";
import type { AdminStudent, Role } from "@/types/db";

const SIZE = 20;

function GrantModal({ student, onClose, onDone }: { student: AdminStudent; onClose: () => void; onDone: () => void }) {
  const courses = useAsync(adminListCourses, []);
  const toast = useToast();
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<"grant" | "revoke">("grant");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const f = new FormData(e.currentTarget);
    const p = grantSchema.safeParse({ course_id: f.get("course_id"), reason: f.get("reason"), expires_at: f.get("expires_at") });
    if (!p.success) return setErr(firstIssue(p.error));
    setBusy(true); setErr("");
    try { await grantEnrollment(student.id, p.data.course_id, action, p.data.reason, action === "grant" ? fromLocalInput(p.data.expires_at ?? "") : null); toast("success", action === "grant" ? "Enrolment granted" : "Enrolment revoked"); onDone(); onClose(); }
    catch (er) { setErr(errorMessage(er)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Enrolment: ${student.full_name ?? student.email}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <Select label="Action" value={action} onChange={(e) => setAction(e.target.value as "grant" | "revoke")}><option value="grant">Grant access</option><option value="revoke">Revoke access</option></Select>
        <Select label="Course" name="course_id" defaultValue=""><option value="" disabled>Choose a course</option>{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
        {action === "grant" && <TextInput label="Access expires (optional)" name="expires_at" type="datetime-local" />}
        <TextInput label="Reason (recorded in the audit log)" name="reason" required />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><Button loading={busy} className={action === "revoke" ? "btn-danger" : "btn-primary"}>{action === "grant" ? "Grant" : "Revoke"}</Button></div>
      </form>
    </Modal>
  );
}

export default function AdminStudents() {
  const { profile } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState(""); const [term, setTerm] = useState(""); const [page, setPage] = useState(0);
  const [grant, setGrant] = useState<AdminStudent | null>(null);
  const state = useAsync(() => adminListStudents(term, page, SIZE), [term, page]);
  const superAdmin = profile?.role === "super_admin";
  async function changeRole(s: AdminStudent, role: Role) {
    if (!window.confirm(`Change ${s.full_name ?? s.email} to “${role}”?`)) return;
    try { await setRole(s.id, role); toast("success", "Role updated"); state.reload(); } catch (e) { toast("error", errorMessage(e)); }
  }
  return (
    <>
      <PageHeader title="Students" />
      <form className="relative mb-4 max-w-md" onSubmit={(e) => { e.preventDefault(); setPage(0); setTerm(search.trim()); }} role="search">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-mute" aria-hidden />
        <input className="input pl-9" type="search" placeholder="Search name, email or phone" aria-label="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
      </form>
      <AsyncView state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No users found" />}>
        {(d) => <>
          <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Contact</th><th>Role</th><th>Courses</th><th>Joined</th><th className="text-right">Actions</th></tr></thead><tbody>
            {d.map((s) => <tr key={s.id}>
              <td className="font-medium">{s.full_name ?? "—"}</td>
              <td><p>{s.email}</p><p className="text-xs text-ink-mute">{s.phone ?? ""}</p></td>
              <td>{superAdmin && s.id !== profile?.id
                ? <select aria-label={`Role for ${s.full_name ?? s.email}`} className="input min-h-[36px] py-1 text-xs" value={s.role} onChange={(e) => void changeRole(s, e.target.value as Role)}><option value="student">student</option><option value="instructor">instructor</option><option value="admin">admin</option><option value="super_admin">super_admin</option></select>
                : <Badge tone={s.role === "student" ? "gray" : "amber"}>{s.role}</Badge>}</td>
              <td>{s.active_enrollments}</td><td className="whitespace-nowrap">{formatDate(s.created_at)}</td>
              <td className="text-right"><button className="btn-ghost btn-sm" onClick={() => setGrant(s)}>Enrolment</button></td>
            </tr>)}
          </tbody></table></div>
          <Pagination page={page} pageSize={SIZE} total={Number(d[0]?.total_count ?? 0)} onPage={setPage} />
        </>}
      </AsyncView>
      {grant && <GrantModal student={grant} onClose={() => setGrant(null)} onDone={state.reload} />}
    </>
  );
}
