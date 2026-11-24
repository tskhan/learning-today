import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadProgress } from "@/lib/progress";
import { summaryLine } from "@/lib/status";
import { formatDate } from "@/lib/time";
import { ProfileForm } from "./ProfileForm";
import { ClassEmailsForm } from "./ClassEmailsForm";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const member = await requireMember();
  const supabase = await createClient();
  const [{ progress }, { data: prefs }] = await Promise.all([
    loadProgress(supabase, member),
    supabase.from("profiles").select("email_new_classes").eq("id", member.id).single(),
  ]);
  return (
    <div className="stack narrow">
      <h1>Profile</h1>
      <div className="card stack">
        <ProfileForm fullName={member.fullName} />
      </div>
      <div className="card stack" id="emails">
        <ClassEmailsForm on={prefs?.email_new_classes ?? true} />
      </div>
      <dl className="card">
        <dt className="label">Email</dt>
        <dd style={{ margin: "0 0 0.75rem" }}>{member.email} <span className="small muted">(only admins see this)</span></dd>
        <dt className="label">Joined</dt>
        <dd style={{ margin: "0 0 0.75rem" }}>{formatDate(member.joinedAt)}</dd>
        <dt className="label">Progress</dt>
        <dd style={{ margin: 0 }}>{summaryLine(progress)}</dd>
      </dl>
    </div>
  );
}
