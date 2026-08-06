import { supabase } from "@/integrations/supabase/client";
import { conversationTracePayloadBytes } from "@/services/conversationTraceFormat";
import { patchConversationTurnTrace, persistConversationTurnTrace } from "@/services/conversationTraceService";
import { trackEvent } from "@/services/posthogService";
import type { ConversationTurnTraceV2 } from "@/types";
import { getCachedSession } from "@/services/gameAuth";

const DATABASE_NAME = "ava-diagnostic-traces";
const STORE_NAME = "trace-outbox";
const DATABASE_VERSION = 1;
const LOCAL_ENQUEUE_BUDGET_MS = 100;

export type ConversationTraceOutboxStatus = "pending" | "syncing" | "uploaded" | "error";

export interface ConversationTracePatch {
  path: string[];
  value: unknown;
}

export interface ConversationTraceOutboxRecord {
  key: string;
  ownerUserId: string;
  sessionId: string;
  turnIndex: number;
  trace: ConversationTurnTraceV2;
  status: ConversationTraceOutboxStatus;
  remoteId: string | null;
  pendingPatches: ConversationTracePatch[];
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  payloadBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface TraceOutboxStorage {
  get(key: string): Promise<ConversationTraceOutboxRecord | null>;
  getAll(): Promise<ConversationTraceOutboxRecord[]>;
  put(record: ConversationTraceOutboxRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryTraceOutboxStorage implements TraceOutboxStorage {
  private readonly records = new Map<string, ConversationTraceOutboxRecord>();

  async get(key: string) { return this.records.get(key) ?? null; }
  async getAll() { return [...this.records.values()]; }
  async put(record: ConversationTraceOutboxRecord) { this.records.set(record.key, structuredClone(record)); }
  async delete(key: string) { this.records.delete(key); }
}

export class IndexedDbTraceOutboxStorage implements TraceOutboxStorage {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly databaseName = DATABASE_NAME) {}

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    });
    return this.databasePromise;
  }

  private async request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = run(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    });
  }

  async get(key: string) { return (await this.request("readonly", (store) => store.get(key))) ?? null; }
  async getAll() { return this.request("readonly", (store) => store.getAll()); }
  async put(record: ConversationTraceOutboxRecord) { await this.request("readwrite", (store) => store.put(record)); }
  async delete(key: string) { await this.request("readwrite", (store) => store.delete(key)); }
}

type OutboxListener = () => void;

class ConversationTraceOutbox {
  private storage: TraceOutboxStorage;
  private readonly memoryFallback = new MemoryTraceOutboxStorage();
  private storageIsDurable: boolean;
  private readonly listeners = new Set<OutboxListener>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly knownKeys = new Set<string>();
  private ownerUserId = "";
  private paused = false;
  private activeController: AbortController | null = null;
  private flushTimer: number | null = null;
  private onlineListenerInstalled = false;

  constructor(storage?: TraceOutboxStorage) {
    this.storage = storage ?? (typeof indexedDB === "undefined"
      ? this.memoryFallback
      : new IndexedDbTraceOutboxStorage());
    this.storageIsDurable = this.storage !== this.memoryFallback && !(this.storage instanceof MemoryTraceOutboxStorage);
  }

  async prewarm(): Promise<void> {
    const cachedAuthSession = await getCachedSession();
    this.ownerUserId = cachedAuthSession?.user.id ?? "";
    try {
      const records = await this.storage.getAll();
      this.knownKeys.clear();
      records.forEach((record) => this.knownKeys.add(record.key));
    } catch (error) {
      console.warn("[Trace Outbox] IndexedDB unavailable, using memory fallback", error);
      this.storage = this.memoryFallback;
      this.storageIsDurable = false;
    }
    if (!this.onlineListenerInstalled && typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      this.onlineListenerInstalled = true;
    }
    this.scheduleFlush(1_000);
  }

  private readonly handleOnline = () => {
    // Reconnection must never override an explicit voice-critical PTT pause.
    if (!this.paused) this.scheduleFlush(250);
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: OutboxListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private key(sessionId: string, turnIndex: number): string {
    return `${this.ownerUserId || "admin"}:${sessionId}:${turnIndex}`;
  }

  private async locked<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.locks.set(key, next);
    try {
      return await next;
    } finally {
      if (this.locks.get(key) === next) this.locks.delete(key);
    }
  }

