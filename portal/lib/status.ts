export type HomeworkState = "done" | "due" | "overdue" | "catchup";

export interface HomeworkRef {
  id: number;
  classId: number;
  classNumber: number;
  title: string;
  deadline: string | null;
  handinExpected: boolean;
}

export interface ClassRef {
  id: number;
  number: number;
  title: string;
  classDate: string;
  /** When it was first published (null for old data); drives the "New" badge. */
  publishedAt?: string | null;
  homework: HomeworkRef[];
}

export interface Progress {
  classesTotal: number;
  classesReviewed: number;
  due: HomeworkRef[];
  overdue: HomeworkRef[];
  catchup: HomeworkRef[];
  doneCount: number;
}

const time = (iso: string) => new Date(iso).getTime();

/**
 * done → "done"; no deadline → "due"; deadline before the student joined → "catchup";
 * deadline reached → "overdue"; otherwise "due".
 */
export function homeworkState(hw: Pick<HomeworkRef, "deadline">, done: boolean, joinedAt: string, now: Date): HomeworkState {
  if (done) return "done";
  if (hw.deadline === null) return "due";
  if (time(hw.deadline) < time(joinedAt)) return "catchup";
  if (time(hw.deadline) <= now.getTime()) return "overdue";
  return "due";
}

export function summarize(classes: ClassRef[], reviewed: Set<number>, done: Set<number>, joinedAt: string, now: Date): Progress {
  const progress: Progress = {
    classesTotal: classes.length,
    classesReviewed: classes.filter((c) => reviewed.has(c.id)).length,
    due: [],
    overdue: [],
    catchup: [],
    doneCount: 0,
  };
  for (const c of classes) {
    for (const hw of c.homework) {
      const state = homeworkState(hw, done.has(hw.id), joinedAt, now);
      if (state === "done") progress.doneCount += 1;
      else progress[state].push(hw);
    }
  }
  const byDeadline = (a: HomeworkRef, b: HomeworkRef) => {
    if (a.deadline === b.deadline) return a.classNumber - b.classNumber;
    if (a.deadline === null) return 1;
    if (b.deadline === null) return -1;
    return time(a.deadline) - time(b.deadline) || a.classNumber - b.classNumber;
  };
  progress.due.sort(byDeadline);
  progress.overdue.sort(byDeadline);
  progress.catchup.sort((a, b) => a.classNumber - b.classNumber);
  return progress;
}

export function summaryLine(p: Progress): string {
  let line = `${p.classesReviewed} of ${p.classesTotal} classes reviewed`;
  if (p.due.length > 0) line += ` · ${p.due.length} homework due`;
  if (p.overdue.length > 0) line += ` · ${p.overdue.length} overdue`;
  const anyHomework = p.doneCount + p.due.length + p.overdue.length + p.catchup.length > 0;
  if (anyHomework && p.due.length === 0 && p.overdue.length === 0 && p.catchup.length === 0) line += " · all homework done";
  return line;
}

/** How long a class counts as new. */
export const NEW_FOR_DAYS = 7;

/** A class is "new" for a member for a week after it's first published, until they've reviewed it. */
export function isNewClass(c: Pick<ClassRef, "id" | "publishedAt">, reviewed: Set<number>, now: Date = new Date()): boolean {
  if (!c.publishedAt || reviewed.has(c.id)) return false;
  const age = now.getTime() - new Date(c.publishedAt).getTime();
  return age >= 0 && age < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;
}
