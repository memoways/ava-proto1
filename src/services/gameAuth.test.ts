import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
}));

const roleQuery = vi.hoisted(() => ({
  select: vi.fn(),
  eqUser: vi.fn(),
  eqRole: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth,
    from: vi.fn(() => ({ select: roleQuery.select })),
  },
}));

import {
  authenticatedFunctionFetch,
  ensureGameAuth,
  isGameCaptchaEnabled,
  isCurrentUserAdmin,
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
    roleQuery.select.mockReset().mockReturnValue({ eq: roleQuery.eqUser });
    roleQuery.eqUser.mockReset().mockReturnValue({ eq: roleQuery.eqRole });
    roleQuery.eqRole.mockReset().mockReturnValue({ maybeSingle: roleQuery.maybeSingle });
    roleQuery.maybeSingle.mockReset();
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

  it("forwards the CAPTCHA proof when creating an anonymous identity", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.signInAnonymously.mockResolvedValue({ data: { session }, error: null });

    await ensureGameAuth("captcha-proof");

    expect(auth.signInAnonymously).toHaveBeenCalledWith({
      options: { captchaToken: "captcha-proof" },
    });
  });

  it("reports CAPTCHA as optional until its public site key is configured", () => {
    expect(isGameCaptchaEnabled()).toBe(false);
    vi.stubEnv("VITE_HCAPTCHA_SITE_KEY", "10000000-ffff-ffff-ffff-000000000001");
    expect(isGameCaptchaEnabled()).toBe(true);
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
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await authenticatedFunctionFetch("https://example.test/functions/v1/proxy-stt");

    expect(auth.getSession).toHaveBeenCalledOnce();
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("apikey")).toBeTruthy();
  });

  it("recognizes an authenticated admin even when public game security is disabled", async () => {
    vi.stubEnv("VITE_GAME_SECURITY_ENABLED", "false");
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    roleQuery.maybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });

    await expect(isCurrentUserAdmin()).resolves.toBe(true);

    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(roleQuery.eqUser).toHaveBeenCalledWith("user_id", session.user.id);
    expect(roleQuery.eqRole).toHaveBeenCalledWith("role", "admin");
  });
});
