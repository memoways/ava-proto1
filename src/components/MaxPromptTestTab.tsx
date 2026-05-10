import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import {
  emptyStepStates,
  estimateTokens,
  parseHistory,
  runMaxTestPipeline,
  totalLatencyMs,
  totalTokens,
  type MaxTestStepStates,
  type StepKey,
  type StepStatus,
} from "@/services/maxTestPipeline";
import { toast } from "sonner";

const PRESETS = [
  { id: "ava_disp", label: "Question sur Ava (in-scope)", text: "Est-ce qu'Ava t'avait parlé de partir avant sa disparition ?" },
  { id: "off_topic", label: "Hors-périmètre", text: "Quelle est la météo demain à Paris ?" },
  { id: "trap", label: "Piège à hallucination", text: "Donne-moi la date exacte et l'adresse où Ava a été vue pour la dernière fois." },
  { id: "intim", label: "Sujet sensible", text: "Tu penses qu'Ava est encore en vie ?" },
];

/**
 * Scénario complet « banc d'essai RAG v2 » :
 * - historique multi-tours qui déclenche l'injection de mémoire de session
 * - dernier message volontairement ambigu pour exercer le query rewrite
 * - le RAG appliquera rerank + provider configurés dans les toggles courants
 */
const FULL_BENCH_SCENARIO = {
  history: [
    "USER: Salut Max, tu peux me parler d'Ava ?",
    "MAX: Ava… c'est ma sœur. Elle a disparu il y a quelques semaines.",
    "USER: Vous étiez proches ?",
    "MAX: Très. On se voyait presque tous les jours avant qu'elle déménage.",
    "USER: Elle t'avait parlé de quelque chose d'inhabituel récemment ?",
    "MAX: Elle bossait sur un truc qu'elle voulait pas trop expliquer. Un projet, peut-être.",
  ].join("\n"),
  message: "Et ce truc-là, justement, t'en sais plus ?",
  sessionSummary:
    "Max a confié que sa sœur Ava a disparu récemment. Ils étaient très proches. Avant sa disparition, Ava travaillait sur un projet qu'elle ne souhaitait pas détailler.",
};


const STEP_LABELS: Record<StepKey, string> = {
  rewrite: "0. Query rewrite",
  rag: "1. RAG query",
  knowledge: "2. Knowledge build",
  gmPre: "3. GM pré-tour",
  max: "4. Réponse Max",
  validator: "5. Validateur conformité",
};

