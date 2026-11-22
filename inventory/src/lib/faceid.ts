"use client";

// Face ID app lock using the phone's built-in passkey support (WebAuthn).
// The password sign-in stays the real login; Face ID only unlocks the app on this
// phone, and works offline because the check happens on the device.

const KEY = "sask-faceid";

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function read(): { id: string; email: string } | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export const faceIdEnabled = () => !!read();

export async function faceIdAvailable() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Must be called from a tap (iOS requires a user gesture). */
export async function enableFaceId(email: string) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: "Sask Inventory", id: location.hostname },
      user: { id: random(16), name: email, displayName: email },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Face ID was not set up");
  localStorage.setItem(KEY, JSON.stringify({ id: b64(cred.rawId), email }));
}

export function disableFaceId() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Asks for Face ID. Resolves true when the phone confirms it is the owner. */
export async function unlockWithFaceId() {
  const saved = read();
  if (!saved) return true;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: unb64(saved.id) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!res;
  } catch {
    return false;
  }
}
