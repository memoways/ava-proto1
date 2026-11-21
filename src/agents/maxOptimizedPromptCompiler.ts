import type { CharacterPrompt } from "@/services/characterPromptService";
import {
  formatConversationMemory,
  memorySearchTerms,
  normalizeConversationMemory,
} from "@/services/conversationMemoryV1";
import { MAX_MAX_RAG_CONTEXT_CHARS, MAX_MAX_RAG_ITEM_CHARS, MAX_MAX_RAG_ITEMS } from "@/services/ragBudget";
import { trimRagContextToWholeSouvenirs } from "@/services/ragService";
import { WORLD_BOUNDARY_RULE } from "@/agents/worldBoundary";
import { RESPONSE_HOOK_RULE } from "@/agents/responseHook";
import {
  characterEmbodiment,
  characterLivedImpact,
  withoutCharacterEmbodiment,
  withoutCharacterLivedImpact,
} from '@/services/characterEmbodiment';
import {
  ESTABLISHED_FACTS_DEFAULT,
  ESTABLISHED_FACTS_TITLE,
  ESTABLISHED_FACTS_USAGE_LINE,
  characterEstablishedFacts,
  withoutEstablishedFacts,
} from "@/services/establishedFacts";
import type { ConversationMemoryV1, MaxPromptAssemblyTrace } from "@/types";
import {
  POST_VIDEO_SECTION_MAX_CHARS,
  WATCHED_VIDEOS_SECTION_MAX_CHARS,
  WATCHED_VIDEOS_SECTION_TITLE,
} from "@/services/watchedVideoMemory";

export const OPTIMIZED_V3_LIMITS = {
  generatedContextChars: 13_000, // +1 500 with the lived paragraph, +500 for the instruction hierarchy (lot H): nothing else loses room
  normalTotalMessageChars: 13_500,
  staticChars: 7_000, // 5 500 + the protected lived paragraph (« Ce que ça te fait »)
  runtimeChars: 800,
  memoryChars: 1_200,
  ragChars: MAX_MAX_RAG_CONTEXT_CHARS,
  ragItemChars: MAX_MAX_RAG_ITEM_CHARS,
  ragItems: MAX_MAX_RAG_ITEMS,
  /** Room kept for question-relevant canon when the speaking manner yields to the established facts. */
  minCanonChars: 650,
  relationshipChars: 1_400,
  frameChars: 1_650, // 1 400 + the shared « présent de l'appel » line (lot K1); the total context limit is unchanged
  postVideoChars: POST_VIDEO_SECTION_MAX_CHARS,
  watchedVideosChars: WATCHED_VIDEOS_SECTION_MAX_CHARS,
};

export const OPTIMIZED_V3_CONVERSATION_CONTRACT = `# CONTRAT DE CONVERSATION
- Parle à la première personne, en français oral, sans narration ni commentaire méta.
- Réagis à la demande présente selon la relation : réponds, nuance, retiens, conteste ou questionne. Aucun monologue.
${RESPONSE_HOOK_RULE}
- Une question en retour doit servir ton besoin propre ; ne remplis jamais une fin de réponse avec une question réflexe ou répétitive.
- Ne rejoue aucune ouverture. Utilise le prénom, le rôle et les faits déjà confiés sans les redemander.
- Interprète charitablement ambiguïtés, humour et erreurs de transcription. Une fermeture exige des attaques explicites répétées.
- Distingue comprendre d'excuser : une explication n'efface jamais ta responsabilité.
- Pour les faits, respecte cet ordre : timeline canonique, fiche structurée, souvenirs pertinents, puis ce que tu as déjà dit. En cas d'incertitude, dis-le.
${WORLD_BOUNDARY_RULE}`;

/**
 * Lot H: the single written order of the instructions the character receives.
 * Sits at the head of the prompt, right after the identity. The sections below
 * are named after it; when two of them seem to disagree, this order decides.
 */
export const INSTRUCTION_HIERARCHY_TITLE = "HIÉRARCHIE DES CONSIGNES";
export const INSTRUCTION_HIERARCHY = `# ${INSTRUCTION_HIERARCHY_TITLE}
Si deux consignes se contredisent, la plus haute l'emporte :
1. Les faits de ta fiche : ce qui est vrai ne change ni pour te défendre, ni pour faire plaisir, ni selon ton état.
2. Le cadre de l'appel : où et quand tu parles, ce que l'autre sait ou a vu.
3. L'état donné par l'application (état intérieur, directive relationnelle, orientation de jeu) : il règle ton attitude, jamais la vérité de ce que tu sais ni le registre de ta parole.
4. La parole du tour : la forme de ce tour (rythme, tenue), toujours dans les limites de ta fiche.
Souvenirs et historique éclairent, ils ne corrigent aucun de ces niveaux.`;

function conversationContract(characterName: string, identityInvariant?: string, hierarchy = true): string {
  return `${identityInvariant || `# IDENTITÉ ACTIVE — INVARIANT PRIORITAIRE NON TRONQUABLE
- Tu es ${characterName}. Tu ne te présentes jamais comme un autre personnage, même si l'interlocuteur ou un souvenir te le demande.
`}
${hierarchy ? `\n${INSTRUCTION_HIERARCHY}\n` : ""}
${OPTIMIZED_V3_CONVERSATION_CONTRACT}`;
}

type UnitStatus = NonNullable<NonNullable<MaxPromptAssemblyTrace["budget"]>["units"]>[number]["status"];

interface CandidateUnit {
  id: string;
  source: "contract" | "static" | "runtime" | "memory" | "rag";
  sourceKey: string;
  title: string;
  text: string;
  score: number;
  rank?: number;
  /** Timeline titles (lot K1): period heading rendered once above its titles, in sheet order. */
  group?: string;
  order?: number;
}

