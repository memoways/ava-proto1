/** Isolated process clock; these offsets must never be subtracted from client offsets. */
export function createMonotonicSpans(requestId: string = crypto.randomUUID(), clock: "edge_monotonic" | "client_monotonic" = "edge_monotonic") {
  const origin = performance.now();
  const spans: Array<{ name: string; start_ms: number; end_ms: number; status: "ok" | "failed" }> = [];
  return {
    async run<T>(name: string, fn: () => PromiseLike<T>): Promise<T> {
      const start = performance.now();
      let status: "ok" | "failed" = "ok";
      try { return await fn(); } catch (error) { status = "failed"; throw error; }
      finally { if (spans.length < 32) spans.push({ name, start_ms: Math.round(start - origin), end_ms: Math.round(performance.now() - origin), status }); }
    },
    runSync<T>(name: string, fn: () => T): T {
      const start = performance.now();
      let status: "ok" | "failed" = "ok";
      try { return fn(); } catch (error) { status = "failed"; throw error; }
      finally { if (spans.length < 32) spans.push({ name, start_ms: Math.round(start - origin), end_ms: Math.round(performance.now() - origin), status }); }
    },
    snapshot() { return { request_id: requestId, clock, spans: [...spans] }; },
  };
}
