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
  type FlowLink,
  type MechanismFilter,
  type VideoDecisionReport,
} from "@/services/videoDecisionLog";

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

function videoCountLabel(played: number): string {
  return `${played} vidéo${played > 1 ? "s" : ""} jouée${played > 1 ? "s" : ""}`;
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
  | { kind: "link"; link: FlowLink }
  | { kind: "node"; side: "in" | "out"; name: string };

function nodeCaption(name: string, count: number, total: number): string {
  const suffix = ` · ${count} · ${percent(count, total)} %`;
  const room = Math.max(10, 42 - suffix.length);
  const short = name.length > room ? `${name.slice(0, room - 1)}…` : name;
  return `${short}${suffix}`;
}

function Sankey({ links }: { links: FlowLink[] }) {
  const [hover, setHover] = useState<SankeyHover | null>(null);
  const layout = useMemo(() => {
    const sourceWeight = new Map<string, number>();
    const targetWeight = new Map<string, number>();
    for (const link of links) {
      sourceWeight.set(link.source, (sourceWeight.get(link.source) ?? 0) + link.count);
      targetWeight.set(link.target, (targetWeight.get(link.target) ?? 0) + link.count);
    }
    const byWeight = (weights: Map<string, number>) =>
      [...weights.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).map(([name]) => name);
    const sourceOrder = byWeight(sourceWeight);
    const targetOrder = byWeight(targetWeight);
    const total = [...sourceWeight.values()].reduce((sum, count) => sum + count, 0);
    const width = 980;
    const row = 32;
    const height = Math.max(180, Math.max(sourceOrder.length, targetOrder.length, 1) * row + 16);
    const place = (names: string[], weights: Map<string, number>) => {
      const sum = names.reduce((count, name) => count + (weights.get(name) ?? 0), 0) || 1;
      const gap = 8;
      const inner = height - 16 - gap * Math.max(0, names.length - 1);
      let y = 8;
      return names.map((name) => {
        const count = weights.get(name) ?? 0;
        const h = Math.max(16, (inner * count) / sum);
        const node = { name, y, h, count };
        y += h + gap;
        return node;
      });
    };
    return {
      width,
      height,
      total,
      maxLink: Math.max(1, ...links.map((link) => link.count)),
      left: place(sourceOrder, sourceWeight),
      right: place(targetOrder, targetWeight),
      sourceWeight,
      targetWeight,
    };
  }, [links]);

  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">Pas assez de thèmes GM sur cette période pour tracer un flux.</p>;
  }

  const leftX = 300;
  const rightX = layout.width - 320;
  const nodeOf = (nodes: { name: string; y: number; h: number; count: number }[], name: string) => nodes.find((node) => node.name === name);
  const emphasized = (link: FlowLink) => {
    if (!hover) return true;
    if (hover.kind === "link") return hover.link === link;
    return hover.side === "in" ? link.source === hover.name : link.target === hover.name;
  };
  const sources = layout.left.map((node) => ({
    ...node,
    share: percent(node.count, layout.total),
    destinations: links
      .filter((link) => link.source === node.name)
      .sort((a, b) => b.count - a.count || a.target.localeCompare(b.target, "fr")),
  }));

  let caption = "Le nombre à gauche est la part du thème, à droite celle de la vidéo, sur le lien celle du chemin. Survolez pour voir vers quoi part le pourcentage.";
  if (hover?.kind === "link") {
    const link = hover.link;
    const from = layout.sourceWeight.get(link.source) ?? link.count;
    const to = layout.targetWeight.get(link.target) ?? link.count;
    caption = `${link.source} → ${link.target} · ${link.count} sur le chemin · ${percent(link.count, from)} % de ${link.source} · ${percent(link.count, to)} % de la cible · ${percent(link.count, layout.total)} % de l'ensemble${link.examples[0] ? ` · ${link.examples[0]}` : ""}`;
  } else if (hover?.kind === "node" && hover.side === "in") {
    const node = sources.find((entry) => entry.name === hover.name);
    const parts = (node?.destinations ?? []).map((link) => `${link.target} ${link.count} (${percent(link.count, node?.count ?? link.count)} %)`);
    caption = `${hover.name} · ${node?.count ?? 0} décisions · ${node?.share ?? 0} % de l'ensemble · vers ${parts.join(" · ") || "—"}`;
  } else if (hover?.kind === "node") {
    const incoming = links
      .filter((link) => link.target === hover.name)
      .sort((a, b) => b.count - a.count);
    const count = layout.targetWeight.get(hover.name) ?? 0;
    const parts = incoming.map((link) => `${link.source} ${link.count} (${percent(link.count, count)} %)`);
    caption = `${hover.name} · ${count} décisions · ${percent(count, layout.total)} % de l'ensemble · depuis ${parts.join(" · ") || "—"}`;
  }

  return (
    <div className="space-y-3" data-testid="video-decision-sankey">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="w-full text-foreground" role="img" aria-label="Flux des thèmes, avec le nombre et le pourcentage de chaque thème, de chaque vidéo et de chaque lien">
        {links.map((link) => {
          const source = nodeOf(layout.left, link.source);
          const target = nodeOf(layout.right, link.target);
          if (!source || !target) return null;
          const y1 = source.y + source.h / 2;
          const y2 = target.y + target.h / 2;
          const midX = (leftX + rightX) / 2;
          const path = `M ${leftX} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${rightX} ${y2}`;
          const active = emphasized(link);
          return (
            <g key={`${link.source}-${link.target}`} onMouseEnter={() => setHover({ kind: "link", link })} onMouseLeave={() => setHover(null)}>
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={Math.max(2, (link.count / layout.maxLink) * 18)}
                strokeOpacity={active ? 0.7 : 0.12}
                className="text-primary"
              >
                <title>{`${link.source} → ${link.target} : ${link.count}`}</title>
              </path>
              <text
                x={midX}
                y={(y1 + y2) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-[10px]"
                opacity={active ? 1 : 0.35}
              >
                {link.count}
              </text>
            </g>
          );
        })}
        {layout.left.map((node) => (
          <g key={`l-${node.name}`} onMouseEnter={() => setHover({ kind: "node", side: "in", name: node.name })} onMouseLeave={() => setHover(null)}>
            <rect x={leftX - 8} y={node.y} width={8} height={node.h} className="fill-primary" />
            <text x={leftX - 14} y={node.y + node.h / 2} textAnchor="end" dominantBaseline="middle" className="fill-foreground text-[11px]">
              {nodeCaption(node.name, node.count, layout.total)}
            </text>
          </g>
        ))}
        {layout.right.map((node) => (
          <g key={`r-${node.name}`} onMouseEnter={() => setHover({ kind: "node", side: "out", name: node.name })} onMouseLeave={() => setHover(null)}>
            <rect x={rightX} y={node.y} width={8} height={node.h} className="fill-primary" />
            <text x={rightX + 14} y={node.y + node.h / 2} dominantBaseline="middle" className="fill-foreground text-[11px]">
              {nodeCaption(node.name, node.count, layout.total)}
            </text>
          </g>
        ))}
      </svg>
      <p className="min-h-6 text-sm text-muted-foreground" data-testid="sankey-hover">{caption}</p>
      <div className="space-y-1">
        {sources.map((source) => (
          <Collapsible key={source.name} className="rounded-md border">
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm [&[data-state=open]>svg]:rotate-90">
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform" />
              <span className="font-medium">{source.name}</span>
              <span className="tabular-nums text-muted-foreground">{source.count} · {source.share} %</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 px-9 pb-2 text-sm text-muted-foreground">
              {source.destinations.map((link) => (
                <p key={link.target}>
                  {link.target} · {link.count} · {percent(link.count, source.count)} % de {source.name}
                  {" · "}{percent(link.count, layout.total)} % de l'ensemble
                </p>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
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
            <CollapsibleTrigger className="flex w-full items-start gap-2 p-3 text-left [&[data-state=open]>svg]:rotate-90">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 transition-transform" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{session.title}</span>
                <span className="text-xs text-muted-foreground">
                  {videoCountLabel(played)}
                  {skipped > 0 ? ` · ${skipped} écartée${skipped > 1 ? "s" : ""}` : ""}
                </span>
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
