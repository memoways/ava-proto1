import type { CharacterPrompt } from "@/services/characterPromptService";

export const MAX_SYSTEM_PROMPT_CHARS = 12_000;
export const MAX_STATIC_PROMPT_CHARS = 7_000;

/**
 * Plafonds propres à la variante `legacy`, qui injecte la fiche personnage
 * brute. Ils sont plus larges que `compact_v1` (la variante legacy assume un
 * prompt riche) mais bornés : sans plafond, la fiche seule dépassait 32 000
 * car., soit ~9 600 tokens d'entrée par tour.
 */
export const LEGACY_STATIC_PROMPT_CHARS = 20_000;
export const LEGACY_SYSTEM_PROMPT_CHARS = 24_000;


export const MAX_DYNAMIC_SECTION_CHARS = {
  user_role: 450,
  temporal_context: 260,
  session_summary: 900,
  gm_guidance: 350,
  rag_context: 2_100,
  post_video: 500,
  turn_guards: 500,
} as const;

export interface CompiledCharacterSection {
  key: string;
  title: string;
  content: string;
  originalChars: number;
  truncated: boolean;
}

const CHARACTER_FIELD_SPECS: Array<{
  key: keyof Pick<
    CharacterPrompt,
    | "situation_summary"
    | "timeline"
    | "identite_fondamentale"
    | "qui_tu_es"
    | "ce_que_tu_ne_fais_jamais"
    | "ce_que_tu_sais_utilisateur"
    | "dynamique_conversation"
    | "sujets_sensibles"
    | "profondeur_par_niveau"
  >;
  title: string;
  maxChars: number;
}> = [
  // Runtime ceilings are deliberately below the editorial ceilings documented
  // for Notion so headings and invariants still fit in the 7k static envelope.
  { key: "situation_summary", title: "PRÉSENT", maxChars: 450 },
  { key: "timeline", title: "ÉVÉNEMENTS PIVOTS", maxChars: 850 },
  { key: "identite_fondamentale", title: "IDENTITÉ ET DRIVE", maxChars: 400 },
  { key: "qui_tu_es", title: "POSTURE ET VOIX", maxChars: 650 },
  { key: "ce_que_tu_ne_fais_jamais", title: "INVARIANTS DU PERSONNAGE", maxChars: 450 },
  { key: "ce_que_tu_sais_utilisateur", title: "RELATION À L'INTERLOCUTEUR", maxChars: 450 },
  { key: "dynamique_conversation", title: "MOTEUR DE CONVERSATION", maxChars: 650 },
  { key: "sujets_sensibles", title: "SUJETS SENSIBLES", maxChars: 450 },
  { key: "profondeur_par_niveau", title: "PROGRESSION RELATIONNELLE", maxChars: 700 },
];

export function normalizePromptText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Truncate without cutting a sentence when one is available near the limit. */
export function truncateAtSentenceBoundary(value: string, maxChars: number): string {
  const clean = normalizePromptText(value);
  if (maxChars <= 0) return "";
  if (clean.length <= maxChars) return clean;
  if (maxChars === 1) return "…";

  const candidate = clean.slice(0, maxChars - 1).trimEnd();
  const sentenceMatches = [...candidate.matchAll(/[.!?…](?=\s|$)/g)];
  const lastSentenceEnd = sentenceMatches.at(-1)?.index;
  if (lastSentenceEnd !== undefined && lastSentenceEnd + 1 >= Math.floor(maxChars * 0.45)) {
    return candidate.slice(0, lastSentenceEnd + 1).trim();
  }

  const paragraphEnd = candidate.lastIndexOf("\n");
  if (paragraphEnd >= Math.floor(maxChars * 0.45)) {
    return `${candidate.slice(0, paragraphEnd).trim()}…`;
  }

  const wordEnd = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, Math.max(0, wordEnd)).trim()}…`;
}

function removeScriptLikeLines(value: string): string {
  return value
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !/^(?:[>«"]|[-–—]\s*[«"]|(?:exemple|réplique|formulation)\s*:)/i.test(trimmed);
    })
    .join("\n");
}

function removeDuplicatedConversationRules(value: string): string {
  return value
    .split("\n")
    .filter((line) => {
      const normalized = line.trim().toLocaleLowerCase("fr");
      if (!normalized) return true;
      return !(
        /(?:question|relance).*(?:trois|quatre|systémati|tour|échange)/.test(normalized) ||
        /(?:termine|finis).*(?:question|interrogation)/.test(normalized) ||
        /(?:une|1)[–-](?:deux|2) phrases|45 mots/.test(normalized) ||
        /(?:demande|demander).*(?:prénom|nom)/.test(normalized) ||
        /ouverture de la conversation/.test(normalized)
      );
    })
    .join("\n");
}

/**
 * Preserve every declared depth level while removing the long scripted replies
 * that made this field dominate the live prompt.
 */
export function condenseDepthSignatures(value: string): string {
  const clean = normalizePromptText(removeScriptLikeLines(value));
  if (!clean) return "";

  const heading = /(?:^|\n)(#{0,3}\s*)?(NIVEAU\s+(?:\d+|BONUS)[^\n]*)/gi;
  const matches = [...clean.matchAll(heading)];
  if (!matches.length) return truncateAtSentenceBoundary(clean, 900);

  const signatures: string[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = match[2].replace(/[:—-]+\s*$/, "").trim();
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? clean.length;
    const body = clean
      .slice(bodyStart, bodyEnd)
      .replace(/\n(?:Sur |À propos |Exemples?\b|Répliques?\b)[\s\S]*$/i, "")
      .trim();
    const signature = truncateAtSentenceBoundary(body, 190);
    if (signature) signatures.push(`- ${title} : ${signature}`);
  }

  return truncateAtSentenceBoundary(signatures.join("\n"), 900);
}

export function compileCharacterSections(prompt: CharacterPrompt | null): CompiledCharacterSection[] {
  if (!prompt) return [];

  return CHARACTER_FIELD_SPECS.flatMap((spec) => {
    const raw = prompt[spec.key] || "";
    const withoutDuplicatedRules = [
      "ce_que_tu_ne_fais_jamais",
      "ce_que_tu_sais_utilisateur",
      "dynamique_conversation",
    ].includes(spec.key)
      ? removeDuplicatedConversationRules(raw)
      : raw;
    const prepared = spec.key === "profondeur_par_niveau"
      ? condenseDepthSignatures(withoutDuplicatedRules)
      : normalizePromptText(withoutDuplicatedRules);
    if (!prepared) return [];
    const content = truncateAtSentenceBoundary(prepared, spec.maxChars);
    return [{
      key: spec.key,
      title: spec.title,
      content,
      originalChars: normalizePromptText(raw).length,
      truncated: content.length < normalizePromptText(raw).length,
    }];
  });
}

export function renderCompiledCharacterSections(sections: CompiledCharacterSection[]): string {
  return sections.map((section) => `## ${section.title}\n${section.content}`).join("\n\n");
}

export function isFallbackGmGuidance(value: string): boolean {
  const normalized = normalizePromptText(value).toLocaleLowerCase("fr")
    .replace(/[.!?]+$/g, "")
    .trim();
  return normalized === "continue la conversation naturellement";
}
