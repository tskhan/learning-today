"use client";
import { useActionState } from "react";
import { setClassEmails } from "./actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function ClassEmailsForm({ on }: { on: boolean }) {
  const [state, action] = useActionState(setClassEmails, undefined);
  return (
    <form action={action}>
      <h2>Emails</h2>
      <FormMessage state={state} />
      <label className="check">
        <input type="checkbox" name="email_new_classes" defaultChecked={on} />
        Email me when a new class guide is posted
      </label>
      <p className="hint">One email per class, with the summary, the homework and a link. Password-reset emails always come.</p>
      <SubmitButton pendingText="Saving…">Save email setting</SubmitButton>
    </form>
  );
}
