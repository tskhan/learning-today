"use client";
import { useKeptActionState } from "@/app/components/useKeptActionState";
import { requestReset } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function ForgotForm() {
  const [state, action] = useKeptActionState(requestReset, ["email"]);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <div className="form-row">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email ?? ""} required />
      </div>
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
