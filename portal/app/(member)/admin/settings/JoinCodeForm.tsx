"use client";
import { useKeptActionState } from "@/app/components/useKeptActionState";
import { saveJoinCode } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function JoinCodeForm({ current }: { current: string }) {
  const [state, action] = useKeptActionState(saveJoinCode, ["join_code"]);
  return (
    <form action={action} className="card">
      <FormMessage state={state} />
      <div className="form-row">
        <label htmlFor="join_code">Join code</label>
        <input id="join_code" name="join_code" type="text" defaultValue={state?.values?.join_code ?? current} maxLength={64} autoComplete="off" required />
        <span className="hint">At least 10 characters, so it can&apos;t be guessed. Post the new code in the WhatsApp group. Existing members are not affected. Codes are not case-sensitive.</span>
      </div>
      <SubmitButton pendingText="Saving…">Save join code</SubmitButton>
    </form>
  );
}
