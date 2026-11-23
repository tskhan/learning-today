import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { setClassStatus } from "../actions";

export const metadata: Metadata = { title: "Admin: classes" };

interface Row {
  id: number;
  number: number;
  class_date: string;
  title: string;
  status: "draft" | "published";
  homework: Array<{ id: number; homework_status: Array<{ user_id: string }> }>;
}

export default async function AdminClassesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("id, number, class_date, title, status, homework(id, homework_status(user_id))")
    .order("number", { ascending: false })
    .returns<Row[]>();
  const classes = data ?? [];
  return (
    <div className="stack">
      <div className="spread">
        <h1>Classes</h1>
        <Link className="btn" href="/admin/classes/new">New class</Link>
      </div>
      <p className="small muted">After each class, add its guide here: what was discussed, the material and any homework. Publish it when it&apos;s ready.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Class</th><th>Status</th><th>Done / handed in</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {classes.map((c) => {
              // Counted from the rows: notes are private, so members (admins included) can only read some columns, and count(*) needs the whole table.
              const handins = c.homework.reduce((n, h) => n + (h.homework_status?.length ?? 0), 0);
              return (
                <tr key={c.id}>
                  <td>{c.number}</td>
                  <td>
                    <strong>{c.title}</strong>
                    <br />
                    <span className="small muted">{formatDate(c.class_date)}</span>
                  </td>
                  <td>
                    {c.status === "published" ? <span className="badge badge-done">Published</span> : <span className="badge">Draft</span>}
                  </td>
                  <td>{c.homework.length ? handins : <span className="muted">No homework</span>}</td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/admin/classes/${c.id}`}>Edit</Link>
                      <form action={setClassStatus}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="status" value={c.status === "published" ? "draft" : "published"} />
                        <button type="submit" className="link-button">{c.status === "published" ? "Unpublish" : "Publish"}</button>
                      </form>
                      <Link href={`/classes/${c.number}`}>View</Link>
                    </div>
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
