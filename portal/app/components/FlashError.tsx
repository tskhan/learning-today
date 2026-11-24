"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { flashMessage } from "@/lib/flash";

/**
 * Shows the message for an ?error=… code that a failed action redirected with, then removes the
 * code from the address so a later success on the same page doesn't keep showing it. The message
 * stays until the member dismisses it or moves to another page.
 */
export function FlashError() {
  const params = useSearchParams();
  const pathname = usePathname();
  const code = params.get("error");
  const [shown, setShown] = useState<{ message: string; path: string } | null>(null);

  useEffect(() => {
    const message = flashMessage(code);
    if (!message) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the code comes from the address once, then is cleared from it
    setShown({ message, path: pathname });
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [code, pathname]);

  if (!shown || shown.path !== pathname) return null;
  return (
    <div className="error flash" role="alert">
      <span>{shown.message}</span>
      <button type="button" className="link-button" onClick={() => setShown(null)} aria-label="Dismiss message">Dismiss</button>
    </div>
  );
}
