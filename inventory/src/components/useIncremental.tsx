"use client";

import { useEffect, useRef, useState } from "react";

/** Renders long lists in pages of `step` and loads more as the user nears the bottom. */
export function useIncremental(total: number, step = 40, resetKey: unknown = null) {
  const [count, setCount] = useState(step);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setCount(step), [resetKey, step]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setCount((c) => (c < total ? c + step : c)), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [total, step, count]);
  // a plain element (not an inline component) so React keeps the same DOM node between renders
  const Sentinel = count < total ? <div ref={sentinel} className="h-8" /> : null;
  return { count, Sentinel };
}
