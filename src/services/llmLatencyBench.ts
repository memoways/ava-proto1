/**
 * Conversational latency, lot 2 — LLM bench (measure only).
 *
 * Pure part of `npm run eval:llm-latency`: candidate catalogue, request
 * bodies, the timed reading of an OpenAI-compatible SSE stream (first token,
 * first safe sentence through the real `ResponseIntentParser`, end, usage,
 * cached tokens, cost), median/p90 summaries, prefix stability of the compiled
 * prompts and the Markdown report. Network and clock are injected so the
 * measures are tested on simulated streams. No Ava setting is read or written
 * here. See docs/plan_latence_conversationnelle_llm_tts.md, "Lot 2".
 */

export type BenchMessage = { role: "system" | "user" | "assistant"; content: string };

/** `proxy`: Ava's `proxy-llm` (OpenRouter). `direct`: provider API, only to measure OpenRouter's overhead. */
export type BenchTransport = "proxy" | "direct";

export interface DirectEndpoint {
  url: string;
  /** Environment variable holding the provider key (never versioned, never printed). */
  keyEnv: string;
  model: string;
  /** Extra body fields of that provider (reasoning switch). */
  extraBody?: Record<string, unknown>;
}

export interface BenchCandidate {
  id: string;
  label: string;
  /** OpenRouter model id (also the price reference of a direct call). */
  model: string;
  transport: BenchTransport;
  /** OpenRouter provider preference, sent through proxy-llm (`provider`). */
  provider?: { sort?: "latency" | "throughput" | "price"; only?: string[]; order?: string[]; allow_fallbacks?: boolean };
  /** proxy-llm `disable_reasoning` (Gemini 2.5 Flash / Flash-Lite only). */
  disableReasoning?: boolean;
  /** proxy-llm `reasoning_effort` (gpt-oss: reasoning cannot be turned off, only lowered). */
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  direct?: DirectEndpoint;
  /** Public OpenRouter price, USD per million tokens (26 Nov. 2026), for the estimate and direct calls. */
  price: { input: number; output: number; cachedInput?: number };
  note?: string;
}

const M = 1e6;

/**
 * Candidates checked on the OpenRouter catalogue on 26 November 2026
 * (`/api/v1/models` and `/endpoints`). Llama 4 is no longer served by Cerebras
 * nor Groq on OpenRouter (Scout: DeepInfra only, Maverick: Parasail only).
 */
