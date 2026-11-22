"use client";

// Face ID sign-in using passkeys stored in iCloud Keychain and verified by Supabase Auth.
// Online: a real passwordless sign-in. Offline (already signed in on this phone): the same
// passkey is checked on the device to open the app.

import { supabase } from "./supabase";

const FLAG = "sask-faceid";

export function faceIdEnabled() {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export async function faceIdAvailable() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Creates a passkey for the signed-in user. Call it straight from a tap. */
export async function enableFaceId() {
  const { error } = await supabase!.auth.registerPasskey();
  if (error && !/already been registered|credential_exists/i.test(error.message)) throw new Error(error.message);
  localStorage.setItem(FLAG, "1");
}

export async function disableFaceId() {
  try {
    const { data } = await supabase!.auth.passkey.list();
    for (const p of data ?? []) await supabase!.auth.passkey.delete({ passkeyId: p.id });
  } catch {}
  localStorage.removeItem(FLAG);
}

/** Passwordless sign-in (needs a connection). */
export async function signInWithFaceId() {
  const { error } = await supabase!.auth.signInWithPasskey();
  if (error) throw new Error(/cancel|abort|NotAllowed/i.test(error.message) ? "Face ID was cancelled" : error.message);
  localStorage.setItem(FLAG, "1");
}

/** Opens the app for an already signed-in user; works offline. */
export async function unlockWithFaceId() {
  if (navigator.onLine) {
    try {
      await signInWithFaceId();
      return true;
    } catch {
      // fall through to the on-device check
    }
  }
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!res;
  } catch {
    return false;
  }
}
