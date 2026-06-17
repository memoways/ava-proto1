import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Trash2, Pencil, MessageSquare, Check, X, ExternalLink, Activity } from "lucide-react";
import { Link } from "react-router-dom";

/** Onglet admin où corriger la cause racine selon le type de fallback GM. */
const FALLBACK_TARGET_TAB: Record<string, { tab: string; label: string }> = {
  timeout: { tab: "llm", label: "Ouvrir LLM Config (modèle / max_tokens GM)" },
  llm_error: { tab: "llm", label: "Ouvrir LLM Config (modèle GM)" },
  orchestrator_error: { tab: "llm", label: "Ouvrir LLM Config (modèle GM)" },
  no_json: { tab: "gamemaster", label: "Ouvrir prompt Game Master (forcer JSON)" },
};

export interface SessionRow {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  trust_level: number | null;
  game_over_reason: string | null;
  duration_seconds: number | null;
  branch: string | null;
  triggers_activated: string[] | null;
  conversation_log: any;
  questionnaire_responses: any;
  name: string | null;
  admin_note: string | null;
  player_role?: any;
  gm_post_turn_log?: any;
  personnage_appele?: string | null;
  modalite_voix?: string | null;
}

const fmt = (d: string | null) => d ? new Date(d).toLocaleString("fr-CH") : "—";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

interface FallbackPoint {
  index: number;        // index du message Max dans le log
  turnLabel: string;    // ex "T3"
  elapsed_ms: number;
  timeout_ms: number;
  kind: string;
  exceeded: boolean;
}