export const BENCH_CANDIDATES: BenchCandidate[] = [
  { id: "luna", label: "gpt-5.6-luna (référence)", model: "openai/gpt-5.6-luna", transport: "proxy",
    price: { input: 0.2, output: 1.2, cachedInput: 0.02 } },
  { id: "luna-latency", label: "gpt-5.6-luna · provider.sort latency", model: "openai/gpt-5.6-luna", transport: "proxy",
    provider: { sort: "latency" }, price: { input: 0.2, output: 1.2, cachedInput: 0.02 } },
  { id: "gemini-25-flash", label: "Gemini 2.5 Flash · sans raisonnement", model: "google/gemini-2.5-flash", transport: "proxy",
    disableReasoning: true, price: { input: 0.3, output: 2.5, cachedInput: 0.03 } },
  { id: "gemini-25-flash-lite", label: "Gemini 2.5 Flash-Lite · sans raisonnement", model: "google/gemini-2.5-flash-lite", transport: "proxy",
    disableReasoning: true, price: { input: 0.1, output: 0.4, cachedInput: 0.01 } },
  { id: "gemini-35-flash-lite", label: "Gemini 3.5 Flash-Lite (raisonnement par défaut)", model: "google/gemini-3.5-flash-lite", transport: "proxy",
    price: { input: 0.3, output: 2.5, cachedInput: 0.03 }, note: "proxy-llm ne coupe pas la réflexion des Gemini 3.x" },
  { id: "oss-cerebras", reasoningEffort: "low", label: "gpt-oss-120b · Cerebras", model: "openai/gpt-oss-120b", transport: "proxy",
    provider: { only: ["cerebras"], allow_fallbacks: false }, price: { input: 0.05, output: 0.25, cachedInput: 0.05 } },
  { id: "oss-groq", reasoningEffort: "low", label: "gpt-oss-120b · Groq", model: "openai/gpt-oss-120b", transport: "proxy",
    provider: { only: ["groq"], allow_fallbacks: false }, price: { input: 0.05, output: 0.25, cachedInput: 0.05 } },
  { id: "llama4-scout", label: "Llama 4 Scout (DeepInfra)", model: "meta-llama/llama-4-scout", transport: "proxy",
    price: { input: 0.1, output: 0.3 }, note: "plus servi par Cerebras ni Groq sur OpenRouter" },
  { id: "llama4-maverick", label: "Llama 4 Maverick (Parasail)", model: "meta-llama/llama-4-maverick", transport: "proxy",
    price: { input: 0.35, output: 1, cachedInput: 0.17 }, note: "plus servi par Cerebras ni Groq sur OpenRouter" },
  { id: "haiku-55", label: "Claude Haiku 5.5", model: "anthropic/claude-haiku-5.5", transport: "proxy",
    price: { input: 0.1, output: 0.5, cachedInput: 0.01 } },
  { id: "gpt5-mini", label: "GPT-5 mini (raisonnement minimal)", model: "openai/gpt-5-mini", transport: "proxy",
    price: { input: 0.25, output: 2, cachedInput: 0.025 } },
  { id: "gpt54-mini", label: "GPT-5.4 mini (raisonnement minimal)", model: "openai/gpt-5.4-mini", transport: "proxy",
    price: { input: 0.75, output: 4.5, cachedInput: 0.075 } },
  { id: "mistral-small", label: "Mistral Small 2603", model: "mistralai/mistral-small-2603", transport: "proxy",
    price: { input: 0.15, output: 0.6, cachedInput: 0.015 } },
  { id: "mistral-medium", label: "Mistral Medium 3.5", model: "mistralai/mistral-medium-3-5", transport: "proxy",
    price: { input: 1.5, output: 7.5 } },
  // Outside OpenRouter: overhead measure only, never an integration (keys in .env.eval.local).
  { id: "direct-cerebras-oss", label: "gpt-oss-120b · Cerebras en direct", model: "openai/gpt-oss-120b", transport: "direct",
    direct: { url: "https://api.cerebras.ai/v1/chat/completions", keyEnv: "CEREBRAS_API_KEY", model: "gpt-oss-120b",
      extraBody: { reasoning_effort: "low" } },
    price: { input: 0.05, output: 0.25 } },
  { id: "direct-groq-oss", label: "gpt-oss-120b · Groq en direct", model: "openai/gpt-oss-120b", transport: "direct",
    direct: { url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY", model: "openai/gpt-oss-120b",
      extraBody: { reasoning_effort: "low" } },
    price: { input: 0.05, output: 0.25 } },
  { id: "direct-gemini-25-flash", label: "Gemini 2.5 Flash · Google en direct", model: "google/gemini-2.5-flash", transport: "direct",
    direct: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", keyEnv: "GEMINI_API_KEY",
      model: "gemini-2.5-flash", extraBody: { reasoning_effort: "none" } },
    price: { input: 0.3, output: 2.5 } },
];

/** Candidates of the first run: everything reachable through proxy-llm. */
export const DEFAULT_BENCH_CANDIDATE_IDS = BENCH_CANDIDATES.filter((c) => c.transport === "proxy").map((c) => c.id);

export function selectBenchCandidates(ids: string[] | null): { candidates: BenchCandidate[]; unknown: string[] } {
  const wanted = ids?.length ? ids : DEFAULT_BENCH_CANDIDATE_IDS;
  const unknown = wanted.filter((id) => !BENCH_CANDIDATES.some((c) => c.id === id));
  return { candidates: BENCH_CANDIDATES.filter((c) => wanted.includes(c.id)), unknown };
}

export interface BenchSampling {
  temperature?: number;
  top_p?: number;
  max_tokens: number;
}

