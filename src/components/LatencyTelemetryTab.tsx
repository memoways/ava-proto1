import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TurnRow {
  id: string;
  created_at: string;
  session_id: string | null;
  turn_index: number | null;
  t_rag_rewrite_ms: number | null;
  t_rag_query_ms: number | null;
  t_rag_total_ms: number | null;
  t_knowledge_build_ms: number | null;
  t_gm_pre_ms: number | null;
  t_max_llm_ms: number | null;
  t_validator_ms: number | null;
  t_turn_total_ms: number | null;
  rag_matches_count: number | null;
  rag_top_similarity: number | null;
  max_response_len: number | null;
  user_message_len: number | null;
  max_model: string | null;
  had_fallback: boolean | null;
}

interface AudioRow {
  id: string;
  created_at: string;
  session_id: string | null;
  direction: string;
  t_stt_ms: number | null;
  t_tts_first_byte_ms: number | null;
  t_tts_total_ms: number | null;
  stt_text_len: number | null;
  tts_text_len: number | null;
}

const SEGMENTS: Array<{ key: keyof TurnRow; label: string; color: string }> = [
  { key: "t_rag_rewrite_ms", label: "Query rewrite", color: "bg-indigo-500" },
  { key: "t_rag_query_ms", label: "RAG query", color: "bg-blue-500" },
  { key: "t_knowledge_build_ms", label: "Knowledge build", color: "bg-cyan-500" },
  { key: "t_gm_pre_ms", label: "GM pre-turn", color: "bg-amber-500" },
  { key: "t_max_llm_ms", label: "Max LLM", color: "bg-emerald-500" },
  { key: "t_validator_ms", label: "Validator", color: "bg-rose-500" },
];

function fmt(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export default function LatencyTelemetryTab() {
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [audios, setAudios] = useState<AudioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [t, a] = await Promise.all([
      supabase
        .from("turn_latencies" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("audio_latencies" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (t.data) setTurns(t.data as unknown as TurnRow[]);
    if (a.data) setAudios(a.data as unknown as AudioRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const totals = turns.map((t) => t.t_turn_total_ms ?? 0).filter((v) => v > 0);
    return {
      count: turns.length,
      median: percentile(totals, 50),
      p95: percentile(totals, 95),
      fallbacks: turns.filter((t) => t.had_fallback).length,
    };
  }, [turns]);

  const audioStats = useMemo(() => {
    const stt = audios.filter((a) => a.direction === "in").map((a) => a.t_stt_ms ?? 0).filter((v) => v > 0);
    const ttsFirstByte = audios.filter((a) => a.direction === "out").map((a) => a.t_tts_first_byte_ms ?? 0).filter((v) => v > 0);
    const ttsTotal = audios.filter((a) => a.direction === "out").map((a) => a.t_tts_total_ms ?? 0).filter((v) => v > 0);
    return {
      stt_median: percentile(stt, 50),
      stt_p95: percentile(stt, 95),
      tts_fb_median: percentile(ttsFirstByte, 50),
      tts_fb_p95: percentile(ttsFirstByte, 95),
      tts_total_median: percentile(ttsTotal, 50),
      tts_total_p95: percentile(ttsTotal, 95),
    };
  }, [audios]);

  const maxTotal = Math.max(1, ...turns.map((t) => t.t_turn_total_ms ?? 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Latences pipeline</h2>
          <p className="text-xs text-muted-foreground">
            {stats.count} tours · médiane {fmt(stats.median)} · p95 {fmt(stats.p95)} · {stats.fallbacks} fallback(s)
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Chargement…" : "Recharger"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        <div className="rounded border p-2">
          <div className="text-muted-foreground">STT (Deepgram, après silence)</div>
          <div className="font-mono">méd {fmt(audioStats.stt_median)} · p95 {fmt(audioStats.stt_p95)}</div>
        </div>
        <div className="rounded border p-2">
          <div className="text-muted-foreground">TTS premier octet</div>
          <div className="font-mono">méd {fmt(audioStats.tts_fb_median)} · p95 {fmt(audioStats.tts_fb_p95)}</div>
        </div>
        <div className="rounded border p-2">
          <div className="text-muted-foreground">TTS total</div>
          <div className="font-mono">méd {fmt(audioStats.tts_total_median)} · p95 {fmt(audioStats.tts_total_p95)}</div>
        </div>
      </div>

      <div className="flex gap-3 text-xs flex-wrap">
        {SEGMENTS.map((s) => (
          <div key={String(s.key)} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded ${s.color}`} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <ScrollArea className="h-[520px] border rounded">
        <div className="p-2 space-y-1">
          {turns.map((t) => {
            const total = t.t_turn_total_ms ?? 0;
            const widthPct = (total / maxTotal) * 100;
            const segments = SEGMENTS.map((s) => ({ ...s, value: (t[s.key] as number) ?? 0 }));
            const sum = segments.reduce((acc, s) => acc + s.value, 0) || 1;
            const isOpen = expanded === t.id;
            return (
              <div key={t.id} className="rounded border p-2 text-xs space-y-1.5">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">
                      {new Date(t.created_at).toLocaleTimeString()}
                    </span>
                    <Badge variant={total <= 2000 ? "default" : total <= 4000 ? "secondary" : "destructive"}>
                      {fmt(total)}
                    </Badge>
                    {t.had_fallback ? <Badge variant="destructive">fallback</Badge> : null}
                    <span className="text-muted-foreground">
                      tour #{t.turn_index ?? "?"} · {t.rag_matches_count ?? 0} RAG · {t.max_response_len ?? 0}c
                    </span>
                  </div>
                  <span className="text-muted-foreground">{isOpen ? "▼" : "▶"}</span>
                </button>

                <div
                  className="h-3 rounded overflow-hidden flex bg-muted"
                  style={{ width: `${Math.max(10, widthPct)}%` }}
                >
                  {segments.map((s) => (
                    <div
                      key={String(s.key)}
                      className={s.color}
                      style={{ width: `${(s.value / sum) * 100}%` }}
                      title={`${s.label}: ${fmt(s.value)}`}
                    />
                  ))}
                </div>

                {isOpen && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 pt-1 font-mono text-[11px]">
                    {segments.map((s) => (
                      <div key={String(s.key)} className="flex justify-between">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span>{fmt(s.value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between col-span-full pt-1 border-t">
                      <span className="text-muted-foreground">Total</span>
                      <span>{fmt(total)}</span>
                    </div>
                    {t.max_model && (
                      <div className="col-span-full text-muted-foreground truncate">model: {t.max_model}</div>
                    )}
                    {t.session_id && (
                      <div className="col-span-full text-muted-foreground truncate">session: {t.session_id}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {turns.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">
              Aucune mesure encore. Lance une conversation pour générer des données.
            </p>
          )}
        </div>
      </ScrollArea>

      <p className="text-[11px] text-muted-foreground">
        Les mêmes événements (<code>turn_latency</code>, <code>audio_latency</code>) sont aussi envoyés à PostHog
        en fire-and-forget. Tu peux y construire des Insights : médiane/p95 par jour, breakdown par modèle, funnel
        STT → tour → TTS.
      </p>
    </div>
  );
}
