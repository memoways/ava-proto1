import { describe, expect, it } from "vitest";
import { oauthReturnPath, safeRedirectUrl } from "./oauth-return-path";

describe("oauthReturnPath", () => {
  it("keeps a local consent path with its query and fragment", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#frag")).toBe(
      "/.lovable/oauth/consent?authorization_id=abc#frag",
    );
  });

  it("falls back to / for missing, external or malformed values", () => {
    expect(oauthReturnPath(null)).toBe("/");
    expect(oauthReturnPath(undefined)).toBe("/");
    expect(oauthReturnPath("//evil.invalid/x")).toBe("/");
    expect(oauthReturnPath("https://evil.invalid/x")).toBe("/");
    expect(oauthReturnPath("/\\evil.invalid")).toBe("/");
    expect(oauthReturnPath("/ok\nHost: evil.invalid")).toBe("/");
  });
});

describe("safeRedirectUrl", () => {
  it("accepts https urls and same-origin paths only", () => {
    expect(safeRedirectUrl("https://client.invalid/cb")).toBe("https://client.invalid/cb");
    expect(safeRedirectUrl("/local/return")).toBe("/local/return");
  });

  it("rejects scripts, protocol-relative urls and empty values", () => {
    expect(safeRedirectUrl("javascript:alert(1)")).toBeNull();
    expect(safeRedirectUrl("//evil.invalid/x")).toBeNull();
    expect(safeRedirectUrl("data:text/html,x")).toBeNull();
    expect(safeRedirectUrl(null)).toBeNull();
    expect(safeRedirectUrl("")).toBeNull();
  });
});
