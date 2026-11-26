"use client";

import { useCallback, useEffect, useState } from "react";

/** A choice the app remembers on this phone (filters, tabs, sorting).
 * A value in the page address (e.g. a link from Home) wins and is remembered too. */
export function useSaved<T>(key: string, fallback: T, fromUrl?: T | null): [T, (v: T) => void] {
  const k = `sask-pick-${key}`;
  const [v, setV] = useState<T>(fromUrl ?? fallback);
  useEffect(() => {
    if (fromUrl != null) {
      try { localStorage.setItem(k, JSON.stringify(fromUrl)); } catch {}
      return;
    }
    try {
      const s = localStorage.getItem(k);
      if (s != null) setV(JSON.parse(s) as T);
    } catch {}
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((nv: T) => {
    setV(nv);
    try { localStorage.setItem(k, JSON.stringify(nv)); } catch {}
  }, [k]);
  return [v, set];
}
