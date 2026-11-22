import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Join the batch" };

export default function SignupPage() {
  return (
    <div className="stack">
      <div>
        <p className="kicker">PIAIC Batch 91</p>
        <h1>Join the batch</h1>
        <p className="muted">For Batch 91 students only. You need the join code from the class WhatsApp group.</p>
      </div>
      <SignupForm />
      <p className="small">
        Already a member? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
