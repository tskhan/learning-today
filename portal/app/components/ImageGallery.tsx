"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useModal } from "./Modal";

/**
 * Pictures under a message or class guide. Hovering shows a magnifier; clicking opens the picture
 * large on top of the page (← and → move between pictures; Esc, a click outside or × closes).
 */
export function ImageGallery({ urls, label = "Picture" }: { urls: string[]; label?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref, index !== null, () => setIndex(null));
  const titleId = useId();
  const count = urls.length;
  const go = (step: number) => setIndex((i) => (i === null ? i : (i + step + count) % count));

  useEffect(() => {
    if (index === null || count < 2) return;
    const dialog = ref.current;
    const keys = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    dialog?.addEventListener("keydown", keys);
    return () => dialog?.removeEventListener("keydown", keys);
  });

  const name = (i: number) => (count > 1 ? `${label} ${i + 1} of ${count}` : label);
  return (
    <>
      <div className={`post-images count-${count}`}>
        {urls.map((url, i) => (
          <button key={url} type="button" className="thumb" onClick={() => setIndex(i)} aria-label={`View ${name(i).toLowerCase()} larger`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed links from Supabase Storage */}
            <img src={url} alt={name(i)} loading="lazy" />
            <span className="zoom" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" />
              </svg>
            </span>
          </button>
        ))}
      </div>
      <dialog
        ref={ref}
        className="viewer"
        aria-labelledby={titleId}
        {...({ closedby: "any" } as object)}
        // The viewer fills the screen, so "outside the picture" is the dialog's own empty area.
        onClick={(e) => { if (e.target === e.currentTarget) setIndex(null); }}
      >
        {index !== null ? (
          <>
            <div className="viewer-bar">
              <span id={titleId}>{name(index)}</span>
              <span className="row">
                <a href={urls[index]} target="_blank" rel="noopener">Open original</a>
                <button type="button" className="viewer-close" autoFocus onClick={() => setIndex(null)} aria-label="Close">×</button>
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link */}
            <img src={urls[index]} alt={name(index)} />
            {count > 1 ? (
              <>
                <button type="button" className="viewer-nav prev" onClick={() => go(-1)} aria-label="Previous picture">‹</button>
                <button type="button" className="viewer-nav next" onClick={() => go(1)} aria-label="Next picture">›</button>
              </>
            ) : null}
          </>
        ) : null}
      </dialog>
    </>
  );
}
