import { describe, expect, it } from "vitest";
import { ResponseIntentParser, SPEECH_BOUNDARY } from "./responseIntentStream";
import {
  BENCH_CANDIDATES,
  SseEventReader,
  analyzePrefixStability,
  buildDirectBenchRequest,
  buildProxyBenchBody,
  commonPrefixLength,
  estimateCallCostUsd,
  measureLlmStream,
  median,
  percentile,
  readStreamUsage,
  sectionAt,
  selectBenchCandidates,
  summarizeCandidate,
  type BenchCallRecord,
  type BenchCandidate,
  type CompiledBenchPrompt,
} from "./llmLatencyBench";

const context = { characterKey: "max" as const, displayName: "Max Lorenzo", characterId: "11111111-1111-4111-8111-111111111111", notionPageId: "30362322e5958011ad7bffb1ed6772bc", environmentId: "sandbox-ulrich", promptUpdatedAt: "2026-10-13T00:00:00Z" };
const header = JSON.stringify({ goal: "Raconter sans tout dire", points: ["Le chalet"] }) + SPEECH_BOUNDARY;

/** SSE stream whose chunks become readable at given clock times; `clock.t` follows the reads. */
function timedStream(chunks: Array<{ at: number; text: string }>, clock: { t: number }) {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks[index++];
      if (!next) { controller.close(); return; }
      clock.t = next.at;
      controller.enqueue(encoder.encode(next.text));
    },
  });
}

const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const delta = (content: string, extra: Record<string, unknown> = {}) => event({ provider: "OpenAI", model: "openai/gpt-5.6-luna", choices: [{ delta: { content } }], ...extra });

function realParser(onSegment: () => void) {
  return new ResponseIntentParser(context, () => {}, () => onSegment());
}

describe("lecture du flux SSE", () => {
  it("assemble les événements coupés n'importe où et garde [DONE]", () => {
    const wire = delta("Bon") + delta("jour.") + "data: [DONE]\n\n";
    for (let cut = 0; cut <= wire.length; cut += 1) {
      const reader = new SseEventReader();
      const events = [...reader.push(wire.slice(0, cut)), ...reader.push(wire.slice(cut)), ...reader.end()];
      expect(events).toHaveLength(3);
      expect(events[2]).toBe("done");
    }
  });

  it("ignore un événement illisible sans casser la suite", () => {
    const reader = new SseEventReader();
    expect(reader.push("data: {pas du json\n\n" + delta("Oui."))).toHaveLength(1);
  });
});

describe("mesures d'un appel", () => {
  it("mesure premier token, première phrase sûre et fin, avec l'en-tête privé du vrai parseur", async () => {
    const clock = { t: 0 };
    const body = timedStream([
      { at: 400, text: delta(header.slice(0, 20)) },
      { at: 450, text: delta(header.slice(20)) },
      { at: 600, text: delta("Le chalet était froid") },
      { at: 700, text: delta(" ce soir-là. Je suis resté") },
      { at: 900, text: delta(" dehors.", { choices: [{ delta: { content: " dehors." }, finish_reason: "stop" }] }) },
      { at: 950, text: event({ choices: [], usage: { prompt_tokens: 3000, completion_tokens: 60, prompt_tokens_details: { cached_tokens: 2048 }, cost: 0.0007 } }) },
      { at: 960, text: "data: [DONE]\n\n" },
    ], clock);
    const metrics = await measureLlmStream({ body, startedAt: 0, headersAt: 300, now: () => clock.t, createParser: realParser });
    expect(metrics.ok).toBe(true);
    expect(metrics.headersMs).toBe(300);
    expect(metrics.firstTokenMs).toBe(400);
    expect(metrics.firstSentenceMs).toBe(700);
    expect(metrics.totalMs).toBe(960);
    expect(metrics.intentValid).toBe(true);
    expect(metrics.speech).toBe("Le chalet était froid ce soir-là. Je suis resté dehors.");
    expect(metrics.provider).toBe("OpenAI");
    expect(metrics.usage).toEqual({ promptTokens: 3000, completionTokens: 60, cachedTokens: 2048, reasoningTokens: null, costUsd: 0.0007 });
  });

  it("compte un en-tête absent comme intent invalide, sans perdre les temps", async () => {
    const clock = { t: 0 };
    const body = timedStream([
      { at: 200, text: delta("Je ne sais pas. ") },
      { at: 260, text: event({ choices: [{ delta: {}, finish_reason: "stop" }] }) + "data: [DONE]\n\n" },
    ], clock);
    const metrics = await measureLlmStream({ body, startedAt: 0, headersAt: 150, now: () => clock.t, createParser: realParser });
    expect(metrics.ok).toBe(true);
    expect(metrics.firstTokenMs).toBe(200);
    expect(metrics.firstSentenceMs).toBeNull();
    expect(metrics.intentValid).toBe(false);
    expect(metrics.parserError).toMatch(/intent|speech|response/i);
    expect(metrics.speech).toBe("Je ne sais pas.");
  });

  it("rend une erreur amont et un flux vide comme échecs", async () => {
    const clock = { t: 0 };
    const failed = await measureLlmStream({
      body: timedStream([{ at: 100, text: event({ error: { message: "No endpoints found" } }) }], clock),
      startedAt: 0, headersAt: 90, now: () => clock.t, createParser: realParser,
    });
    expect(failed.ok).toBe(false);
    expect(failed.error).toContain("No endpoints found");
    const empty = await measureLlmStream({ body: timedStream([{ at: 50, text: "data: [DONE]\n\n" }], clock), startedAt: 0, headersAt: 40, now: () => clock.t, createParser: realParser });
    expect(empty.ok).toBe(false);
    expect(empty.error).toBe("réponse vide");
  });
});

