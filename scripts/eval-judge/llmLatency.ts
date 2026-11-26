/**
 * Conversational latency, lot 2 — LLM bench (measure only).
 *
 *   npm run eval:llm-latency -- --dry-run
 *   npm run eval:llm-latency -- --compile-only [--questions 5]
 *   npm run eval:llm-latency -- --prompts @output/eval-judge/llm-latency-prompts-….json [--candidates luna,haiku-55] [--repeats 3]
 *
 * 1. Compile: real Max and Emma prompts of the `eval:judge` corpus, assembled by
 *    the live chain (`processPRD4Turn`, `optimized_v3`, real RAG). The character
 *    request to proxy-llm is captured and cancelled before it leaves: no LLM, no
 *    GM, nothing persisted (only the RAG runs).
 * 2. Bench: each prompt streamed through proxy-llm (or a provider directly when
 *    its key is in .env.eval.local) for each candidate, timed by
 *    `src/services/llmLatencyBench.ts`. Raw records and a Markdown summary go
 *    to output/eval-judge/ (ignored by git).
 * Same session rules as the judge: sandbox only, `admin_settings` read-only,
 * cost announced before any paid call and capped (--max-cost-usd).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fail, log, openEvalSession, readArgs } from "./session";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const USAGE = `npm run eval:llm-latency -- [options]
  --env SANDBOX            sandbox (défaut sandbox-ulrich ; prod refusé)
  --character all|max|emma personnages du corpus (défaut all)
  --questions N            questions par personnage à compiler (défaut 5)
  --compile-only           compile et enregistre les prompts (RAG seulement), sans banc
  --prompts @FICHIER       prompts déjà compilés (sinon compilés au début)
  --candidates a,b         candidats (défaut : tous ceux du proxy) ; --list pour les voir
  --repeats N              répétitions par prompt et par candidat (défaut 3)
  --warmup N               appels de chauffe par candidat, hors mesures (défaut 1)
  --max-cost-usd X         plafond du run (défaut 3)
  --dry-run                estimation seule, aucun appel payant
  --out DOSSIER            défaut output/eval-judge`;

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const bench = await import("@/services/llmLatencyBench");
  if (args.has("help")) { log(USAGE); return; }
  if (args.has("list")) {
    for (const c of bench.BENCH_CANDIDATES) log(`${c.id.padEnd(24)} ${c.transport.padEnd(6)} ${c.label}${c.note ? ` — ${c.note}` : ""}`);
    return;
  }
  const character = args.get("character") ?? "all";
  if (!["all", "max", "emma"].includes(character)) fail(`--character inconnu : ${character}`);
  const questions = Number(args.get("questions") ?? 5);
  const repeats = Number(args.get("repeats") ?? 3);
  const warmup = Number(args.get("warmup") ?? 1);
  const capUsd = Number((args.get("max-cost-usd") ?? "3").replace(",", "."));
  if (![questions, repeats, warmup, capUsd].every((n) => Number.isFinite(n) && n >= 0) || questions < 1 || repeats < 1) fail(`Options numériques invalides.\n\n${USAGE}`);
  const { candidates, unknown } = bench.selectBenchCandidates(args.get("candidates")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null);
  if (unknown.length) fail(`Candidats inconnus : ${unknown.join(", ")} (--list)`);
  const outDir = path.resolve(process.cwd(), args.get("out") ?? "output/eval-judge");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const session = await openEvalSession(args.get("env") ?? "sandbox-ulrich");
  const [pipeline, runner, store, { authenticatedFunctionFetch }, { ResponseIntentParser }, { getSupportedSamplingParameters }, { processPRD4Turn }] = await Promise.all([
    import("@/services/evalJudgePipeline"),
    import("@/services/evalJudgeRunner"),
    import("@/services/evalJudgeStore"),
    import("@/services/gameAuth"),
    import("@/services/responseIntentStream"),
    import("@/services/llmModelCapabilities"),
    import("@/services/prd4Orchestrator"),
  ]);
  const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-llm`;

  // ------------------------------------------------------------- prompts
  let prompts: import("@/services/llmLatencyBench").CompiledBenchPrompt[] = [];
  const promptsArg = args.get("prompts");
  if (promptsArg) {
    const file = path.resolve(process.cwd(), promptsArg.replace(/^@/, ""));
    if (!existsSync(file)) fail(`Prompts introuvables : ${file}`);
    prompts = JSON.parse(readFileSync(file, "utf8")).prompts;
    log(`• ${prompts.length} prompts relus (${path.relative(process.cwd(), file)})`);
  } else {
    const live = pipeline.snapshotLiveSettings();
    const compare = runner.buildCompareConfigs(live, { variant: "optimized_v3", snapshotJson: "" }, { variant: "optimized_v3", snapshotJson: "" });
    const config = compare.configs[0];
    const items = runner.selectRunnableEvalItems(await store.fetchEvalItems(), character as "all" | "max" | "emma")
      .sort((a, b) => a.sort_order - b.sort_order);
    const chosen = (["max", "emma"] as const)
      .filter((key) => character === "all" || character === key)
      .flatMap((key) => items.filter((item) => pipeline.evalCharacterKey(item.character_name) === key).slice(0, questions));
    log(`• Compilation de ${chosen.length} prompts réels (${config.model}, ${config.promptVariant}) : RAG seulement, l'appel au personnage est intercepté avant l'envoi`);
    if (args.has("dry-run")) {
      log(`  (--dry-run : compilation sautée, estimation sur ${chosen.length} prompts de ≈ 3 000 tokens)`);
      prompts = chosen.map((item) => ({ id: item.id, character: pipeline.evalCharacterKey(item.character_name) ?? "?", question: item.question, messages: [{ role: "system", content: "x".repeat(10_800) }, { role: "user", content: item.question }], sampling: { max_tokens: config.maxTokens } }));
    } else {
      const baseFetch = globalThis.fetch;
      for (const item of chosen) {
        const controller = new AbortController();
        let captured: Record<string, unknown> | null = null;
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          if (!captured && url === proxyUrl && typeof init?.body === "string") {
            const body = JSON.parse(init.body) as { model?: string; messages?: Array<{ role: string; content: string }> };
            const last = body.messages?.at(-1);
            if (body.model === config.model && body.messages?.[0]?.role === "system" && last?.role === "user" && last.content === item.question) {
              captured = body;
              controller.abort("prompt-captured");
              throw new DOMException("Prompt captured for the latency bench", "AbortError");
            }
          }
          return baseFetch(input, init);
        }) as typeof fetch;
        try {
          const { characterKey, characterContext } = await pipeline.resolveEvalCharacterContext(item.character_name);
          await processPRD4Turn({
            sessionId: null, conversationHistory: [], userMessage: item.question, userRole: null, timeElapsedSeconds: 0,
            characterContext, signal: controller.signal, turnIndex: 1,
            evaluationOverrides: pipeline.buildEvalTurnOverrides(config, characterKey),
          }).catch(() => null);
        } finally {
          globalThis.fetch = baseFetch;
        }
        const body = captured as { messages: import("@/services/llmLatencyBench").BenchMessage[]; temperature?: number; top_p?: number; max_tokens: number } | null;
        if (!body) { log(`  ✖ ${item.id} : prompt non capturé (tour en repli avant l'appel ?)`); continue; }
        prompts.push({
          id: item.id, character: pipeline.evalCharacterKey(item.character_name) ?? "?", question: item.question,
          messages: body.messages, sampling: { temperature: body.temperature, top_p: body.top_p, max_tokens: body.max_tokens },
        });
        log(`  ✓ ${item.id} · ${item.character_name} · ${body.messages[0].content.length} car. système`);
      }
      mkdirSync(outDir, { recursive: true });
      const file = path.join(outDir, `llm-latency-prompts-${stamp}.json`);
      writeFileSync(file, `${JSON.stringify({ environment: session.environment, model: config.model, promptVariant: config.promptVariant, prompts }, null, 2)}\n`, "utf8");
      log(`✓ Prompts enregistrés : --prompts @${path.relative(process.cwd(), file)}`);
    }
  }
  if (!prompts.length) fail("Aucun prompt à mesurer.");
  const stability = bench.analyzePrefixStability(prompts);
  for (const s of stability) {
    log(`• Préfixe ${s.character} : commun ${s.minCommonChars}-${s.medianCommonChars} / ${s.medianSystemChars} car., première différence : ${s.divergenceSections.slice(0, 2).map((d) => d.section).join(" ; ") || "aucune"}`);
  }
  if (args.has("compile-only")) { await session.close(); return; }

  // -------------------------------------------------------------- estimate
  const env = process.env as Record<string, string | undefined>;
  const skipped: string[] = [];
  const runnable = candidates.filter((c) => {
    if (c.transport !== "direct") return true;
    if (bench.buildDirectBenchRequest([], c, { max_tokens: 1 }, env)) return true;
    skipped.push(`${c.label} : clé ${c.direct?.keyEnv} absente de l'environnement`);
    return false;
  });
  const promptTokens = Math.round(prompts.reduce((sum, p) => sum + bench.approxTokens(p.messages), 0) / prompts.length);
  const estimate = bench.estimateBenchRunUsd({ candidates: runnable, prompts: prompts.length, repeats, warmup, promptTokens, completionTokens: 150 });
  log(`• ${runnable.length} candidats × ${prompts.length} prompts × ${repeats} répétitions (+ ${warmup} chauffe) = ${runnable.length * (prompts.length * repeats + warmup)} appels · ≈ ${promptTokens} tokens d'entrée`);
  for (const c of runnable) log(`  - ${c.id} · ${c.label}`);
  for (const s of skipped) log(`  ⤼ ${s}`);
  log(`• Estimation ${estimate.toFixed(2)} $ (prix publics, sans cache) · plafond ${capUsd.toFixed(2)} $`);
  if (estimate > capUsd) fail(`Estimation au-dessus du plafond : relever --max-cost-usd ou réduire le run.`, 2);
  if (args.has("dry-run")) { log("✓ --dry-run : aucun appel payant."); await session.close(); return; }

  // ----------------------------------------------------------------- bench
  const contexts = new Map<string, import("@/services/characterIdentityGuard").CharacterExecutionContext>();
  for (const key of new Set(prompts.map((p) => p.character))) {
    contexts.set(key, (await pipeline.resolveEvalCharacterContext(key === "emma" ? "Emma" : "Max")).characterContext);
  }
  const records: import("@/services/llmLatencyBench").BenchCallRecord[] = [];
  let spent = 0;
  let stop = false;
  process.on("SIGINT", () => { if (stop) process.exit(130); stop = true; log("\n⏸ Arrêt demandé : fin de l'appel en cours."); });

  const callOnce = async (candidate: import("@/services/llmLatencyBench").BenchCandidate, prompt: typeof prompts[number]) => {
    const sampling = { ...getSupportedSamplingParameters(candidate.model, prompt.sampling.temperature, prompt.sampling.top_p), max_tokens: prompt.sampling.max_tokens };
    for (let attempt = 1; ; attempt += 1) {
      const startedAt = performance.now();
      let response: Response;
      if (candidate.transport === "direct") {
        const request = bench.buildDirectBenchRequest(prompt.messages, candidate, sampling, env)!;
        response = await fetch(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(request.body) });
      } else {
        response = await authenticatedFunctionFetch(proxyUrl, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bench.buildProxyBenchBody(prompt.messages, candidate, sampling, 18_000)),
        });
      }
      const headersAt = performance.now();
      if (response.status === 429 && attempt <= 3) { log("  ⏳ 429 : attente 20 s"); await sleep(20_000); continue; }
      if (!response.ok || !response.body) {
        const detail = (await response.text().catch(() => "")).slice(0, 200);
        return { ok: false, error: `HTTP ${response.status} ${detail}`, headersMs: Math.round(headersAt - startedAt), firstTokenMs: null, firstSentenceMs: null, totalMs: null, intentValid: false, parserError: null, finishReason: null, speech: "", provider: null, resolvedModel: null, usage: null } satisfies import("@/services/llmLatencyBench").BenchCallMetrics;
      }
      const metrics = await bench.measureLlmStream({
        body: response.body, startedAt, headersAt, now: () => performance.now(), chunkTimeoutMs: 20_000,
        createParser: (onSegment) => new ResponseIntentParser(contexts.get(prompt.character)!, () => {}, () => onSegment()),
      });
      if (candidate.transport === "direct" && !metrics.provider) metrics.provider = `${candidate.direct!.url.split("/")[2]} (direct)`;
      return metrics;
    }
  };
  const record = async (candidate: typeof runnable[number], prompt: typeof prompts[number], repeat: number, isWarmup: boolean) => {
    const metrics = await callOnce(candidate, prompt);
    const usage = metrics.usage;
    const billed = usage?.costUsd ?? null;
    const costUsd = billed ?? (usage?.promptTokens != null
      ? bench.estimateCallCostUsd(candidate.price, usage.promptTokens, usage.completionTokens ?? 0, usage.cachedTokens ?? 0) : null);
    spent += costUsd ?? 0;
    records.push({ candidateId: candidate.id, promptId: prompt.id, character: prompt.character, repeat, warmup: isWarmup || undefined, metrics, costUsd, costEstimated: billed === null });
    const t = (v: number | null) => (v === null ? "–" : `${(v / 1000).toFixed(2)}s`);
    log(`  ${isWarmup ? "chauffe" : `r${repeat}`} ${candidate.id} ${prompt.id.slice(0, 8)} · 1er token ${t(metrics.firstTokenMs)} · phrase ${t(metrics.firstSentenceMs)} · fin ${t(metrics.totalMs)}${metrics.intentValid ? "" : " · intent ✗"}${usage?.cachedTokens ? ` · cache ${usage.cachedTokens}` : ""}${metrics.error ? ` · ✖ ${metrics.error}` : ""}`);
    if (spent > capUsd) { stop = true; log(`✖ Plafond atteint (${spent.toFixed(3)} $) : arrêt.`); }
  };

  for (const candidate of runnable) {
    for (let w = 0; w < warmup && !stop; w += 1) await record(candidate, prompts[w % prompts.length], 0, true);
  }
  // Repeat-major order: for one candidate, its first repeat walks every question
  // of a character in a row (realistic cross-question cache), later repeats replay them.
  for (let repeat = 1; repeat <= repeats && !stop; repeat += 1) {
    for (const candidate of runnable) {
      for (const prompt of prompts) {
        if (stop) break;
        await record(candidate, prompt, repeat, false);
      }
    }
  }

  const summaries = runnable.map((c) => bench.summarizeCandidate(c, records));
  const report = bench.formatBenchReport({ date: new Date().toISOString().slice(0, 10), environment: session.environment, repeats, prompts, summaries, stability, skipped });
  mkdirSync(outDir, { recursive: true });
  const rawFile = path.join(outDir, `llm-latency-${stamp}.json`);
  writeFileSync(rawFile, `${JSON.stringify({ environment: session.environment, repeats, warmup, candidates: runnable, records, summaries, stability }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outDir, `llm-latency-${stamp}.md`), report, "utf8");
  process.stdout.write(report);
  log(`✓ ${records.length} appels · ${spent.toFixed(3)} $ · ${path.relative(process.cwd(), rawFile)}`);
  if (session.blockedSettingsWrites.length) log(`ℹ ${session.blockedSettingsWrites.length} écriture(s) admin_settings refusée(s)`);
  await session.close();
}

main().catch((error) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
