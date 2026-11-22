import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadProgress } from "@/lib/progress";
import { summaryLine } from "@/lib/status";
import { ClassList } from "@/app/components/ClassList";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const member = await requireMember();
  const supabase = await createClient();
  const { classes, reviewed, done, progress } = await loadProgress(supabase, member);
  return (
    <div className="stack">
      <div>
        <h1>Classes</h1>
        <p className="muted">{summaryLine(progress)}. Missed a class? Open it to catch up.</p>
      </div>
      <ClassList classes={classes} reviewed={reviewed} done={done} />
    </div>
  );
}
