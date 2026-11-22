import Link from "next/link";
import { notFound } from "next/navigation";
import type { Member } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/time";
import { deletePost, setPinned } from "@/app/(member)/discussions/actions";
import { Markdown } from "./Markdown";
import { ReplyForm } from "./ReplyForm";
import { EditPostForm } from "./EditPostForm";
import { ConfirmButton } from "./ConfirmButton";

interface Author { full_name: string }
interface PostRow { id: number; author_id: string | null; body_md: string; created_at: string; edited_at: string | null; author: Author | null }
interface ThreadRow extends Omit<PostRow, "author"> {
  title: string;
  pinned: boolean;
  is_class_thread: boolean;
  class_id: number | null;
  author: Author | null;
  class: { number: number; title: string } | null;
}

function PostCard({ kind, post, member, basePath, edit, threadTitle, systemPost = false }: {
  kind: "thread" | "post";
  post: PostRow;
  systemPost?: boolean;
  member: Member;
  basePath: string;
  edit?: string;
  threadTitle?: string;
}) {
  const key = `${kind}-${post.id}`;
  const mine = post.author_id === member.id;
  const canDelete = mine || member.role === "admin";
  const editing = mine && edit === key;
  return (
    <article className="post card" id={key}>
      <header className="spread small">
        <span>
          <strong>{post.author?.full_name ?? (systemPost ? "Batch 91 Portal" : "Former member")}</strong>{" "}
          <span className="muted">
            · <time dateTime={post.created_at}>{formatRelative(post.created_at)}</time>
            {post.edited_at ? " (edited)" : ""}
          </span>
        </span>
        {!editing && (mine || canDelete) ? (
          <span className="row">
            {mine ? <Link href={`${basePath}?edit=${key}#${key}`}>Edit</Link> : null}
            {canDelete ? (
              <form action={deletePost}>
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="id" value={post.id} />
                <input type="hidden" name="return_to" value={basePath} />
                <ConfirmButton message={kind === "thread" ? "Delete this discussion and all its replies?" : "Delete this reply?"}>
                  Delete
                </ConfirmButton>
              </form>
            ) : null}
          </span>
        ) : null}
      </header>
      {editing ? (
        <EditPostForm kind={kind} id={post.id} title={threadTitle} body={post.body_md} returnTo={basePath} />
      ) : (
        <Markdown md={post.body_md} />
      )}
    </article>
  );
}

/** A discussion: opening post, replies oldest first, and a reply box. Reused inside class guides. */
export async function ThreadView({ threadId, member, showTitle = true, basePath, edit }: {
  threadId: number;
  member: Member;
  showTitle?: boolean;
  basePath?: string;
  edit?: string;
}) {
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("threads")
    .select("id, title, body_md, author_id, created_at, edited_at, pinned, is_class_thread, class_id, author:profiles(full_name), class:classes(number, title)")
    .eq("id", threadId)
    .maybeSingle<ThreadRow>();
  if (!thread) notFound();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, author_id, body_md, created_at, edited_at, author:profiles(full_name)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .returns<PostRow[]>();

  const path = basePath ?? `/discussions/${threadId}`;
  const replies = posts ?? [];
  return (
    <div className="stack thread">
      {showTitle ? (
        <div className="stack" style={{ gap: "0.5rem" }}>
          <div className="row">
            {thread.pinned ? <span className="badge badge-due">Pinned</span> : null}
            {thread.class ? <Link className="badge" href={`/classes/${thread.class.number}`}>Class {thread.class.number}</Link> : null}
          </div>
          <h1>{thread.title}</h1>
          {member.role === "admin" ? (
            <form action={setPinned}>
              <input type="hidden" name="thread_id" value={thread.id} />
              <input type="hidden" name="pinned" value={thread.pinned ? "false" : "true"} />
              <button type="submit" className="btn-quiet">{thread.pinned ? "Unpin" : "Pin to top"}</button>
            </form>
          ) : null}
        </div>
      ) : null}
      <PostCard kind="thread" post={thread} member={member} basePath={path} edit={edit} threadTitle={thread.title} systemPost={thread.is_class_thread} />
      <h2 className="small muted" style={{ fontFamily: "var(--sans)", fontWeight: 600 }}>
        {replies.length === 0 ? "No replies yet" : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
      </h2>
      {replies.map((p) => (
        <PostCard key={p.id} kind="post" post={p} member={member} basePath={path} edit={edit} />
      ))}
      <ReplyForm threadId={thread.id} returnTo={path} />
    </div>
  );
}
