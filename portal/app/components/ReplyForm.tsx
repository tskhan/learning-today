"use client";
import Link from "next/link";
import { useKeptActionState } from "./useKeptActionState";
import { replyToThread } from "@/app/(member)/discussions/actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";
import { Composer } from "./Composer";
import { keptImages } from "./keptImages";

export interface QuotedReply { id: number; author: string; excerpt: string }

export function ReplyForm({ threadId, returnTo, replyTo }: { threadId: number; returnTo: string; replyTo?: QuotedReply | null }) {
  const [state, action] = useKeptActionState(replyToThread, ["body", "images"]);
  return (
    <form action={action} className="reply-form" id="reply-form">
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {replyTo ? <input type="hidden" name="reply_to" value={replyTo.id} /> : null}
      {state?.error ? <FormMessage state={state} /> : null}
      {replyTo ? (
        <div className="replying-to">
          <span>
            Replying to <strong>{replyTo.author}</strong>: <span className="muted">{replyTo.excerpt}</span>
          </span>
          <Link href={`${returnTo}#reply-form`} aria-label="Cancel replying to this message">Cancel</Link>
        </div>
      ) : null}
      <Composer
        id={`reply-${threadId}`}
        label="Your reply"
        name="body"
        imagesName="images"
        initialMarkdown={state?.values?.body ?? ""}
        initialImages={keptImages(state?.values?.images)}
        placeholder="Write a reply…"
      />
      <SubmitButton pendingText="Posting…">Reply</SubmitButton>
    </form>
  );
}