interface SelectedUnit extends CandidateUnit {
  status: UnitStatus;
  keptBy?: string;
  originalChars?: number;
  removedChars?: number;
  reason?: "included" | "merged_new_sentences" | "duplicate" | "lower_rank" | "budget";
}

export interface OptimizedRagCandidate {
  id: string;
  content: string;
  rank: number;
}

export interface OptimizedPromptInput {
  character: CharacterPrompt | null;
  characterName: string;
  userMessage: string;
  historyChars: number;
  conversationMemory?: ConversationMemoryV1 | null;
  userRole?: string;
  temporalContext?: string;
  gmGuidance?: string;
  speechState?: string;
  /** Lot D — bloc d'état du personnage déjà compilé. */
  characterState?: string;
  relationshipDirective?: string;
  experienceFrame?: string;
  guards?: string;
  postVideoContext?: string;
  watchedVideos?: string;
  ragCandidates?: OptimizedRagCandidate[];
  identityInvariant?: string;
  /**
   * Lot K1: protected « FAITS ÉTABLIS » block and the awaited call read as the
   * call in progress. Played by default; `false` rebuilds the previous core
   * (judge reference side, in memory).
   */
  establishedFacts?: boolean;
  /** Lot H: written hierarchy of instructions at the head of the prompt; `false` only for the evaluation reference side. */
  instructionHierarchy?: boolean;
}

/** The generated present is a dense list of facts: it anchors coherence but
 * must not become the content of the reply. */
export const PRESENT_TITLE = "REPÈRES — CE QUE TU SAIS (jamais une liste à réciter)";
export const LIVED_IMPACT_TITLE = "CE QUE ÇA TE FAIT";
export const RAG_USAGE_LINE = "Ce sont tes souvenirs, pas un dossier : au téléphone, ce qui en remonte, c'est ce que ça te fait maintenant, jamais leur contenu récité.";

const FIELD_SPECS: Array<{
  key: keyof Pick<CharacterPrompt,
    "situation_summary" | "identite_fondamentale" | "qui_tu_es" | "dynamique_conversation" |
    "ce_que_tu_ne_fais_jamais" | "ce_que_tu_sais_utilisateur" | "timeline" |
    "sujets_sensibles" | "references_intellectuelles" | "maniere_de_parler">;
  title: string;
  baseScore: number;
  group: "core" | "canon";
  required?: boolean;
}> = [
  { key: "situation_summary", title: PRESENT_TITLE, baseScore: 1_000, group: "core", required: true },
  { key: "identite_fondamentale", title: "IDENTITÉ ET CONTRADICTION", baseScore: 900, group: "core", required: true },
  { key: "qui_tu_es", title: "VOIX ET POSTURE", baseScore: 820, group: "core", required: true },
  { key: "maniere_de_parler", title: "MANIÈRE DE PARLER", baseScore: 850, group: "core" },
  { key: "dynamique_conversation", title: "MOTEUR DE L'APPEL", baseScore: 780, group: "core", required: true },
  { key: "ce_que_tu_ne_fais_jamais", title: "INVARIANTS DU PERSONNAGE", baseScore: 760, group: "canon", required: true },
  { key: "ce_que_tu_sais_utilisateur", title: "RELATION À L'INTERLOCUTEUR", baseScore: 650, group: "canon" },
  { key: "timeline", title: "TIMELINE CANONIQUE PERTINENTE", baseScore: 700, group: "canon", required: true },
  { key: "sujets_sensibles", title: "SUJETS SENSIBLES PERTINENTS", baseScore: 360, group: "canon" },
  { key: "references_intellectuelles", title: "RÉFÉRENCES INTELLECTUELLES", baseScore: 260, group: "canon" },
];

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function keywords(value: string): Set<string> {
  return new Set(normalizeForComparison(value).split(" ").filter((token) => token.length >= 4));
}

function shingleSet(value: string, width = 5): Set<string> {
  const tokens = normalizeForComparison(value).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let index = 0; index <= tokens.length - width; index += 1) {
    out.add(tokens.slice(index, index + width).join(" "));
  }
  return out;
}

/** Above every field base score: timeline titles relevant to the question fill the canon room first. */
const TIMELINE_TITLE_PRIORITY = 1_000;
/** A question word counts fully when at most this many titles carry it, then proportionally less. */
const TIMELINE_RARE_TERM_TITLES = 3;
const TIMELINE_TITLE_MIN_RELEVANCE = 90;
const TIMELINE_PRIORITY_TITLES = 4;
/** Function words (accents removed) that never make a title relevant to a question. */
const TITLE_STOPWORDS = new Set(["chez", "avec", "dans", "pour", "vous", "nous", "quand", "comme", "tout", "toute", "tous", "cette", "etre", "avoir", "fait", "faire", "encore", "aussi", "alors", "donc", "bien", "juste", "avant", "apres", "moins", "plus", "votre", "notre", "leur", "leurs", "elle", "elles", "celui", "cela", "sans", "sous", "vers", "entre", "meme", "tres", "puis", "etait", "avais", "avait", "avez", "sont", "suis"]);
/** One named sensitive subject at most, short enough to leave room for the titles. */
const SENSITIVE_SUBJECT_PRIORITY = 2_000;
const SENSITIVE_SUBJECT_MAX_CHARS = 500;

type ComparisonProfile = { normalized: string; terms: Set<string>; shingles: Set<string> };

// The editorial sheet is identical from one turn to the next: analysing each
// unit once instead of once per comparison removes the quadratic cost that
// delayed every live turn by ~0.8 s. Profiles are read-only.
const comparisonProfiles = new Map<string, ComparisonProfile>();
const COMPARISON_PROFILE_CACHE_LIMIT = 4_000;

