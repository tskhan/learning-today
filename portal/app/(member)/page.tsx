import { requireMember } from "@/lib/auth";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const member = await requireMember();
  const { reset } = await searchParams;
  return (
    <div className="stack">
      {reset ? <p className="notice" role="status">Your password has been changed.</p> : null}
      <h1>Welcome back, {member.fullName.split(/\s+/)[0]}</h1>
    </div>
  );
}
