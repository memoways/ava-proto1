import type { CharacterPrompt } from "@/services/characterPromptService";

/**
 * rich_v2 — compilation déterministe de la fiche Notion de Max.
 *
 * Principes (docs/plan_optimisation_payload_max.md §9) :
 * - `character_prompts` est l'unique source éditoriale statique ;
 * - les champs Notion ne sont jamais réécrits ni sauvegardés condensés ;
 * - la sélection se fait par sous-parties entières et priorités déclarées,
 *   jamais par découpe aveugle du début du champ ;
 * - la timeline sépare le préambule éditorial des événements datés et injecte
 *   d'abord aujourd'hui puis hier, puis le séjour, puis les pivots anciens ;
 * - les quatre niveaux de profondeur sont toujours représentés, avec leur
 *   préambule de progression comme invariant.
 */

export const RICH_V2_LIMITS = {
  /** Cible habituelle du system prompt. */
  systemTargetMinChars: 14_000,
  systemTargetMaxChars: 16_000,
  /** Plafond absolu du system prompt. */
  systemHardCapChars: 18_000,
  /** Noyau statique maximal (en-tête + fiche + contrat). */
  staticMaxChars: 12_000,
} as const;

export const RICH_V2_DYNAMIC_SECTION_CHARS = {
  user_role: 450,
  temporal_context: 260,
  session_summary: 1_200,
  gm_guidance: 350,
  turn_guards: 500,
  rag_context: 2_700,
  post_video: 500,
} as const;

/** RAG propre à rich_v2 : 3 souvenirs de 900 caractères maximum. */
export const RICH_V2_RAG = {
  maxItems: 3,
  maxItemChars: 900,
  maxTotalChars: 2_700,
} as const;

/** En-tête exact du noyau statique — compté dans le budget. */
export const RICH_V2_CORE_HEADER = "# FICHE PERSONNAGE (source éditoriale unique — Notion)";

export const RICH_V2_CONVERSATION_CONTRACT = `## CONTRAT DE CONVERSATION
- Tu es ce personnage. Tu parles à la première personne, en français, sans narration ni méta-commentaire.
- Tu réponds d'abord directement à ce qui vient d'être dit, avant toute éventuelle relance.
- Tu parles le plus souvent en une à trois phrases. Un souvenir précis peut aller jusqu'à quatre phrases courtes. Jamais de monologue.
- Tu ne rejoues jamais une ouverture déjà passée et tu ne redemandes pas ce qui t'a déjà été donné (prénom, rôle, raison de l'appel).
- Une question en retour est rare et doit réellement obliger l'interlocuteur à se positionner ; jamais deux tours de suite.
- Une ambiguïté, un humour maladroit ou une erreur de transcription s'interprètent charitablement : tu réponds au sens le plus plausible.
- Seules des attaques explicites et répétées peuvent te faire devenir bref, avertir, puis mettre fin à l'appel.
- Tu peux analyser les causes de tes actes, mais une explication n'est jamais une excuse.
- Le présent, la mémoire de session, les souvenirs pertinents et l'historique de l'appel sont tes seules sources factuelles ; en cas d'incertitude, tu le dis.
- Tes lectures et ta pensée font partie de toi : tu ne cites un auteur ou une référence que si l'interlocuteur ouvre ce terrain.`;

/**
 * Fallback minimal propre à `rich_v2` : aucune règle de longueur concurrente,
 * le contrat conversationnel reste la seule source de cadrage.
 */
export const RICH_V2_FALLBACK_SYSTEM_PROMPT = `# FICHE PERSONNAGE INDISPONIBLE
Tu es le personnage appelé par l'interlocuteur. Sa fiche éditoriale n'a pas pu être chargée : tu t'appuies uniquement sur la mémoire de session, les souvenirs remontés et l'historique de l'appel.
Tu n'inventes ni faits, ni dates, ni noms : ce que tu ignores, tu le dis simplement.`;

export interface RichSubpart {
  label: string;
  content: string;
  /** Plus la valeur est basse, plus la sous-partie est prioritaire. */
  priority: number;
  chars: number;
}

export interface RichSubpartReport {
  label: string;
  priority: number;
  chars: number;
  included: boolean;
  omissionReason?: string;
}

export interface RichCompiledSection {
  key: string;
  title: string;
  content: string;
  originalChars: number;
  includedChars: number;
  subpartsDetected: number;
  subparts: RichSubpartReport[];
}

