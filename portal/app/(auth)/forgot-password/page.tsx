import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <div className="stack">
      <div>
        <h1>Forgot password</h1>
        <p className="muted">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      </div>
      {expired ? (
        <p className="error" role="alert">That link has expired or was already used. Request a new one.</p>
      ) : null}
      <ForgotForm />
      <p className="small">
        <Link href="/login">Back to log in</Link>
      </p>
    </div>
  );
}
