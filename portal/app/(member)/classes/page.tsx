import { requireMember } from "@/lib/auth";

export default async function ClassesPage() {
  await requireMember();
  return <h1>Classes</h1>;
}