/** Body sent to proxy-llm, the same shape as `streamLLM` plus the bench-only `provider`. */
export function buildProxyBenchBody(messages: BenchMessage[], candidate: BenchCandidate, sampling: BenchSampling, timeoutMs: number) {
  return {
    messages,
    stream: true,
    model: candidate.model,
    ...(sampling.temperature !== undefined ? { temperature: sampling.temperature } : {}),
    ...(sampling.top_p !== undefined ? { top_p: sampling.top_p } : {}),
    max_tokens: sampling.max_tokens,
    timeout_ms: timeoutMs,
    reasoning: false,
    ...(candidate.disableReasoning ? { disable_reasoning: true } : {}),
    ...(candidate.reasoningEffort ? { reasoning_effort: candidate.reasoningEffort } : {}),
    ...(candidate.provider ? { provider: candidate.provider } : {}),
  };
}

/** Direct provider request; null when its key is absent (the candidate is then skipped, never guessed). */
export function buildDirectBenchRequest(
  messages: BenchMessage[],
  candidate: BenchCandidate,
  sampling: BenchSampling,
  env: Record<string, string | undefined>,
): { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null {
  const direct = candidate.direct;
  const key = direct ? env[direct.keyEnv]?.trim() : undefined;
  if (!direct || !key) return null;
  return {
    url: direct.url,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: {
      model: direct.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: sampling.max_tokens,
      ...(sampling.temperature !== undefined ? { temperature: sampling.temperature } : {}),
      ...(sampling.top_p !== undefined ? { top_p: sampling.top_p } : {}),
      ...direct.extraBody,
    },
  };
}

// ------------------------------------------------------------ stream reading

/** Incremental SSE reader: `data:` lines joined per event, `[DONE]` kept as a marker. */
export class SseEventReader {
  private buffer = "";
  private data: string[] = [];
  push(chunk: string): Array<Record<string, unknown> | "done"> {
    this.buffer += chunk;
    const out: Array<Record<string, unknown> | "done"> = [];
    let index: number;
    while ((index = this.buffer.indexOf("\n")) >= 0) {
      this.line(this.buffer.slice(0, index), out);
      this.buffer = this.buffer.slice(index + 1);
    }
    return out;
  }
  end(): Array<Record<string, unknown> | "done"> {
    const out: Array<Record<string, unknown> | "done"> = [];
    if (this.buffer) this.line(this.buffer, out);
    this.buffer = "";
    this.flush(out);
    return out;
  }
  private line(raw: string, out: Array<Record<string, unknown> | "done">) {
    const value = raw.replace(/\r$/, "");
    if (!value) this.flush(out);
    else if (value.startsWith("data:")) this.data.push(value.slice(5).replace(/^ /, ""));
  }
  private flush(out: Array<Record<string, unknown> | "done">) {
    if (!this.data.length) return;
    const payload = this.data.join("\n");
    this.data = [];
    if (payload.trim() === "[DONE]") { out.push("done"); return; }
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (parsed && typeof parsed === "object") out.push(parsed as Record<string, unknown>);
    } catch {
      // A malformed event is not content; the stream is judged on what it completes.
    }
  }
}

export interface StreamUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  cachedTokens: number | null;
  reasoningTokens: number | null;
  /** OpenRouter `usage.cost` (USD) when the provider returns it. */
  costUsd: number | null;
}

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Reads OpenAI-compatible usage, OpenRouter's `cost` and the cached-token field. */
export function readStreamUsage(value: unknown): StreamUsage | null {
  if (!value || typeof value !== "object") return null;
  const usage = value as Record<string, unknown>;
  const promptDetails = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  const completionDetails = usage.completion_tokens_details as Record<string, unknown> | undefined;
  return {
    promptTokens: num(usage.prompt_tokens),
    completionTokens: num(usage.completion_tokens),
    cachedTokens: num(promptDetails?.cached_tokens) ?? num(usage.cache_read_input_tokens),
    reasoningTokens: num(completionDetails?.reasoning_tokens),
    costUsd: num(usage.cost),
  };
}

