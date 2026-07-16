import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedFunctionFetch = vi.hoisted(() => vi.fn());

vi.mock("./gameAuth", () => ({ authenticatedFunctionFetch }));

import {
  buildDeepgramWebSocketUrl,
  getDeepgramToken,
  getDeepgramWebSocketProtocols,
} from "./deepgramSTT";

describe("Deepgram token diagnostics", () => {
  beforeEach(() => authenticatedFunctionFetch.mockReset());

  it("turns an upstream grant permission failure into an actionable message", async () => {
    authenticatedFunctionFetch.mockResolvedValue(new Response(JSON.stringify({
      code: "DEEPGRAM_GRANT_PERMISSION",
      error: "Deepgram API key needs Member permission for temporary tokens",
    }), { status: 502, headers: { "Content-Type": "application/json" } }));

    await expect(getDeepgramToken()).rejects.toThrow(/permission Member/i);
  });

  it("authenticates temporary JWTs with the Bearer WebSocket subprotocol", () => {
    expect(getDeepgramWebSocketProtocols("temporary-jwt")).toEqual([
      "bearer",
      "temporary-jwt",
    ]);
  });

  it("uses the shared nova-3 baseline when the proxy omits optional metadata", async () => {
    authenticatedFunctionFetch.mockResolvedValue(new Response(JSON.stringify({
      key: "temporary-jwt",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(getDeepgramToken()).resolves.toEqual({
      key: "temporary-jwt",
      model: "nova-3",
      language: "fr",
    });
  });

  it("builds the live stream from the effective token configuration", () => {
    const url = new URL(buildDeepgramWebSocketUrl({ model: "nova-3", language: "fr" }));

    expect(url.origin + url.pathname).toBe("wss://api.deepgram.com/v1/listen");
    expect(url.searchParams.get("model")).toBe("nova-3");
    expect(url.searchParams.get("language")).toBe("fr");
    expect(url.searchParams.get("interim_results")).toBe("true");
    expect(url.searchParams.get("endpointing")).toBe("false");
    expect(url.searchParams.getAll("keyterm")).toEqual([]);
  });

  it("appends each dictionary term as a repeated keyterm query param", () => {
    const url = new URL(
      buildDeepgramWebSocketUrl(
        { model: "nova-3", language: "fr" },
        { keyterms: ["Ava", "Protogyny", "Ulrich Fischer", "  ", ""] },
      ),
    );
    expect(url.searchParams.getAll("keyterm")).toEqual([
      "Ava",
      "Protogyny",
      "Ulrich Fischer",
    ]);
  });

  it("caps keyterms at Deepgram's 100-term limit", () => {
    const terms = Array.from({ length: 150 }, (_, i) => `term${i}`);
    const url = new URL(
      buildDeepgramWebSocketUrl({ model: "nova-3", language: "fr" }, { keyterms: terms }),
    );
    expect(url.searchParams.getAll("keyterm")).toHaveLength(100);
  });
});

