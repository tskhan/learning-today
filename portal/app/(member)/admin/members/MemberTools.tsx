"use client";
import { useActionState } from "react";
import { deleteMember, resetLink } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function ResetLinkButton({ userId }: { userId: string }) {
  const [state, action] = useActionState(resetLink, undefined);
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="user_id" value={userId} />
        <SubmitButton className="link-button" pendingText="Making link…">Reset link</SubmitButton>
      </form>
      {state?.error ? <FormMessage state={state} /> : null}
      {state?.ok ? (
        <div className="stack" style={{ gap: "0.25rem", maxInlineSize: "22rem" }}>
          <label className="small" htmlFor={`reset-${userId}`}>Reset link for this member</label>
          <input id={`reset-${userId}`} type="text" readOnly value={state.ok} onFocus={(e) => e.currentTarget.select()} />
          <div className="row">
            <button type="button" className="btn-quiet" onClick={() => navigator.clipboard?.writeText(state.ok!)}>Copy</button>
          </div>
          <span className="hint">Send this to them on WhatsApp. It works once.</span>
        </div>
      ) : null}
    </div>
  );
}

export function DeleteMemberForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(deleteMember, undefined);
  return (
    <details className="inline-confirm">
      <summary>Delete permanently</summary>
      <form action={action} className="stack" style={{ gap: "0.4rem", maxInlineSize: "22rem" }}>
        <p className="small" style={{ margin: 0 }}>
          Erases their account, progress and hand-ins. Their posts stay, shown as &ldquo;Former member&rdquo;.
        </p>
        <FormMessage state={state} />
        <input type="hidden" name="user_id" value={userId} />
        <label className="small" htmlFor={`del-${userId}`}>Type their email to confirm</label>
        <input id={`del-${userId}`} name="confirm" type="text" autoComplete="off" />
        <SubmitButton className="btn-quiet btn-danger" pendingText="Deleting…">Delete forever</SubmitButton>
      </form>
    </details>
  );
}