  async enqueue(trace: ConversationTurnTraceV2): Promise<{ durable: boolean; enqueueMs: number }> {
    const startedAt = performance.now();
    const key = this.key(trace.identity.sessionId, trace.identity.turnIndex);
    const now = new Date().toISOString();
    this.knownKeys.add(key);
    const record: ConversationTraceOutboxRecord = {
      key,
      ownerUserId: this.ownerUserId,
      sessionId: trace.identity.sessionId,
      turnIndex: trace.identity.turnIndex,
      trace,
      status: "pending",
      remoteId: null,
      pendingPatches: [],
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
      payloadBytes: conversationTracePayloadBytes(trace),
      createdAt: now,
      updatedAt: now,
    };
    let durable = this.storageIsDurable;
    const write = this.locked(key, () => this.storage.put(record)).catch(async (error) => {
      durable = false;
      console.warn("[Trace Outbox] Durable enqueue failed, retaining in memory", error);
      this.storage = this.memoryFallback;
      this.storageIsDurable = false;
      await this.memoryFallback.put(record);
    });
    let budgetTimer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      write,
      new Promise<void>((resolve) => {
        budgetTimer = globalThis.setTimeout(() => {
          durable = false;
          resolve();
        }, LOCAL_ENQUEUE_BUDGET_MS);
      }),
    ]);
    if (budgetTimer !== undefined) globalThis.clearTimeout(budgetTimer);
    const enqueueMs = Math.round(performance.now() - startedAt);
    trace.timings.traceEnqueueMs = enqueueMs;
    trace.timings.traceWriteMs = enqueueMs;
    record.updatedAt = new Date().toISOString();
    record.payloadBytes = conversationTracePayloadBytes(trace);
    // The first durable copy is sufficient to release the voice path. Persist
    // the measured enqueue timings afterward without extending that path.
    void write.then(() => this.locked(key, () => this.storage.put(record))).catch(async () => {
      await this.memoryFallback.put(record);
    });
    trackEvent("diagnostic_trace_enqueued", {
      session_id: record.sessionId,
      turn_index: record.turnIndex,
      payload_bytes: record.payloadBytes,
      enqueue_ms: enqueueMs,
      durable,
      backlog: this.knownKeys.size,
    });
    this.emit();
    return { durable, enqueueMs };
  }

  async patch(sessionId: string, turnIndex: number, path: string[], value: unknown): Promise<void> {
    const key = this.key(sessionId, turnIndex);
    const handledLocally = await this.locked(key, async () => {
      const record = await this.storage.get(key) ?? await this.memoryFallback.get(key);
      if (!record) return false;
      setNestedValue(record.trace as unknown as Record<string, unknown>, path, value);
      record.updatedAt = new Date().toISOString();
      record.payloadBytes = conversationTracePayloadBytes(record.trace);
      if (record.status === "uploaded") record.pendingPatches.push({ path, value });
      else if (record.status === "error") record.status = "pending";
      await this.storage.put(record).catch(() => this.memoryFallback.put(record));
      return true;
    });
    if (!handledLocally) {
      await patchConversationTurnTrace(sessionId, turnIndex, path, value).catch((error) => {
        console.warn("[Trace Outbox] Remote patch deferred", error);
      });
    }
    this.emit();
    this.scheduleFlush(500);
  }

  pause(): void {
    this.paused = true;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.activeController?.abort("voice-critical-phase");
    this.activeController = null;
  }

  resume(flush = false): void {
    this.paused = false;
    if (flush) this.scheduleFlush(250);
  }

  scheduleFlush(delayMs = 0): void {
    if (this.paused || typeof window === "undefined") return;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      const run = () => void this.flush();
      if ("requestIdleCallback" in window) {
        (window as typeof window & { requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number })
          .requestIdleCallback(run, { timeout: 2_000 });
      } else run();
    }, delayMs);
  }

  async flush(force = false): Promise<void> {
    if (this.paused || this.activeController || (!force && typeof navigator !== "undefined" && !navigator.onLine)) return;
    const controller = new AbortController();
    this.activeController = controller;
    try {
      const records = (await this.storage.getAll()).filter((record) =>
        (!this.ownerUserId || record.ownerUserId === this.ownerUserId) &&
        (force || record.nextAttemptAt <= Date.now()),
      );
      for (const record of records) {
        if (this.paused || controller.signal.aborted) break;
        await this.locked(record.key, async () => {
          const latest = await this.storage.get(record.key);
          if (latest) await this.flushRecord(latest, controller.signal);
        });
      }
    } finally {
      if (this.activeController === controller) this.activeController = null;
      this.emit();
    }
  }

  private async flushRecord(record: ConversationTraceOutboxRecord, signal: AbortSignal): Promise<void> {
    record.status = "syncing";
    record.updatedAt = new Date().toISOString();
    await this.storage.put(record);
    this.emit();
    const startedAt = performance.now();
    trackEvent("diagnostic_trace_sync_attempt", {
      session_id: record.sessionId,
      turn_index: record.turnIndex,
      payload_bytes: record.payloadBytes,
      attempt: record.attempts + 1,
    });
    try {
      if (!record.remoteId) {
        const persisted = await persistConversationTurnTrace(record.trace, signal);
        record.remoteId = persisted.id;
        record.status = "uploaded";
        const uploadMs = Math.max(1, Math.round(performance.now() - startedAt));
        const uploadBps = Math.round((record.payloadBytes * 8 * 1000) / uploadMs);
        record.trace.timings.traceUploadMs = uploadMs;
        record.trace.timings.traceUploadBytes = record.payloadBytes;
        record.trace.timings.traceUploadBps = uploadBps;
        record.pendingPatches.push({ path: ["timings"], value: record.trace.timings });
        trackEvent("diagnostic_trace_sync_completed", {
          session_id: record.sessionId,
          turn_index: record.turnIndex,
          payload_bytes: record.payloadBytes,
          upload_ms: uploadMs,
          upload_bps: uploadBps,
          network_quality: classifyTraceUpload(uploadBps, uploadMs),
          backlog: this.knownKeys.size,
        });
      }
      for (const patch of record.pendingPatches) {
        await patchConversationTurnTrace(record.sessionId, record.turnIndex, patch.path, patch.value, signal);
      }
      record.pendingPatches = [];
      record.lastError = null;
      record.nextAttemptAt = 0;
      if (isTraceComplete(record.trace)) {
        await this.storage.delete(record.key);
        this.knownKeys.delete(record.key);
      }
      else await this.storage.put(record);
    } catch (error) {
      if (signal.aborted) {
        record.status = record.remoteId ? "uploaded" : "pending";
      } else {
        record.status = "error";
        record.attempts += 1;
        record.lastError = error instanceof Error ? error.message : String(error);
        record.nextAttemptAt = Date.now() + retryDelay(record.attempts);
        trackEvent("diagnostic_trace_sync_failed", {
          session_id: record.sessionId,
          turn_index: record.turnIndex,
          payload_bytes: record.payloadBytes,
          attempt: record.attempts,
          error: record.lastError.slice(0, 200),
          backlog: this.knownKeys.size,
        });
      }
      await this.storage.put(record);
    }
  }

  async list(sessionId?: string): Promise<ConversationTraceOutboxRecord[]> {
    const records = await this.storage.getAll();
    return records.filter((record) =>
      (!this.ownerUserId || record.ownerUserId === this.ownerUserId) &&
      (!sessionId || record.sessionId === sessionId),
    );
  }

  async retry(key: string): Promise<void> {
    const record = await this.storage.get(key);
    if (!record) return;
    record.status = record.remoteId ? "uploaded" : "pending";
    record.nextAttemptAt = 0;
    record.lastError = null;
    await this.storage.put(record);
    this.emit();
    await this.flush(true);
  }

  async discard(key: string): Promise<void> {
    await this.storage.delete(key);
    await this.memoryFallback.delete(key);
    this.knownKeys.delete(key);
    this.emit();
  }
}

