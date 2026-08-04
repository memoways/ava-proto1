import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const remote = vi.hoisted(() => ({
  persist: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "admin-1" } } },
        error: null,
      }),
    },
  },
}));
vi.mock("@/services/conversationTraceService", () => ({
  persistConversationTurnTrace: remote.persist,
  patchConversationTurnTrace: remote.patch,
}));
vi.mock("@/services/posthogService", () => ({ trackEvent: vi.fn() }));

import { compactConversationTurnTrace } from "./conversationTraceFormat";
import {
  ConversationTraceOutbox,
  IndexedDbTraceOutboxStorage,
} from "./conversationTraceOutbox";
import { makeConversationTraceV1 } from "@/test/conversationTraceFixture";

let databaseIndex = 0;
const makeOutbox = (databaseName = `trace-outbox-test-${databaseIndex++}`) =>
  new ConversationTraceOutbox(new IndexedDbTraceOutboxStorage(databaseName));

describe("conversation trace IndexedDB outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remote.persist.mockResolvedValue({ id: "remote-trace-1", writeLatencyMs: 5 });
    remote.patch.mockResolvedValue(undefined);
  });

  it("persists a compact trace across a new outbox instance", async () => {
    const databaseName = `trace-outbox-reload-${databaseIndex++}`;
    const first = makeOutbox(databaseName);
    await first.prewarm();
    const result = await first.enqueue(compactConversationTurnTrace(makeConversationTraceV1()));

    const reloaded = makeOutbox(databaseName);
    await reloaded.prewarm();
    const records = await reloaded.list("session-trace");

    expect(result.durable).toBe(true);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ sessionId: "session-trace", turnIndex: 1, status: "pending" });
    expect(records[0].trace.timings.traceEnqueueMs).toEqual(expect.any(Number));
  });

  it("merges Labels and GM locally before the first remote upsert", async () => {
    const outbox = makeOutbox();
    await outbox.prewarm();
    await outbox.enqueue(compactConversationTurnTrace(makeConversationTraceV1()));
    await outbox.patch("session-trace", 1, ["gm", "labelPass"], { status: "complete", labels: ["ava"] });
    await outbox.patch("session-trace", 1, ["gm", "postTurn"], { status: "complete", guidance: "Continuer" });

    await outbox.flush(true);

    expect(remote.persist).toHaveBeenCalledOnce();
    expect(remote.persist.mock.calls[0][0].gm).toMatchObject({
      labelPass: { status: "complete", labels: ["ava"] },
      postTurn: { status: "complete", guidance: "Continuer" },
    });
    expect(await outbox.list()).toEqual([]);
    await outbox.flush(true);
    expect(remote.persist).toHaveBeenCalledOnce();
  });

  it("does not lose a GM patch that arrives while the remote upsert is in flight", async () => {
    const outbox = makeOutbox();
    await outbox.prewarm();
    await outbox.enqueue(compactConversationTurnTrace(makeConversationTraceV1()));
    let releaseUpload: (() => void) | null = null;
    remote.persist.mockImplementationOnce(() => new Promise((resolve) => {
      releaseUpload = () => resolve({ id: "remote-trace-1", writeLatencyMs: 5 });
    }));

    const flush = outbox.flush(true);
    await vi.waitFor(() => expect(remote.persist).toHaveBeenCalledOnce());
    const concurrentPatch = outbox.patch(
      "session-trace",
      1,
      ["gm", "labelPass"],
      { status: "complete", labels: ["concurrent"] },
    );
    releaseUpload?.();
    await Promise.all([flush, concurrentPatch]);

    const [record] = await outbox.list();
    expect(record.trace.gm.labelPass).toEqual({ status: "complete", labels: ["concurrent"] });
    expect(record.pendingPatches).toContainEqual({
      path: ["gm", "labelPass"],
      value: { status: "complete", labels: ["concurrent"] },
    });
  });

  it("pauses uploads during PTT and resumes without creating a duplicate", async () => {
    const outbox = makeOutbox();
    await outbox.prewarm();
    await outbox.enqueue(compactConversationTurnTrace(makeConversationTraceV1()));
    outbox.pause();

    await outbox.flush(true);
    expect(remote.persist).not.toHaveBeenCalled();

    outbox.resume();
    await outbox.flush(true);
    await outbox.flush(true);
    expect(remote.persist).toHaveBeenCalledOnce();
  });

  it("keeps failed uploads with backoff and supports an explicit retry", async () => {
    const outbox = makeOutbox();
    await outbox.prewarm();
    await outbox.enqueue(compactConversationTurnTrace(makeConversationTraceV1()));
    remote.persist.mockRejectedValueOnce(new Error("offline"));

    await outbox.flush(true);
    const [failed] = await outbox.list();
    expect(failed).toMatchObject({ status: "error", attempts: 1, lastError: "offline" });
    expect(failed.nextAttemptAt).toBeGreaterThan(Date.now());

    await outbox.flush(false);
    expect(remote.persist).toHaveBeenCalledOnce();
    await outbox.retry(failed.key);
    expect(remote.persist).toHaveBeenCalledTimes(2);
    expect((await outbox.list())[0]).toMatchObject({ status: "uploaded", attempts: 1, lastError: null });
  });
});