describe("lecture de l'usage et du cache", () => {
  it("lit les tokens en cache d'OpenRouter, ceux d'Anthropic et les tokens de raisonnement", () => {
    expect(readStreamUsage({ prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 4 }, completion_tokens_details: { reasoning_tokens: 1 } }))
      .toEqual({ promptTokens: 10, completionTokens: 2, cachedTokens: 4, reasoningTokens: 1, costUsd: null });
    expect(readStreamUsage({ prompt_tokens: 10, cache_read_input_tokens: 7 })?.cachedTokens).toBe(7);
    expect(readStreamUsage(null)).toBeNull();
  });

  it("estime le coût avec le tarif du cache quand il est connu", () => {
    expect(estimateCallCostUsd({ input: 1, output: 2, cachedInput: 0.1 }, 1_000_000, 0, 500_000)).toBeCloseTo(0.55);
    expect(estimateCallCostUsd({ input: 1, output: 2 }, 1_000_000, 1_000_000, 500_000)).toBeCloseTo(3);
  });
});

describe("médiane et p90", () => {
  it("interpole linéairement et ignore les valeurs non finies", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
    expect(percentile([5], 0.9)).toBe(5);
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([1, Number.NaN, 3], 0.5)).toBe(2);
  });

  it("résume un candidat sans les appels de chauffe, et sépare le cache de la 1re répétition", () => {
    const candidate: BenchCandidate = { id: "c", label: "C", model: "m", transport: "proxy", provider: { only: ["cerebras"] }, price: { input: 1, output: 1 } };
    const record = (repeat: number, firstToken: number, cached: number, extra: Partial<BenchCallRecord> = {}): BenchCallRecord => ({
      candidateId: "c", promptId: `p${repeat}`, character: "max", repeat, costUsd: 0.001, costEstimated: false,
      metrics: { ok: true, error: null, headersMs: 1, firstTokenMs: firstToken, firstSentenceMs: firstToken + 100, totalMs: firstToken + 500,
        intentValid: repeat !== 3, parserError: null, finishReason: "stop", speech: "x", provider: "Groq", resolvedModel: "m",
        usage: { promptTokens: 1000, completionTokens: 50, cachedTokens: cached, reasoningTokens: null, costUsd: 0.001 } },
      ...extra,
    });
    const summary = summarizeCandidate(candidate, [
      record(1, 9_999, 0, { warmup: true }),
      record(1, 300, 200),
      record(2, 400, 1000),
      record(3, 500, 1000),
    ]);
    expect(summary.calls).toBe(3);
    expect(summary.firstToken.median).toBe(400);
    expect(summary.firstSentence.p90).toBe(580);
    expect(summary.intentValidRate).toBeCloseTo(0.667);
    expect(summary.cacheRateFirstRepeat).toBe(0.2);
    expect(summary.cacheRateRepeats).toBe(1);
    expect(summary.routingMismatch).toBe(true);
  });
});

