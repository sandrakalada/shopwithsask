"use client";

const MINE = process.env.NEXT_PUBLIC_BUILD_ID;

/** Reloads the app when a newer version has been published. */
export async function checkForUpdate() {
  if (!MINE || !navigator.onLine) return false;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const { build } = await res.json();
    if (build && build !== MINE) {
      const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
      if (reg && navigator.serviceWorker.controller) {
        // the new version downloads in the background; the app switches to it once, when it is ready
        void reg.update().catch(() => {});
        return true;
      }
      // no offline copy yet: a normal reload gets the new version (at most once a minute)
      const last = Number(sessionStorage.getItem("sask-reloaded") ?? 0);
      if (Date.now() - last > 60_000) {
        sessionStorage.setItem("sask-reloaded", String(Date.now()));
        location.reload();
      }
      return true;
    }
  } catch {}
  return false;
}
