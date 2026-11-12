const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ExternalTestInvitationStatus = "scheduled" | "available" | "activated" | "expired" | "revoked";

export function generateExternalTestCode(
  randomBytes = crypto.getRandomValues(new Uint8Array(16)),
): string {
  if (randomBytes.length < 16) throw new Error("At least 16 random bytes are required");
  const random = Array.from(randomBytes.slice(0, 16), (byte) => CODE_ALPHABET[byte & 31]).join("");
  return `AVA-${random.match(/.{1,4}/g)!.join("-")}`;
}

export function normalizeExternalTestCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

/** Validity period = [valid_from, expires_at]; activation lasts until expires_at. */
export function externalTestInvitationStatus(
  row: { revoked_at: string | null; redeemed_at: string | null; expires_at: string; valid_from?: string | null },
  now = Date.now(),
): ExternalTestInvitationStatus {
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= now) return "expired";
  if (row.redeemed_at) return "activated";
  if (row.valid_from && new Date(row.valid_from).getTime() > now) return "scheduled";
  return "available";
}

// ---- Recoverable codes (admin console) ---------------------------------------
// The redeem path still checks only `code_hash`. A copy of the code is kept,
// encrypted (AES-GCM), so the creating admin can show it again. The key is
// derived from a server-only secret (HKDF-SHA-256), never stored in the table:
// a database export alone does not reveal the codes.

const CIPHER_PREFIX = "v1";
const KEY_INFO = "ava-external-test-invitation-code-v1";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function deriveInvitationCodeKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error("Missing secret for invitation codes");
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode(KEY_INFO), info: new TextEncoder().encode(KEY_INFO) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** `v1:<iv>:<ciphertext>`, bound to the invitation id (additional data). */
export async function encryptInvitationCode(key: CryptoKey, invitationId: string, code: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(invitationId) },
    key,
    new TextEncoder().encode(code),
  );
  return `${CIPHER_PREFIX}:${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
}

/** Null when absent, malformed, for another invitation or under another key. */
export async function decryptInvitationCode(key: CryptoKey, invitationId: string, stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  const [prefix, iv, data] = stored.split(":");
  if (prefix !== CIPHER_PREFIX || !iv || !data) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(iv), additionalData: new TextEncoder().encode(invitationId) },
      key,
      fromBase64(data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
