import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: (row: unknown) => {
        mocks.insert(row);
        return { select: () => ({ single: async () => ({ data: { id: "session-1" }, error: null }) }) };
      },
    })),
    rpc: (...args: unknown[]) => {
      mocks.rpc(...args);
      return Promise.resolve({ error: null });
    },
  },
}));
vi.mock("@/services/gameAuth", () => ({ ensureGameAuth: vi.fn(async () => undefined) }));
vi.mock("@/services/posthogService", () => ({ trackEvent: vi.fn() }));
vi.mock("@/services/environmentContext", () => ({
  getRuntimeContext: () => ({
    environmentId: "prod",
    contextType: "public",
    campaignId: null,
    testerLabel: null,
    testInvitationId: null,
    startedByUserId: null,
    startedBy: "public",
  }),
}));

describe("createPRD4Session device columns", () => {
  beforeEach(async () => {
    mocks.insert.mockClear();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    const { resetDeviceClassForTests } = await import("./deviceClass");
    resetDeviceClassForTests();
  });

  it("writes device_class and a technical device_info snapshot", async () => {
    window.history.replaceState(null, "", "/?ecran=telephone");
    const { createPRD4Session } = await import("./prd4Session");
    await expect(createPRD4Session(null, "max")).resolves.toBe("session-1");
    const row = mocks.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.device_class).toBe("smartphone");
    expect(row.device_info).toMatchObject({ source: "url", pointer_coarse: expect.any(Boolean), touch: expect.any(Boolean) });
    expect(row.device_info).not.toHaveProperty("device_class");
    expect(row.environment_id).toBe("prod");
  });

  it("classifies automatically without an override", async () => {
    const { createPRD4Session } = await import("./prd4Session");
    await createPRD4Session(null, "max");
    const row = mocks.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(["smartphone", "tablet", "desktop"]).toContain(row.device_class);
    expect(row.device_info).toMatchObject({ source: "auto" });
  });
});
