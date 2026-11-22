"use client";
import { useKeptActionState } from "@/app/components/useKeptActionState";
import { logIn } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useKeptActionState(logIn, ["email"]);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <div className="form-row">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email ?? ""} required />
      </div>
      <div className="form-row">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
    </form>
  );
}