function setNestedValue(target: Record<string, unknown>, path: string[], value: unknown): void {
  let cursor = target;
  path.forEach((part, index) => {
    if (index === path.length - 1) {
      cursor[part] = value;
      return;
    }
    const next = cursor[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  });
}

function isTraceComplete(trace: ConversationTurnTraceV2): boolean {
  const labelStatus = String((trace.gm.labelPass as { status?: string }).status ?? "pending");
  const postStatus = String((trace.gm.postTurn as { status?: string }).status ?? "pending");
  return labelStatus !== "pending" && postStatus !== "pending";
}

function retryDelay(attempt: number): number {
  return [5_000, 30_000, 120_000, 600_000][Math.min(Math.max(attempt - 1, 0), 3)];
}

export function classifyTraceUpload(uploadBps: number, uploadMs: number): "ok" | "degraded" | "critical" {
  if (uploadBps < 250_000 || uploadMs > 10_000) return "critical";
  if (uploadBps < 1_000_000 || uploadMs > 3_000) return "degraded";
  return "ok";
}

const outbox = new ConversationTraceOutbox();

export const prewarmConversationTraceOutbox = () => outbox.prewarm();
export const enqueueConversationTurnTrace = (trace: ConversationTurnTraceV2) => outbox.enqueue(trace);
export const patchQueuedConversationTurnTrace = (sessionId: string, turnIndex: number, path: string[], value: unknown) => outbox.patch(sessionId, turnIndex, path, value);
export const pauseConversationTraceSync = () => outbox.pause();
export const resumeConversationTraceSync = (flush = false) => outbox.resume(flush);
export const flushConversationTraceOutbox = (force = false) => outbox.flush(force);
export const listConversationTraceOutboxRecords = (sessionId?: string) => outbox.list(sessionId);
export const retryConversationTraceOutboxRecord = (key: string) => outbox.retry(key);
export const discardConversationTraceOutboxRecord = (key: string) => outbox.discard(key);
export const subscribeConversationTraceOutbox = (listener: OutboxListener) => outbox.subscribe(listener);

export { ConversationTraceOutbox };
