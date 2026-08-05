import type { CharacterPrompt } from "@/services/characterPromptService";
import {
  formatConversationMemory,
  memorySearchTerms,
  normalizeConversationMemory,
} from "@/services/conversationMemoryV1";
import type { ConversationMemoryV1, MaxPromptAssemblyTrace } from "@/types";

export const OPTIMIZED_V3_LIMITS = {
  generatedContextChars: 11_000,
  normalTotalMessageChars: 12_000,
  staticChars: 4_500,
  runtimeChars: 800,
  memoryChars: 1_200,
  ragChars: 1_800,
  ragItemChars: 700,
  ragItems: 3,
};

export const OPTIMIZED_V3_CONVERSATION_CONTRACT = `# CONTRAT DE CONVERSATION
- Tu es Max. Parle à la première personne, en français oral, sans narration ni commentaire méta.
- Réponds d'abord à la demande présente. Une à trois phrases parlées suffisent généralement ; un souvenir précis peut aller jusqu'à quatre phrases courtes. Aucun monologue.
- Une question en retour est rare et utile. N'en pose jamais deux tours de suite et ne remplis jamais une fin de réponse avec une question réflexe.
- Ne rejoue aucune ouverture. Utilise le prénom, le rôle et les faits déjà confiés sans les redemander.
- Interprète charitablement ambiguïtés, humour et erreurs de transcription. Une fermeture exige des attaques explicites répétées.
- Distingue comprendre d'excuser : une explication n'efface jamais ta responsabilité.
- Pour les faits, respecte cet ordre : timeline canonique, fiche structurée, souvenirs pertinents, puis ce que tu as déjà dit. En cas d'incertitude, dis-le.`;

const OPTIMIZED_V3_FALLBACK_CORE = `## PRÉSENT
Tu es Max Lorenzo, à Lausanne aujourd'hui, au lendemain du retour du Jura. Emma et Ava se sont isolées, Mona est au camp et la police ne rappelle pas.

## IDENTITÉ, CONTRADICTION ET MOTEUR
Tu es le père de Mona, Léo et Ava, le compagnon d'Emma et un journaliste scientifique. Tu te crois protecteur, mais ta peur t'a conduit à contrôler les autres. Hier, tu as pointé le fusil sur Emma puis Ava avant que Léo te désarme. Dans cet appel, tu essaies de mettre de l'ordre dans les faits et de savoir s'il reste quelque chose à réparer, sans transformer une explication en excuse.`;

type UnitStatus = NonNullable<NonNullable<MaxPromptAssemblyTrace["budget"]>["units"]>[number]["status"];

interface CandidateUnit {
  id: string;
  source: "contract" | "static" | "runtime" | "memory" | "rag";
  sourceKey: string;
  title: string;
  text: string;
  score: number;
  rank?: number;
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
  guards?: string;
  postVideoContext?: string;
  ragCandidates?: OptimizedRagCandidate[];
}

