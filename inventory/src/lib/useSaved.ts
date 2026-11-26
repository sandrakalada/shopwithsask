"use client";

import { useCallback, useEffect, useState } from "react";

/** A choice the app remembers on this phone (filters, tabs, sorting).
 * A value in the page address (e.g. a link from Home) wins and is remembered too.
 * "session" keeps it only until the app is closed (searches, month browsing): it survives refresh. */
export function useSaved<T>(key: string, fallback: T, fromUrl?: T | null, keep: "always" | "session" = "always"): [T, (v: T | ((old: T) => T)) => void] {
  const k = `sask-pick-${key}`;
  const store = () => (keep === "session" ? sessionStorage : localStorage);
  const [v, setV] = useState<T>(fromUrl ?? fallback);
  useEffect(() => {
    if (fromUrl != null) {
      try { store().setItem(k, JSON.stringify(fromUrl)); } catch {}
      return;
    }
    try {
      const s = store().getItem(k);
      setV(s != null ? (JSON.parse(s) as T) : fallback);
    } catch {}
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((nv: T | ((old: T) => T)) => {
    setV((old) => {
      const next = typeof nv === "function" ? (nv as (old: T) => T)(old) : nv;
      try { store().setItem(k, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, set];
}
