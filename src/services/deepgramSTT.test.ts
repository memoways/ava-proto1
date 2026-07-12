import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedFunctionFetch = vi.hoisted(() => vi.fn());

vi.mock("./gameAuth", () => ({ authenticatedFunctionFetch }));

import { getDeepgramToken, getDeepgramWebSocketProtocols } from "./deepgramSTT";

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
});
