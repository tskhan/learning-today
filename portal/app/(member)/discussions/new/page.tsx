import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewThreadForm } from "./NewThreadForm";

export const metadata: Metadata = { title: "New discussion" };

export default async function NewThreadPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  await requireMember();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("id, number, title").eq("status", "published").order("number", { ascending: false });
  const classes = data ?? [];
  const defaultClassId = classes.find((c) => String(c.number) === classParam)?.id;
  return (
    <div className="stack narrow">
      <p className="small"><Link href="/discussions">← All discussions</Link></p>
      <h1>New discussion</h1>
      <NewThreadForm classes={classes} defaultClassId={defaultClassId} />
    </div>
  );
}
