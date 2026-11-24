"use client";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

/**
 * Opens and closes a native <dialog> as a modal. The browser then handles Esc, the mobile back
 * gesture, focus (kept inside, returned to the button that opened it) and makes the page inert.
 * `closedby="any"` also closes it on a click outside; Safari doesn't support that attribute yet,
 * so the same is done by hand there (press and release both outside the dialog's box).
 */
export function useModal(ref: RefObject<HTMLDialogElement | null>, open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [ref, open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const closed = () => onCloseRef.current();
    dialog.addEventListener("close", closed);
    let cleanupFallback = () => {};
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const down = (e: PointerEvent) => { pressedOutside = outside(e); };
      const up = (e: PointerEvent) => { if (pressedOutside && outside(e)) dialog.close(); };
      dialog.addEventListener("pointerdown", down);
      dialog.addEventListener("pointerup", up);
      cleanupFallback = () => {
        dialog.removeEventListener("pointerdown", down);
        dialog.removeEventListener("pointerup", up);
      };
    }
    return () => {
      dialog.removeEventListener("close", closed);
      cleanupFallback();
    };
  }, [ref]);
}

/** A small "are you sure?" box. The safe choice (Cancel) has focus first. */
export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref, open, onCancel);
  const titleId = useId();
  return (
    <dialog ref={ref} className="modal confirm-dialog" aria-labelledby={titleId} {...({ closedby: "any" } as object)}>
      {open ? (
        <>
          <h1 id={titleId}>{title}</h1>
          <p>{message}</p>
          <div className="modal-actions">
            <button type="button" className="btn-quiet" autoFocus onClick={onCancel}>Cancel</button>
            <button type="button" className="btn btn-danger-solid" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