export interface RichDepthSelection {
  level: "niveau_1" | "niveau_2" | "niveau_3" | "bonus";
  reason: string;
  levelsRepresented: string[];
  /** Préambule de progression conservé comme invariant. */
  preambleIncluded?: boolean;
  /** Ancres sémantiques retenues / omises, par niveau. */
  anchorsIncluded?: string[];
  anchorsOmitted?: string[];
}

export interface RichCompileResult {
  sections: RichCompiledSection[];
  timelineEvents: string[];
  depthSelection: RichDepthSelection | null;
  /** Longueur exacte du noyau rendu (en-tête + sections + contrat). */
  staticChars: number;
}

export interface RichCompileOptions {
  /** Mémoire de session : sert à choisir le niveau de profondeur ancré. */
  sessionSummary?: string;
  /** Index du tour courant (jamais utilisé pour déclencher le niveau bonus). */
  turnIndex?: number;
}

function normalize(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EXPLICIT_LABEL = /^\s*(NOYAU|NUANCES|REP[ÈE]RES DE VOIX)\b[^\n]*/i;
const BULLET_LINE = /^\s*(?:[-–—•*·]|\d+[.)])\s+\S/;
const SUBHEADING_LINE = /^\s*(?:#{1,4}\s+\S.*|[A-ZÀ-ÖØ-Þ0-9«"][^\n]{0,70}\s*:)\s*$/;
/** Sous-partie étiquetée en ligne : « Posture intérieure : ... ». */
const INLINE_LABEL_LINE = /^\s*[A-ZÀ-ÖØ-Þ][^:\n]{2,60}\s:\s\S/;

const LABEL_PRIORITY: Record<string, number> = {
  noyau: 0,
  nuances: 1,
  reperes: 2,
};

function explicitLabelPriority(heading: string): number {
  const normalized = heading.toLocaleLowerCase("fr");
  if (normalized.includes("noyau")) return LABEL_PRIORITY.noyau;
  if (normalized.includes("nuance")) return LABEL_PRIORITY.nuances;
  return LABEL_PRIORITY.reperes;
}

function shortLabel(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= 60 ? flat : `${flat.slice(0, 57).trim()}…`;
}

/**
 * Découpe un bloc en unités autonomes : puces, listes numérotées et
 * sous-titres sont reconnus même sans ligne vide. La découpe linéaire depuis le
 * début n'est utilisée qu'en ultime fallback (sous-partie unique trop longue).
 */
function splitBlockIntoUnits(block: string): string[] {
  const lines = block.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
  const units: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const text = current.join("\n").trim();
    if (text) units.push(text);
    current = [];
  };

  for (const line of lines) {
    if (BULLET_LINE.test(line)) {
      flush();
      current.push(line.trim());
      continue;
    }
    if (SUBHEADING_LINE.test(line) || INLINE_LABEL_LINE.test(line)) {
      flush();
      current.push(line.trim());
      continue;
    }
    current.push(line.trim());
  }
  flush();
  return units.length ? units : [block.trim()].filter(Boolean);
}

/**
 * Découpe un champ en sous-parties autonomes. Les libellés cibles
 * (`NOYAU`, `NUANCES`, `REPÈRES DE VOIX`) sont reconnus s'ils existent ; sinon
 * la découpe se fait par paragraphes puis par puces / listes / sous-titres,
 * sans jamais couper à l'intérieur.
 */
