/**
 * Debug Logger — captures all outgoing API calls for the debug panel.
 * Activated when ?debug is in the URL.
 */

export type DebugLogLevel = "info" | "warn" | "error" | "success";
export type DebugService = "llm" | "tts" | "stt" | "rag" | "notion" | "session" | "gm" | "other";

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  service: DebugService;
  level: DebugLogLevel;
  direction: "out" | "in";
  label: string;
  detail?: string;
  durationMs?: number;
  /** Truncated body/response for inspection */
  payload?: string;
}

type Listener = () => void;

class DebugLoggerClass {
  private entries: DebugLogEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private _enabled = false;
  private idCounter = 0;

  get enabled() { return this._enabled; }

  /** Call once at app startup based on URL */
  init() {
    this._enabled = window.location.search.includes("debug");
    if (this._enabled) {
      console.log("%c[DebugLogger] Enabled — debug panel active", "color: #0f0; font-weight: bold");
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  log(entry: Omit<DebugLogEntry, "id" | "timestamp">): string {
    if (!this._enabled) return "";
    const id = `dbg_${++this.idCounter}`;
    const full: DebugLogEntry = { ...entry, id, timestamp: Date.now() };
    this.entries.push(full);
    // Keep max 500 entries
    if (this.entries.length > 500) this.entries.splice(0, this.entries.length - 500);
    this.notify();
    return id;
  }

  /** Update an existing entry (e.g. add duration after response) */
  update(id: string, patch: Partial<DebugLogEntry>) {
    if (!this._enabled) return;
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      Object.assign(entry, patch);
      this.notify();
    }
  }

  getEntries(): DebugLogEntry[] {
    return this.entries;
  }

  clear() {
    this.entries = [];
    this.notify();
  }

  /** Helper for outgoing fetch calls */
  logFetch(service: DebugService, label: string, url: string, body?: any): string {
    let payload: string | undefined;
    if (body) {
      try {
        const str = typeof body === "string" ? body : JSON.stringify(body);
        payload = str.length > 2000 ? str.slice(0, 2000) + "…" : str;
      } catch { payload = "[non-serializable]"; }
    }
    return this.log({
      service,
      level: "info",
      direction: "out",
      label,
      detail: url,
      payload,
    });
  }

  /** Helper for responses */
  logResponse(id: string, service: DebugService, label: string, status: number, startTime: number, body?: string) {
    const level: DebugLogLevel = status >= 400 ? "error" : status >= 300 ? "warn" : "success";
    const durationMs = Date.now() - startTime;
    let payload: string | undefined;
    if (body) {
      payload = body.length > 2000 ? body.slice(0, 2000) + "…" : body;
    }
    if (id) {
      this.update(id, { level, durationMs, payload: payload || undefined });
    }
    this.log({
      service,
      level,
      direction: "in",
      label: `${label} → ${status}`,
      durationMs,
      payload,
    });
  }

  logError(service: DebugService, label: string, error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    this.log({
      service,
      level: "error",
      direction: "in",
      label,
      detail: msg,
      payload: error instanceof Error ? error.stack : undefined,
    });
  }
}

export const debugLogger = new DebugLoggerClass();
