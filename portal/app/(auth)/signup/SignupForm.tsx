"use client";
import { useKeptActionState } from "@/app/components/useKeptActionState";
import { signUp } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function SignupForm() {
  const [state, action] = useKeptActionState(signUp, ["full_name", "email", "join_code"]);
  const v = state?.values ?? {};
  return (
    <form action={action}>
      <FormMessage state={state} />
      <div className="form-row">
        <label htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" type="text" autoComplete="name" maxLength={80} defaultValue={v.full_name ?? ""} required />
        <span className="hint">Classmates see this name on your posts and hand-ins.</span>
      </div>
      <div className="form-row">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email ?? ""} required />
        <span className="hint">Only admins see your email.</span>
      </div>
      <div className="form-row">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <span className="hint">At least 8 characters.</span>
      </div>
      <div className="form-row">
        <label htmlFor="join_code">Join code</label>
        <input id="join_code" name="join_code" type="text" autoComplete="off" defaultValue={v.join_code ?? ""} required />
        <span className="hint">Posted in the Batch 91 WhatsApp group.</span>
      </div>
      <SubmitButton pendingText="Creating your account…">Join the batch</SubmitButton>
    </form>
  );
}
