"use client";
import { useActionState } from "react";
import { saveJoinCode } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function JoinCodeForm({ current }: { current: string }) {
  const [state, action] = useActionState(saveJoinCode, undefined);
  return (
    <form action={action} className="card">
      <FormMessage state={state} />
      <div className="form-row">
        <label htmlFor="join_code">Join code</label>
        <input id="join_code" name="join_code" type="text" defaultValue={current} maxLength={64} autoComplete="off" required />
        <span className="hint">Post the new code in the WhatsApp group. Existing members are not affected. Codes are not case-sensitive.</span>
      </div>
      <SubmitButton pendingText="Saving…">Save join code</SubmitButton>
    </form>
  );
}
