"use client";
import { useActionState } from "react";
import { updateProfile } from "./actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <div className="form-row">
        <label htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" type="text" defaultValue={fullName} maxLength={80} required />
        <span className="hint">Classmates see this on your posts and hand-ins.</span>
      </div>
      <SubmitButton pendingText="Saving…">Save name</SubmitButton>
    </form>
  );
}
