const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ACCESS_DURATION_MS = 4 * 60 * 60 * 1000;

export type ExternalTestInvitationStatus = "available" | "activated" | "expired" | "revoked";

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

export function externalTestInvitationStatus(
  row: { revoked_at: string | null; redeemed_at: string | null; expires_at: string },
  now = Date.now(),
): ExternalTestInvitationStatus {
  if (row.revoked_at) return "revoked";
  if (row.redeemed_at) {
    return new Date(row.redeemed_at).getTime() + ACCESS_DURATION_MS <= now
      ? "expired"
      : "activated";
  }
  return new Date(row.expires_at).getTime() <= now ? "expired" : "available";
}
