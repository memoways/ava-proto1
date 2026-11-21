import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isOutsideList, type VideoLabelLists } from "@/services/videoLabelVocabulary";
import {
  criteriaSummary,
  filterSessions,
  loadVideoDecisions,
  themeFlows,
  type DecisionSession,
  type LabelDimension,
  type DecisionTurn,
  type MechanismFilter,
  type ThemeEvolution,
  type VideoDecisionReport,
} from "@/services/videoDecisionLog";
import { bandPath, layoutSankey, videoFlowColumns, type SankeyBandLayout } from "@/services/videoDecisionSankey";

function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function mechanismLabel(mechanism: DecisionTurn["mechanism"]): string {
  if (mechanism === "extract") return "Extrait";
  if (mechanism === "unknown") return "Ancien journal";
  return "Cinématique";
}

function mechanismNote(mechanism: DecisionTurn["mechanism"]): string | null {
  if (mechanism === "overlay") return "Cinématique montrée pendant que le personnage parle.";
  if (mechanism === "game_master") return "Cinématique qui coupe la conversation.";
  if (mechanism === "extract") return "Extrait du film.";
  return null;
}

function characterLabel(character: string | null): string {
  if (character === "max") return "Max";
  if (character === "emma") return "Emma";
  return character ?? "—";
}

function videoCountWords(played: number): string {
  return `vidéo${played > 1 ? "s" : ""} jouée${played > 1 ? "s" : ""}`;
}

function Bar({ label, count, total }: { label: string; count: number; total: number }) {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-2 text-sm">
      <span className="truncate text-foreground">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
      </span>
      <span className="tabular-nums text-muted-foreground">{count} · {share} %</span>
    </div>
  );
}

type SankeyHover =
  | { kind: "band"; band: SankeyBandLayout }
  | { kind: "node"; column: number; name: string };