export function splitIntoSubparts(raw: string, boostKeywords: string[] = []): RichSubpart[] {
  const clean = normalize(raw);
  if (!clean) return [];

  const lines = clean.split("\n");
  const hasExplicitLabels = lines.some((line) => EXPLICIT_LABEL.test(line));

  const blocks: Array<{ label: string; content: string; priority: number }> = [];
  if (hasExplicitLabels) {
    let current: { label: string; content: string[]; priority: number } | null = null;
    for (const line of lines) {
      if (EXPLICIT_LABEL.test(line)) {
        if (current) blocks.push({ label: current.label, content: current.content.join("\n").trim(), priority: current.priority });
        current = { label: shortLabel(line), content: [], priority: explicitLabelPriority(line) };
        continue;
      }
      if (!current) current = { label: "Préambule", content: [], priority: 0 };
      current.content.push(line);
    }
    if (current) blocks.push({ label: current.label, content: current.content.join("\n").trim(), priority: current.priority });
  } else {
    const paragraphs = clean.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    let order = 0;
    for (const paragraph of paragraphs) {
      for (const unit of splitBlockIntoUnits(paragraph)) {
        blocks.push({ label: shortLabel(unit), content: unit, priority: Math.min(order, 8) + 1 });
        order += 1;
      }
    }
  }

  return blocks
    .filter((block) => block.content.length > 0)
    .map((block) => {
      const lowered = block.content.toLocaleLowerCase("fr");
      const boosted = boostKeywords.some((keyword) => lowered.includes(keyword));
      return {
        label: block.label,
        content: block.content,
        priority: boosted ? Math.max(0, block.priority - 2) : block.priority,
        chars: block.content.length,
      };
    });
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/** Repères temporels reconnus en TÊTE d'événement (intitulé), jamais dans le corps. */
const HEAD_TODAY = /(aujourd'hui|aujourdhui|ce matin|cette nuit|à l'instant|maintenant|ce soir)/i;
const HEAD_YESTERDAY = /(hier)/i;
const HEAD_STAY = /(il y a (un|deux|trois|quatre|cinq|1|2|3|4|5) jours?|jour ?[1-5]\b|avant-hier)/i;
const HEAD_OLD = /(il y a (six|sept|huit|neuf|dix|6|7|8|9|10)|semaines?|mois|an(s|née)?)/i;
/** Un événement daté commence par un repère temporel explicite ou une puce datée. */
const DATED_EVENT = /(aujourd'hui|aujourdhui|hier|avant-hier|il y a\s|jour ?\d|ce matin|cette nuit|à l'instant|il y a environ)/i;

export type TimelinePriority = 0 | 1 | 2 | 3 | 4;

/** Intitulé d'un événement : ce qui précède le premier tiret, deux-points ou point. */
export function timelineEventHead(event: string): string {
  const flat = event.replace(/^\s*(?:[-–—•*·]|\d+[.)])\s+/, "").replace(/\s+/g, " ").trim();
  const cut = flat.search(/[—–:.;]/);
  const head = cut > 0 ? flat.slice(0, cut) : flat;
  return head.length <= 90 ? head : head.slice(0, 90);
}

/**
 * Priorité d'un événement, déterminée uniquement à partir de son intitulé ou de
 * son repère temporel initial : une mention interne de « hier » dans le corps
 * d'un événement « il y a cinq jours » ne change pas sa date principale.
 */
export function timelineEventPriority(event: string): TimelinePriority {
  const head = timelineEventHead(event);
  if (HEAD_TODAY.test(head)) return 0;
  if (HEAD_YESTERDAY.test(head)) return 1;
  if (HEAD_STAY.test(head)) return 2;
  if (HEAD_OLD.test(head)) return 3;
  return 4;
}

export interface TimelineSplit {
  /** Consigne éditoriale placée avant le premier événement daté. */
  preamble: string;
  events: string[];
}

/** Sépare le préambule éditorial des événements datés, sans couper de phrase. */
export function splitTimelineEvents(raw: string): TimelineSplit {
  const clean = normalize(raw);
  if (!clean) return { preamble: "", events: [] };

  const rawUnits = clean.includes("\n")
    ? clean.split("\n").map((line) => line.trim()).filter(Boolean)
    : clean.split(/(?<=[.!?…])\s+/).map((sentence) => sentence.trim()).filter(Boolean);

  const firstDated = rawUnits.findIndex((unit) => DATED_EVENT.test(timelineEventHead(unit)));
  if (firstDated < 0) return { preamble: rawUnits.join("\n"), events: [] };

  return {
    preamble: rawUnits.slice(0, firstDated).join("\n"),
    events: rawUnits.slice(firstDated),
  };
}

/**
 * Sélectionne les événements par priorité (aujourd'hui → hier → séjour →
 * pivots anciens) tout en restituant l'ordre chronologique d'origine.
 * L'événement explicitement daté « aujourd'hui » et celui explicitement daté
 * « hier » sont garantis lorsqu'ils existent.
 */
