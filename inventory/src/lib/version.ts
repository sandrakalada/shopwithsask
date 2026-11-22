"use client";

const MINE = process.env.NEXT_PUBLIC_BUILD_ID;

/** Reloads the app when a newer version has been published. */
export async function checkForUpdate() {
  if (!MINE || !navigator.onLine) return false;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const { build } = await res.json();
    if (build && build !== MINE) {
      await navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
      location.reload();
      return true;
    }
  } catch {}
  return false;
}
