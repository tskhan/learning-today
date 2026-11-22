import type { ReactNode } from "react";

/** Site header: the learning-today.com logo (links to the main site) and an optional nav. */
export function Logo() {
  return (
    <a className="site-logo" href="https://learning-today.com">
      <picture>
        <source srcSet="/logo-dark.png" media="(prefers-color-scheme: dark)" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="learning-today.com" width={114} height={26} />
      </picture>
    </a>
  );
}

export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        {children}
      </div>
    </header>
  );
}
