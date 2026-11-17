/**
 * Cookie de desbloqueo de la tablet tras introducir el PIN del local.
 * Formato: <userId>.<expiraEnSegundos>.<firmaHMAC>. Funciona en Node y en Edge.
 */
export const UNLOCK_COOKIE = "rm_unlock";
export const UNLOCK_TTL_SECONDS = 12 * 60 * 60; // un turno largo

const enc = new TextEncoder();

function toB64Url(buf: ArrayBuffer): string {
  let s = "";
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string) {
  if (!secret || secret.length < 32) throw new Error("RM_UNLOCK_SECRET debe tener al menos 32 caracteres");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signUnlock(userId: string, secret: string, ttl = UNLOCK_TTL_SECONDS, now = Date.now()) {
  const exp = Math.floor(now / 1000) + ttl;
  const payload = `${userId}.${exp}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload));
  return `${payload}.${toB64Url(sig)}`;
}

export async function verifyUnlock(
  token: string | undefined,
  userId: string,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uid, exp, sig] = parts;
  if (uid !== userId) return false;
  const expNum = Number(exp);
  if (!Number.isInteger(expNum) || expNum * 1000 <= now) return false;
  const sigBytes = fromB64Url(sig);
  if (!sigBytes) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(secret), sigBytes, enc.encode(`${uid}.${exp}`));
}
