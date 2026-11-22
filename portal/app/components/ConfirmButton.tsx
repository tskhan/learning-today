"use client";
import type { ReactNode } from "react";

/** A submit button that asks for confirmation first. */
export function ConfirmButton({ message, children, className = "link-button danger" }: { message: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