/** Minimal surface of `ResponseIntentParser` the bench needs (injected so tests can use the real one). */
export interface SpeechParser {
  push(chunk: string): void;
  finish(normalCompletion?: boolean): string;
  readonly intent: unknown;
}

export interface BenchCallMetrics {
  ok: boolean;
  error: string | null;
  /** All times are milliseconds since the request was sent. */
  headersMs: number | null;
  firstTokenMs: number | null;
  /** First sentence the parser would hand to the voice (`onSegment`). */
  firstSentenceMs: number | null;
  totalMs: number | null;
  /** Private header parsed and the speech finished without a parser error. */
  intentValid: boolean;
  /** Parser error, if any (header missing or malformed, structured data in speech…). */
  parserError: string | null;
  finishReason: string | null;
  speech: string;
  /** Provider OpenRouter reports in the stream (`provider`), or the direct provider. */
  provider: string | null;
  resolvedModel: string | null;
  usage: StreamUsage | null;
}

export async function measureLlmStream(input: {
  body: ReadableStream<Uint8Array>;
  startedAt: number;
  headersAt: number;
  now: () => number;
  createParser: (onSegment: () => void) => SpeechParser;
  /** Stop waiting for the next chunk after this long (the call is then an error). */
  chunkTimeoutMs?: number;
}): Promise<BenchCallMetrics> {
  const { startedAt, now } = input;
  const metrics: BenchCallMetrics = {
    ok: false, error: null, headersMs: Math.round(input.headersAt - startedAt), firstTokenMs: null, firstSentenceMs: null,
    totalMs: null, intentValid: false, parserError: null, finishReason: null, speech: "", provider: null, resolvedModel: null, usage: null,
  };
  const parser = input.createParser(() => {
    if (metrics.firstSentenceMs === null) metrics.firstSentenceMs = Math.round(now() - startedAt);
  });
  const reader = input.body.getReader();
  const decoder = new TextDecoder();
  const sse = new SseEventReader();
  let done = false;
  let raw = "";
  const handle = (event: Record<string, unknown> | "done") => {
    if (event === "done") { done = true; return; }
    if (event.error) {
      const error = event.error as { message?: unknown };
      throw new Error(`SSE error: ${typeof error.message === "string" ? error.message : "upstream failure"}`);
    }
    if (typeof event.provider === "string") metrics.provider = event.provider;
    if (typeof event.model === "string") metrics.resolvedModel = event.model;
    const usage = readStreamUsage(event.usage);
    if (usage) metrics.usage = usage;
    const choice = (event.choices as Array<Record<string, unknown>> | undefined)?.[0];
    if (typeof choice?.finish_reason === "string") metrics.finishReason = choice.finish_reason;
    const delta = choice?.delta as { content?: unknown } | undefined;
    const content = typeof delta?.content === "string" ? delta.content : "";
    if (!content) return;
    if (metrics.firstTokenMs === null) metrics.firstTokenMs = Math.round(now() - startedAt);
    raw += content;
    if (metrics.parserError) return;
    try { parser.push(content); } catch (error) { metrics.parserError = error instanceof Error ? error.message : String(error); }
  };
  try {
    while (!done) {
      const read = reader.read();
      const chunk = input.chunkTimeoutMs
        ? await Promise.race([read, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("chunk timeout")), input.chunkTimeoutMs))])
        : await read;
      if (chunk.done) {
        for (const event of sse.end()) handle(event);
        break;
      }
      for (const event of sse.push(decoder.decode(chunk.value, { stream: true }))) handle(event);
    }
    metrics.totalMs = Math.round(now() - startedAt);
    if (!raw.trim()) throw new Error("réponse vide");
    if (!metrics.parserError) {
      try {
        metrics.speech = parser.finish(metrics.finishReason === "stop");
        metrics.intentValid = Boolean(parser.intent);
      } catch (error) {
        metrics.parserError = error instanceof Error ? error.message : String(error);
      }
    }
    if (!metrics.speech) metrics.speech = raw.slice(raw.indexOf("<speech>") >= 0 ? raw.indexOf("<speech>") + 8 : 0).trim();
    metrics.ok = done || metrics.finishReason !== null;
    if (!metrics.ok) metrics.error = "flux terminé sans [DONE] ni finish_reason";
  } catch (error) {
    metrics.error = error instanceof Error ? error.message : String(error);
    if (metrics.totalMs === null) metrics.totalMs = Math.round(now() - startedAt);
  } finally {
    await reader.cancel().catch(() => {});
  }
  return metrics;
}

