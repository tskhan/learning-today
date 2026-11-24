"use client";
import { useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./Modal";

/**
 * A button that asks "are you sure?" in the portal's own dialog (not the browser's pop-up), then
 * submits the form it sits in.
 */
export function ConfirmButton({ title, message, confirmLabel = "Delete", children, className = "link-button danger" }: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" ref={trigger} className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          trigger.current?.form?.requestSubmit();
        }}
      />
    </>
  );
}
