import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Discussions" };

interface Row {
  id: number;
  title: string;
  pinned: boolean;
  is_class_thread: boolean;
  last_activity_at: string;
  author: { full_name: string } | null;
  class: { number: number } | null;
  posts: Array<{ count: number }>;
}

export default async function DiscussionsPage() {
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("threads")
    .select("id, title, pinned, is_class_thread, last_activity_at, author:profiles(full_name), class:classes(number), posts(count)")
    .order("pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(200)
    .returns<Row[]>();
  const threads = data ?? [];
  const classThreads = threads
    .filter((t): t is Row & { class: { number: number } } => t.class !== null)
    .sort((a, b) => b.class.number - a.class.number);

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1>Discussions</h1>
          <p className="muted">Ask the batch anything. Most active first.</p>
        </div>
        <Link className="btn" href="/discussions/new">New discussion</Link>
      </div>
      <div className="split">
        {threads.length === 0 ? (
          <div className="card">
            <p>No discussions yet. Start the first one.</p>
          </div>
        ) : (
          <ul className="list threads">
            {threads.map((t) => {
              const replies = t.posts?.[0]?.count ?? 0;
              return (
                <li key={t.id} className="thread-row">
                  <div className="thread-main">
                    {t.pinned || t.class ? (
                      <div className="row">
                        {t.pinned ? <span className="badge badge-due">Pinned</span> : null}
                        {t.class ? <span className="badge">Class {t.class.number}</span> : null}
                      </div>
                    ) : null}
                    <Link href={`/discussions/${t.id}`} className="thread-title">{t.title}</Link>
                    <p className="small muted">
                      {t.author?.full_name ?? (t.is_class_thread ? "Batch 91 Portal" : "Former member")} · active {formatRelative(t.last_activity_at)}
                    </p>
                  </div>
                  <p className="reply-count">
                    <strong>{replies}</strong> <span>{replies === 1 ? "reply" : "replies"}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <aside>
          {classThreads.length > 0 ? (
            <section className="card">
              <h2>Class questions</h2>
              <p className="small muted">Stuck on something from a class? Ask in that class&apos;s own thread.</p>
              <ul className="side-list">
                {classThreads.map((t) => {
                  const replies = t.posts?.[0]?.count ?? 0;
                  return (
                    <li key={t.id} className="side-row">
                      <Link href={`/discussions/${t.id}`}>Class {t.class.number}</Link>
                      <span className="small muted">{replies} {replies === 1 ? "reply" : "replies"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
