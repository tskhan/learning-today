import { Header } from "@/app/components/Header";
import { Nav } from "@/app/components/Nav";
import { requireMember } from "@/lib/auth";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const firstName = member.fullName.split(/\s+/)[0] ?? member.fullName;
  return (
    <>
      <Header>
        <Nav firstName={firstName} isAdmin={member.role === "admin"} />
      </Header>
      <main id="main" className="wrap">{children}</main>
    </>
  );
}
