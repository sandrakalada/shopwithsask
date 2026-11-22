"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { thumb } from "@/lib/stock";

/** Full-screen photo viewer: every photo fits the screen; swipe (or arrow keys) for previous / next. */
export default function Lightbox({ images, start = 0, onClose }: { images: string[]; start?: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(start);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const d = e.key === "ArrowRight" ? 1 : -1;
        el?.scrollTo({ left: (Math.round(el.scrollLeft / el.clientWidth) + d) * el.clientWidth, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", key);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Photos">
      <div className="pt-safe absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3 text-sm text-white">
        <span>{images.length > 1 ? `${i + 1} / ${images.length}` : ""}</span>
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur" aria-label="Close">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div
        ref={ref}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {images.map((src, k) => (
          <div key={src + k} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb(src, 1600) ?? src} alt={`Photo ${k + 1}`} className="max-h-full max-w-full object-contain" loading={Math.abs(k - start) <= 1 ? "eager" : "lazy"} />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
