import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="stack">
      <nav aria-label="Admin" className="admin-nav row">
        <Link href="/admin/classes">Classes</Link>
        <Link href="/admin/handins">Hand-ins</Link>
        <Link href="/admin/members">Members</Link>
        <Link href="/admin/settings">Settings</Link>
      </nav>
      {children}
    </div>
  );
}
