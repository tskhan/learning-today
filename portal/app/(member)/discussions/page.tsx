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
    .select("id, title, pinned, last_activity_at, author:profiles(full_name), class:classes(number), posts(count)")
    .order("pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(200)
    .returns<Row[]>();
  const threads = data ?? [];
  return (
    <div className="stack">
      <div className="spread">
        <h1>Discussions</h1>
        <Link className="btn" href="/discussions/new">New discussion</Link>
      </div>
      {threads.length === 0 ? (
        <div className="card">
          <p>No discussions yet. Start the first one.</p>
          <Link className="btn" href="/discussions/new">Start a discussion</Link>
        </div>
      ) : (
        <ul className="list threads">
          {threads.map((t) => {
            const replies = t.posts?.[0]?.count ?? 0;
            return (
              <li key={t.id}>
                <div className="row" style={{ marginBlockEnd: "0.25rem" }}>
                  {t.pinned ? <span className="badge badge-due">Pinned</span> : null}
                  {t.class ? <span className="badge">Class {t.class.number}</span> : null}
                </div>
                <Link href={`/discussions/${t.id}`} className="thread-title">{t.title}</Link>
                <p className="small muted" style={{ margin: 0 }}>
                  {replies} {replies === 1 ? "reply" : "replies"} · {t.author?.full_name ?? "Former member"} · active {formatRelative(t.last_activity_at)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
