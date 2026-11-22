import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { homeworkState } from "@/lib/status";
import { formatDate, formatDateTime } from "@/lib/time";
import { Markdown } from "@/app/components/Markdown";
import { ThreadView } from "@/app/components/ThreadView";
import { HomeworkControl, type MyStatus } from "@/app/components/HomeworkControl";
import { setReviewed } from "../actions";

interface ClassRow {
  id: number;
  number: number;
  class_date: string;
  title: string;
  summary_md: string;
  status: "draft" | "published";
  class_materials: Array<{ id: number; label: string; url: string; position: number }>;
  homework: Array<{ id: number; title: string; instructions_md: string; deadline: string | null; handin_expected: boolean; position: number }>;
}

const STATE_LABEL = { done: "Done", due: "Due", overdue: "Overdue", catchup: "Catch-up (optional)" } as const;

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  return { title: `Class ${number}` };
}

export default async function ClassGuidePage({ params, searchParams }: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const member = await requireMember();
  const { number } = await params;
  const { edit } = await searchParams;
  const classNumber = Number(number);
  if (!Number.isInteger(classNumber) || classNumber <= 0) notFound();

  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("classes")
    .select("id, number, class_date, title, summary_md, status, class_materials(id, label, url, position), homework(id, title, instructions_md, deadline, handin_expected, position)")
    .eq("number", classNumber)
    .maybeSingle<ClassRow>();
  if (!cls) notFound();

  const materials = [...cls.class_materials].sort((a, b) => a.position - b.position || a.id - b.id);
  const homework = [...cls.homework].sort((a, b) => a.position - b.position || a.id - b.id);
  const homeworkIds = homework.map((h) => h.id);

  const [reviewRes, statusRes, threadRes] = await Promise.all([
    supabase.from("class_reviews").select("class_id").eq("user_id", member.id).eq("class_id", cls.id).maybeSingle(),
    homeworkIds.length
      ? supabase
          .from("homework_status")
          .select("user_id, homework_id, handin_url, note, profile:profiles(full_name)")
          .in("homework_id", homeworkIds)
          .order("done_at", { ascending: true })
          .returns<Array<{ user_id: string; homework_id: number; handin_url: string | null; note: string | null; profile: { full_name: string } | null }>>()
      : Promise.resolve({ data: [] as Array<{ user_id: string; homework_id: number; handin_url: string | null; note: string | null; profile: { full_name: string } | null }> }),
    supabase.from("threads").select("id").eq("class_id", cls.id).eq("is_class_thread", true).maybeSingle(),
  ]);

  const reviewed = Boolean(reviewRes.data);
  const statuses = statusRes.data ?? [];
  const mine = new Map<number, MyStatus>();
  for (const s of statuses) if (s.user_id === member.id) mine.set(s.homework_id, { handinUrl: s.handin_url, note: s.note });
  const path = `/classes/${cls.number}`;
  const handinHomework = homework.filter((h) => h.handin_expected);
  const now = new Date();

  return (
    <div className="stack">
      <p className="small"><Link href="/classes">← All classes</Link></p>

      <header className="class-head">
        <p className="kicker">Class {cls.number} · {formatDate(cls.class_date)}</p>
        <h1>{cls.title}</h1>
        <div className="row">
          {cls.status === "draft" ? <span className="badge">Draft: only admins can see this</span> : null}
          {reviewed ? <span className="badge badge-done">Reviewed</span> : <span className="badge">Not reviewed</span>}
        </div>
      </header>

      <section className="card">
        <h2>What was discussed</h2>
        {cls.summary_md.trim() ? <Markdown md={cls.summary_md} /> : <p className="muted">No summary yet.</p>}
      </section>

      {materials.length > 0 ? (
        <section className="card">
          <h2>Material</h2>
          <ul className="materials">
            {materials.map((m) => (
              <li key={m.id}><a href={m.url} target="_blank" rel="noopener">{m.label}</a></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2>Homework</h2>
        {homework.length === 0 ? (
          <p className="muted">No homework for this class.</p>
        ) : (
          <div className="stack">
            {homework.map((h) => {
              const state = homeworkState(h, mine.has(h.id), member.joinedAt, now);
              return (
                <article key={h.id} id={`hw-${h.id}`} className="card hw-item">
                  <h3>{h.title}</h3>
                  <p className="row small" style={{ marginBlockEnd: "0.5rem" }}>
                    <span className={`badge badge-${state}`}>{STATE_LABEL[state]}</span>
                    <span className="muted">{h.deadline ? `Deadline: ${formatDateTime(h.deadline)}` : "No deadline"}</span>
                  </p>
                  {h.instructions_md.trim() ? <Markdown md={h.instructions_md} /> : null}
                  <HomeworkControl
                    homeworkId={h.id}
                    handinExpected={h.handin_expected}
                    status={mine.get(h.id) ?? null}
                    editing={edit === `hw-${h.id}`}
                    returnTo={path}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Your checklist</h2>
        <form action={setReviewed} className="row">
          <input type="hidden" name="class_id" value={cls.id} />
          <input type="hidden" name="return_to" value={path} />
          <input type="hidden" name="reviewed" value={reviewed ? "false" : "true"} />
          {reviewed ? (
            <>
              <span className="badge badge-done">You&apos;ve reviewed this class</span>
              <button type="submit" className="link-button">Undo review</button>
            </>
          ) : (
            <button type="submit" className="btn">I&apos;ve reviewed this class</button>
          )}
        </form>
      </section>

      {handinHomework.length > 0 ? (
        <section className="classmates-work">
          <h2>Classmates&apos; work</h2>
          <div className="stack">
            {handinHomework.map((h) => {
              const handins = statuses.filter((s) => s.homework_id === h.id && s.handin_url);
              return (
                <div key={h.id} className="card">
                  <h3>{h.title}</h3>
                  {handins.length === 0 ? (
                    <p className="muted">No hand-ins yet.</p>
                  ) : (
                    <ul>
                      {handins.map((s) => (
                        <li key={s.user_id}>
                          {s.profile?.full_name ?? "Former member"}:{" "}
                          <a href={s.handin_url!} target="_blank" rel="noopener nofollow">{s.handin_url}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {threadRes.data ? (
        <section className="section">
          <div className="spread">
            <h2>Questions about this class</h2>
            <Link className="small" href={`/discussions/${threadRes.data.id}`}>Open full discussion</Link>
          </div>
          <ThreadView threadId={threadRes.data.id} member={member} showTitle={false} basePath={path} edit={edit} />
        </section>
      ) : null}
    </div>
  );
}