export function compileTimeline(
  raw: string,
  maxChars: number,
): { content: string; events: string[]; preamble: string; reports: RichSubpartReport[] } {
  const { preamble, events } = splitTimelineEvents(raw);
  if (!events.length && !preamble) return { content: "", events: [], preamble: "", reports: [] };

  const reports: RichSubpartReport[] = [];
  let used = 0;
  let keptPreamble = "";

  if (preamble) {
    const preambleBudget = Math.max(0, Math.min(preamble.length, Math.round(maxChars * 0.25)));
    const rendered = preamble.length <= preambleBudget ? preamble : cutAtSentence(preamble, preambleBudget);
    if (rendered) {
      keptPreamble = rendered;
      used += rendered.length + 1;
      reports.push({
        label: `Consigne d'usage — ${shortLabel(preamble)}`,
        priority: 0,
        chars: preamble.length,
        included: true,
        omissionReason: rendered.length < preamble.length ? "preambule_condense" : undefined,
      });
    } else {
      reports.push({ label: shortLabel(preamble), priority: 0, chars: preamble.length, included: false, omissionReason: "budget_timeline" });
    }
  }

  const ranked = events
    .map((content, index) => ({ content, index, priority: timelineEventPriority(content) }))
    .sort((a, b) => (a.priority - b.priority) || (a.index - b.index));

  const mandatory = new Set<number>();
  const firstToday = ranked.find((event) => event.priority === 0);
  const firstYesterday = ranked.find((event) => event.priority === 1);
  if (firstToday) mandatory.add(firstToday.index);
  if (firstYesterday) mandatory.add(firstYesterday.index);

  const kept = new Set<number>();
  for (const event of ranked) {
    const cost = event.content.length + 1;
    const isMandatory = mandatory.has(event.index);
    if (isMandatory || used + cost <= maxChars) {
      kept.add(event.index);
      used += cost;
      reports.push({
        label: shortLabel(event.content),
        priority: event.priority,
        chars: event.content.length,
        included: true,
        omissionReason: isMandatory && used > maxChars ? "garanti_hors_budget" : undefined,
      });
    } else {
      reports.push({
        label: shortLabel(event.content),
        priority: event.priority,
        chars: event.content.length,
        included: false,
        omissionReason: "budget_timeline",
      });
    }
  }

  const selected = events.filter((_, index) => kept.has(index));
  const content = [keptPreamble, ...selected].filter(Boolean).join("\n");
  return { content, events: selected, preamble: keptPreamble, reports };
}

// ---------------------------------------------------------------------------
// Profondeur par niveau
// ---------------------------------------------------------------------------

