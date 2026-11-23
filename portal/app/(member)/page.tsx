import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadProgress } from "@/lib/progress";
import { summaryLine, type HomeworkRef } from "@/lib/status";
import { formatDateTime, formatRelative } from "@/lib/time";
import { ClassList } from "@/app/components/ClassList";

function HomeworkList({ items, className, badge }: { items: HomeworkRef[]; className: string; badge: string }) {
  return (
    <ul className={`list hw-list ${className}`}>
      {items.map((h) => (
        <li key={h.id}>
          <Link href={`/classes/${h.classNumber}#hw-${h.id}`} className="class-title">{h.title}</Link>
          <span className="row small">
            <span className={`badge ${badge}`}>{h.deadline ? formatDateTime(h.deadline) : "No deadline"}</span>
            <span className="muted">Class {h.classNumber}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const member = await requireMember();
  const { reset } = await searchParams;
  const supabase = await createClient();
  const [{ classes, reviewed, done, progress }, threadsRes] = await Promise.all([
    loadProgress(supabase, member),
    supabase
      .from("threads")
      .select("id, title, last_activity_at")
      .order("last_activity_at", { ascending: false })
      .limit(8),
  ]);
  const firstName = member.fullName.split(/\s+/)[0];
  const nothingOwed = progress.due.length === 0 && progress.overdue.length === 0;

  return (
    <div className="stack">
      {reset ? <p className="notice" role="status">Your password has been changed.</p> : null}
      <div>
        <h1>Welcome back, {firstName}</h1>
        <p className="muted">{summaryLine(progress)}</p>
      </div>

      <div className="split">
        <div className="stack">
          {progress.overdue.length > 0 ? (
            <section>
              <h2>Overdue</h2>
              <HomeworkList items={progress.overdue} className="overdue-list" badge="badge-overdue" />
            </section>
          ) : null}

          {progress.due.length > 0 ? (
            <section>
              <h2>Due next</h2>
              <HomeworkList items={progress.due} className="due-list" badge="badge-due" />
            </section>
          ) : null}

          {nothingOwed ? <p className="notice">You&apos;re all caught up.</p> : null}

          {progress.catchup.length > 0 ? (
            <section>
              <h2>Catch-up (optional)</h2>
              <p className="small muted">Homework set before you joined. Worth doing, but never counted as late.</p>
              <HomeworkList items={progress.catchup} className="catchup-list" badge="badge-catchup" />
            </section>
          ) : null}

          <section>
            <div className="spread">
              <h2>Classes</h2>
              <Link href="/classes" className="small">All classes</Link>
            </div>
            <ClassList classes={classes} reviewed={reviewed} done={done} />
          </section>
        </div>
        <aside>
          <section className="card">
            <div className="spread">
              <h2>Latest discussions</h2>
              <Link href="/discussions" className="small">All discussions</Link>
            </div>
            {(threadsRes.data ?? []).length === 0 ? (
              <p className="muted">No discussions yet.</p>
            ) : (
              <ul className="side-list">
                {(threadsRes.data ?? []).map((t) => (
                  <li key={t.id}>
                    <Link href={`/discussions/${t.id}`} className="thread-title">{t.title}</Link>
                    <span className="small muted">active {formatRelative(t.last_activity_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
