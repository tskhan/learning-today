import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Member {
  id: string;
  email: string;
  fullName: string;
  role: "student" | "admin";
  status: "active" | "removed";
  joinedAt: string;
}

/** The signed-in member, or null. Reads the profile with the secret key so a removed member is still recognised. */
export const getMember = cache(async (): Promise<Member | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, role, status, joined_at")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!profile) return null;
  return {
    id: profile.id,
    email: (claims.email as string | undefined) ?? "",
    fullName: profile.full_name,
    role: profile.role,
    status: profile.status,
    joinedAt: profile.joined_at,
  };
});

/** The signed-in, active member; otherwise redirects to the login page. */
export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect("/login");
  if (member.status !== "active") {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?removed=1");
  }
  return member;
}

/** An active admin; students are sent to the dashboard. */
export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (member.role !== "admin") redirect("/");
  return member;
}