// -------------------------------------------------------------- statistics

/** Linear-interpolation percentile (p in [0, 1]); null on an empty list. */
export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const rank = Math.min(Math.max(p, 0), 1) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

export const median = (values: number[]) => percentile(values, 0.5);

export interface BenchCallRecord {
  candidateId: string;
  promptId: string;
  character: string;
  repeat: number;
  /** Warm-up calls are kept in the raw file but left out of every summary. */
  warmup?: boolean;
  metrics: BenchCallMetrics;
  /** Cost actually billed (OpenRouter `usage.cost`) or estimated from the public price. */
  costUsd: number | null;
  costEstimated: boolean;
}

export interface BenchSummary {
  candidateId: string;
  label: string;
  calls: number;
  errors: number;
  firstToken: { median: number | null; p90: number | null };
  firstSentence: { median: number | null; p90: number | null };
  total: { median: number | null; p90: number | null };
  intentValidRate: number | null;
  /** Cached / prompt tokens, first repeat only (another question of the same character just before: realistic reuse). */
  cacheRateFirstRepeat: number | null;
  /** Cached / prompt tokens on repeats 2+ (the very same prompt again: upper bound). */
  cacheRateRepeats: number | null;
  meanPromptTokens: number | null;
  meanCompletionTokens: number | null;
  meanReasoningTokens: number | null;
  meanCostUsd: number | null;
  costEstimated: boolean;
  providers: string[];
  /** A pinned provider (`only`) that does not match the reported one: routing not applied. */
  routingMismatch: boolean;
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const round = (value: number | null, digits = 0) => (value === null ? null : Number(value.toFixed(digits)));

function cacheRate(records: BenchCallRecord[]): number | null {
  let cached = 0;
  let prompt = 0;
  for (const record of records) {
    const usage = record.metrics.usage;
    if (usage?.promptTokens == null || usage.cachedTokens == null) continue;
    cached += usage.cachedTokens;
    prompt += usage.promptTokens;
  }
  return prompt > 0 ? round(cached / prompt, 3) : null;
}

export function summarizeCandidate(candidate: BenchCandidate, all: BenchCallRecord[]): BenchSummary {
  const records = all.filter((r) => r.candidateId === candidate.id && !r.warmup);
  const ok = records.filter((r) => r.metrics.ok);
  const pick = (key: "firstTokenMs" | "firstSentenceMs" | "totalMs") =>
    ok.map((r) => r.metrics[key]).filter((v): v is number => typeof v === "number");
  const stats = (values: number[]) => ({ median: round(median(values)), p90: round(percentile(values, 0.9)) });
  const usageOf = (key: keyof StreamUsage) =>
    ok.map((r) => r.metrics.usage?.[key]).filter((v): v is number => typeof v === "number");
  const costs = ok.map((r) => r.costUsd).filter((v): v is number => typeof v === "number");
  // Every call that reached a provider counts: a pinned provider that answered with errors only still shows the routing.
  const providers = [...new Set(records.map((r) => r.metrics.provider).filter((p): p is string => Boolean(p)))];
  const pinned = candidate.provider?.only?.map((p) => p.toLowerCase()) ?? [];
  return {
    candidateId: candidate.id,
    label: candidate.label,
    calls: records.length,
    errors: records.length - ok.length,
    firstToken: stats(pick("firstTokenMs")),
    firstSentence: stats(pick("firstSentenceMs")),
    total: stats(pick("totalMs")),
    intentValidRate: ok.length ? round(ok.filter((r) => r.metrics.intentValid).length / ok.length, 3) : null,
    cacheRateFirstRepeat: cacheRate(ok.filter((r) => r.repeat === 1)),
    cacheRateRepeats: cacheRate(ok.filter((r) => r.repeat > 1)),
    meanPromptTokens: round(avg(usageOf("promptTokens"))),
    meanCompletionTokens: round(avg(usageOf("completionTokens"))),
    meanReasoningTokens: round(avg(usageOf("reasoningTokens"))),
    meanCostUsd: round(avg(costs), 6),
    costEstimated: ok.some((r) => r.costEstimated),
    providers,
    routingMismatch: pinned.length > 0 && providers.some((p) => !pinned.some((slug) => p.toLowerCase().includes(slug))),
  };
}

// -------------------------------------------------------------------- cost

/** Price of one call from the public price (cached input billed at its own rate when known). */
export function estimateCallCostUsd(price: BenchCandidate["price"], promptTokens: number, completionTokens: number, cachedTokens = 0): number {
  const cached = Math.min(cachedTokens, promptTokens);
  const cachedRate = price.cachedInput ?? price.input;
  return ((promptTokens - cached) * price.input + cached * cachedRate + completionTokens * price.output) / M;
}

/** Upper estimate of a run before it starts (no cache, reasoning ignored). */
export function estimateBenchRunUsd(input: {
  candidates: BenchCandidate[];
  prompts: number;
  repeats: number;
  warmup: number;
  promptTokens: number;
  completionTokens: number;
}): number {
  const calls = input.prompts * input.repeats + input.warmup;
  const total = input.candidates.reduce((sum, candidate) =>
    sum + calls * estimateCallCostUsd(candidate.price, input.promptTokens, input.completionTokens), 0);
  return Number(total.toFixed(4));
}

/** French characters per token observed on Ava's prompts (2.8 k tokens ≈ 10 k characters). */
export const CHARS_PER_TOKEN = 3.6;

export function approxTokens(messages: BenchMessage[]): number {
  return Math.round(messages.reduce((sum, m) => sum + m.content.length, 0) / CHARS_PER_TOKEN);
}

// --------------------------------------------------------- prefix stability

export interface CompiledBenchPrompt {
  id: string;
  character: string;
  question: string;
  messages: BenchMessage[];
  sampling: BenchSampling;
}

export function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a.charCodeAt(index) === b.charCodeAt(index)) index += 1;
  return index;
}

