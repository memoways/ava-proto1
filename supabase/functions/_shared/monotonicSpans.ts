function failedResult(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return Boolean(result.error) || result.ok === false || result.accepted === false;
}

/** Isolated process clock; these offsets must never be subtracted from client offsets. */
export function createMonotonicSpans(requestId: string = crypto.randomUUID(), clock: "edge_monotonic" | "client_monotonic" = "edge_monotonic") {
  const origin = performance.now();
  const spans: Array<{ name: string; start_ms: number; end_ms: number; status: "ok" | "failed" }> = [];
  return {
    async run<T>(name: string, fn: () => PromiseLike<T>, isFailure: (value: T) => boolean = failedResult): Promise<T> {
      const start = performance.now();
      let status: "ok" | "failed" = "ok";
      try { const value = await fn(); if (isFailure(value)) status = "failed"; return value; } catch (error) { status = "failed"; throw error; }
      finally { if (spans.length < 32) spans.push({ name, start_ms: Math.round(start - origin), end_ms: Math.round(performance.now() - origin), status }); }
    },
    runSync<T>(name: string, fn: () => T): T {
      const start = performance.now();
      let status: "ok" | "failed" = "ok";
      try { const value = fn(); if (failedResult(value)) status = "failed"; return value; } catch (error) { status = "failed"; throw error; }
      finally { if (spans.length < 32) spans.push({ name, start_ms: Math.round(start - origin), end_ms: Math.round(performance.now() - origin), status }); }
    },
    snapshot() { return { request_id: requestId, clock, spans: [...spans], ...(clock === "client_monotonic" ? { client_origin_at: origin } : {}) }; },
  };
}
