import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "@lovable.dev/mcp-js";
const mocks = vi.hoisted(() => ({ create: vi.fn(), from: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
import { supabaseForAdmin } from "./supabase";
describe("MCP admin authorization with caller RLS", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SUPABASE_URL", "https://iralfqlslqndgvexixis.supabase.co"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-key"); });
  const context = { isAuthenticated: () => true, getUserId: () => "admin1", getToken: () => "caller-oauth-token" } as unknown as ToolContext;
  it("uses the caller token and publishable key, with an explicit admin role check", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), limit: vi.fn().mockResolvedValue({ data: [{ role: "admin" }], error: null }) };
    builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder);
    mocks.from.mockReturnValue(builder); mocks.create.mockReturnValue({ from: mocks.from });
    await expect(supabaseForAdmin(context)).resolves.toBeTruthy();
    expect(mocks.create).toHaveBeenCalledWith("https://iralfqlslqndgvexixis.supabase.co", "public-test-key", expect.objectContaining({ global: { headers: { Authorization: "Bearer caller-oauth-token" } } }));
    expect(builder.eq).toHaveBeenCalledWith("user_id", "admin1");
    expect(builder.eq).toHaveBeenCalledWith("role", "admin");
  });
  it("denies a valid token without admin membership", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) };
    builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder);
    mocks.from.mockReturnValue(builder); mocks.create.mockReturnValue({ from: mocks.from });
    await expect(supabaseForAdmin(context)).rejects.toThrow("Admin access required");
  });
  it("denies missing token without an anonymous fallback", async () => {
    await expect(supabaseForAdmin({ ...context, getToken: () => undefined } as unknown as ToolContext)).rejects.toThrow("verified OAuth token");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
