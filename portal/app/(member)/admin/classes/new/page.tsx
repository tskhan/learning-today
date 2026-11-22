import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ClassForm } from "../ClassForm";

export const metadata: Metadata = { title: "New class" };

export default async function NewClassPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("number").order("number", { ascending: false }).lt("number", 1000).limit(1);
  const nextNumber = (data?.[0]?.number ?? 0) + 1;
  return (
    <div className="stack">
      <h1>New class</h1>
      <ClassForm
        initial={{ id: null, number: String(nextNumber), classDate: "", title: "", summary: "", status: "draft", materials: [], homework: [] }}
      />
    </div>
  );
}
