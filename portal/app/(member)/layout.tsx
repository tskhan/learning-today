import { Header } from "@/app/components/Header";
import { Nav } from "@/app/components/Nav";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { FlashError } from "@/app/components/FlashError";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const firstName = member.fullName.split(/\s+/)[0] ?? member.fullName;
  return (
    <>
      <Header>
        <Nav firstName={firstName} isAdmin={member.role === "admin"} />
      </Header>
      <main id="main" className="wrap">
        <Suspense fallback={null}>
          <FlashError />
        </Suspense>
        {children}
      </main>
    </>
  );
}
