import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  externalTestInvitationStatus,
  generateExternalTestCode,
  normalizeExternalTestCode,
  sha256Hex,
} from "../../supabase/functions/_shared/externalTestInvitationCore";

describe("external test invitation core", () => {
  it("creates a readable code backed by 16 random characters", () => {
    const code = generateExternalTestCode(new Uint8Array(Array.from({ length: 16 }, (_, index) => index)));
    expect(code).toMatch(/^AVA-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
    expect(normalizeExternalTestCode(code)).toHaveLength(19);
  });

  it("normalizes separators and letter case before hashing", async () => {
    const normalized = normalizeExternalTestCode("ava-abcd efgh-2345-jkmn");
    expect(normalized).toBe("AVAABCDEFGH2345JKMN");
    expect(await sha256Hex(normalized)).toMatch(/^[a-f0-9]{64}$/);
    expect(constantTimeEqual("same-value", "same-value")).toBe(true);
    expect(constantTimeEqual("same-value", "other-value")).toBe(false);
    expect(constantTimeEqual("short", "longer")).toBe(false);
  });

  it("derives invitation status from pre-activation and four-hour access windows", () => {
    const future = "2026-09-20T00:00:00.000Z";
    const past = "2026-09-01T00:00:00.000Z";
    const now = new Date("2026-09-10T00:00:00.000Z").getTime();
    const recentlyRedeemed = "2026-09-09T22:00:00.000Z";
    expect(externalTestInvitationStatus({ revoked_at: null, redeemed_at: null, expires_at: future }, now)).toBe("available");
    expect(externalTestInvitationStatus({ revoked_at: null, redeemed_at: null, expires_at: past }, now)).toBe("expired");
    expect(externalTestInvitationStatus({ revoked_at: null, redeemed_at: recentlyRedeemed, expires_at: past }, now)).toBe("activated");
    expect(externalTestInvitationStatus({ revoked_at: null, redeemed_at: past, expires_at: future }, now)).toBe("expired");
    expect(externalTestInvitationStatus({ revoked_at: past, redeemed_at: past, expires_at: future }, now)).toBe("revoked");
  });
});
