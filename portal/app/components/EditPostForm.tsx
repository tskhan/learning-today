"use client";
import Link from "next/link";
import { useKeptActionState } from "./useKeptActionState";
import { editPost } from "@/app/(member)/discussions/actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export function EditPostForm({ kind, id, title, body, returnTo }: {
  kind: "thread" | "post";
  id: number;
  title?: string;
  body: string;
  returnTo: string;
}) {
  const [state, action] = useKeptActionState(editPost, ["title", "body"]);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="return_to" value={returnTo} />
      {kind === "thread" ? (
        <div className="form-row">
          <label htmlFor={`edit-title-${id}`}>Title</label>
          <input id={`edit-title-${id}`} name="title" type="text" defaultValue={state?.values?.title ?? title} maxLength={150} required />
        </div>
      ) : null}
      <div className="form-row">
        <label htmlFor={`edit-body-${kind}-${id}`}>{kind === "thread" ? "Edit your post" : "Edit your reply"}</label>
        <textarea id={`edit-body-${kind}-${id}`} name="body" defaultValue={state?.values?.body ?? body} maxLength={5000} required rows={5} />
      </div>
      <div className="row">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
        <Link className="btn-quiet" href={returnTo}>Cancel</Link>
      </div>
    </form>
  );
}