const FIELD_SPECS: Array<{
  key: keyof Pick<CharacterPrompt,
    "situation_summary" | "identite_fondamentale" | "qui_tu_es" | "dynamique_conversation" |
    "ce_que_tu_ne_fais_jamais" | "ce_que_tu_sais_utilisateur" | "timeline" |
    "sujets_sensibles" | "profondeur_par_niveau">;
  title: string;
  baseScore: number;
  group: "core" | "canon";
  required?: boolean;
}> = [
  { key: "situation_summary", title: "PRÉSENT", baseScore: 1_000, group: "core", required: true },
  { key: "identite_fondamentale", title: "IDENTITÉ ET CONTRADICTION", baseScore: 900, group: "core", required: true },
  { key: "qui_tu_es", title: "VOIX ET POSTURE", baseScore: 820, group: "core", required: true },
  { key: "dynamique_conversation", title: "MOTEUR DE L'APPEL", baseScore: 780, group: "core", required: true },
  { key: "ce_que_tu_ne_fais_jamais", title: "INVARIANTS DE MAX", baseScore: 760, group: "canon", required: true },
  { key: "ce_que_tu_sais_utilisateur", title: "RELATION À L'INTERLOCUTEUR", baseScore: 650, group: "canon" },
  { key: "timeline", title: "TIMELINE CANONIQUE PERTINENTE", baseScore: 700, group: "canon", required: true },
  { key: "sujets_sensibles", title: "SUJETS SENSIBLES PERTINENTS", baseScore: 360, group: "canon" },
  { key: "profondeur_par_niveau", title: "PROFONDEUR ACTIVE", baseScore: 420, group: "canon" },
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

function duplicateOf(text: string, selected: CandidateUnit[]): CandidateUnit | null {
  const normalized = normalizeForComparison(text);
  if (normalized.length < 20) return null;
  const shingles = shingleSet(text);
  const lexicalTerms = keywords(text);
  for (const candidate of selected) {
    const other = normalizeForComparison(candidate.text);
    if (other.includes(normalized) || normalized.includes(other)) return candidate;
    const otherTerms = keywords(candidate.text);
    let sharedTerms = 0;
    lexicalTerms.forEach((value) => { if (otherTerms.has(value)) sharedTerms += 1; });
    const lexicalContainment = sharedTerms / Math.max(1, Math.min(lexicalTerms.size, otherTerms.size));
    if (Math.min(lexicalTerms.size, otherTerms.size) >= 8 && lexicalContainment >= 0.82) return candidate;
    if (!shingles.size) continue;
    const otherShingles = shingleSet(candidate.text);
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
  return `${slice.slice(0, Math.max(0, wordEnd)).trim()}…`;
}

function cleanRagContent(value: string): string {
  return value
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

function selectStaticUnits(character: CharacterPrompt | null, query: string): { selected: SelectedUnit[]; all: SelectedUnit[] } {
  if (!character) return { selected: [], all: [] };
  const queryTerms = keywords(query);
  const candidates: CandidateUnit[] = [];
  FIELD_SPECS.forEach((spec, fieldIndex) => {
    splitUnits(character[spec.key] || "").forEach((text, unitIndex) => {
      candidates.push({
        id: `static:${spec.key}:${unitIndex}`,
        source: "static",
        sourceKey: spec.key,
        title: spec.title,
        text,
        score: scoreText(text, queryTerms, spec.baseScore - unitIndex * 3 - fieldIndex, spec.key),
      });
    });
  });
  const selected: CandidateUnit[] = [];
  const decisions = new Map<string, SelectedUnit>();
  const contractReference: CandidateUnit = {
    id: "contract:conversation",
    source: "contract",
    sourceKey: "technical_rules",
    title: "Contrat de conversation",
    text: OPTIMIZED_V3_CONVERSATION_CONTRACT,
    score: 10_000,
  };
  let used = 0;
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
    // Reserve formatting overhead (group headings and section prefixes) inside
    // the declared static budget instead of hiding it from the trace.
    if (used + effective.text.length > OPTIMIZED_V3_LIMITS.staticChars - 320) {
      decisions.set(candidate.id, { ...effective, status: "budget", originalChars: candidate.text.length, removedChars: novelty.removedChars, reason: "budget" });
      return;
    }
    selected.push(effective);
    used += effective.text.length;
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
  for (const spec of requiredSpecs) {
    const best = candidates.filter((candidate) => candidate.sourceKey === spec.key).sort((a, b) => b.score - a.score)[0];
    if (best) trySelect(best);
  }
  candidates.sort((a, b) => b.score - a.score).forEach(trySelect);
  const selectedIds = new Set(selected.map((candidate) => candidate.id));
  const selectedWithStatus = [...decisions.values()].filter((candidate) => selectedIds.has(candidate.id));
  const all = candidates.map((candidate) => decisions.get(candidate.id) ?? {
    ...candidate,
    status: "lower_rank" as const,
    originalChars: candidate.text.length,
    removedChars: 0,
    reason: "lower_rank" as const,
  });
  return { selected: selectedWithStatus, all };
}

function renderGroupedStatic(units: SelectedUnit[], group: "core" | "canon"): string {
  const blocks: string[] = [];
  for (const spec of FIELD_SPECS.filter((item) => item.group === group)) {
    const parts = units.filter((unit) => unit.sourceKey === spec.key).map((unit) => unit.text);
    if (parts.length) blocks.push(`## ${spec.title}\n${parts.join("\n")}`);
  }
  return blocks.join("\n\n");
}

export function buildOptimizedPromptAssembly(input: OptimizedPromptInput): MaxPromptAssemblyTrace {
  const memory = normalizeConversationMemory(input.conversationMemory);
  const query = [input.userMessage, ...memorySearchTerms(memory)].join(" ");
  const staticSelection = selectStaticUnits(input.character, query);
  const compiledCore = renderGroupedStatic(staticSelection.selected, "core");
  const core = compiledCore || OPTIMIZED_V3_FALLBACK_CORE;
  const canon = renderGroupedStatic(staticSelection.selected, "canon");
  const contractUnit: SelectedUnit = {
    id: "contract:conversation",
    source: "contract",
    sourceKey: "technical_rules",
    title: "Contrat de conversation",
    text: OPTIMIZED_V3_CONVERSATION_CONTRACT,
    score: 10_000,
    status: "selected",
    originalChars: OPTIMIZED_V3_CONVERSATION_CONTRACT.length,
    removedChars: 0,
    reason: "included",
  };
  const selectedForDedup: CandidateUnit[] = [contractUnit, ...staticSelection.selected.map((unit) => ({ ...unit }))];
  const unitDecisions: SelectedUnit[] = [contractUnit, ...staticSelection.all];
  const injectedSections: MaxPromptAssemblyTrace["injectedSections"] = [];
  const budgetSections: NonNullable<MaxPromptAssemblyTrace["budget"]>["sections"] = [];
  let prompt = OPTIMIZED_V3_CONVERSATION_CONTRACT;
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
    const cappedOriginal = capAtBoundary(original, cap);
    const novelty = source === "static" || source === "rag"
      ? { text: cappedOriginal, removedChars: 0, keptBy: undefined }
      : retainNovelContent(cappedOriginal, selectedForDedup);
    const content = novelty.text;
    // Static sections are rendered from the very units already registered as
    // canonical references. Comparing the rendered block to those references
    // would incorrectly make the section a duplicate of itself.
    const duplicate = content ? (source === "static" || source === "rag" ? null : duplicateOf(content, selectedForDedup)) : novelty.keptBy;
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
    const bounded = capAtBoundary(content, Math.max(0, remaining));
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

  append("character_core", "NOYAU DE MAX", core, OPTIMIZED_V3_LIMITS.staticChars, "static");
  const runtime = [input.userRole ? `Interlocuteur : ${input.userRole}` : "", input.temporalContext || "", input.gmGuidance ? `Orientation de jeu : ${input.gmGuidance}` : "", input.guards || ""]
    .filter(Boolean).join("\n");
  append("runtime_context", "ÉTAT DU TOUR", runtime, OPTIMIZED_V3_LIMITS.runtimeChars, "runtime");
  const memoryText = formatConversationMemory(memory, OPTIMIZED_V3_LIMITS.memoryChars);
  append("conversation_memory", "HISTORIQUE DE LA CONVERSATION", memoryText, OPTIMIZED_V3_LIMITS.memoryChars, "memory");
  append("character_canon", "CANON PERTINENT", canon, OPTIMIZED_V3_LIMITS.staticChars, "static");

  const ragSelected: CandidateUnit[] = [];
  let ragUsed = 0;
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
    const capped = capAtBoundary(afterRag.text, Math.min(OPTIMIZED_V3_LIMITS.ragItemChars, OPTIMIZED_V3_LIMITS.ragChars - ragUsed));
    if (!capped || ragUsed + capped.length > OPTIMIZED_V3_LIMITS.ragChars) {
      unitDecisions.push({ ...unit, status: "budget", originalChars: clean.length, removedChars: clean.length - afterRag.text.length, reason: "budget" });
      continue;
    }
    const removedChars = Math.max(0, clean.length - afterRag.text.length);
    const selected = { ...unit, text: capped };
    ragSelected.push(selected);
    ragBlocks.push(`Souvenir ${ragSelected.length}\n${capped}`);
    ragUsed += capped.length;
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
  append("rag_context", "SOUVENIRS COMPLÉMENTAIRES", ragBlocks.join("\n\n"), OPTIMIZED_V3_LIMITS.ragChars, "rag");
  append("post_video", "CONTEXTE POST-VIDÉO", input.postVideoContext, 500, "runtime");

  const staticRendered = [core, canon].filter(Boolean).join("\n\n");
  const staticChars = budgetSections.filter((section) => section.key === "character_core" || section.key === "character_canon").reduce((sum, section) => sum + section.chars, 0);
  const totalMessageChars = prompt.length + input.historyChars + input.userMessage.length;
  const deduplicatedChars = unitDecisions
    .reduce((sum, unit) => sum + (unit.removedChars ?? 0), 0);
  const systemLimit = Math.max(2_000, OPTIMIZED_V3_LIMITS.generatedContextChars - input.historyChars);

  return {
    baseSystemPrompt: staticRendered,
    baseSource: {
      kind: input.character ? "compiled" : "fallback",
      characterId: input.character?.character_id ?? null,
      canonicalName: input.character?.name ?? input.characterName,
      updatedAt: input.character?.updated_at ?? null,
    },
    characterPrompt: {
      characterId: input.character?.character_id ?? null,
      canonicalName: input.character?.name ?? null,
      updatedAt: input.character?.updated_at ?? null,
      renderedSections: staticRendered,
    },
    technicalRules: OPTIMIZED_V3_CONVERSATION_CONTRACT,
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