/** Last Markdown heading (or bracketed section marker) that starts before `offset`. */
export function sectionAt(text: string, offset: number): string {
  // A difference inside a heading line (a section present for one question only) names that heading.
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = text.indexOf("\n", offset);
  const current = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).trim();
  if (/^#{1,4}\s/.test(current)) return current.slice(0, 80);
  const before = text.slice(0, offset);
  const lines = before.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (/^#{1,4}\s/.test(line) || /^\[[^\]]{2,60}\]$/.test(line)) return line.slice(0, 80);
  }
  return "(avant toute section)";
}

export interface PrefixStability {
  character: string;
  prompts: number;
  /** Shortest/median common prefix of the system prompts between two questions, in characters. */
  minCommonChars: number;
  medianCommonChars: number;
  medianSystemChars: number;
  /** Where the prompts first differ, with how often (several questions). */
  divergenceSections: Array<{ section: string; count: number }>;
  /** Length of the shared tail (stream contract) after the last difference, in characters. */
  sharedSuffixChars: number;
}

export function analyzePrefixStability(prompts: CompiledBenchPrompt[]): PrefixStability[] {
  const byCharacter = new Map<string, CompiledBenchPrompt[]>();
  for (const prompt of prompts) byCharacter.set(prompt.character, [...(byCharacter.get(prompt.character) ?? []), prompt]);
  const out: PrefixStability[] = [];
  for (const [character, list] of byCharacter) {
    const systems = list.map((p) => p.messages[0]?.content ?? "");
    const common: number[] = [];
    const sections = new Map<string, number>();
    let suffix = Infinity;
    for (let i = 0; i < systems.length; i += 1) {
      for (let j = i + 1; j < systems.length; j += 1) {
        const length = commonPrefixLength(systems[i], systems[j]);
        common.push(length);
        if (length < Math.min(systems[i].length, systems[j].length)) {
          const section = sectionAt(systems[i], length);
          sections.set(section, (sections.get(section) ?? 0) + 1);
        }
        const reversed = commonPrefixLength([...systems[i]].reverse().join(""), [...systems[j]].reverse().join(""));
        suffix = Math.min(suffix, reversed);
      }
    }
    out.push({
      character,
      prompts: list.length,
      minCommonChars: common.length ? Math.min(...common) : systems[0]?.length ?? 0,
      medianCommonChars: Math.round(median(common) ?? systems[0]?.length ?? 0),
      medianSystemChars: Math.round(median(systems.map((s) => s.length)) ?? 0),
      divergenceSections: [...sections.entries()].map(([section, count]) => ({ section, count })).sort((a, b) => b.count - a.count),
      sharedSuffixChars: Number.isFinite(suffix) ? suffix : 0,
    });
  }
  return out;
}

