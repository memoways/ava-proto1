import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; started_at: string | null; context_type: string }>,
  page: vi.fn(),
  cursors: [] as string[],
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => {
    let after = "";
    let limit = 0;
    let exclude = false;
    const query = {
      order: () => query,
      limit: (value: number) => { limit = value; return query; },
      gt: (_key: string, value: string) => { after = value; mocks.cursors.push(value); return query; },
      neq: () => { exclude = true; return query; },
      abortSignal: () => query,
      then: (resolve: (value: unknown) => unknown) => {
        const error = mocks.page();
        return Promise.resolve(resolve({ error, data: error ? null : mocks.rows
          .filter(row => row.id > after && (!exclude || row.context_type !== "sandbox"))
          .slice(0, limit) }));
      },
    };
    return query;
  } }),
} }));

import { fetchAdminSessionHistory } from "./adminSessionHistory";

describe("admin session history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cursors = [];
    mocks.page.mockReturnValue(null);
    mocks.rows = Array.from({ length: 205 }, (_, i) => ({
      id: String(i).padStart(4, "0"), started_at: `2026-05-${String(i % 28 + 1).padStart(2, "0")}T10:00:00Z`,
      context_type: i === 204 ? "sandbox" : "public",
    }));
  });

  it("reads every page and then sorts by time, independent of UUID order", async () => {
    const rows = await fetchAdminSessionHistory();
    expect(rows).toHaveLength(205);
    expect(mocks.cursors).toEqual(["0099", "0199"]);
    expect(rows[0].started_at).toBe("2026-05-28T10:00:00Z");
  });

  it("does not silently return a partial history when the next page fails", async () => {
    mocks.page.mockReturnValueOnce(null).mockReturnValueOnce({ message: "network failure" });
    await expect(fetchAdminSessionHistory()).rejects.toThrow("network failure");
  });

  it("keeps the sandbox filter on subsequent pages", async () => {
    const rows = await fetchAdminSessionHistory({ includeSandbox: false });
    expect(rows).toHaveLength(204);
    expect(rows.some(row => row.id === "0204")).toBe(false);
  });

  it("does not skip rows if earlier sessions are deleted while loading", async () => {
    mocks.page.mockImplementationOnce(() => null).mockImplementationOnce(() => {
      mocks.rows = mocks.rows.filter(row => row.id > "0010");
      return null;
    });
    const rows = await fetchAdminSessionHistory();
    expect(rows).toHaveLength(205);
    expect(rows.some(row => row.id === "0100")).toBe(true);
  });

  it("stops when the reader is aborted instead of applying stale results", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchAdminSessionHistory({ signal: controller.signal })).rejects.toThrow();
    expect(mocks.page).not.toHaveBeenCalled();
  });
});
