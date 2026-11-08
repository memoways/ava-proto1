import { describe, expect, it } from "vitest";
import { describeMicStartError } from "./micStartError";

describe("describeMicStartError", () => {
  it("tells a refused permission apart and says how to fix it", () => {
    const info = describeMicStartError(new DOMException("denied", "NotAllowedError"), true);
    expect(info).toMatchObject({ kind: "permission", name: "NotAllowedError", title: "Micro refusé" });
    expect(info.description).toMatch(/réglages du navigateur/);
  });

  it("recognises a busy or missing microphone", () => {
    expect(describeMicStartError(new DOMException("busy", "NotReadableError"), true).kind).toBe("busy");
    expect(describeMicStartError(new DOMException("none", "NotFoundError"), true).kind).toBe("no_device");
  });

  it("points to Safari when the browser exposes no capture API", () => {
    const info = describeMicStartError(new TypeError("undefined is not an object"), false);
    expect(info.kind).toBe("unsupported");
    expect(info.description).toMatch(/Safari/);
  });

  it("keeps the generic message for anything else, with the raw name and a bounded message", () => {
    const info = describeMicStartError(new Error("x".repeat(500)), true);
    expect(info).toMatchObject({ kind: "unknown", name: "Error", title: "Micro indisponible" });
    expect(info.message).toHaveLength(300);
  });
});
