import { useEffect, useMemo, useState } from "react";
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
  type FlowLink,
  type MechanismFilter,
  type VideoDecisionReport,
} from "@/services/videoDecisionLog";

const MECHANISM_LABEL: Record<DecisionTurn["mechanism"], string> = {
  overlay: "Superposition",
  extract: "Extrait",
  game_master: "Game Master",
  unknown: "Ancien journal",
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function characterLabel(character: string | null): string {
  if (character === "max") return "Max";
  if (character === "emma") return "Emma";
  return character ?? "—";
}

function shortSession(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
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

function Sankey({ links }: { links: FlowLink[] }) {
  const [hover, setHover] = useState<FlowLink | null>(null);
  const layout = useMemo(() => {
    const sourceOrder: string[] = [];
    const targetOrder: string[] = [];
    const sourceWeight = new Map<string, number>();
    const targetWeight = new Map<string, number>();
    for (const link of links) {
      if (!sourceOrder.includes(link.source)) sourceOrder.push(link.source);
      if (!targetOrder.includes(link.target)) targetOrder.push(link.target);
      sourceWeight.set(link.source, (sourceWeight.get(link.source) ?? 0) + link.count);
      targetWeight.set(link.target, (targetWeight.get(link.target) ?? 0) + link.count);
    }
    const width = 760;
    const row = 28;
    const height = Math.max(160, Math.max(sourceOrder.length, targetOrder.length, 1) * row + 16);
    const place = (names: string[], weights: Map<string, number>) => {
      const sum = names.reduce((total, name) => total + (weights.get(name) ?? 0), 0) || 1;
      const gap = 6;
      const inner = height - 16 - gap * Math.max(0, names.length - 1);
      let y = 8;
      return names.map((name) => {
        const h = Math.max(10, (inner * (weights.get(name) ?? 0)) / sum);
        const node = { name, y, h };
        y += h + gap;
        return node;
      });
    };
    return { width, height, left: place(sourceOrder, sourceWeight), right: place(targetOrder, targetWeight) };
  }, [links]);

  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">Pas assez de thèmes GM sur cette période pour tracer un flux.</p>;
  }

  const leftX = 168;
  const rightX = layout.width - 188;
  const nodeOf = (nodes: { name: string; y: number; h: number }[], name: string) => nodes.find((node) => node.name === name);

  return (
    <div className="space-y-2" data-testid="video-decision-sankey">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="w-full text-foreground" role="img" aria-label="Flux des thèmes">
        {links.map((link) => {
          const source = nodeOf(layout.left, link.source);
          const target = nodeOf(layout.right, link.target);
          if (!source || !target) return null;
          const y1 = source.y + source.h / 2;
          const y2 = target.y + target.h / 2;
          const path = `M ${leftX} ${y1} C ${(leftX + rightX) / 2} ${y1}, ${(leftX + rightX) / 2} ${y2}, ${rightX} ${y2}`;
          return (
            <path
              key={`${link.source}-${link.target}`}
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth={Math.max(2, Math.min(18, 2 + link.count))}
              strokeOpacity={hover && hover !== link ? 0.15 : 0.55}
              className="text-primary"
              onMouseEnter={() => setHover(link)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${link.source} → ${link.target} : ${link.count}`}</title>
            </path>
          );
        })}
        {layout.left.map((node) => (
          <g key={`l-${node.name}`}>
            <rect x={leftX - 8} y={node.y} width={8} height={node.h} className="fill-primary" />
            <text x={leftX - 14} y={node.y + node.h / 2} textAnchor="end" dominantBaseline="middle" className="fill-foreground text-[11px]">
              {node.name.length > 28 ? `${node.name.slice(0, 27)}…` : node.name}
            </text>
          </g>
        ))}
        {layout.right.map((node) => (
          <g key={`r-${node.name}`}>
            <rect x={rightX} y={node.y} width={8} height={node.h} className="fill-primary" />
            <text x={rightX + 14} y={node.y + node.h / 2} dominantBaseline="middle" className="fill-foreground text-[11px]">
              {node.name.length > 32 ? `${node.name.slice(0, 31)}…` : node.name}
            </text>
          </g>
        ))}
      </svg>
      <p className="min-h-6 text-sm text-muted-foreground" data-testid="sankey-hover">
        {hover
          ? `${hover.source} → ${hover.target} · ${hover.count}${hover.examples[0] ? ` · ${hover.examples[0]}` : ""}`
          : "Survolez un flux pour voir le nombre."}
      </p>
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
        <Badge variant="outline">{MECHANISM_LABEL[turn.mechanism]}</Badge>
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
    <div className="space-y-4">
      {sessions.map((session) => (
        <section key={session.sessionId} className="rounded-lg border bg-card p-3">
          <h3 className="text-sm font-semibold">
            Session {shortSession(session.sessionId)} · {formatWhen(session.startedAt)} · {session.turns.length} décision{session.turns.length > 1 ? "s" : ""}
          </h3>
          {session.turns.map((turn) => <TurnRow key={turn.key} turn={turn} vocabulary={vocabulary} />)}
        </section>
      ))}
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
            <SelectItem value="all">Tous les mécanismes</SelectItem>
            <SelectItem value="overlay">Superposition</SelectItem>
            <SelectItem value="game_master">Game Master</SelectItem>
            <SelectItem value="extract">Extraits</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className="w-52" aria-label="Session"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sessions</SelectItem>
            {(report?.sessions ?? []).map((session) => (
              <SelectItem key={session.sessionId} value={session.sessionId}>
                {shortSession(session.sessionId)} · {formatWhen(session.startedAt)}
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
      {report?.vocabularyZeroRows && (
        <p className="text-sm text-amber-700 dark:text-amber-300" data-testid="video-vocabulary-zero-rows">
          Le vocabulaire n'a renvoyé aucune ligne. Une lecture bloquée par les règles d'accès ressemble à ça : ce n'est pas une liste vide.
        </p>
      )}
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
          <Sankey links={flow === "videos" ? flows.toVideos : flows.evolution} />
        </TabsContent>
        <TabsContent value="criteria" className="mt-3 space-y-4">
          <p className="text-sm">
            {criteria.turns === 0
              ? "Aucune décision à résumer."
              : `${criteria.played} jouée${criteria.played > 1 ? "s" : ""} · ${criteria.skipped} écartée${criteria.skipped > 1 ? "s" : ""} sur ${criteria.turns}`}
          </p>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Par motif</h3>
            <Bar label="jouée" count={criteria.played} total={criteria.turns} />
            {criteria.byReason.map((entry) => <Bar key={entry.reason} label={entry.label} count={entry.count} total={criteria.turns} />)}
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
