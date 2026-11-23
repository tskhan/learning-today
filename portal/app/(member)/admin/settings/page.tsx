import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { JoinCodeForm } from "./JoinCodeForm";

export const metadata: Metadata = { title: "Admin: settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const { data } = await createAdminClient().from("settings").select("join_code").single();
  return (
    <div className="stack narrow">
      <h1>Settings</h1>
      <p>New students need this code to sign up. Current code: <strong>{data?.join_code}</strong></p>
      <JoinCodeForm current={data?.join_code ?? ""} />
    </div>
  );
}