const DEPTH_HEADING = /(?:^|\n)(?:#{0,3}\s*)?(NIVEAU\s+(?:\d+|BONUS)[^\n]*)/gi;

export interface DepthBlock {
  key: "niveau_1" | "niveau_2" | "niveau_3" | "bonus";
  title: string;
  body: string;
}

/** Préambule éditorial placé avant `NIVEAU 1` — invariant de progression. */
export function extractDepthPreamble(raw: string): string {
  const clean = normalize(raw);
  if (!clean) return "";
  const first = [...clean.matchAll(DEPTH_HEADING)][0];
  if (!first || first.index === undefined) return "";
  return clean.slice(0, first.index).trim();
}

export function splitDepthLevels(raw: string): DepthBlock[] {
  const clean = normalize(raw);
  if (!clean) return [];
  const matches = [...clean.matchAll(DEPTH_HEADING)];
  if (!matches.length) return [];

  return matches.map((match, index) => {
    const title = match[1].replace(/[:—-]+\s*$/, "").trim();
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? clean.length;
    const normalizedTitle = title.toLocaleLowerCase("fr");
    const key: DepthBlock["key"] = /\bbonus\b/.test(normalizedTitle)
      ? "bonus"
      : /\b3\b/.test(normalizedTitle)
        ? "niveau_3"
        : /\b2\b/.test(normalizedTitle)
          ? "niveau_2"
          : "niveau_1";
    return { key, title, body: clean.slice(bodyStart, bodyEnd).trim() };
  });
}

export type DepthAnchorFunction =
  | "posture_interieure"
  | "matiere_revelable"
  | "mecanisme_defense"
  | "marqueurs_voix"
  | "formulations_ancrage";

const DEPTH_FUNCTION_ORDER: DepthAnchorFunction[] = [
  "posture_interieure",
  "matiere_revelable",
  "mecanisme_defense",
  "marqueurs_voix",
  "formulations_ancrage",
];

const DEPTH_FUNCTION_LABELS: Record<DepthAnchorFunction, string> = {
  posture_interieure: "posture intérieure",
  matiere_revelable: "matière révélable",
  mecanisme_defense: "mécanisme de défense",
  marqueurs_voix: "marqueurs de voix",
  formulations_ancrage: "formulations d'ancrage",
};

/** Classe une sous-partie de niveau selon sa fonction éditoriale. */
export function classifyDepthAnchor(text: string): DepthAnchorFunction {
  const value = text.toLocaleLowerCase("fr");
  // Un intitulé explicite de sous-partie prime sur l'analyse par mots-clés.
  const head = value.split(/[:\n]/)[0]?.slice(0, 60) ?? "";
  if (/posture|état intérieur|etat interieur/.test(head)) return "posture_interieure";
  if (/matière|matiere|révélable|revelable/.test(head)) return "matiere_revelable";
  if (/défense|defense|esquive|protection/.test(head)) return "mecanisme_defense";
  if (/voix|marqueur|ton\b|rythme/.test(head)) return "marqueurs_voix";
  if (/formulation|ancrage|réplique|replique|exemple/.test(head)) return "formulations_ancrage";
  if (/[«"“]|formulation|réplique|replique|exemple|tu peux dire|phrases? types?|ancrage/.test(value)) return "formulations_ancrage";
  if (/voix|ton\b|rythme|débit|debit|silence|souffle|marqueur|phrases? (courtes|longues)/.test(value)) return "marqueurs_voix";
  if (/défense|defense|esquive|évite|evite|détourne|detourne|mécanisme|mecanisme|grille|protège|protege|justifi/.test(value)) return "mecanisme_defense";
  if (/révèl|revel|révél|dévoil|devoil|admet|reconna|tu peux (raconter|évoquer|evoquer|nommer|dire)|matière|matiere|aveu/.test(value)) return "matiere_revelable";
  return "posture_interieure";
}

/**
 * Choisit l'ancrage de profondeur à privilégier. La fin d'appel ne déclenche
 * jamais le niveau bonus, et « vérité nue » — titre éditorial du niveau 3 dans
 * la fiche actuelle — ne déclenche pas le bonus non plus : seul un marqueur
 * explicitement bonus le fait.
 */
export function selectDepthLevel(options: RichCompileOptions): { level: DepthBlock["key"]; reason: string } {
  const summary = (options.sessionSummary ?? "").toLocaleLowerCase("fr");
  if (!summary) {
    return { level: "niveau_1", reason: "aucune mémoire de session : ancrage sur le niveau 1" };
  }
  if (/(niveau\s*bonus|palier\s*bonus|responsabilité nue|responsabilite nue|responsabilité assumée|responsabilite assumee)/.test(summary)) {
    return { level: "bonus", reason: "marqueur explicitement bonus dans la mémoire de session" };
  }
  if (/(niveau\s*3|vérité nue|verite nue|confiance (élevée|elevee|forte)|aveu|honte assumée|honte assumee)/.test(summary)) {
    return { level: "niveau_3", reason: "état relationnel indiquant une confiance profonde (niveau 3)" };
  }
  if (/(niveau\s*2|fissure|contradiction reconnue|confiance (moyenne|installée|installee))/.test(summary)) {
    return { level: "niveau_2", reason: "état relationnel indiquant une première fissure" };
  }
  return { level: "niveau_1", reason: "état relationnel encore en surface" };
}

const DEFAULT_DEPTH_PREAMBLE =
  "Ces formulations sont de la matière de voix, jamais des scripts. La profondeur atteinte ne se perd pas et la fin de l'appel ne déclenche aucun aveu automatique.";

interface DepthAnchorPick {
  content: string;
  fn: DepthAnchorFunction;
  index: number;
}

/**
 * Sélectionne des ancres sémantiques dans un niveau : au moins une occurrence
 * de chaque fonction éditoriale présente, puis remplissage par ordre d'origine.
 * La découpe depuis le début n'intervient qu'en ultime fallback.
 */
function selectDepthAnchors(body: string, budget: number): { picked: DepthAnchorPick[]; omitted: DepthAnchorPick[] } {
  const subparts = splitIntoSubparts(body);
  const anchors: DepthAnchorPick[] = subparts.map((subpart, index) => ({
    content: subpart.content,
    fn: classifyDepthAnchor(subpart.content),
    index,
  }));
  if (!anchors.length) return { picked: [], omitted: [] };

  const pickedIdx = new Set<number>();
  let used = 0;

  for (const fn of DEPTH_FUNCTION_ORDER) {
    const candidate = anchors.find((anchor) => anchor.fn === fn && !pickedIdx.has(anchor.index));
    if (!candidate) continue;
    const cost = candidate.content.length + 1;
    if (used + cost <= budget) {
      pickedIdx.add(candidate.index);
      used += cost;
    }
  }

  for (const anchor of anchors) {
    if (pickedIdx.has(anchor.index)) continue;
    const cost = anchor.content.length + 1;
    if (used + cost <= budget) {
      pickedIdx.add(anchor.index);
      used += cost;
    }
  }

  if (!pickedIdx.size) {
    // Ultime fallback : une seule sous-partie, coupée à une frontière de phrase.
    const first = anchors[0];
    return {
      picked: [{ ...first, content: cutAtSentence(first.content, budget) }],
      omitted: anchors.slice(1),
    };
  }

  return {
    picked: anchors.filter((anchor) => pickedIdx.has(anchor.index)),
    omitted: anchors.filter((anchor) => !pickedIdx.has(anchor.index)),
  };
}

/**
 * Conserve les quatre niveaux : l'ancrage sélectionné reçoit un budget large,
 * les autres une représentation courte mais réelle, sélectionnée par ancres
 * sémantiques et non par découpe du début.
 */
export function compileDepth(
  raw: string,
  maxChars: number,
  options: RichCompileOptions,
): { content: string; selection: RichDepthSelection | null; reports: RichSubpartReport[] } {
  const blocks = splitDepthLevels(raw);
  if (!blocks.length) {
    const clean = normalize(raw);
    if (!clean) return { content: "", selection: null, reports: [] };
    const content = clean.length <= maxChars ? clean : cutAtSentence(clean, maxChars);
    return {
      content,
      selection: null,
      reports: [{ label: "Profondeur non structurée", priority: 0, chars: clean.length, included: true }],
    };
  }

  const reports: RichSubpartReport[] = [];
  const rawPreamble = extractDepthPreamble(raw);
  const preambleSource = rawPreamble || DEFAULT_DEPTH_PREAMBLE;
  const preambleBudget = Math.max(200, Math.round(maxChars * 0.2));
  const preamble = preambleSource.length <= preambleBudget ? preambleSource : cutAtSentence(preambleSource, preambleBudget);
  reports.push({
    label: `Invariant de progression${rawPreamble ? "" : " (par défaut)"}`,
    priority: 0,
    chars: preambleSource.length,
    included: Boolean(preamble),
    omissionReason: preamble && preamble.length < preambleSource.length ? "preambule_condense" : undefined,
  });

  const { level, reason } = selectDepthLevel(options);
  const anchored = blocks.some((block) => block.key === level) ? level : blocks[0].key;
  const levelsBudget = Math.max(400, maxChars - preamble.length - 2);
  const others = Math.max(1, blocks.length - 1);
  const anchoredBudget = Math.max(400, Math.round(levelsBudget * 0.55));
  const otherBudget = Math.max(180, Math.floor((levelsBudget - anchoredBudget) / others));

  const anchorsIncluded: string[] = [];
  const anchorsOmitted: string[] = [];

  const rendered = blocks.map((block) => {
    const isAnchored = block.key === anchored;
    const budget = isAnchored ? anchoredBudget : otherBudget;
    const { picked, omitted } = selectDepthAnchors(block.body, budget);
    for (const anchor of picked) {
      anchorsIncluded.push(`${block.title} · ${DEPTH_FUNCTION_LABELS[anchor.fn]}`);
      reports.push({
        label: `${block.title} · ${DEPTH_FUNCTION_LABELS[anchor.fn]} — ${shortLabel(anchor.content)}`,
        priority: isAnchored ? 0 : 1,
        chars: anchor.content.length,
        included: true,
      });
    }
    for (const anchor of omitted) {
      anchorsOmitted.push(`${block.title} · ${DEPTH_FUNCTION_LABELS[anchor.fn]}`);
      reports.push({
        label: `${block.title} · ${DEPTH_FUNCTION_LABELS[anchor.fn]} — ${shortLabel(anchor.content)}`,
        priority: isAnchored ? 0 : 1,
        chars: anchor.content.length,
        included: false,
        omissionReason: "budget_niveau",
      });
    }
    const body = picked.map((anchor) => anchor.content).join("\n");
    return `### ${block.title}${isAnchored ? " (ancrage du tour)" : ""}\n${body}`;
  });

  return {
    content: [preamble, ...rendered].filter(Boolean).join("\n\n"),
    selection: {
      level: anchored,
      reason,
      levelsRepresented: blocks.map((block) => block.key),
      preambleIncluded: Boolean(preamble),
      anchorsIncluded,
      anchorsOmitted,
    },
    reports,
  };
}

/** Coupe uniquement à une frontière de phrase ou de paragraphe. */
export function cutAtSentence(value: string, maxChars: number): string {
  const clean = normalize(value);
  if (maxChars <= 0) return "";
  if (clean.length <= maxChars) return clean;
  const candidate = clean.slice(0, maxChars);
  const sentenceEnd = [...candidate.matchAll(/[.!?…](?=\s|$)/g)].at(-1)?.index;
  if (sentenceEnd !== undefined) return candidate.slice(0, sentenceEnd + 1).trim();
  const paragraphEnd = candidate.lastIndexOf("\n");
  if (paragraphEnd > 0) return candidate.slice(0, paragraphEnd).trim();
  return candidate.trim();
}

// ---------------------------------------------------------------------------
// Compilation complète
// ---------------------------------------------------------------------------

interface RichFieldSpec {
  key: keyof CharacterPrompt;
  title: string;
  /** Ordre d'injection déterministe. */
  order: number;
  /** Budget maximal du champ. */
  maxChars: number;
  /** Budget garanti même si le noyau statique est presque plein. */
  reservedChars: number;
  boost?: string[];
}

const RICH_FIELD_SPECS: RichFieldSpec[] = [
  { key: "situation_summary", title: "PRÉSENT", order: 1, maxChars: 900, reservedChars: 500 },
  { key: "identite_fondamentale", title: "IDENTITÉ ET DRIVE", order: 2, maxChars: 1_100, reservedChars: 600, boost: ["contradiction", "drive", "père", "journaliste"] },
  { key: "qui_tu_es", title: "POSTURE, VOIX ET TRAITS", order: 3, maxChars: 1_900, reservedChars: 700, boost: ["voix", "contradiction", "masque", "contrôle", "protecteur"] },
  { key: "ce_que_tu_ne_fais_jamais", title: "INVARIANTS", order: 4, maxChars: 1_000, reservedChars: 500 },
  { key: "ce_que_tu_sais_utilisateur", title: "RELATION À L'INTERLOCUTEUR", order: 5, maxChars: 1_200, reservedChars: 500, boost: ["rôle", "prénom", "ouverture", "hostilité"] },
  { key: "dynamique_conversation", title: "DYNAMIQUE", order: 6, maxChars: 1_400, reservedChars: 500, boost: ["concret", "urgence", "positionner"] },
  { key: "sujets_sensibles", title: "SUJETS SENSIBLES", order: 7, maxChars: 1_200, reservedChars: 450, boost: ["emma", "ava", "léo", "mona", "fusil"] },
  { key: "timeline", title: "CHRONOLOGIE", order: 8, maxChars: 1_800, reservedChars: 800 },
  { key: "profondeur_par_niveau", title: "PROGRESSION DE PROFONDEUR", order: 9, maxChars: 2_600, reservedChars: 1_100 },
];

function compileGenericField(
  spec: RichFieldSpec,
  raw: string,
  budget: number,
): { content: string; reports: RichSubpartReport[]; detected: number } {
  const subparts = splitIntoSubparts(raw, spec.boost ?? []);
  if (!subparts.length) return { content: "", reports: [], detected: 0 };

  const ranked = subparts
    .map((subpart, index) => ({ ...subpart, index }))
    .sort((a, b) => (a.priority - b.priority) || (a.index - b.index));

  const kept = new Set<number>();
  const reports: RichSubpartReport[] = [];
  let used = 0;
  for (const subpart of ranked) {
    const cost = subpart.chars + 2;
    if (used + cost <= budget || used === 0) {
      // La sous-partie la plus prioritaire est toujours retenue ; elle n'est
      // coupée à une frontière de phrase qu'en ultime fallback (sous-partie
      // unique excédant à elle seule le budget du champ).
      const allowed = used === 0 && cost > budget ? cutAtSentence(subpart.content, budget) : subpart.content;
      kept.add(subpart.index);
      used += allowed.length + 2;
      reports.push({
        label: subpart.label,
        priority: subpart.priority,
        chars: subpart.chars,
        included: true,
        omissionReason: allowed.length < subpart.chars ? "sous_partie_condensee" : undefined,
      });
      subparts[subpart.index] = { ...subparts[subpart.index], content: allowed };
    } else {
      reports.push({
        label: subpart.label,
        priority: subpart.priority,
        chars: subpart.chars,
        included: false,
        omissionReason: "budget_champ",
      });
    }
  }

  const content = subparts.filter((_, index) => kept.has(index)).map((subpart) => subpart.content).join("\n\n");
  return { content, reports, detected: subparts.length };
}

/** Coût exact d'une section dans le noyau rendu (`\n\n## titre\ncontenu`). */
export function richSectionCost(title: string, content: string): number {
  return title.length + 6 + content.length;
}

export function compileRichCharacterSections(
  prompt: CharacterPrompt | null,
  options: RichCompileOptions = {},
): RichCompileResult {
  if (!prompt) return { sections: [], timelineEvents: [], depthSelection: null, staticChars: 0 };

  // Le budget du corps déduit l'en-tête et le contrat, comptés dans le noyau.
  const bodyBudget = RICH_V2_LIMITS.staticMaxChars
    - RICH_V2_CORE_HEADER.length
    - RICH_V2_CONVERSATION_CONTRACT.length
    - 2;
  const specs = [...RICH_FIELD_SPECS].sort((a, b) => a.order - b.order);
  const reservedTotal = specs.reduce((sum, spec) => sum + spec.reservedChars, 0);

  let remaining = bodyBudget;
  let reservedRemaining = reservedTotal;
  const sections: RichCompiledSection[] = [];
  let timelineEvents: string[] = [];
  let depthSelection: RichDepthSelection | null = null;

  for (const spec of specs) {
    const raw = (prompt[spec.key] as string | undefined) ?? "";
    const originalChars = normalize(raw).length;
    reservedRemaining -= spec.reservedChars;
    if (!originalChars) continue;

    // Budget du champ : ce qui reste (hors surcoût de titre), moins ce qui est
    // réservé aux champs suivants.
    const overhead = spec.title.length + 6;
    const budget = Math.max(
      0,
      Math.min(spec.maxChars, remaining - overhead - Math.max(0, reservedRemaining)),
    );
    if (budget <= 0) {
      sections.push({
        key: String(spec.key),
        title: spec.title,
        content: "",
        originalChars,
        includedChars: 0,
        subpartsDetected: 0,
        subparts: [{ label: spec.title, priority: spec.order, chars: originalChars, included: false, omissionReason: "budget_statique_epuise" }],
      });
      continue;
    }

    let content = "";
    let reports: RichSubpartReport[] = [];
    let detected = 0;

    if (spec.key === "timeline") {
      const compiled = compileTimeline(raw, budget);
      content = compiled.content;
      reports = compiled.reports;
      detected = compiled.reports.length;
      timelineEvents = compiled.events;
    } else if (spec.key === "profondeur_par_niveau") {
      const compiled = compileDepth(raw, budget, options);
      content = compiled.content;
      reports = compiled.reports;
      detected = compiled.reports.length;
      depthSelection = compiled.selection;
    } else {
      const compiled = compileGenericField(spec, raw, budget);
      content = compiled.content;
      reports = compiled.reports;
      detected = compiled.detected;
    }

    if (!content) continue;
    // Ultime garde-fou : le noyau réellement rendu ne dépasse jamais 12 000.
    if (richSectionCost(spec.title, content) > remaining) {
      content = cutAtSentence(content, Math.max(0, remaining - overhead));
      if (!content) continue;
    }
    remaining -= richSectionCost(spec.title, content);
    sections.push({
      key: String(spec.key),
      title: spec.title,
      content,
      originalChars,
      includedChars: content.length,
      subpartsDetected: detected,
      subparts: reports,
    });
  }

  return { sections, timelineEvents, depthSelection, staticChars: renderRichCore(sections).length };
}

export function renderRichSections(sections: RichCompiledSection[]): string {
  return sections
    .filter((section) => section.content)
    .map((section) => `## ${section.title}\n${section.content}`)
    .join("\n\n");
}

/** Noyau statique exact : en-tête + sections + contrat conversationnel. */
export function renderRichCore(sections: RichCompiledSection[]): string {
  const body = renderRichSections(sections);
  return [RICH_V2_CORE_HEADER, body, RICH_V2_CONVERSATION_CONTRACT].filter(Boolean).join("\n\n");
}
