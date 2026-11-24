import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClassForm } from "../ClassForm";

export const metadata: Metadata = { title: "New class" };

export default async function NewClassPage() {
  // Checked here as well as in the admin layout: a layout isn't re-run on every page change.
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("number").order("number", { ascending: false }).lt("number", 1000).limit(1);
  const nextNumber = (data?.[0]?.number ?? 0) + 1;
  return (
    <div className="stack narrow">
      <h1>New class</h1>
      <ClassForm
        initial={{ id: null, number: String(nextNumber), classDate: "", title: "", summary: "", status: "draft", materials: [], homework: [] }}
      />
    </div>
  );
}
