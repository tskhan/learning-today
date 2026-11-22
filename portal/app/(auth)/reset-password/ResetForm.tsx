"use client";
import { useActionState } from "react";
import { setNewPassword } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function ResetForm() {
  const [state, action] = useActionState(setNewPassword, undefined);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <div className="form-row">
        <label htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="form-row">
        <label htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
