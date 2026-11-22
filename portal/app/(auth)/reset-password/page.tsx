import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (
    <div className="stack">
      <h1>Choose a new password</h1>
      {data?.claims?.sub ? (
        <ResetForm />
      ) : (
        <p className="error" role="alert">
          Your reset link has expired. <Link href="/forgot-password">Request a new one</Link>.
        </p>
      )}
    </div>
  );
}
