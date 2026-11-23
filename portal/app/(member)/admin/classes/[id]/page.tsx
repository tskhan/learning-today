import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isoToKarachiInput } from "@/lib/time";
import { ClassForm } from "../ClassForm";
import { DeleteClassForm } from "./DeleteClassForm";

export const metadata: Metadata = { title: "Edit class" };

interface Row {
  id: number;
  number: number;
  class_date: string;
  title: string;
  summary_md: string;
  status: "draft" | "published";
  class_materials: Array<{ id: number; label: string; url: string; position: number }>;
  homework: Array<{ id: number; title: string; instructions_md: string; deadline: string | null; handin_expected: boolean; position: number }>;
}

export default async function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("classes")
    .select("id, number, class_date, title, summary_md, status, class_materials(id, label, url, position), homework(id, title, instructions_md, deadline, handin_expected, position)")
    .eq("id", Number(id))
    .maybeSingle<Row>();
  if (!cls) notFound();
  const byPos = <T extends { position: number; id: number }>(a: T, b: T) => a.position - b.position || a.id - b.id;
  return (
    <div className="stack narrow">
      <div className="spread">
        <h1>Edit Class {cls.number}</h1>
        <Link className="small" href={`/classes/${cls.number}`}>View as students see it</Link>
      </div>
      <ClassForm
        initial={{
          id: cls.id,
          number: String(cls.number),
          classDate: cls.class_date,
          title: cls.title,
          summary: cls.summary_md,
          status: cls.status,
          materials: [...cls.class_materials].sort(byPos).map((m) => ({ key: `m${m.id}`, label: m.label, url: m.url })),
          homework: [...cls.homework].sort(byPos).map((h) => ({
            key: `h${h.id}`,
            id: h.id,
            title: h.title,
            instructions: h.instructions_md,
            deadline: h.deadline ? isoToKarachiInput(h.deadline) : "",
            handin: h.handin_expected,
          })),
        }}
      />
      <DeleteClassForm id={cls.id} />
    </div>
  );
}
