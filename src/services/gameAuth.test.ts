import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth },
}));

import {
  authenticatedFunctionFetch,
  ensureGameAuth,
  resetGameAuthForTests,
} from "./gameAuth";

const session = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: { id: "11111111-1111-4111-8111-111111111111" },
};

describe("gameAuth", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GAME_SECURITY_ENABLED", "true");
    resetGameAuthForTests();
    auth.getSession.mockReset();
    auth.signInAnonymously.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reuses an existing Supabase session", async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(ensureGameAuth()).resolves.toMatchObject({ access_token: "test-access-token" });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent anonymous sign-ins", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.signInAnonymously.mockResolvedValue({ data: { session }, error: null });

    const [first, second] = await Promise.all([ensureGameAuth(), ensureGameAuth()]);

    expect(first?.access_token).toBe("test-access-token");
    expect(second).toBe(first);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("adds the user JWT to Edge Function requests", async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await authenticatedFunctionFetch("https://example.test/functions/v1/proxy-llm", {
      method: "POST",
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = request.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-access-token");
    expect(headers.get("apikey")).toBeTruthy();
  });

  it("keeps the Lovable preview compatible while Phase 1 is disabled", async () => {
    vi.stubEnv("VITE_GAME_SECURITY_ENABLED", "false");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await authenticatedFunctionFetch("https://example.test/functions/v1/proxy-stt");

    expect(auth.getSession).not.toHaveBeenCalled();
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("apikey")).toBeTruthy();
  });
});
