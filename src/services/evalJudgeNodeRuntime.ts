/**
 * Node runtime pieces of the headless judge. Deliberately free of app imports:
 * `scripts/eval-judge/run.ts` installs them before any module creates the
 * Supabase client or reads settings.
 */

export interface BlockedWrite {
  method: string;
  path: string;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * Wraps `fetch` so that any write to `admin_settings` (REST insert, upsert,
 * update or delete) is refused with a synthetic 403 and recorded. Evaluation
 * overrides live in memory only; this makes the rule mechanical in Node.
 */
export function guardAdminSettingsWrites(baseFetch: typeof fetch): { fetch: typeof fetch; blocked: BlockedWrite[] } {
  const blocked: BlockedWrite[] = [];
  const guarded: typeof fetch = async (input, init) => {
    const method = requestMethod(input, init);
    const url = requestUrl(input);
    if (method !== "GET" && method !== "HEAD" && /\/rest\/v1\/admin_settings(?:[/?]|$)/.test(url)) {
      const path = (() => {
        try { return new URL(url).pathname; } catch { return url; }
      })();
      blocked.push({ method, path });
      return new Response(
        JSON.stringify({ message: "admin_settings est en lecture seule pour le juge sans navigateur", code: "AVA_EVAL_READ_ONLY" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
    return baseFetch(input, init);
  };
  return { fetch: guarded, blocked };
}

/** Minimal in-memory Web Storage for Node (settings cache and auth session, never written to disk). */
export function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
  };
}

