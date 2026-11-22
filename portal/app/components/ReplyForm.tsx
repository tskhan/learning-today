"use client";
import { useActionState } from "react";
import { replyToThread } from "@/app/(member)/discussions/actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export function ReplyForm({ threadId, returnTo }: { threadId: number; returnTo: string }) {
  const [state, action] = useActionState(replyToThread, undefined);
  return (
    <form action={action} className="reply-form">
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {state?.error ? <FormMessage state={state} /> : null}
      <div className="form-row">
        <label htmlFor={`reply-${threadId}`}>Your reply</label>
        <textarea id={`reply-${threadId}`} name="body" maxLength={5000} required rows={4} />
        <span className="hint">Markdown works: **bold**, lists with -, and links.</span>
      </div>
      <SubmitButton pendingText="Posting…">Reply</SubmitButton>
    </form>
  );
}