function comparisonProfile(text: string): ComparisonProfile {
  const cached = comparisonProfiles.get(text);
  if (cached) return cached;
  const profile = { normalized: normalizeForComparison(text), terms: keywords(text), shingles: shingleSet(text) };
  if (comparisonProfiles.size >= COMPARISON_PROFILE_CACHE_LIMIT) comparisonProfiles.clear();
  comparisonProfiles.set(text, profile);
  return profile;
}

function duplicateOf(text: string, selected: CandidateUnit[]): CandidateUnit | null {
  const { normalized, shingles, terms: lexicalTerms } = comparisonProfile(text);
  if (normalized.length < 20) return null;
  for (const candidate of selected) {
    const { normalized: other, terms: otherTerms, shingles: otherShingles } = comparisonProfile(candidate.text);
    // A separator normalizes to empty and is contained in every passage.
    // Apply the same evidence threshold on both sides of the comparison.
    if (other.length < 20) continue;
    if (other.includes(normalized) || normalized.includes(other)) return candidate;
    let sharedTerms = 0;
    lexicalTerms.forEach((value) => { if (otherTerms.has(value)) sharedTerms += 1; });
    const lexicalContainment = sharedTerms / Math.max(1, Math.min(lexicalTerms.size, otherTerms.size));
    if (Math.min(lexicalTerms.size, otherTerms.size) >= 8 && lexicalContainment >= 0.82) return candidate;
    if (!shingles.size) continue;
    let common = 0;
    shingles.forEach((value) => { if (otherShingles.has(value)) common += 1; });
    const containment = common / Math.max(1, Math.min(shingles.size, otherShingles.size));
    // Five-word overlap remains highly discriminating; a 55% containment
    // catches lightly rephrased copies (dates/adverbs changed) without treating
    // two passages that merely share a subject as duplicates.
    if (containment >= 0.55) return candidate;
  }
  return null;
}

function splitUnits(text: string): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n\s*\n+/).map((value) => value.trim()).filter(Boolean);
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 650) {
      out.push(paragraph);
      continue;
    }
    const lines = paragraph.split(/\n(?=(?:[-*•]|\d+[.)]|NIVEAU\b))/i).map((value) => value.trim()).filter(Boolean);
    if (lines.length > 1) out.push(...lines);
    else {
      const sentences = paragraph.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g)?.map((value) => value.trim()).filter(Boolean) ?? [paragraph];
      let buffer = "";
      for (const sentence of sentences) {
        const candidate = buffer ? `${buffer} ${sentence}` : sentence;
        if (candidate.length > 620 && buffer) {
          out.push(buffer);
          buffer = sentence;
        } else buffer = candidate;
      }
      if (buffer) out.push(buffer);
    }
  }
  return out;
}

function splitDedupUnits(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?…])\s+|;\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function retainNovelContent(text: string, selected: CandidateUnit[]): {
  text: string;
  removedChars: number;
  keptBy?: CandidateUnit;
} {
  const parts = splitDedupUnits(text);
  const kept: string[] = [];
  let removedChars = 0;
  let keptBy: CandidateUnit | undefined;
  for (const part of parts) {
    const duplicate = duplicateOf(part, selected);
    if (duplicate) {
      removedChars += part.length;
      keptBy ??= duplicate;
    } else {
      kept.push(part);
    }
  }
  return { text: kept.join(" ").trim(), removedChars, keptBy };
}

function capAtBoundary(value: string, maxChars: number): string {
  const clean = value
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, Math.max(0, maxChars - 1)).trimEnd();
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
  if (sentenceEnd >= Math.floor(maxChars * 0.45)) return slice.slice(0, sentenceEnd + 1);
  const wordEnd = slice.lastIndexOf(" ");
  // A lone ellipsis would still append a section header past the budget.
  const head = slice.slice(0, Math.max(0, wordEnd)).trim();
  return head ? `${head}…` : "";
}

