import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedFunctionFetch = vi.hoisted(() => vi.fn());

vi.mock("@/services/gameAuth", () => ({ authenticatedFunctionFetch }));

import { getSTTRuntimeConfig, resetSTTRuntimeConfigCache } from "./runtimeConfig";

describe("STT runtime provider contract", () => {
  beforeEach(() => {
    resetSTTRuntimeConfigCache();
    authenticatedFunctionFetch.mockReset();
  });

  it("preserves the Gamilab portal credential required by the browser SDK", async () => {
    authenticatedFunctionFetch.mockResolvedValue(new Response(JSON.stringify({
      gamilabPortalId: "42",
      gamilabPortalToken: "short-or-scoped-browser-token",
      configured: { deepgram: true, gamilab: true },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const config = await getSTTRuntimeConfig();

    expect(config.gamilabPortalId).toBe("42");
    expect(config.gamilabPortalToken).toBe("short-or-scoped-browser-token");
    expect(config.configured.gamilab).toBe(true);
  });
});
