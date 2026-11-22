import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "@/lib/auth";
import { summarize, type ClassRef, type Progress } from "@/lib/status";

interface ClassRow {
  id: number;
  number: number;
  title: string;
  class_date: string;
  homework: Array<{ id: number; title: string; deadline: string | null; handin_expected: boolean; position: number }>;
}

/** Published classes (newest first) with the member's reviews, finished homework and progress summary. */
export async function loadProgress(supabase: SupabaseClient, member: Member, now: Date = new Date()): Promise<{
  classes: ClassRef[];
  reviewed: Set<number>;
  done: Set<number>;
  progress: Progress;
}> {
  const [classesRes, reviewsRes, doneRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, number, title, class_date, homework(id, title, deadline, handin_expected, position)")
      .eq("status", "published")
      .order("number", { ascending: false })
      .returns<ClassRow[]>(),
    supabase.from("class_reviews").select("class_id").eq("user_id", member.id),
    supabase.from("homework_status").select("homework_id").eq("user_id", member.id),
  ]);
  const classes: ClassRef[] = (classesRes.data ?? []).map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    classDate: c.class_date,
    homework: [...(c.homework ?? [])]
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map((h) => ({
        id: h.id,
        classId: c.id,
        classNumber: c.number,
        title: h.title,
        deadline: h.deadline,
        handinExpected: h.handin_expected,
      })),
  }));
  const reviewed = new Set((reviewsRes.data ?? []).map((r) => r.class_id as number));
  const done = new Set((doneRes.data ?? []).map((r) => r.homework_id as number));
  return { classes, reviewed, done, progress: summarize(classes, reviewed, done, member.joinedAt, now) };
}