/** Mini bar chart SVG : elapsed_ms vs timeout_ms sur les N derniers fallbacks GM. */
function GmFallbackChart({ log }: { log: any[] }) {
  // Construire la liste des fallbacks (uniquement messages Max avec gmFallback)
  let turnCount = 0;
  const points: FallbackPoint[] = [];
  for (let i = 0; i < log.length; i++) {
    const m = log[i];
    if (m?.role !== "max") continue;
    turnCount += 1;
    const fb = m.gmFallback;
    if (!fb || typeof fb.elapsed_ms !== "number") continue;
    const timeout_ms = typeof fb.timeout_ms === "number" ? fb.timeout_ms : 4000;
    points.push({
      index: i,
      turnLabel: `T${turnCount}`,
      elapsed_ms: fb.elapsed_ms,
      timeout_ms,
      kind: fb.kind || "?",
      exceeded: fb.elapsed_ms >= timeout_ms,
    });
  }

  if (points.length === 0) {
    return (
      <div className="mb-3 border rounded p-3 bg-muted/20 text-xs text-muted-foreground">
        Aucun fallback GM sur cette session.
      </div>
    );
  }

  const recent = points.slice(-20); // les 20 derniers
  const maxTimeout = Math.max(...recent.map((p) => p.timeout_ms));
  const maxValue = Math.max(maxTimeout, ...recent.map((p) => p.elapsed_ms));
  const yMax = Math.ceil((maxValue * 1.1) / 500) * 500 || 500; // arrondi 500ms

  const W = 480;
  const H = 140;
  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / recent.length;
  const barW = Math.max(4, slot * 0.55);

  const yFor = (v: number) => padT + innerH - (v / yMax) * innerH;
  const exceededCount = recent.filter((p) => p.exceeded).length;

  // Ligne timeout (on prend le max — quasi tjrs constant) tracée en repère
  const timeoutY = yFor(maxTimeout);

  return (
    <div className="mb-3 border rounded p-3 bg-muted/20">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Fallbacks GM — elapsed vs timeout ({recent.length} dernier{recent.length > 1 ? "s" : ""})
        </p>
        <p className="text-[10px] text-muted-foreground">
          <span className="text-destructive font-medium">{exceededCount}</span> dépassement{exceededCount > 1 ? "s" : ""} ·
          seuil {maxTimeout} ms
        </p>
      </div>
      <TooltipProvider delayDuration={100}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Graphique elapsed_ms vs timeout_ms des derniers fallbacks GM"
        >
          {/* Axe Y simplifié : 3 graduations */}
          {[0, 0.5, 1].map((r) => {
            const v = Math.round(yMax * r);
            const y = yFor(v);
            return (
              <g key={r}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="hsl(var(--border))" strokeDasharray="2 3" strokeWidth={0.5} />
                <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">
                  {v}
                </text>
              </g>
            );
          })}

          {/* Ligne seuil timeout */}
          <line
            x1={padL}
            y1={timeoutY}
            x2={W - padR}
            y2={timeoutY}
            stroke="hsl(var(--destructive))"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
          <text x={W - padR} y={timeoutY - 3} textAnchor="end" fontSize="9" fill="hsl(var(--destructive))">
            timeout
          </text>

          {/* Barres elapsed_ms */}
          {recent.map((p, idx) => {
            const x = padL + idx * slot + (slot - barW) / 2;
            const y = yFor(p.elapsed_ms);
            const h = padT + innerH - y;
            const fill = p.exceeded
              ? "hsl(var(--destructive))"
              : p.kind === "no_json"
                ? "hsl(var(--primary))"
                : "hsl(var(--muted-foreground))";
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <g className="cursor-help">
                    <rect x={x} y={y} width={barW} height={Math.max(1, h)} fill={fill} opacity={0.85} rx={1} />
                    {/* zone hover plus large */}
                    <rect x={padL + idx * slot} y={padT} width={slot} height={innerH} fill="transparent" />
                  </g>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-semibold">{p.turnLabel} · {p.kind}</div>
                  <div>elapsed: <span className="font-mono">{p.elapsed_ms} ms</span></div>
                  <div>timeout: <span className="font-mono">{p.timeout_ms} ms</span></div>
                  {p.exceeded && <div className="text-destructive font-medium">⚠ dépassement</div>}
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Labels X (1 sur 2 si trop dense) */}
          {recent.map((p, idx) => {
            if (recent.length > 10 && idx % 2 !== 0) return null;
            const x = padL + idx * slot + slot / 2;
            return (
              <text key={`xl-${idx}`} x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">
                {p.turnLabel}
              </text>
            );
          })}
        </svg>
      </TooltipProvider>
    </div>
  );
}

interface Props {
  sessions: SessionRow[];
  onRefresh: () => void;
}

export default function SessionsTab({ sessions, onRefresh }: Props) {
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function deleteSession(id: string) {
    if (!confirm("Supprimer cette session définitivement ?")) return;
    setDeleting(id);
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) {
      toast.error("Erreur suppression: " + error.message);
    } else {
      toast.success("Session supprimée");
      if (selected?.id === id) setSelected(null);
      onRefresh();
    }
    setDeleting(null);
  }

  async function saveName(id: string) {
    const { error } = await supabase.from("sessions").update({ name: nameInput || null }).eq("id", id);
    if (error) {
      toast.error("Erreur: " + error.message);
    } else {
      toast.success("Nom mis à jour");
      if (selected?.id === id) setSelected({ ...selected!, name: nameInput || null });
      onRefresh();
    }
    setEditingName(null);
  }

  async function saveNote(id: string) {
    const { error } = await supabase.from("sessions").update({ admin_note: noteInput || null }).eq("id", id);
    if (error) {
      toast.error("Erreur: " + error.message);
    } else {
      toast.success("Note mise à jour");
      if (selected?.id === id) setSelected({ ...selected!, admin_note: noteInput || null });
      onRefresh();
    }
    setEditingNote(null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Sessions récentes</h2>
          <Button size="sm" variant="outline" onClick={onRefresh}>Rafraîchir</Button>
        </div>
        <ScrollArea className="h-[70vh] border rounded-lg">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`relative group w-full text-left p-3 border-b hover:bg-accent/50 transition-colors cursor-pointer ${
                selected?.id === s.id ? "bg-accent" : ""
              }`}
              onClick={() => setSelected(s)}
            >
              <div className="flex justify-between items-start">
                <div>
                  {s.name ? (
                    <span className="text-sm font-semibold">{s.name}</span>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">{s.id.slice(0, 8)}</span>
                  )}
                  <p className="text-xs text-muted-foreground">{fmt(s.started_at)}</p>
                </div>
                <div className="text-right text-xs flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full ${
                    s.ended_at ? "bg-green-900/40 text-green-300" : "bg-yellow-900/40 text-yellow-300"
                  }`}>
                    {s.ended_at ? "Terminée" : "En cours"}
                  </span>
                  <p className="mt-1">Trust: {s.trust_level ?? 0} | {s.duration_seconds ?? "—"}s</p>
                </div>
              </div>
              {s.admin_note && (
                <p className="text-xs text-muted-foreground mt-1 italic">💬 {s.admin_note}</p>
              )}
              {s.game_over_reason && (
                <p className="text-xs text-red-400 mt-1">Fin: {s.game_over_reason}</p>
              )}
              {/* Action buttons on hover */}
              <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                <Link
                  to={`/admin?tab=latency&session=${s.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground"
                  title="Voir latences & blocages"
                >
                  <Activity className="w-3 h-3" />
                </Link>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingName(s.id); setNameInput(s.name || ""); }}
                  className="p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground"
                  title="Renommer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingNote(s.id); setNoteInput(s.admin_note || ""); }}
                  className="p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground"
                  title="Note"
                >
                  <MessageSquare className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="p-1 rounded bg-destructive/20 hover:bg-destructive/40 text-destructive"
                  title="Supprimer"
                  disabled={deleting === s.id}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Inline edit: name */}
              {editingName === s.id && (
                <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Nom de la session..."
                    className="h-7 text-xs"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && saveName(s.id)}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveName(s.id)}><Check className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingName(null)}><X className="w-3 h-3" /></Button>
                </div>
              )}

              {/* Inline edit: note */}
              {editingNote === s.id && (
                <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                  <Textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Note / commentaire..."
                    className="text-xs min-h-[60px]"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => saveNote(s.id)}>Enregistrer</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingNote(null)}>Annuler</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="p-4 text-muted-foreground text-sm">Aucune session</p>
          )}
        </ScrollArea>
      </div>

      <div>
        {selected ? (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">
                {selected.name || `Session ${selected.id.slice(0, 8)}`}
              </h2>
              <div className="flex items-center gap-2">
                <Link to={`/admin?tab=latency&session=${selected.id}`}>
                  <Button size="sm" variant="outline">
                    <Activity className="w-3 h-3 mr-1" /> Voir latences
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteSession(selected.id)}
                  disabled={deleting === selected.id}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                </Button>
              </div>
            </div>

            {selected.admin_note && (
              <p className="text-sm italic text-muted-foreground mb-3 bg-muted/20 rounded p-2">💬 {selected.admin_note}</p>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <Stat label="Début" value={fmt(selected.started_at)} />
              <Stat label="Fin" value={fmt(selected.ended_at)} />
              <Stat label="Trust" value={String(selected.trust_level ?? 0)} />
              <Stat label="Durée" value={`${selected.duration_seconds ?? "—"}s`} />
              <Stat label="Branch" value={selected.branch || "—"} />
              <Stat label="Raison fin" value={selected.game_over_reason || "—"} />
            </div>

            {selected.triggers_activated?.length ? (
              <div className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Triggers activés</p>
                <div className="flex flex-wrap gap-1">
                  {selected.triggers_activated.map((t) => (
                    <span key={t} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* PRD4 — Rôle utilisateur */}
            {selected.player_role && typeof selected.player_role === "object" && (
              <div className="mb-3 border rounded p-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Rôle utilisateur (PRD4)
                </p>
                {selected.player_role.summary_for_user && (
                  <p className="text-sm mb-1">
                    <span className="text-muted-foreground">Pour le joueur : </span>
                    {selected.player_role.summary_for_user}
                  </p>
                )}
                {selected.player_role.summary_for_max && (
                  <p className="text-sm mb-2 italic">
                    <span className="text-muted-foreground not-italic">Pour Max : </span>
                    {selected.player_role.summary_for_max}
                  </p>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    JSON complet
                  </summary>
                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] bg-background/40 rounded p-2 max-h-48 overflow-auto">
{JSON.stringify(selected.player_role, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {/* PRD4 — Timeline GM post-turn */}
            {Array.isArray(selected.gm_post_turn_log) && selected.gm_post_turn_log.length > 0 && (
              <div className="mb-3 border rounded p-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Game Master post-turn ({selected.gm_post_turn_log.length} évaluations)
                </p>
                <ScrollArea className="h-48">
                  <div className="space-y-1.5">
                    {selected.gm_post_turn_log.map((evalEntry: any, i: number) => (
                      <div
                        key={i}
                        className="text-[11px] border-l-2 border-primary/40 pl-2 py-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-muted-foreground">
                            T{evalEntry.turn_index ?? i + 1}
                          </span>
                          <span className={evalEntry.engagement_delta >= 0 ? "text-green-400" : "text-red-400"}>
                            engagement {evalEntry.engagement_delta >= 0 ? "+" : ""}
                            {evalEntry.engagement_delta ?? 0}
                          </span>
                          {evalEntry.role_usage_quality && (
                            <span className="bg-muted/60 px-1.5 rounded text-[10px]">
                              rôle: {evalEntry.role_usage_quality}
                            </span>
                          )}
                          {evalEntry.confusion_detected && (
                            <span className="text-amber-400">⚠ confusion</span>
                          )}
                          {evalEntry.end_recommended && (
                            <span className="text-red-400 font-semibold">END</span>
                          )}
                          {evalEntry.moderation_flag && (
                            <span className="text-red-400 font-semibold">MOD</span>
                          )}
                          {typeof evalEntry.latency_ms === "number" && (
                            <span className="font-mono text-muted-foreground">
                              {evalEntry.latency_ms}ms
                            </span>
                          )}
                        </div>
                        {evalEntry.next_turn_guidance && (
                          <p className="text-muted-foreground mt-0.5 italic">
                            → {evalEntry.next_turn_guidance}
                          </p>
                        )}
                        {Array.isArray(evalEntry.topics_covered) && evalEntry.topics_covered.length > 0 && (
                          <p className="text-muted-foreground/70 mt-0.5">
                            sujets: {evalEntry.topics_covered.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {Array.isArray(selected.conversation_log) && selected.conversation_log.length > 0 && (
              <GmFallbackChart log={selected.conversation_log} />
            )}

            <div className="mb-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Conversation ({Array.isArray(selected.conversation_log) ? selected.conversation_log.length : 0} messages)
              </p>
              <ScrollArea className="h-60 border rounded p-2">
                <TooltipProvider delayDuration={150}>
                  {Array.isArray(selected.conversation_log) &&
                    selected.conversation_log.map((msg: any, i: number) => {
                      const fb = msg.gmFallback;
                      const blocker = msg.pipeline?.blocker;
                      return (
                        <div key={i} className={`mb-2 text-sm ${msg.role === "max" ? "text-blue-300" : "text-green-300"}`}>
                          <span className="font-bold">{msg.role === "max" ? "Max" : "User"}:</span> {msg.content}
                          {msg.role === "user" && msg.labels && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(msg.labels.themes ?? []).map((t: string, k: number) => (
                                <span key={`th-${k}`} className="text-[10px] uppercase tracking-wide bg-primary/15 text-primary border border-primary/40 px-1.5 py-0.5 rounded">
                                  {t}
                                </span>
                              ))}
                              {(msg.labels.topics ?? []).map((t: string, k: number) => (
                                <span key={`tp-${k}`} className="text-[10px] uppercase tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                                  {t}
                                </span>
                              ))}
                              {(msg.labels.intentions ?? []).map((t: string, k: number) => (
                                <span key={`in-${k}`} className="text-[10px] uppercase tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {msg.role === "max" && (fb || blocker) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {fb && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help text-[10px] uppercase tracking-wide bg-destructive/20 text-destructive border border-destructive/40 px-1.5 py-0.5 rounded">
                                      GM fallback · {fb.kind}
                                      {typeof fb.elapsed_ms === "number" ? ` · ${fb.elapsed_ms}ms` : ""}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="bottom"
                                    align="start"
                                    className="max-w-[420px] p-0 bg-popover text-popover-foreground border"
                                  >
                                    <div className="p-2.5 space-y-1.5 text-xs">
                                      <div className="flex items-center justify-between gap-3 border-b border-border pb-1.5">
                                        <span className="font-semibold uppercase tracking-wide text-destructive">
                                          GM fallback · {fb.kind}
                                        </span>
                                        {typeof fb.elapsed_ms === "number" && (
                                          <span className="font-mono text-[10px] text-muted-foreground">
                                            {fb.elapsed_ms} ms
                                            {typeof fb.timeout_ms === "number"
                                              ? ` / ${fb.timeout_ms} ms seuil`
                                              : ""}
                                          </span>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1">
                                        <span className="text-muted-foreground">Raison</span>
                                        <span className="break-words">{fb.reason || "—"}</span>

                                        <span className="text-muted-foreground">Modèle</span>
                                        <span className="font-mono break-all">{fb.model || "—"}</span>

                                        <span className="text-muted-foreground">Timeout</span>
                                        <span className="font-mono">
                                          {typeof fb.timeout_ms === "number" ? `${fb.timeout_ms} ms` : "—"}
                                        </span>

                                        <span className="text-muted-foreground">Écoulé</span>
                                        <span className="font-mono">
                                          {typeof fb.elapsed_ms === "number" ? `${fb.elapsed_ms} ms` : "—"}
                                        </span>
                                      </div>
                                      {fb.error_excerpt && (
                                        <div className="pt-1.5 border-t border-border">
                                          <p className="text-muted-foreground mb-1">Extrait erreur (200 c.)</p>
                                          <pre className="whitespace-pre-wrap break-words font-mono text-[10px] bg-muted/40 rounded p-1.5 max-h-32 overflow-auto">
{fb.error_excerpt}
                                          </pre>
                                        </div>
                                      )}
                                      {FALLBACK_TARGET_TAB[fb.kind] && (
                                        <div className="pt-1.5 border-t border-border">
                                          <Link
                                            to={`/admin?tab=${FALLBACK_TARGET_TAB[fb.kind].tab}`}
                                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                            {FALLBACK_TARGET_TAB[fb.kind].label}
                                          </Link>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {blocker && (
                                <span className="text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                                  blocker · {blocker}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </TooltipProvider>
              </ScrollArea>
            </div>

            {selected.questionnaire_responses && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Questionnaire</p>
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 rounded p-3">
                  <Stat label="Note expérience" value={`${selected.questionnaire_responses.experience_rating}/10`} />
                  <Stat label="NPS" value={`${selected.questionnaire_responses.nps}/10`} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            Sélectionne une session pour voir les détails
          </div>
        )}
      </div>
    </div>
  );
}
