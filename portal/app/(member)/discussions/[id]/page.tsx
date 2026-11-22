import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { ThreadView } from "@/app/components/ThreadView";

export const metadata: Metadata = { title: "Discussion" };

export default async function ThreadPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const member = await requireMember();
  const { id } = await params;
  const { edit } = await searchParams;
  const threadId = Number(id);
  if (!Number.isInteger(threadId) || threadId <= 0) notFound();
  return (
    <div className="stack">
      <p className="small"><Link href="/discussions">← All discussions</Link></p>
      <ThreadView threadId={threadId} member={member} edit={edit} />
    </div>
  );
}
