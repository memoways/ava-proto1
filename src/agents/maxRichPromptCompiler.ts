import type { CharacterPrompt } from "@/services/characterPromptService";

/**
 * rich_v2 — compilation déterministe de la fiche Notion de Max.
 *
 * Principes (docs/plan_optimisation_payload_max.md §9) :
 * - `character_prompts` est l'unique source éditoriale statique ;
 * - les champs Notion ne sont jamais réécrits ni sauvegardés condensés ;
 * - la sélection se fait par sous-parties entières et priorités déclarées,
 *   jamais par découpe aveugle du début du champ ;
 * - la timeline injecte d'abord aujourd'hui / hier, puis le séjour, puis les
 *   pivots anciens ;
 * - les quatre niveaux de profondeur sont toujours représentés.
 */

export const RICH_V2_LIMITS = {
  /** Cible habituelle du system prompt. */
  systemTargetMinChars: 14_000,
  systemTargetMaxChars: 16_000,
  /** Plafond absolu du system prompt. */
  systemHardCapChars: 18_000,
  /** Noyau statique maximal (fiche + contrat). */
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
}

export interface RichCompileResult {
  sections: RichCompiledSection[];
  timelineEvents: string[];
  depthSelection: RichDepthSelection | null;
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
 * Découpe un champ en sous-parties autonomes. Les libellés cibles
 * (`NOYAU`, `NUANCES`, `REPÈRES DE VOIX`) sont reconnus s'ils existent ; sinon
 * la découpe se fait par paragraphes, sans jamais couper à l'intérieur.
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
    paragraphs.forEach((paragraph, index) => {
      blocks.push({ label: shortLabel(paragraph), content: paragraph, priority: Math.min(index, 8) + 1 });
    });
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

const TIMELINE_TODAY = /(aujourd'hui|aujourdhui|ce matin|cette nuit|hier soir|hier|maintenant|à l'instant|depuis le retour|lendemain)/i;
const TIMELINE_STAY = /(il y a (un|deux|trois|quatre|cinq|1|2|3|4|5) jours?|jour ?[1-5]\b|chalet|hôtel|hotel|montagne|jura|carnage|fusil|otage|refuge|abri)/i;
const TIMELINE_OLD = /(il y a (six|sept|6|7|huit|8|neuf|9|dix|10)|semaines?|mois|pandémie|pandemie|camp|école|ecole)/i;

/** Découpe la timeline en événements sans jamais couper une phrase. */
export function splitTimelineEvents(raw: string): string[] {
  const clean = normalize(raw);
  if (!clean) return [];
  const byLine = clean.split("\n").map((line) => line.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;
  return clean
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function timelineEventPriority(event: string): number {
  if (TIMELINE_TODAY.test(event)) return 0;
  if (TIMELINE_STAY.test(event)) return 1;
  if (TIMELINE_OLD.test(event)) return 2;
  return 3;
}

/**
 * Sélectionne les événements par priorité (aujourd'hui/hier → séjour → pivots
 * anciens → reste) tout en restituant l'ordre chronologique d'origine.
 */
export function compileTimeline(raw: string, maxChars: number): { content: string; events: string[]; reports: RichSubpartReport[] } {
  const events = splitTimelineEvents(raw);
  if (!events.length) return { content: "", events: [], reports: [] };

  const ranked = events
    .map((content, index) => ({ content, index, priority: timelineEventPriority(content) }))
    .sort((a, b) => (a.priority - b.priority) || (a.index - b.index));

  const kept = new Set<number>();
  const reports: RichSubpartReport[] = [];
  let used = 0;
  for (const event of ranked) {
    const cost = event.content.length + 1;
    if (used + cost <= maxChars) {
      kept.add(event.index);
      used += cost;
      reports.push({ label: shortLabel(event.content), priority: event.priority, chars: event.content.length, included: true });
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
  return { content: selected.join("\n"), events: selected, reports };
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
    const key: DepthBlock["key"] = normalizedTitle.includes("bonus")
      ? "bonus"
      : normalizedTitle.includes("3")
        ? "niveau_3"
        : normalizedTitle.includes("2")
          ? "niveau_2"
          : "niveau_1";
    return { key, title, body: clean.slice(bodyStart, bodyEnd).trim() };
  });
}

/**
 * Choisit l'ancrage de profondeur à privilégier. La fin d'appel ne déclenche
 * jamais le niveau bonus : seule la matière relationnelle du résumé de session
 * peut le faire.
 */
export function selectDepthLevel(options: RichCompileOptions): { level: DepthBlock["key"]; reason: string } {
  const summary = (options.sessionSummary ?? "").toLocaleLowerCase("fr");
  if (!summary) {
    return { level: "niveau_1", reason: "aucune mémoire de session : ancrage sur le niveau 1" };
  }
  if (/(niveau\s*bonus|vérité nue|verite nue|responsabilité assumée|responsabilite assumee)/.test(summary)) {
    return { level: "bonus", reason: "état relationnel explicitement au-delà du niveau 3" };
  }
  if (/(niveau\s*3|confiance (élevée|elevee|forte)|aveu|honte assumée|honte assumee)/.test(summary)) {
    return { level: "niveau_3", reason: "état relationnel indiquant une confiance profonde" };
  }
  if (/(niveau\s*2|fissure|contradiction reconnue|confiance (moyenne|installée|installee))/.test(summary)) {
    return { level: "niveau_2", reason: "état relationnel indiquant une première fissure" };
  }
  return { level: "niveau_1", reason: "état relationnel encore en surface" };
}

/**
 * Conserve les quatre niveaux : l'ancrage sélectionné reçoit un budget large,
 * les autres une représentation courte mais réelle. Les formulations restent
 * de la matière de voix (jamais des scripts) et les références culturelles ne
 * sont pas supprimées.
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

  const { level, reason } = selectDepthLevel(options);
  const anchored = blocks.some((block) => block.key === level) ? level : blocks[0].key;
  const others = blocks.length - 1 || 1;
  const anchoredBudget = Math.max(400, Math.round(maxChars * 0.5));
  const otherBudget = Math.max(180, Math.floor((maxChars - anchoredBudget) / others));

  const reports: RichSubpartReport[] = [];
  const rendered = blocks.map((block) => {
    const budget = block.key === anchored ? anchoredBudget : otherBudget;
    const body = block.body.length <= budget ? block.body : cutAtSentence(block.body, budget);
    reports.push({
      label: block.title,
      priority: block.key === anchored ? 0 : 1,
      chars: block.body.length,
      included: true,
      omissionReason: body.length < block.body.length ? "representation_condensee" : undefined,
    });
    return `### ${block.title}${block.key === anchored ? " (ancrage du tour)" : ""}\n${body}`;
  });

  const header = "Ces formulations sont de la matière de voix, jamais des scripts. La profondeur atteinte ne se perd pas et la fin de l'appel ne déclenche aucun aveu automatique.";
  return {
    content: `${header}\n\n${rendered.join("\n\n")}`,
    selection: { level: anchored, reason, levelsRepresented: blocks.map((block) => block.key) },
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
      // La sous-partie la plus prioritaire est toujours retenue, tronquée à une
      // frontière de phrase seulement si elle excède à elle seule le budget.
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

export function compileRichCharacterSections(
  prompt: CharacterPrompt | null,
  options: RichCompileOptions = {},
): RichCompileResult {
  if (!prompt) return { sections: [], timelineEvents: [], depthSelection: null, staticChars: 0 };

  const bodyBudget = RICH_V2_LIMITS.staticMaxChars - RICH_V2_CONVERSATION_CONTRACT.length - 200;
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

    // Budget du champ : ce qui reste, moins ce qui est réservé aux champs suivants.
    const budget = Math.max(0, Math.min(spec.maxChars, remaining - Math.max(0, reservedRemaining)));
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
    remaining -= content.length + spec.title.length + 6;
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

  const staticChars = sections.reduce((sum, section) => sum + section.content.length + section.title.length + 6, 0)
    + RICH_V2_CONVERSATION_CONTRACT.length;

  return { sections, timelineEvents, depthSelection, staticChars };
}

export function renderRichSections(sections: RichCompiledSection[]): string {
  return sections
    .filter((section) => section.content)
    .map((section) => `## ${section.title}\n${section.content}`)
    .join("\n\n");
}