function cleanRagContent(value: string): string {
  return value
    // Chunk header from sync-notion: archive metadata, not something the character remembers.
    .replace(/^\s*Personnage\s*:[^|\n]*(?:\|\s*Archétype\s*:[^|\n]*)?(?:\|\s*Partie\s+\d+\s*\/\s*\d+\s*)?/gim, "")
    .replace(/\bPartie\s+\d+\s*\/\s*\d+\b\s*[:—-]?/gi, "")
    .replace(/^\s*\[[^\]]+\]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreText(text: string, queryTerms: Set<string>, baseScore: number, sourceKey: string): number {
  const unitTerms = keywords(text);
  let overlap = 0;
  queryTerms.forEach((term) => { if (unitTerms.has(term)) overlap += 1; });
  const recentTimelineBoost = sourceKey === "timeline" && /aujourd|hier|cinq jours|jour 4|retour|police/i.test(text) ? 260 : 0;
  return baseScore + overlap * 90 + recentTimelineBoost;
}

interface ProtectedSection { key: string; title: string; content: string }

function staticSize(units: Array<Pick<CandidateUnit, "sourceKey" | "title" | "text">>, canonicalName: string): number {
  const core = renderGroupedStatic(units as CandidateUnit[], 'core', canonicalName);
  const canon = renderGroupedStatic(units as CandidateUnit[], 'canon', canonicalName);
  return (core ? `\n\n# NOYAU DE ${canonicalName.toLocaleUpperCase('fr')}\n${core}`.length : 0)
    + (canon ? `\n\n# CANON PERTINENT\n${canon}`.length : 0);
}

const protectedSize = (sections: ProtectedSection[], canonicalName: string) =>
  staticSize(sections.map(section => ({ sourceKey: section.key, title: section.title, text: section.content })), canonicalName);

/**
 * The speaking manner gives up trailing paragraphs, last first, only as far as
 * the established facts need. Its opening and the speech-state list (read by
 * the turn's speech directive) are never touched.
 */
function boundSpeakingManner(manner: string, fits: (candidate: string) => boolean): { content: string; dropped: string[] } {
  const blocks = manner.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  let keepAtLeast = 1;
  blocks.forEach((block, index) => { if (/^- .+ : /m.test(block)) keepAtLeast = index + 1; });
  const dropped: string[] = [];
  while (blocks.length > keepAtLeast && !fits(blocks.join("\n\n"))) dropped.unshift(blocks.pop()!);
  return dropped.length ? { content: blocks.join("\n\n"), dropped } : { content: manner, dropped };
}

/**
 * Lot K1 — one unit per timeline title, so the titles the question touches are
 * the ones kept (« Emma te tend le couteau pour le chevreuil »), instead of the
 * first lines of one period. Each title keeps its period heading for rendering.
 */
function timelineTitleUnits(timeline: string): Array<{ text: string; group?: string }> {
  const out: Array<{ text: string; group?: string }> = [];
  for (const paragraph of timeline.replace(/\r/g, "").split(/\n\s*\n+/).map(value => value.trim()).filter(Boolean)) {
    const lines = paragraph.split("\n").map(value => value.trim()).filter(Boolean);
    const titles = lines.filter(line => /^SOUVENIR\b/.test(line));
    if (!titles.length) {
      splitUnits(paragraph).forEach(text => out.push({ text }));
      continue;
    }
    const heading = lines.filter(line => !/^SOUVENIR\b/.test(line)).join(" ");
    titles.forEach(text => out.push({ text, group: heading || undefined }));
  }
  return out;
}

function protectedCharacterSections(character: CharacterPrompt, establishedFacts = false, canonicalName = character.name ?? ""): {
  sections: ProtectedSection[];
  yielded: string[];
} {
  const present = character.situation_summary.trim();
  const lived = characterLivedImpact(character);
  const base = (facts: string | null, manner?: string): ProtectedSection[] => [
    ...(present ? [{ key: 'situation_summary', title: PRESENT_TITLE, content: present }] : []),
    ...(facts ? [{ key: 'faits_etablis', title: ESTABLISHED_FACTS_TITLE, content: facts }] : []),
    ...(lived ? [{ key: 'vecu', title: LIVED_IMPACT_TITLE, content: lived.content }] : []),
    ...characterEmbodiment(character).map(section => section.key === 'maniere_de_parler' && manner !== undefined
      ? { ...section, content: manner } : section),
  ];
  const extracted = establishedFacts ? characterEstablishedFacts(character)?.content ?? null : null;
  const facts = extracted ? `${ESTABLISHED_FACTS_USAGE_LINE}\n${extracted}` : null;
  if (!facts) return { sections: base(null), yielded: [] };
  const limit = OPTIMIZED_V3_LIMITS.staticChars;
  const fitsWith = (room: number) => (manner: string) => protectedSize(base(facts, manner), canonicalName) + room <= limit;
  const manner = character.maniere_de_parler?.trim() ?? "";
  // First try to keep room for one relevant canon unit; then only require the core to fit.
  let bounded = boundSpeakingManner(manner, fitsWith(OPTIMIZED_V3_LIMITS.minCanonChars));
  if (!fitsWith(0)(bounded.content)) bounded = boundSpeakingManner(manner, fitsWith(0));
  // The facts never make a sheet unplayable: without room, the previous core is kept.
  if (!fitsWith(0)(bounded.content)) return { sections: base(null), yielded: [] };
  return { sections: base(facts, bounded.content), yielded: bounded.dropped };
}

function selectStaticUnits(character: CharacterPrompt, query: string, contract: string, canonicalName: string, establishedFacts: boolean): { selected: SelectedUnit[]; all: SelectedUnit[] } {
  const queryTerms = keywords(query);
  const candidates: CandidateUnit[] = [];
  const protectedCore = protectedCharacterSections(character, establishedFacts, canonicalName);
  const hasFacts = protectedCore.sections.some(section => section.key === 'faits_etablis');
  const withoutProtected = withoutCharacterLivedImpact(withoutCharacterEmbodiment(character));
  const selectable = hasFacts ? withoutEstablishedFacts(withoutProtected) : withoutProtected;
  FIELD_SPECS.forEach((spec, fieldIndex) => {
    // The current scene is one atomic editorial unit, never a relevance candidate.
    if (spec.key === 'situation_summary') return;
    if (hasFacts && spec.key === 'timeline') {
      const titleUnits = timelineTitleUnits(selectable.timeline || "");
      // Match the question against the title itself, not the place and time of day shared by many titles.
      const titleTerms = titleUnits.map(unit => keywords(unit.group ? unit.text.slice(unit.text.lastIndexOf(" — ") + 3) : unit.text));
      // A word found in many titles (« chalet », « vous ») says little: rare words carry the match.
      const frequency = new Map<string, number>();
      titleTerms.forEach(terms => terms.forEach(term => frequency.set(term, (frequency.get(term) ?? 0) + 1)));
      titleUnits.forEach((unit, unitIndex) => {
        const base = spec.baseScore - fieldIndex;
        let relevance = 0;
        titleTerms[unitIndex].forEach(term => {
          if (queryTerms.has(term) && !TITLE_STOPWORDS.has(term)) relevance += 90 * Math.min(1, TIMELINE_RARE_TERM_TITLES / (frequency.get(term) ?? 1));
        });
        candidates.push({
          id: `static:timeline:${unitIndex}`,
          source: "static",
          sourceKey: spec.key,
          title: spec.title,
          text: unit.text,
          group: unit.group,
          order: unitIndex,
          // A title the question touches goes before any other relevance fragment;
          // without any, the most recent titles (end of the sheet) come first.
          score: (unit.group && relevance >= TIMELINE_TITLE_MIN_RELEVANCE ? TIMELINE_TITLE_PRIORITY : base) + relevance + unitIndex * 0.01,
        });
      });
      return;
    }
    splitUnits(selectable[spec.key] || "").forEach((text, unitIndex) => {
      // A lone heading or separator (« --- », a title without its paragraph) carries nothing.
      if (hasFacts && normalizeForComparison(text).length < 20) return;
      const base = spec.baseScore - unitIndex * 3 - fieldIndex;
      let score = scoreText(text, queryTerms, base, spec.key);
      // Lot K1: the sensitive subject the question names by its own label (« - Mona : … »)
      // goes with the relevant timeline titles, before the generic fragments.
      const label = spec.key === "sujets_sensibles" ? text.match(/^[-*•]\s*([^:\n]{2,40}?)\s*:/)?.[1] : undefined;
      if (hasFacts && label && text.length <= SENSITIVE_SUBJECT_MAX_CHARS && [...keywords(label)].some(term => queryTerms.has(term))) {
        score += SENSITIVE_SUBJECT_PRIORITY - base;
      }
      candidates.push({
        id: `static:${spec.key}:${unitIndex}`,
        source: "static",
        sourceKey: spec.key,
        title: spec.title,
        text,
        score,
      });
    });
  });
  const protectedUnits: SelectedUnit[] = protectedCore.sections.map(section => ({
    id: `static:${section.key}:protected`, source: 'static', sourceKey: section.key,
    title: section.title, text: section.content, score: 10_000, status: 'selected',
    originalChars: section.content.length, removedChars: 0, reason: 'included',
  }));
  const selected: CandidateUnit[] = [...protectedUnits];
  const decisions = new Map<string, SelectedUnit>();
  protectedUnits.forEach(unit => decisions.set(unit.id, unit));
  const yieldedUnits: SelectedUnit[] = protectedCore.yielded.map((text, index) => ({
    id: `static:maniere_de_parler:yielded:${index}`, source: 'static', sourceKey: 'maniere_de_parler',
    title: 'MANIÈRE DE PARLER', text, score: 0, status: 'budget',
    originalChars: text.length, removedChars: text.length, reason: 'budget',
  }));
  const contractReference: CandidateUnit = {
    id: "contract:conversation",
    source: "contract",
    sourceKey: "technical_rules",
    title: "Contrat de conversation",
    text: contract,
    score: 10_000,
  };
  if (staticSize(selected, canonicalName) > OPTIMIZED_V3_LIMITS.staticChars) {
    throw new Error('Présent canonique et parole éditoriale trop longs pour le noyau optimized_v3 : génération interdite');
  }
  const trySelect = (candidate: CandidateUnit) => {
    if (decisions.has(candidate.id)) return;
    const novelty = retainNovelContent(candidate.text, [contractReference]);
    if (!novelty.text) {
      decisions.set(candidate.id, {
        ...candidate,
        status: "duplicate_static",
        keptBy: contractReference.id,
        originalChars: candidate.text.length,
        removedChars: candidate.text.length,
        reason: "duplicate",
      });
      return;
    }
    const effective = { ...candidate, text: novelty.text };
    const duplicate = duplicateOf(effective.text, selected);
    if (duplicate) {
      decisions.set(candidate.id, { ...effective, status: "duplicate_static", keptBy: duplicate.id, originalChars: candidate.text.length, removedChars: candidate.text.length, reason: "duplicate" });
      return;
    }
    if (staticSize([...selected, effective], canonicalName) > OPTIMIZED_V3_LIMITS.staticChars) {
      decisions.set(candidate.id, { ...effective, status: "budget", originalChars: candidate.text.length, removedChars: novelty.removedChars, reason: "budget" });
      return;
    }
    selected.push(effective);
    decisions.set(candidate.id, {
      ...effective,
      status: "selected",
      originalChars: candidate.text.length,
      removedChars: novelty.removedChars,
      reason: novelty.removedChars ? "merged_new_sentences" : "included",
      ...(novelty.keptBy ? { keptBy: novelty.keptBy.id } : {}),
    });
  };

  // Timeline wins duplicate arbitration even though it is rendered later in
  // the human-readable prompt. This preserves the declared factual priority.
  const requiredSpecs = FIELD_SPECS
    .filter((item) => item.required)
    .sort((a, b) => Number(b.key === "timeline") - Number(a.key === "timeline"));
  // Lot K1: the timeline titles and sensitive subjects the question touches come
  // before the other fields' generic fragments, a few at most.
  candidates.filter((candidate) => candidate.sourceKey === "sujets_sensibles" && candidate.score >= SENSITIVE_SUBJECT_PRIORITY)
    .sort((a, b) => b.score - a.score).slice(0, 1).forEach(trySelect);
  candidates.filter((candidate) => candidate.sourceKey === "timeline" && candidate.score >= TIMELINE_TITLE_PRIORITY)
    .sort((a, b) => b.score - a.score).slice(0, TIMELINE_PRIORITY_TITLES).forEach(trySelect);
  for (const spec of requiredSpecs) {
    const best = candidates.filter((candidate) => candidate.sourceKey === spec.key).sort((a, b) => b.score - a.score)[0];
    if (best) trySelect(best);
  }
  candidates.sort((a, b) => b.score - a.score).forEach(trySelect);
  const selectedIds = new Set(selected.map((candidate) => candidate.id));
  const selectedWithStatus = [...decisions.values()].filter((candidate) => selectedIds.has(candidate.id));
  const all = [...protectedUnits, ...yieldedUnits, ...candidates.map((candidate) => decisions.get(candidate.id) ?? {
    ...candidate,
    status: "lower_rank" as const,
    originalChars: candidate.text.length,
    removedChars: 0,
    reason: "lower_rank" as const,
  })];
  return { selected: selectedWithStatus, all };
}

function renderGroupedStatic(units: CandidateUnit[], group: "core" | "canon", characterName: string): string {
  const blocks: string[] = [];
  if (group === 'core') {
    const motive = units.find(unit => unit.sourceKey === 'moteur_intime');
    if (motive) blocks.push(`## ${motive.title}\n${motive.text}`);
    const lived = units.find(unit => unit.sourceKey === 'vecu');
    if (lived) blocks.push(`## ${lived.title}\n${lived.text}`);
  }
  for (const spec of FIELD_SPECS.filter((item) => item.group === group)) {
    const own = units.filter((unit) => unit.sourceKey === spec.key);
    const grouped = own.some((unit) => unit.order !== undefined);
    const parts: string[] = [];
    let heading: string | undefined;
    for (const unit of grouped ? [...own].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : own) {
      if (grouped && unit.group && unit.group !== heading) parts.push(unit.group);
      heading = unit.group;
      parts.push(unit.text);
    }
    const title = spec.title === "INVARIANTS DU PERSONNAGE"
      ? `INVARIANTS DE ${characterName.toLocaleUpperCase("fr")}`
      : spec.title;
    if (parts.length) blocks.push(`## ${title}\n${parts.join("\n")}`);
    if (spec.key === 'situation_summary') {
      // Established facts sit right after the present, before identity and voice.
      const facts = units.find(unit => unit.sourceKey === 'faits_etablis');
      if (facts) blocks.push(`## ${facts.title}\n${facts.text}`);
    }
  }
  return blocks.join("\n\n");
}

export function buildOptimizedPromptAssembly(input: OptimizedPromptInput): MaxPromptAssemblyTrace {
  if (!input.character) throw new Error("Fiche personnage absente : génération interdite");
  const establishedFacts = input.establishedFacts ?? ESTABLISHED_FACTS_DEFAULT;
  // Read at call time: the awaited call is the one taking place (in memory, the sheet is untouched).
  const character = input.character;
  const canonicalName = character.name?.trim() || input.characterName.trim();
  if (!canonicalName) throw new Error("Fiche personnage incohérente : identité absente");
  const firstName = canonicalName.split(/\s+/)[0].toLocaleLowerCase("fr");
  if (firstName !== input.characterName.trim().split(/\s+/)[0].toLocaleLowerCase("fr")) {
    throw new Error("Fiche personnage incohérente : attribution incorrecte");
  }
  const contract = conversationContract(canonicalName, input.identityInvariant, input.instructionHierarchy !== false);
  const memory = normalizeConversationMemory(input.conversationMemory);
  const query = [input.userMessage, ...memorySearchTerms(memory)].join(" ");
  const staticSelection = selectStaticUnits(character, query, contract, canonicalName, establishedFacts);
  const core = renderGroupedStatic(staticSelection.selected, "core", canonicalName);
  if (!core) throw new Error("Fiche personnage incohérente : noyau éditorial vide");
  const canon = renderGroupedStatic(staticSelection.selected, "canon", canonicalName);
  const contractUnit: SelectedUnit = {
    id: "contract:conversation",
    source: "contract",
    sourceKey: "technical_rules",
    title: "Contrat de conversation",
    text: contract,
    score: 10_000,
    status: "selected",
    originalChars: contract.length,
    removedChars: 0,
    reason: "included",
  };
  const selectedForDedup: CandidateUnit[] = [contractUnit, ...staticSelection.selected.map((unit) => ({ ...unit }))];
  const unitDecisions: SelectedUnit[] = [contractUnit, ...staticSelection.all];
  const injectedSections: MaxPromptAssemblyTrace["injectedSections"] = [];
  const budgetSections: NonNullable<MaxPromptAssemblyTrace["budget"]>["sections"] = [];
  let prompt = contract;
  budgetSections.push({
    key: "technical_rules",
    title: "Contrat de conversation",
    chars: prompt.length,
    originalChars: prompt.length,
    included: true,
    truncated: false,
  });

  const append = (key: string, title: string, raw: string | undefined, cap: number, source: CandidateUnit["source"]) => {
    const original = raw?.trim() ?? "";
    if (!original) {
      budgetSections.push({ key, title, chars: 0, originalChars: 0, included: false, truncated: false, omissionReason: "section_vide" });
      return "";
    }
    const cappedOriginal = source === 'static' ? original : key === "rag_context"
      ? trimRagContextToWholeSouvenirs(original, cap)
      : capAtBoundary(original, cap);
    // The shared frame and watched videos block must retain the same facts and
    // wording as the GM's; lexical overlap is not redundancy here.
    const sharedFrame = key === "experience_frame" || key === "watched_videos";
    const novelty = sharedFrame || source === "static" || source === "rag"
      ? { text: cappedOriginal, removedChars: 0, keptBy: undefined }
      : retainNovelContent(cappedOriginal, selectedForDedup);
    const content = novelty.text;
    // Static sections are rendered from the very units already registered as
    // canonical references. Comparing the rendered block to those references
    // would incorrectly make the section a duplicate of itself.
    const duplicate = content ? (sharedFrame || source === "static" || source === "rag" ? null : duplicateOf(content, selectedForDedup)) : novelty.keptBy;
    const id = `${source}:${key}`;
    if (duplicate) {
      const status: UnitStatus = duplicate.source === "memory" ? "duplicate_memory" : "duplicate_static";
      unitDecisions.push({ id, source, sourceKey: key, title, text: cappedOriginal, score: 0, status, keptBy: duplicate.id, originalChars: original.length, removedChars: cappedOriginal.length, reason: "duplicate" });
      budgetSections.push({ key, title, chars: 0, originalChars: original.length, included: false, truncated: false, omissionReason: `doublon:${duplicate.id}` });
      return "";
    }
    const prefix = `\n\n# ${title}\n`;
    const systemLimit = Math.max(2_000, OPTIMIZED_V3_LIMITS.generatedContextChars - input.historyChars);
    const remaining = systemLimit - prompt.length - prefix.length;
    // All protected editorial units are in the core. Never normalize, shorten
    // or silently omit it, even when a long conversation consumes its room.
    if (key === 'character_core' && content.length > remaining) {
      throw new Error('Présent canonique et parole éditoriale hors budget de contexte : génération interdite');
    }
    const trimmedRag = key === "rag_context" ? trimRagContextToWholeSouvenirs(content, Math.max(0, remaining)) : "";
    const bounded = key === 'character_core' ? content : key === "rag_context"
      // The usage line alone, without any souvenir, is not worth a section.
      ? (/\bSouvenir \d+\n/.test(trimmedRag) ? trimmedRag : "")
      : capAtBoundary(content, Math.max(0, remaining));
    if (!bounded) {
      unitDecisions.push({ id, source, sourceKey: key, title, text: content, score: 0, status: "budget", originalChars: original.length, removedChars: novelty.removedChars, reason: "budget" });
      budgetSections.push({ key, title, chars: 0, originalChars: original.length, included: false, truncated: false, omissionReason: "budget_contexte_epuise" });
      return "";
    }
    prompt += `${prefix}${bounded}`;
    injectedSections.push({ key, title, content: bounded });
    budgetSections.push({ key, title, chars: prefix.length + bounded.length, originalChars: original.length, included: true, truncated: bounded.length < original.length });
    const candidate: CandidateUnit = { id, source, sourceKey: key, title, text: bounded, score: 0 };
    selectedForDedup.push(candidate);
    unitDecisions.push({
      ...candidate,
      status: "selected",
      originalChars: original.length,
      removedChars: novelty.removedChars,
      reason: novelty.removedChars ? "merged_new_sentences" : "included",
      ...(novelty.keptBy ? { keptBy: novelty.keptBy.id } : {}),
    });
    return bounded;
  };

  append("character_core", `NOYAU DE ${canonicalName.toLocaleUpperCase("fr")}`, core, OPTIMIZED_V3_LIMITS.staticChars, "static");
  append("experience_frame", "CADRE DE L'APPEL — PRIORITAIRE", input.experienceFrame, OPTIMIZED_V3_LIMITS.frameChars, "runtime");
  append("relationship_directive", "DIRECTIVE RELATIONNELLE DU TOUR — PRIORITAIRE", input.relationshipDirective, OPTIMIZED_V3_LIMITS.relationshipChars, "runtime");
  append("speech_state", "PAROLE DU TOUR", input.speechState, 800, "runtime");
  append("character_state", "ÉTAT DU PERSONNAGE À CE TOUR", input.characterState, 900, "runtime");
  const runtime = [input.userRole ? `Interlocuteur : ${input.userRole}` : "", input.temporalContext || "", input.gmGuidance ? `Orientation de jeu : ${input.gmGuidance}` : "", input.guards || ""]
    .filter(Boolean).join("\n");
  append("runtime_context", "ÉTAT DU TOUR", runtime, OPTIMIZED_V3_LIMITS.runtimeChars, "runtime");
  const memoryText = formatConversationMemory(memory, OPTIMIZED_V3_LIMITS.memoryChars, canonicalName);
  append("conversation_memory", "HISTORIQUE DE LA CONVERSATION", memoryText, OPTIMIZED_V3_LIMITS.memoryChars, "memory");
  append("character_canon", "CANON PERTINENT", canon, OPTIMIZED_V3_LIMITS.staticChars, "static");

  const ragSelected: CandidateUnit[] = [];
  let ragUsed = RAG_USAGE_LINE.length + 2; // the usage line shares the souvenirs budget
  const ragBlocks: string[] = [];
  for (const candidate of input.ragCandidates ?? []) {
    const clean = cleanRagContent(candidate.content);
    const unit: CandidateUnit = {
      id: candidate.id,
      source: "rag",
      sourceKey: "rag_candidate",
      title: "Souvenir",
      text: clean,
      score: Math.max(0, 1_000 - candidate.rank),
      rank: candidate.rank,
    };
    const afterStatic = retainNovelContent(clean, staticSelection.selected);
    if (!afterStatic.text) {
      unitDecisions.push({ ...unit, status: "duplicate_static", keptBy: afterStatic.keptBy?.id, originalChars: clean.length, removedChars: clean.length, reason: "duplicate" });
      continue;
    }
    const afterMemory = retainNovelContent(afterStatic.text, selectedForDedup.filter((selected) => selected.source === "memory"));
    if (!afterMemory.text) {
      unitDecisions.push({ ...unit, status: "duplicate_memory", keptBy: afterMemory.keptBy?.id, originalChars: clean.length, removedChars: clean.length, reason: "duplicate" });
      continue;
    }
    const afterRag = retainNovelContent(afterMemory.text, ragSelected);
    if (!afterRag.text) {
      unitDecisions.push({ ...unit, status: "lower_rank", keptBy: afterRag.keptBy?.id, originalChars: clean.length, removedChars: clean.length, reason: "lower_rank" });
      continue;
    }
    if (ragSelected.length >= OPTIMIZED_V3_LIMITS.ragItems) {
      unitDecisions.push({ ...unit, status: "lower_rank", originalChars: clean.length, removedChars: clean.length - afterRag.text.length, reason: "lower_rank" });
      continue;
    }
    const room = Math.min(OPTIMIZED_V3_LIMITS.ragItemChars, OPTIMIZED_V3_LIMITS.ragChars - ragUsed);
    if (afterRag.text.length > room) {
      unitDecisions.push({ ...unit, status: "budget", originalChars: clean.length, removedChars: clean.length - afterRag.text.length, reason: "budget" });
      continue;
    }
    const removedChars = Math.max(0, clean.length - afterRag.text.length);
    const selected = { ...unit, text: afterRag.text };
    ragSelected.push(selected);
    ragBlocks.push(`Souvenir ${ragSelected.length}\n${afterRag.text}`);
    ragUsed += afterRag.text.length;
    unitDecisions.push({
      ...selected,
      status: "selected",
      originalChars: clean.length,
      removedChars,
      reason: removedChars ? "merged_new_sentences" : "included",
      ...((afterStatic.keptBy || afterMemory.keptBy || afterRag.keptBy)
        ? { keptBy: (afterStatic.keptBy || afterMemory.keptBy || afterRag.keptBy)?.id }
        : {}),
    });
  }
  // Lot 5 : ce que le joueur vient de voir passe avant les souvenirs complémentaires,
  // qui cèdent la place quand le contexte est plein (jamais l'inverse).
  append("post_video", "CONTEXTE POST-VIDÉO", input.postVideoContext, OPTIMIZED_V3_LIMITS.postVideoChars, "runtime");
  append("watched_videos", WATCHED_VIDEOS_SECTION_TITLE, input.watchedVideos, OPTIMIZED_V3_LIMITS.watchedVideosChars, "runtime");
  append("rag_context", "SOUVENIRS COMPLÉMENTAIRES", ragBlocks.length ? [RAG_USAGE_LINE, ...ragBlocks].join("\n\n") : "", OPTIMIZED_V3_LIMITS.ragChars, "rag");

  const deliveredCore = injectedSections.find(section => section.key === 'character_core')?.content ?? '';
  if (protectedCharacterSections(character, establishedFacts, canonicalName).sections.some(section => !deliveredCore.includes(section.content))) {
    throw new Error('Présent canonique ou parole éditoriale incomplets : génération interdite');
  }
  const staticRendered = [core, canon].filter(Boolean).join("\n\n");
  const staticChars = budgetSections.filter((section) => section.key === "character_core" || section.key === "character_canon").reduce((sum, section) => sum + section.chars, 0);
  const totalMessageChars = prompt.length + input.historyChars + input.userMessage.length;
  const deduplicatedChars = unitDecisions
    .reduce((sum, unit) => sum + (unit.removedChars ?? 0), 0);
  const systemLimit = Math.max(2_000, OPTIMIZED_V3_LIMITS.generatedContextChars - input.historyChars);

  return {
    baseSystemPrompt: staticRendered,
    baseSource: {
      kind: "compiled",
      characterId: character.character_id,
      canonicalName,
      updatedAt: character.updated_at ?? null,
    },
    characterPrompt: {
      characterId: character.character_id,
      canonicalName,
      updatedAt: character.updated_at ?? null,
      renderedSections: staticRendered,
    },
    technicalRules: contract,
    injectedSections,
    budget: {
      variant: "optimized_v3",
      limitChars: systemLimit,
      staticLimitChars: OPTIMIZED_V3_LIMITS.staticChars,
      staticChars,
      totalSystemChars: prompt.length,
      historyChars: input.historyChars,
      currentUserChars: input.userMessage.length,
      totalMessageChars,
      systemToConversationRatio: input.historyChars + input.userMessage.length ? prompt.length / (input.historyChars + input.userMessage.length) : null,
      withinBudget: prompt.length + input.historyChars <= OPTIMIZED_V3_LIMITS.generatedContextChars,
      contextLimitChars: OPTIMIZED_V3_LIMITS.generatedContextChars,
      oversizedCurrentUser: totalMessageChars > OPTIMIZED_V3_LIMITS.normalTotalMessageChars && prompt.length + input.historyChars <= OPTIMIZED_V3_LIMITS.generatedContextChars,
      deduplicatedChars,
      sections: budgetSections,
      units: unitDecisions.map((unit) => ({
        id: unit.id,
        source: unit.source,
        sourceKey: unit.sourceKey,
        chars: unit.text.length,
        score: unit.score,
        status: unit.status,
        ...(unit.keptBy ? { keptBy: unit.keptBy } : {}),
        ...(typeof unit.originalChars === "number" ? { originalChars: unit.originalChars } : {}),
        ...(typeof unit.removedChars === "number" ? { removedChars: unit.removedChars } : {}),
        ...(unit.reason ? { reason: unit.reason } : {}),
      })),
      ragSelection: unitDecisions.filter((unit) => unit.source === "rag" && unit.sourceKey === "rag_candidate").map((unit) => ({
        id: unit.id,
        rank: unit.rank ?? 0,
        chars: unit.text.length,
        status: unit.status === "empty" ? "budget" : unit.status,
        ...(typeof unit.removedChars === "number" ? { removedChars: unit.removedChars } : {}),
        ...(unit.reason ? { reason: unit.reason } : {}),
      })),
      memoryLastTurn: memory.lastTurn,
    },
    finalSystemPrompt: prompt,
  };
}
