import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/time";
import { setMemberRole, setMemberStatus } from "../actions";
import { DeleteMemberForm, ResetLinkButton } from "./MemberTools";

export const metadata: Metadata = { title: "Admin: members" };

export default async function MembersPage() {
  const me = await requireAdmin();
  const admin = createAdminClient();
  const [profilesRes, reviewsRes, statusRes] = await Promise.all([
    admin.from("profiles").select("id, full_name, role, status, joined_at").order("joined_at", { ascending: false }),
    admin.from("class_reviews").select("user_id"),
    admin.from("homework_status").select("user_id"),
  ]);
  const emails = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) emails.set(u.id, u.email ?? "");
    if (!data || data.users.length < 1000) break;
  }
  const count = (rows: Array<{ user_id: string }> | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const reviews = count(reviewsRes.data);
  const done = count(statusRes.data);
  const profiles = profilesRes.data ?? [];

  return (
    <div className="stack">
      <h1>Members</h1>
      <p className="small muted">{profiles.filter((p) => p.status === "active").length} active members. Emails are visible to admins only.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Member</th><th>Role</th><th>Status</th><th>Progress</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const self = p.id === me.id;
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.full_name}</strong> {self ? <span className="badge">You</span> : null}
                    <br />
                    <span className="small">{emails.get(p.id)}</span>
                    <br />
                    <span className="small muted">Joined {formatDate(p.joined_at)}</span>
                  </td>
                  <td>{p.role}</td>
                  <td>{p.status === "active" ? <span className="badge badge-done">active</span> : <span className="badge badge-overdue">removed</span>}</td>
                  <td className="small">{reviews.get(p.id) ?? 0} classes reviewed<br />{done.get(p.id) ?? 0} homework done</td>
                  <td>
                    {self ? (
                      <span className="small muted">—</span>
                    ) : (
                      <div className="stack" style={{ gap: 0 }}>
                        <div className="row-actions">
                          <form action={setMemberStatus}>
                            <input type="hidden" name="user_id" value={p.id} />
                            <input type="hidden" name="status" value={p.status === "active" ? "removed" : "active"} />
                            <button type="submit" className={p.status === "active" ? "link-button danger" : "link-button"}>
                              {p.status === "active" ? "Remove" : "Restore"}
                            </button>
                          </form>
                          <form action={setMemberRole}>
                            <input type="hidden" name="user_id" value={p.id} />
                            <input type="hidden" name="role" value={p.role === "admin" ? "student" : "admin"} />
                            <button type="submit" className="link-button">{p.role === "admin" ? "Make student" : "Make admin"}</button>
                          </form>
                        </div>
                        <ResetLinkButton userId={p.id} />
                        <DeleteMemberForm userId={p.id} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
