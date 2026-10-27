import { beforeEach, describe, expect, it, vi } from "vitest";
const from = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { prepareSessionsMarkdown } from "./sessionMarkdownDownload";

function query(data: unknown, error: unknown = null) {
  const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data, error })),
    then: vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve)) };
  return q;
}
describe("authorized session export preparation", () => {
  beforeEach(() => from.mockReset());
  it("reads only the selected sessions and joins both reports", async () => {
    const sessionQuery = query({ id: "fresh", conversation_log: [{ role: "user", content: "Bonjour" }, { role: "emma", content: "Salut" }] });
    from.mockImplementation(table => table === "sessions" ? sessionQuery : query([]));
    const result = await prepareSessionsMarkdown([{ id: "s1", account_display_name: "Ulrich" }, { id: "s2" }]);
    expect(sessionQuery.eq.mock.calls).toEqual([["id", "s1"], ["id", "s2"]]);
    expect(result.warningCount).toBe(0);
    expect(result.blob.type).toBe("text/markdown;charset=utf-8");
    expect(result.blob.size).toBeGreaterThan(100);
    expect(result.filename).toMatch(/-2\.md$/);
  });
  it("preserves the session but explicitly warns on unavailable telemetry", async () => {
    from.mockImplementation(table => table === "sessions" ? query({ id: "s1" }) : table === "audio_latencies" ? query(null, { message: "denied" }) : query([]));
    const result = await prepareSessionsMarkdown([{ id: "s1" }]);
    expect(result.warningCount).toBe(1);
  });
  it("does not produce a misleading partial selection when a session cannot be read", async () => {
    from.mockImplementation(() => query(null, { message: "denied" }));
    await expect(prepareSessionsMarkdown([{ id: "s1" }])).rejects.toThrow("Session s1 inaccessible");
  });
  it("paginates telemetry instead of silently truncating at the first page", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ id: `row-${i}` }));
    const paged = query(rows);
    paged.then.mockImplementationOnce(resolve => Promise.resolve({ data: rows, error: null }).then(resolve))
      .mockImplementationOnce(resolve => Promise.resolve({ data: [], error: null }).then(resolve));
    from.mockImplementation(table => table === "sessions" ? query({ id: "s1" }) : table === "voice_turn_events" ? paged : query([]));
    await prepareSessionsMarkdown([{ id: "s1" }]);
    expect(paged.gt).toHaveBeenCalledWith("id", "row-499");
    expect(paged.limit).toHaveBeenCalledTimes(2);
  });
});