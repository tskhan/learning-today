import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; removed?: string }> }) {
  const { next, removed } = await searchParams;
  return (
    <div className="stack">
      <div>
        <p className="kicker">PIAIC Batch 91</p>
        <h1>Log in</h1>
        <p className="muted">Follow each class step by step, track your homework and ask classmates questions.</p>
      </div>
      {removed ? (
        <p className="error" role="alert">This account has been removed. Contact the batch admin if you think this is a mistake.</p>
      ) : null}
      <LoginForm next={next ?? "/"} />
      <p className="small">
        <Link href="/forgot-password">Forgot password?</Link>
      </p>
      <p className="small">
        New here? <Link href="/signup">Join the batch</Link>
      </p>
    </div>
  );
}
