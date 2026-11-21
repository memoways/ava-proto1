import { describe, expect, it, vi } from "vitest";
vi.mock("./settingsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./settingsService")>()),
  loadNewsletterSettingsFromDB: vi.fn(async () => {
    throw new Error("offline");
  }),
}));
import { requestGamiwaysNews } from "./newsletterSubscribe";
import { normalizeNewsletterSettings } from "./settingsService";

const enabled = { ENABLED: true, SUBSCRIBE_URL: "https://memoways.com/api/newsletter/subscribe" };

describe("requestGamiwaysNews", () => {
  it("sends only the Gamiways topic, the AVA source and no credentials", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const result = await requestGamiwaysNews({ email: " tester@example.test ", optIn: true, settings: enabled, fetchImpl });
    expect(result).toBe("requested");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(enabled.SUBSCRIBE_URL);
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(String(init.body))).toEqual({
      topic: "gamiways",
      email: "tester@example.test",
      firstName: "",
      lastName: "",
      consent: true,
      locale: "fr",
      source: "ava-questionnaire",
      website: "",
    });
  });

  it("never sends without the box, a valid email or the admin switch", async () => {
    const fetchImpl = vi.fn();
    expect(await requestGamiwaysNews({ email: "tester@example.test", optIn: false, settings: enabled, fetchImpl })).toBe("skipped");
    expect(await requestGamiwaysNews({ email: "not-an-email", optIn: true, settings: enabled, fetchImpl })).toBe("skipped");
    expect(await requestGamiwaysNews({ email: undefined, optIn: true, settings: enabled, fetchImpl })).toBe("skipped");
    expect(
      await requestGamiwaysNews({ email: "tester@example.test", optIn: true, settings: { ...enabled, ENABLED: false }, fetchImpl }),
    ).toBe("skipped");
    // Unreadable settings fall back to the closed default.
    expect(await requestGamiwaysNews({ email: "tester@example.test", optIn: true, fetchImpl })).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a failure without throwing", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect(await requestGamiwaysNews({ email: "tester@example.test", optIn: true, settings: enabled, fetchImpl: down })).toBe("failed");
    const closed = vi.fn(async () => new Response(null, { status: 503 }));
    expect(await requestGamiwaysNews({ email: "tester@example.test", optIn: true, settings: enabled, fetchImpl: closed })).toBe("failed");
  });
});

describe("normalizeNewsletterSettings", () => {
  it("stays closed by default and accepts only an HTTPS endpoint", () => {
    expect(normalizeNewsletterSettings(null).ENABLED).toBe(false);
    expect(normalizeNewsletterSettings({ ENABLED: true, SUBSCRIBE_URL: "http://evil.test" }).SUBSCRIBE_URL).toBe(
      "https://memoways.com/api/newsletter/subscribe",
    );
    expect(normalizeNewsletterSettings({ ENABLED: "yes" as never }).ENABLED).toBe(false);
  });
});
