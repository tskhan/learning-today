"use client";
import Link from "next/link";
import { useKeptActionState } from "./useKeptActionState";
import { editPost } from "@/app/(member)/discussions/actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";
import { Composer } from "./Composer";
import { keptImages } from "./keptImages";
import type { AttachedImage } from "@/lib/images";

export function EditPostForm({ kind, id, title, body, images, returnTo }: {
  kind: "thread" | "post";
  id: number;
  title?: string;
  body: string;
  images: AttachedImage[];
  returnTo: string;
}) {
  const [state, action] = useKeptActionState(editPost, ["title", "body", "images"]);
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
      <Composer
        id={`edit-body-${kind}-${id}`}
        label={kind === "thread" ? "Edit your post" : "Edit your reply"}
        name="body"
        imagesName="images"
        initialMarkdown={state?.values?.body ?? body}
        initialImages={state?.values?.images ? keptImages(state.values.images) : images}
      />
      <div className="row">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
        <Link className="btn-quiet" href={returnTo}>Cancel</Link>
      </div>
    </form>
  );
}