function formatFlowCount(count: number): string {
  const rounded = Math.round(count * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) return String(Math.round(rounded));
  return rounded.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function nodeCaption(name: string, count: number, total: number): string {
  const suffix = ` · ${formatFlowCount(count)} · ${percent(count, total)} %`;
  const room = Math.max(10, 42 - suffix.length);
  const short = name.length > room ? `${name.slice(0, room - 1)}…` : name;
  return `${short}${suffix}`;
}

function Sankey({ flow, evolution }: { flow: ThemeEvolution; evolution: boolean }) {
  const [hover, setHover] = useState<SankeyHover | null>(null);
  const layout = useMemo(() => layoutSankey(flow), [flow]);
  const columnTotal = (column: number) => layout.columns[column]?.nodes.reduce((sum, node) => sum + node.count, 0) ?? 0;

  if (flow.columns.length === 0) {
    return <p className="text-sm text-muted-foreground">{evolution ? "Aucune vidéo jouée sur cette période, donc pas d'évolution." : "Pas assez de thèmes GM sur cette période pour tracer un flux."}</p>;
  }

  const emphasized = (band: SankeyBandLayout) => {
    if (!hover) return true;
    if (hover.kind === "band") return hover.band.key === band.key;
    return hover.column === band.column && hover.name === band.source
      || hover.column === band.column + 1 && hover.name === band.target;
  };
  const firstColumn = layout.columns[0];
  const sources = (firstColumn?.nodes ?? []).map((node) => ({
    ...node,
    share: percent(node.count, columnTotal(0)),
    destinations: layout.bands
      .filter((band) => band.column === 0 && band.source === node.name)
      .sort((a, b) => b.count - a.count || a.target.localeCompare(b.target, "fr")),
  }));

  let caption = evolution
    ? "Chaque colonne est une vidéo jouée, dans l'ordre de la session. L'épaisseur suit le chiffre. Survolez un flux pour voir le nombre."
    : "L'épaisseur des flux suit le chiffre, sur toute la hauteur de la barre. Survolez un flux pour voir le nombre.";
  if (evolution && flow.columns.length === 1) {
    caption = "Une seule vidéo jouée dans ces sessions. L'évolution apparaît dès qu'une session en joue une deuxième. Survolez un thème pour le détail.";
  }
  if (hover?.kind === "band") {
    const band = hover.band;
    const from = layout.columns[band.column]?.nodes.find((node) => node.name === band.source)?.count ?? band.count;
    const to = layout.columns[band.column + 1]?.nodes.find((node) => node.name === band.target)?.count ?? band.count;
    const example = flow.steps[band.column]?.find((link) => link.source === band.source && link.target === band.target)?.examples[0];
    caption = `${band.source} → ${band.target} · ${formatFlowCount(band.count)} · ${percent(band.count, from)} % de ${band.source} · ${percent(band.count, to)} % de ${band.target}${example ? ` · ${example}` : ""}`;
  } else if (hover?.kind === "node") {
    const node = layout.columns[hover.column]?.nodes.find((entry) => entry.name === hover.name);
    const leaving = layout.bands
      .filter((band) => band.column === hover.column && band.source === hover.name)
      .sort((a, b) => b.count - a.count);
    const arriving = layout.bands
      .filter((band) => band.column === hover.column - 1 && band.target === hover.name)
      .sort((a, b) => b.count - a.count);
    const parts = (leaving.length ? leaving : arriving).map((band) => {
      const label = leaving.length ? band.target : band.source;
      return `${label} ${formatFlowCount(band.count)} (${percent(band.count, node?.count ?? band.count)} %)`;
    });
    caption = `${hover.name} · ${formatFlowCount(node?.count ?? 0)} · ${percent(node?.count ?? 0, columnTotal(hover.column))} % · ${leaving.length ? "vers" : "depuis"} ${parts.join(" · ") || "—"}`;
  }

  return (
    <div className="space-y-3" data-testid="video-decision-sankey">
      <div className="overflow-x-auto">
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="text-foreground"
          role="img"
          aria-label={evolution ? "Évolution des thèmes d'une vidéo jouée à la suivante" : "Flux des thèmes vers les vidéos"}
        >
          {layout.bands.map((band) => {
            const active = emphasized(band);
            const title = `${band.source} → ${band.target} : ${formatFlowCount(band.count)}`;
            return (
              <path
                key={band.key}
                d={bandPath(band)}
                data-testid="sankey-band"
                fill="currentColor"
                fillOpacity={active ? 0.72 : hover ? 0.12 : 0.5}
                className="text-primary"
                onMouseEnter={() => setHover({ kind: "band", band })}
                onMouseLeave={() => setHover(null)}
              >
                <title>{title}</title>
              </path>
            );
          })}
          {layout.columns.map((column) => {
            const total = column.nodes.reduce((sum, node) => sum + node.count, 0);
            return (
              <g key={column.label}>
                <text x={column.x} y={16} textAnchor="middle" className="fill-muted-foreground text-[11px]">{column.label}</text>
                {column.nodes.map((node) => {
                  const last = node.column === layout.columns.length - 1 && layout.columns.length > 1;
                  return (
                    <g key={`${column.label}-${node.name}`} onMouseEnter={() => setHover({ kind: "node", column: node.column, name: node.name })} onMouseLeave={() => setHover(null)}>
                      <rect x={node.x} y={node.y} width={10} height={Math.max(node.h, 1)} className="fill-primary" />
                      <text
                        x={last ? node.x + 16 : node.x - 8}
                        y={node.y + node.h / 2}
                        textAnchor={last ? "start" : "end"}
                        dominantBaseline="middle"
                        className="fill-foreground stroke-background text-[11px]"
                        strokeWidth={3}
                        style={{ paintOrder: "stroke" }}
                      >
                        {nodeCaption(node.name, node.count, total)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="min-h-6 text-sm text-muted-foreground" data-testid="sankey-hover">{caption}</p>
      {!evolution && (
        <div className="space-y-1">
          {sources.map((source) => (
            <Collapsible key={source.name} className="rounded-md border">
              <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm [&[data-state=open]>svg]:rotate-90">
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform" />
                <span className="font-medium">{source.name}</span>
                <span className="tabular-nums text-muted-foreground">{formatFlowCount(source.count)} · {source.share} %</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 px-9 pb-2 text-sm text-muted-foreground">
                {source.destinations.map((band) => (
                  <p key={band.key}>
                    {band.target} · {formatFlowCount(band.count)} · {percent(band.count, source.count)} % de {source.name}
                  </p>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}

function LabelMark({ label, list }: { label: string; list: readonly string[] | null | undefined }) {
  const outside = Boolean(list && isOutsideList(label, list));
  return (
    <span className="text-xs text-primary">
      {label}
      {outside && <span className="text-amber-700 dark:text-amber-300" data-testid="label-outside">hors liste</span>}
    </span>
  );
}

function TurnRow({ turn, vocabulary }: { turn: DecisionTurn; vocabulary: VideoLabelLists | null }) {
  return (
    <Collapsible className="border-t py-2" data-testid="video-decision-turn">
      <CollapsibleTrigger className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 text-left text-sm">
        <span className="font-medium">Tour {turn.turnIndex ?? "—"}</span>
        <span className="text-muted-foreground">{characterLabel(turn.character)}</span>
        <Badge variant="outline">{mechanismLabel(turn.mechanism)}</Badge>
        <Badge variant={turn.outcome === "played" ? "default" : "secondary"}>
          {turn.outcome === "played" ? turn.videoTitle ?? "vidéo jouée" : turn.reasonLabel}
        </Badge>
        {turn.themes.map((theme) => <LabelMark key={`t-${theme}`} label={theme} list={vocabulary?.themes} />)}
        {(turn.emotions ?? []).map((emotion) => <LabelMark key={`e-${emotion}`} label={emotion} list={vocabulary?.emotions} />)}
        {(turn.stakes ?? []).map((stake) => <LabelMark key={`s-${stake}`} label={stake} list={vocabulary?.stakes} />)}
        {turn.quote && <span className="text-muted-foreground">{turn.quote}</span>}
        {turn.degraded && <span className="text-xs text-muted-foreground">journal partiel</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 pl-1 text-xs text-muted-foreground">
        {mechanismNote(turn.mechanism) && <p>{mechanismNote(turn.mechanism)}</p>}
        {turn.outcome === "played" && <p>Vidéo : {turn.videoTitle}{turn.confidence != null ? ` · confiance ${turn.confidence}` : ""}</p>}
        {turn.quote && <p data-testid="video-decision-quote">{turn.quote}</p>}
        {turn.replyExcerpt && <p>Réplique : « {turn.replyExcerpt} »</p>}
        {turn.userExcerpt && <p>Joueur : « {turn.userExcerpt} »</p>}
        <p>
          Candidates{turn.candidateCount != null ? ` (${turn.candidateCount})` : ""} :{" "}
          {turn.candidates.length ? turn.candidates.map((candidate) => candidate.title).join(", ") : "non enregistrées"}
        </p>
        {turn.excluded.length > 0 && (
          <ul>
            {turn.excluded.map((entry) => (
              <li key={entry.reason}>Écartées · {entry.label} : {entry.videoIds.join(", ")}</li>
            ))}
          </ul>
        )}
        {turn.topics.length > 0 && <p>Sujets GM : {turn.topics.join(", ")}</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SessionList({ sessions, vocabulary }: { sessions: DecisionSession[]; vocabulary: VideoLabelLists | null }) {
  if (sessions.length === 0) return <p className="text-sm text-muted-foreground">Aucune décision pour ces filtres.</p>;
  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const played = session.turns.filter((turn) => turn.outcome === "played").length;
        const skipped = session.turns.length - played;
        return (
          <Collapsible key={session.sessionId} className="rounded-lg border bg-card" data-testid="video-decision-session">
            <CollapsibleTrigger className="flex w-full items-center gap-3 p-3 text-left [&[data-state=open]>svg]:rotate-90">
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform" />
              <span className="min-w-0 flex-1 text-sm font-semibold">{session.title}</span>
              <span className="shrink-0 text-sm text-muted-foreground">
                <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">{played}</span>
                {` ${videoCountWords(played)}`}
                {skipped > 0 ? ` · ${skipped} écartée${skipped > 1 ? "s" : ""}` : ""}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-3">
              {session.turns.map((turn) => <TurnRow key={turn.key} turn={turn} vocabulary={vocabulary} />)}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

export default function VideoDecisionsTab() {
  const [days, setDays] = useState<7 | 30>(30);
  const [mechanism, setMechanism] = useState<MechanismFilter>("all");
  const [sessionId, setSessionId] = useState("all");
  const [flow, setFlow] = useState<"videos" | "themes">("videos");
  const [dimension, setDimension] = useState<LabelDimension>("themes");
  const [report, setReport] = useState<VideoDecisionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(null);
    loadVideoDecisions({ sinceDays: days })
      .then((next) => { if (!cancelled) setReport(next); })
      .catch((error: unknown) => { if (!cancelled) setFailed(error instanceof Error ? error.message : "lecture impossible"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const sessions = useMemo(
    () => (report ? filterSessions(report.sessions, { mechanism, sessionId: sessionId === "all" ? null : sessionId }) : []),
    [report, mechanism, sessionId],
  );
  const turns = sessions.flatMap((session) => session.turns);
  const dimensions = report?.labelDimensions ?? { emotion: false, stake: false };
  const activeDimension: LabelDimension = dimension === "emotions" && !dimensions.emotion
    ? "themes"
    : dimension === "stakes" && !dimensions.stake
      ? "themes"
      : dimension;
  const dimensionWord = activeDimension === "emotions" ? "émotions" : activeDimension === "stakes" ? "enjeux" : "thèmes";
  const flows = themeFlows(sessions, { dimension: activeDimension, vocabulary: report?.vocabulary ?? null });
  const criteria = criteriaSummary(turns);

  return (
    <div className="space-y-4" data-testid="video-decisions-tab">
      <div>
        <h2 className="text-lg font-semibold">Décisions vidéo</h2>
        <p className="text-sm text-muted-foreground">Pourquoi une vidéo a été jouée ou écartée. Lecture seule : rien ne change en jeu.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={days === 7 ? "default" : "outline"} onClick={() => setDays(7)}>7 jours</Button>
        <Button size="sm" variant={days === 30 ? "default" : "outline"} onClick={() => setDays(30)}>30 jours</Button>
        <Select value={mechanism} onValueChange={(value) => setMechanism(value as MechanismFilter)}>
          <SelectTrigger className="w-44" aria-label="Mécanisme"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="cinematic">Cinématiques</SelectItem>
            <SelectItem value="extract">Extraits</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className="w-[min(40rem,100%)]" aria-label="Session"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sessions</SelectItem>
            {(report?.sessions ?? []).map((session) => (
              <SelectItem key={session.sessionId} value={session.sessionId}>
                {session.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Lecture du journal…</p>}
      {failed && <p role="alert" className="text-sm text-destructive">{failed}</p>}
      {report?.error && <p role="alert" className="text-sm text-destructive">{report.error}</p>}
      {report?.zeroRows && !report.error && (
        <p className="text-sm text-amber-700 dark:text-amber-300" data-testid="video-decisions-empty">
          Aucune ligne renvoyée sur cette période. Une lecture bloquée par les règles d'accès renvoie aussi zéro ligne, sans erreur.
        </p>
      )}
      {report?.catalogUnreadable && <p className="text-sm text-amber-700 dark:text-amber-300">Les titres de vidéos n'ont pas pu être lus : les identifiants sont affichés tels quels.</p>}
      {report?.themesUnreadable && <p className="text-sm text-amber-700 dark:text-amber-300">Les thèmes du Game Master n'ont pas pu être lus pour ces sessions.</p>}
      {report?.vocabularyError && <p role="alert" className="text-sm text-destructive">{report.vocabularyError}</p>}
      {report?.truncated && <p className="text-sm text-muted-foreground">Journal tronqué aux 5 000 événements les plus anciens de la période.</p>}

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Par session</TabsTrigger>
          <TabsTrigger value="themes">Par thèmes</TabsTrigger>
          <TabsTrigger value="criteria">Synthèse</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-3">
          <SessionList sessions={sessions} vocabulary={report?.vocabulary ?? null} />
        </TabsContent>
        <TabsContent value="themes" className="mt-3 space-y-3">
          {(dimensions.emotion || dimensions.stake) && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={activeDimension === "themes" ? "default" : "outline"} onClick={() => setDimension("themes")}>Thèmes</Button>
              {dimensions.emotion && <Button size="sm" variant={activeDimension === "emotions" ? "default" : "outline"} onClick={() => setDimension("emotions")}>Émotion</Button>}
              {dimensions.stake && <Button size="sm" variant={activeDimension === "stakes" ? "default" : "outline"} onClick={() => setDimension("stakes")}>Enjeu</Button>}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant={flow === "videos" ? "default" : "outline"} onClick={() => setFlow("videos")}>
              {activeDimension === "themes" ? "Thèmes → vidéos" : `${dimensionWord[0].toUpperCase()}${dimensionWord.slice(1)} → vidéos`}
            </Button>
            <Button size="sm" variant={flow === "themes" ? "default" : "outline"} onClick={() => setFlow("themes")}>
              {activeDimension === "themes" ? "Évolution des thèmes" : `Évolution des ${dimensionWord}`}
            </Button>
          </div>
          <Sankey
            evolution={flow === "themes"}
            flow={flow === "videos"
              ? videoFlowColumns(
                flows.toVideos,
                activeDimension === "emotions" ? "Émotions" : activeDimension === "stakes" ? "Enjeux" : "Thèmes",
                "Vidéos",
              )
              : flows.evolution}
          />
        </TabsContent>
        <TabsContent value="criteria" className="mt-3 space-y-4">
          <p className="text-sm">
            {criteria.turns === 0
              ? "Aucune décision à résumer."
              : `${criteria.played} jouée${criteria.played > 1 ? "s" : ""} · ${criteria.skipped} écartée${criteria.skipped > 1 ? "s" : ""} sur ${criteria.turns}`}
          </p>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Par motif</h3>
            {[
              { key: "played", label: "jouée", count: criteria.played },
              ...criteria.byReason.map((entry) => ({ key: entry.reason, label: entry.label, count: entry.count })),
            ]
              .filter((entry) => entry.count > 0)
              .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"))
              .map((entry) => <Bar key={entry.key} label={entry.label} count={entry.count} total={criteria.turns} />)}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Confiance</h3>
            {criteria.confidence.filter((bucket) => bucket.count > 0).map((bucket) => (
              <Bar key={bucket.label} label={bucket.label} count={bucket.count} total={criteria.turns} />
            ))}
          </div>
          {criteria.linkDetails.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Liens</h3>
              {criteria.linkDetails.map((entry) => <Bar key={entry.detail} label={entry.label} count={entry.count} total={criteria.turns} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
