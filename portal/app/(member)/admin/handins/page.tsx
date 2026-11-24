import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Admin: hand-ins" };

interface ClassRow { id: number; number: number; title: string; status: string }
interface HomeworkRow { id: number; title: string; deadline: string | null; handin_expected: boolean; position: number }

export default async function HandinsPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  // Checked here as well as in the admin layout: a layout isn't re-run on every page change.
  await requireAdmin();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();
  const { data: classesData } = await supabase.from("classes").select("id, number, title, status").order("number", { ascending: false }).returns<ClassRow[]>();
  const classes = classesData ?? [];
  const selected =
    classes.find((c) => String(c.id) === classParam) ?? classes.find((c) => c.status === "published") ?? classes[0];

  if (!selected) return <p className="muted">No classes yet.</p>;

  const [hwRes, studentsRes, reviewsRes] = await Promise.all([
    supabase.from("homework").select("id, title, deadline, handin_expected, position").eq("class_id", selected.id).order("position").returns<HomeworkRow[]>(),
    supabase.from("profiles").select("id, full_name").eq("status", "active").eq("role", "student").order("full_name"),
    supabase.from("class_reviews").select("user_id").eq("class_id", selected.id),
  ]);
  const homework = hwRes.data ?? [];
  const students = studentsRes.data ?? [];
  const reviewedBy = new Set((reviewsRes.data ?? []).map((r) => r.user_id as string));
  const { data: statusData } = homework.length
    ? await supabase.from("homework_status").select("user_id, homework_id, handin_url").in("homework_id", homework.map((h) => h.id))
    : { data: [] as Array<{ user_id: string; homework_id: number; handin_url: string | null }> };
  const statuses = statusData ?? [];

  return (
    <div className="stack">
      <h1>Hand-ins</h1>
      <form className="row" method="get">
        <label htmlFor="class" className="label">Class</label>
        <select id="class" name="class" defaultValue={selected.id} style={{ flex: "1 1 14rem", inlineSize: "auto" }}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>Class {c.number}: {c.title}{c.status === "draft" ? " (draft)" : ""}</option>
          ))}
        </select>
        <button type="submit" className="btn-quiet">Show</button>
      </form>

      <section className="card">
        <h2>Reviewed the class</h2>
        <p>{students.filter((s) => reviewedBy.has(s.id)).length} of {students.length} students</p>
      </section>

      {homework.length === 0 ? <p className="muted">This class has no homework.</p> : null}
      {homework.map((h) => {
        const forHw = statuses.filter((s) => s.homework_id === h.id);
        const doneCount = students.filter((s) => forHw.some((x) => x.user_id === s.id)).length;
        return (
          <section key={h.id} className="stack">
            <div>
              <h2>{h.title}</h2>
              <p className="small muted">
                {h.deadline ? `Deadline ${formatDateTime(h.deadline)}` : "No deadline"} · {doneCount} of {students.length} done
              </p>
            </div>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">{h.title}</caption>
                <thead><tr><th>Student</th><th>Status</th><th>Hand-in</th></tr></thead>
                <tbody>
                  {students.map((s) => {
                    const st = forHw.find((x) => x.user_id === s.id);
                    return (
                      <tr key={s.id}>
                        <td>{s.full_name}</td>
                        <td>{st ? <span className="badge badge-done">Done</span> : <span className="badge">Not done</span>}</td>
                        <td>{st?.handin_url ? <a href={st.handin_url} target="_blank" rel="noopener nofollow">{st.handin_url}</a> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