describe("requêtes du banc", () => {
  const messages = [{ role: "system" as const, content: "S" }, { role: "user" as const, content: "Q" }];

  it("envoie la préférence de fournisseur et la coupure de réflexion au proxy, seulement si le candidat les demande", () => {
    const cerebras = BENCH_CANDIDATES.find((c) => c.id === "oss-cerebras")!;
    expect(buildProxyBenchBody(messages, cerebras, { max_tokens: 360 }, 18_000)).toMatchObject({ stream: true, model: "openai/gpt-oss-120b", provider: { only: ["cerebras"], allow_fallbacks: false } });
    const luna = BENCH_CANDIDATES.find((c) => c.id === "luna")!;
    expect(buildProxyBenchBody(messages, luna, { max_tokens: 360 }, 18_000)).not.toHaveProperty("provider");
    const flash = BENCH_CANDIDATES.find((c) => c.id === "gemini-25-flash")!;
    expect(buildProxyBenchBody(messages, flash, { max_tokens: 360, temperature: 0.7 }, 18_000)).toMatchObject({ disable_reasoning: true, temperature: 0.7 });
  });

  it("n'appelle un fournisseur en direct que si sa clé est présente", () => {
    const groq = BENCH_CANDIDATES.find((c) => c.id === "direct-groq-oss")!;
    expect(buildDirectBenchRequest(messages, groq, { max_tokens: 360 }, {})).toBeNull();
    const request = buildDirectBenchRequest(messages, groq, { max_tokens: 360 }, { GROQ_API_KEY: "k" })!;
    expect(request.headers.Authorization).toBe("Bearer k");
    expect(request.body).toMatchObject({ model: "openai/gpt-oss-120b", stream_options: { include_usage: true } });
  });

  it("signale les candidats inconnus et prend par défaut tous ceux du proxy", () => {
    expect(selectBenchCandidates(["luna", "nope"]).unknown).toEqual(["nope"]);
    expect(selectBenchCandidates(null).candidates.every((c) => c.transport === "proxy")).toBe(true);
  });
});

describe("stabilité du préfixe", () => {
  it("trouve la section où deux prompts du même personnage divergent", () => {
    const prompt = (id: string, character: string, fragment: string): CompiledBenchPrompt => ({
      id, character, question: id, sampling: { max_tokens: 360 },
      messages: [{ role: "system", content: `# CONTRAT\nRègles fixes.\n# NOYAU\nIdentité.\n${fragment}\n# CONTRAT DE FLUX\nFin commune.` }, { role: "user", content: id }],
    });
    const [max] = analyzePrefixStability([prompt("a", "max", "Fragment chalet."), prompt("b", "max", "Fragment fusil."), prompt("c", "max", "Fragment chalet, encore.")]);
    expect(max.prompts).toBe(3);
    expect(max.divergenceSections[0].section).toBe("# NOYAU");
    expect(max.minCommonChars).toBe(commonPrefixLength("# CONTRAT\nRègles fixes.\n# NOYAU\nIdentité.\nFragment chalet.", "# CONTRAT\nRègles fixes.\n# NOYAU\nIdentité.\nFragment fusil."));
    expect(max.sharedSuffixChars).toBeGreaterThanOrEqual("\n# CONTRAT DE FLUX\nFin commune.".length);
    expect(sectionAt("aucune section", 5)).toBe("(avant toute section)");
    // A section present for one question only: the difference falls inside its heading.
    const withVoice = "# NOYAU\nA.\n## VOIX ET POSTURE\nB.\n## MANIÈRE DE PARLER\nC.";
    const withoutVoice = "# NOYAU\nA.\n## MANIÈRE DE PARLER\nC.";
    expect(sectionAt(withVoice, commonPrefixLength(withVoice, withoutVoice))).toBe("## VOIX ET POSTURE");
  });
});