// ------------------------------------------------------------------ report

const ms = (value: number | null) => (value === null ? "–" : `${(value / 1000).toFixed(2)} s`);
const pct = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)} %`);
const usd = (value: number | null, estimated: boolean) => (value === null ? "–" : `${value.toFixed(5)} $${estimated ? " (est.)" : ""}`);

export function formatBenchReport(input: {
  date: string;
  environment: string;
  repeats: number;
  prompts: CompiledBenchPrompt[];
  summaries: BenchSummary[];
  stability: PrefixStability[];
  skipped: string[];
}): string {
  const rows = [...input.summaries].sort((a, b) => (a.firstSentence.median ?? Infinity) - (b.firstSentence.median ?? Infinity));
  const lines = [
    `# Banc LLM latence — ${input.date}`,
    "",
    `Environnement ${input.environment} · ${input.prompts.length} prompts réels (\`optimized_v3\`, tour 1) × ${input.repeats} répétitions par modèle · flux via \`proxy-llm\` sauf mention « en direct ».`,
    "Temps depuis l'envoi de la requête (sans RAG). Classement par première phrase sûre (médiane).",
    "",
    "| Candidat | n | erreurs | 1er token méd. / p90 | 1re phrase sûre méd. / p90 | fin méd. / p90 | intent valide | cache (rép. 1 / suivantes) | tokens in / out / raison. | coût moyen | fournisseur |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((s) => `| ${s.label}${s.routingMismatch ? " ⚠ routage non appliqué" : ""} | ${s.calls} | ${s.errors} | ${ms(s.firstToken.median)} / ${ms(s.firstToken.p90)} | ${ms(s.firstSentence.median)} / ${ms(s.firstSentence.p90)} | ${ms(s.total.median)} / ${ms(s.total.p90)} | ${pct(s.intentValidRate)} | ${pct(s.cacheRateFirstRepeat)} / ${pct(s.cacheRateRepeats)} | ${s.meanPromptTokens ?? "–"} / ${s.meanCompletionTokens ?? "–"} / ${s.meanReasoningTokens ?? "–"} | ${usd(s.meanCostUsd, s.costEstimated)} | ${s.providers.join(", ") || "–"} |`),
    "",
    "## Stabilité du préfixe (prompts système, entre deux questions du même personnage)",
    "",
    "| Personnage | prompts | préfixe commun min / méd. | longueur méd. | fin commune | première différence |",
    "|---|---|---|---|---|---|",
    ...input.stability.map((s) => `| ${s.character} | ${s.prompts} | ${s.minCommonChars} / ${s.medianCommonChars} car. | ${s.medianSystemChars} car. | ${s.sharedSuffixChars} car. | ${s.divergenceSections.slice(0, 3).map((d) => `${d.section} (${d.count})`).join(" ; ") || "aucune"} |`),
  ];
  if (input.skipped.length) lines.push("", "## Candidats non mesurés", "", ...input.skipped.map((s) => `- ${s}`));
  return `${lines.join("\n")}\n`;
}
