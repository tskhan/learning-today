import Link from "next/link";
import type { ClassRef, Progress } from "@/lib/status";
import { formatDateTime } from "@/lib/time";

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <span className="bar" aria-hidden="true">
      <span style={{ inlineSize: `${pct}%` }} />
    </span>
  );
}

/** The "Your progress" side card: reading and homework bars, then what to do next. */
export function ProgressPanel({ classes, reviewed, progress }: { classes: ClassRef[]; reviewed: Set<number>; progress: Progress }) {
  const homeworkTotal = progress.doneCount + progress.due.length + progress.overdue.length + progress.catchup.length;
  // Oldest class not yet reviewed: the next step for someone catching up.
  const nextClass = [...classes].reverse().find((c) => !reviewed.has(c.id));
  const nextHomework = progress.overdue[0] ?? progress.due[0];

  return (
    <section className="card progress-panel" aria-labelledby="progress-title">
      <h2 id="progress-title">Your progress</h2>

      <div className="meter">
        <p className="meter-label">
          <span>Reading</span>
          <strong>{progress.classesReviewed} of {progress.classesTotal} classes</strong>
        </p>
        <Bar value={progress.classesReviewed} max={progress.classesTotal} />
      </div>

      {homeworkTotal > 0 ? (
        <div className="meter">
          <p className="meter-label">
            <span>Homework</span>
            <strong>{progress.doneCount} of {homeworkTotal} done</strong>
          </p>
          <Bar value={progress.doneCount} max={homeworkTotal} />
        </div>
      ) : null}

      <div className="next-steps">
        <p className="kicker">Next up</p>
        {nextClass ? (
          <p>
            Read <Link href={`/classes/${nextClass.number}`}>Class {nextClass.number}: {nextClass.title}</Link>
          </p>
        ) : null}
        {nextHomework ? (
          <p>
            Finish <Link href={`/classes/${nextHomework.classNumber}#hw-${nextHomework.id}`}>{nextHomework.title}</Link>
            <span className="small muted">
              {" "}· {nextHomework.deadline ? `${progress.overdue.length > 0 ? "was due" : "due"} ${formatDateTime(nextHomework.deadline)}` : "no deadline"}
            </span>
          </p>
        ) : null}
        {!nextClass && !nextHomework ? <p>You&apos;re all caught up. Nice work.</p> : null}
      </div>
    </section>
  );
}
