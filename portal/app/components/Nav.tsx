"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logOut } from "@/app/(auth)/actions";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/classes", label: "Classes" },
  { href: "/discussions", label: "Discussions" },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ firstName, isAdmin }: { firstName: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;
  return (
    <div className="nav-bar">
      <nav aria-label="Portal" className="nav-links">
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={isCurrent(pathname, l.href) ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <details className="user-menu">
        <summary>{firstName}</summary>
        <div className="user-menu-panel">
          <Link href="/profile">Profile</Link>
          <form action={logOut}>
            <button type="submit" className="link-button">Log out</button>
          </form>
        </div>
      </details>
    </div>
  );
}
