import Link from "next/link";
import { isNewClass, type ClassRef } from "@/lib/status";
import { formatDate } from "@/lib/time";

export function ClassList({ classes, reviewed, done }: { classes: ClassRef[]; reviewed: Set<number>; done: Set<number> }) {
  if (classes.length === 0) return <p className="muted">No classes published yet.</p>;
  return (
    <ul className="list class-list">
      {classes.map((c) => {
        const hwDone = c.homework.filter((h) => done.has(h.id)).length;
        return (
          <li key={c.id}>
            <Link href={`/classes/${c.number}`} className="class-link">
              <span className="small muted">Class {c.number} · {formatDate(c.classDate)}</span>
              <span className="class-title">{c.title}</span>
              <span className="row small">
                {isNewClass(c, reviewed) ? <span className="badge badge-new">New</span> : null}
                {reviewed.has(c.id) ? <span className="badge badge-done">Reviewed</span> : <span className="badge">Not reviewed</span>}
                {c.homework.length > 0 ? <span className="muted">Homework: {hwDone} of {c.homework.length} done</span> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