function StatusBadge({ status }: { status: StepStatus["status"] }) {
  const map: Record<StepStatus["status"], { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "bg-muted text-muted-foreground" },
    running: { label: "En cours…", cls: "bg-primary/20 text-primary animate-pulse" },
    ok: { label: "OK", cls: "bg-emerald-500/20 text-emerald-300" },
    error: { label: "Erreur", cls: "bg-destructive/20 text-destructive" },
    skipped: { label: "Ignoré", cls: "bg-muted text-muted-foreground" },
  };
  const v = map[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function fmtMs(n?: number) {
  if (n === undefined) return "—";
  return `${n} ms`;
}

function fmtTokens(p?: number, c?: number, t?: number) {
  if (!p && !c && !t) return "—";
  return `in ${p ?? "?"} / out ${c ?? "?"} / total ${t ?? "?"}`;
}

export default function MaxPromptTestTab() {
  const [characters, setCharacters] = useState<Array<{ name: string }>>([]);
  const [characterName, setCharacterName] = useState("Max");
  const [userMessage, setUserMessage] = useState(PRESETS[0].text);
  const [historyText, setHistoryText] = useState("");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.3);
  const [trustLevel, setTrustLevel] = useState(0);
  const [running, setRunning] = useState(false);
  const [states, setStates] = useState<MaxTestStepStates>(emptyStepStates());

  useEffect(() => {
    supabase.from("characters").select("name").order("name").then(({ data }) => {
      if (data) setCharacters(data as Array<{ name: string }>);
    });
  }, []);

  const conversationHistory = useMemo(() => parseHistory(historyText), [historyText]);

  async function handleRun(opts?: { skipRAG?: boolean; skipGM?: boolean; skipValidator?: boolean }) {
    if (running) return;
    if (!userMessage.trim()) {
      toast.error("Saisis un message utilisateur");
      return;
    }
    setRunning(true);
    setStates(emptyStepStates());
    try {
      const final = await runMaxTestPipeline(
        {
          characterName,
          userMessage,
          conversationHistory,
          ragTopK: topK,
          ragThreshold: threshold,
          currentTrustLevel: trustLevel,
          triggeredIds: [],
          timeElapsedSeconds: 0,
          ...opts,
        },
        (s) => setStates({ ...s }),
      );
      setStates(final);
      toast.success("Simulation terminée");
    } catch (err) {
      console.error("[MaxPromptTest] pipeline failed", err);
      toast.error("Pipeline échoué — voir console");
    } finally {
      setRunning(false);
    }
  }

  function exportTrace() {
    const blob = new Blob([JSON.stringify({ input: { characterName, userMessage, historyText, topK, threshold, trustLevel }, states }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `max-test-trace-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total_ms = totalLatencyMs(states);
  const total_tok = totalTokens(states);

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">🧪 Banc d'essai Max — pipeline complet</h2>
        <p className="text-sm text-muted-foreground">
          Rejoue un tour complet (RAG → contexte → GM pré-tour → Max → validateur) à partir d'une simple phrase utilisateur.
          Inspecte chaque étape : prompt injecté, tokens, latences, fallback éventuel.
        </p>
      </div>

      {/* Inputs */}
      <section className="grid gap-4 rounded-lg border p-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Personnage</Label>
          <Select value={characterName} onValueChange={setCharacterName}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {characters.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
              {!characters.length && <SelectItem value="Max">Max</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Preset rapide</Label>
          <Select onValueChange={(id) => { const p = PRESETS.find((x) => x.id === id); if (p) setUserMessage(p.text); }}>
            <SelectTrigger><SelectValue placeholder="Choisir un cas type…" /></SelectTrigger>
            <SelectContent>{PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Trust level</Label>
          <Input type="number" value={trustLevel} onChange={(e) => setTrustLevel(Number(e.target.value))} />
        </div>

        <div className="space-y-2 lg:col-span-3">
          <Label>Message utilisateur</Label>
          <Textarea value={userMessage} onChange={(e) => setUserMessage(e.target.value)} className="min-h-[80px]" />
        </div>

        <div className="space-y-2 lg:col-span-3">
          <Label>Historique simulé (optionnel — format <code>USER: …</code> / <code>MAX: …</code>)</Label>
          <Textarea value={historyText} onChange={(e) => setHistoryText(e.target.value)} className="min-h-[100px] font-mono text-xs" placeholder={"USER: bonjour\nMAX: salut, qui es-tu ?"} />
        </div>

        <div className="space-y-2">
          <Label>RAG top_k</Label>
          <Input type="number" value={topK} onChange={(e) => setTopK(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>RAG threshold</Label>
          <Input type="number" step="0.05" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={() => handleRun()} disabled={running}>
            {running ? "Simulation…" : "Lancer la simulation complète"}
          </Button>
          <Button variant="outline" onClick={() => handleRun({ skipRAG: true, skipGM: true })} disabled={running}>
            Max seul
          </Button>
        </div>
      </section>

      {/* Pipeline chronology */}
      <section className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Chronologie du pipeline</h3>
          <div className="text-sm text-muted-foreground">
            Total : <strong>{total_ms} ms</strong> · ≈ <strong>{total_tok || "—"}</strong> tokens
            <Button size="sm" variant="ghost" className="ml-3" onClick={exportTrace}>Export JSON</Button>
          </div>
        </div>
        <div className="space-y-2">
          {(Object.keys(STEP_LABELS) as StepKey[]).map((key) => {
            const s = states[key];
            const meta: string[] = [];
            if (key === "rewrite" && s.status === "ok") {
              const rw = (s as any).rewritten;
              meta.push(rw ? `→ "${String(rw).slice(0, 80)}"` : "(inchangée)");
            }
            if (key === "rag" && s.status === "ok") {
              const matches = (s as any).matches?.length ?? 0;
              const prov = (s as any).embeddingProvider;
              const rer = (s as any).rerankUsed;
              meta.push(`${matches} matches`);
              if (prov) meta.push(`provider: ${prov}${rer ? "+rerank" : ""}`);
            }
            if (key === "gmPre" && s.status === "ok") {
              const d = (s as any).detail;
              if (d?.model) meta.push(d.model);
              if (d?.usage) meta.push(fmtTokens(d.usage.prompt_tokens, d.usage.completion_tokens, d.usage.total_tokens));
              if (d?.brief?.fallback) meta.push(`fallback: ${d.brief.fallback.kind}`);
            }
            if (key === "max" && s.status === "ok") {
              const d = (s as any).detail;
              if (d?.model) meta.push(d.model);
              if (d?.usage) meta.push(fmtTokens(d.usage.prompt_tokens, d.usage.completion_tokens, d.usage.total_tokens));
            }
            if (key === "validator" && s.status === "ok") {
              const d = (s as any).detail;
              if (d?.model) meta.push(d.model);
              if (d?.usage) meta.push(fmtTokens(d.usage.prompt_tokens, d.usage.completion_tokens, d.usage.total_tokens));
              if (d?.result) meta.push(d.result.compliant ? "conforme" : "NON conforme");
            }
            return (
              <div key={key} className="grid grid-cols-12 items-center gap-2 rounded border bg-muted/10 px-3 py-2 text-sm">
                <div className="col-span-4 font-medium">{STEP_LABELS[key]}</div>
                <div className="col-span-2"><StatusBadge status={s.status} /></div>
                <div className="col-span-2 text-right tabular-nums">{fmtMs(s.durationMs)}</div>
                <div className="col-span-4 truncate text-xs text-muted-foreground">{s.error ? `❌ ${s.error}` : meta.join(" · ")}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Inspection accordions */}
      <Accordion type="multiple" defaultValue={["rewrite", "rag", "max", "validator"]} className="space-y-2">
        <AccordionItem value="rewrite" className="rounded-lg border px-4">
          <AccordionTrigger>Query rewrite</AccordionTrigger>
          <AccordionContent>
            {states.rewrite.status === "skipped" ? (
              <p className="text-sm text-muted-foreground">Étape ignorée.</p>
            ) : states.rewrite.status === "pending" ? (
              <p className="text-sm text-muted-foreground">Pas exécuté.</p>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="rounded border bg-muted/20 p-2">
                  <p className="mb-1 font-medium text-muted-foreground">Original</p>
                  <p className="whitespace-pre-wrap">{states.rewrite.original}</p>
                </div>
                <div className="rounded border bg-primary/5 p-2">
                  <p className="mb-1 font-medium text-muted-foreground">Réécrite (envoyée au RAG)</p>
                  <p className="whitespace-pre-wrap">
                    {states.rewrite.rewritten ? states.rewrite.rewritten : <em className="text-muted-foreground">aucune réécriture — message original utilisé</em>}
                  </p>
                </div>
                {states.rewrite.error && <div className="rounded bg-destructive/10 p-2 text-destructive">{states.rewrite.error}</div>}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rag" className="rounded-lg border px-4">
          <AccordionTrigger>
            RAG matches ({states.rag.matches?.length ?? 0})
            {states.rag.embeddingProvider && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {states.rag.embeddingProvider}{states.rag.rerankUsed ? " + rerank" : ""}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent>
            {states.rag.error && <div className="mb-2 rounded bg-destructive/10 p-2 text-xs text-destructive">{states.rag.error}</div>}
            {!states.rag.matches?.length ? (
              <p className="text-sm text-muted-foreground">Aucun match.</p>
            ) : (
              <div className="space-y-2">
                {states.rag.matches.map((m, i) => (
                  <div key={m.id} className="rounded border bg-muted/20 p-3 text-xs">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">[{i + 1}] {m.source_table}</Badge>
                      {m.character_id ? (
                        <Badge variant="secondary" className="text-[10px]">char: {m.character_id.slice(0, 8)}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">shared</Badge>
                      )}
                      <span className="ml-auto flex gap-3 tabular-nums text-muted-foreground">
                        {typeof m.rerank_score === "number" && (
                          <span title="Voyage rerank-2.5 score">rerank: <strong className="text-foreground">{m.rerank_score.toFixed(3)}</strong></span>
                        )}
                        {typeof m.retrieval_similarity === "number" && (
                          <span title="Cosine retrieval similarity">retrieval: {m.retrieval_similarity.toFixed(3)}</span>
                        )}
                        <span>final: {m.similarity.toFixed(3)}</span>
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="knowledge" className="rounded-lg border px-4">
          <AccordionTrigger>Contexte injecté (knowledge)</AccordionTrigger>
          <AccordionContent>
            {!states.knowledge.context ? (
              <p className="text-sm text-muted-foreground">Pas de contexte construit.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 text-xs">
                {(["allowedFacts", "activeMemories", "hypotheses", "forbiddenTopics", "blockedAssertions"] as const).map((k) => (
                  <div key={k} className="rounded border bg-muted/20 p-3">
                    <p className="mb-1 font-medium text-foreground">{k} ({states.knowledge.context?.[k]?.length || 0})</p>
                    <ul className="list-disc space-y-1 pl-4">
                      {(states.knowledge.context?.[k] || []).map((v, i) => <li key={i} className="break-words">{v}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="gmPre" className="rounded-lg border px-4">
          <AccordionTrigger>Brief Game Master pré-tour</AccordionTrigger>
          <AccordionContent>
            {!states.gmPre.detail ? (
              <p className="text-sm text-muted-foreground">Pas exécuté.</p>
            ) : (
              <div className="space-y-3 text-xs">
                {states.gmPre.detail.brief.fallback && (
                  <div className="rounded bg-destructive/10 p-2 text-destructive">
                    Fallback: <strong>{states.gmPre.detail.brief.fallback.kind}</strong> — {states.gmPre.detail.brief.fallback.reason}
                  </div>
                )}
                <pre className="overflow-auto rounded border bg-muted/20 p-3">{JSON.stringify(states.gmPre.detail.brief, null, 2)}</pre>
                <details>
                  <summary className="cursor-pointer text-muted-foreground">Voir prompts envoyés au GM</summary>
                  <div className="mt-2 space-y-2">
                    <Label>System</Label>
                    <Textarea readOnly value={states.gmPre.detail.systemPrompt} className="min-h-[120px] font-mono text-xs" />
                    <Label>User</Label>
                    <Textarea readOnly value={states.gmPre.detail.userPrompt} className="min-h-[120px] font-mono text-xs" />
                  </div>
                </details>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="max" className="rounded-lg border px-4">
          <AccordionTrigger>Prompt système final + réponse Max</AccordionTrigger>
          <AccordionContent>
            {!states.max.detail ? (
              <p className="text-sm text-muted-foreground">Pas exécuté.</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded border bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                  {states.max.detail.response}
                </div>
                <div className="text-xs text-muted-foreground">
                  Modèle : <strong>{states.max.detail.model}</strong> ·
                  Tokens : {fmtTokens(states.max.detail.usage?.prompt_tokens, states.max.detail.usage?.completion_tokens, states.max.detail.usage?.total_tokens)} ·
                  Latence : {states.max.detail.latencyMs} ms
                </div>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Voir prompt système complet ({states.max.detail.systemPrompt.length} chars · ≈ {estimateTokens(states.max.detail.systemPrompt)} tokens)
                  </summary>
                  <Textarea readOnly value={states.max.detail.systemPrompt} className="mt-2 min-h-[300px] font-mono text-xs" />
                </details>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="validator" className="rounded-lg border px-4">
          <AccordionTrigger>Diagnostic validateur</AccordionTrigger>
          <AccordionContent>
            {!states.validator.detail ? (
              <p className="text-sm text-muted-foreground">Pas exécuté.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className={`rounded border p-3 ${states.validator.detail.result.compliant ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                  <p className="font-medium">{states.validator.detail.result.compliant ? "✅ Conforme" : "❌ Non conforme"} — {states.validator.detail.result.summary}</p>
                </div>
                {!!states.validator.detail.result.violations.length && (
                  <div>
                    <p className="mb-1 font-medium">Violations</p>
                    <ul className="list-disc space-y-1 pl-5 text-xs">
                      {states.validator.detail.result.violations.map((v, i) => <li key={i}>{v}</li>)}
                    </ul>
                  </div>
                )}
                {!!states.validator.detail.result.safe_points.length && (
                  <div>
                    <p className="mb-1 font-medium">Points respectés</p>
                    <ul className="list-disc space-y-1 pl-5 text-xs">
                      {states.validator.detail.result.safe_points.map((v, i) => <li key={i}>{v}</li>)}
                    </ul>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Modèle : <strong>{states.validator.detail.model}</strong> ·
                  Tokens : {fmtTokens(states.validator.detail.usage?.prompt_tokens, states.validator.detail.usage?.completion_tokens, states.validator.detail.usage?.total_tokens)} ·
                  Latence : {states.validator.detail.latencyMs} ms
                </div>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Voir prompt validateur</summary>
                  <Textarea readOnly value={states.validator.detail.validatorPrompt || ""} className="mt-2 min-h-[200px] font-mono text-xs" />
                </details>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
