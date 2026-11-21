import type { CharacterPrompt } from "./characterPromptService";

/**
 * Lot K1 — what the character holds as established at the moment of the call.
 *
 * No fact is written here: every sentence comes from the synced sheet. Source,
 * in order: (a) the optional Notion field « Ce que tu sais aujourd'hui » ;
 * (b) otherwise the paragraph « Ce qui est vrai aujourd'hui » of the identity
 * field, the family ties named by the permanent timeline titles and, if room
 * remains, the sheet's own « chronologies » interdict.
 */
export const ESTABLISHED_FACTS_TITLE = "FAITS ÉTABLIS — CE QUI EST VRAI AU MOMENT DE L'APPEL";
export const ESTABLISHED_FACTS_MAX_CHARS = 1_200;
/**
 * Usage line at the head of the block (no fact in it): the block is not a
 * closed list. Measured on 14 November 2026 (Max B1): Max still denies that
 * his father sent Mona to the camp, because the source sentence « Elle est
 * toujours dans un camp de quarantaine » reads as the cause; that sentence is
 * to be fixed in Notion, the line alone does not fix it.
 */
export const ESTABLISHED_FACTS_USAGE_LINE = "Quelques faits sûrs au moment de l'appel, pas la liste de tout ce que tu sais : ce qui n'y figure pas reste vrai s'il est dans ta timeline, tes sujets sensibles ou tes souvenirs. Ne nie jamais un fait parce qu'il manque ici.";
/** Played by default; the judge's reference side turns it off in memory to compare. */
export const ESTABLISHED_FACTS_DEFAULT = true;

const TRUE_TODAY_HEADING = /^Ce qui est vrai aujourd['’]hui\b/i;
const KINSHIP_TITLE = /^\p{Lu}[\p{L}-]+, t(?:on|a|es) [^,:—]{2,40}$/u;
const PERMANENT_TITLE = /^SOUVENIR\s+\S+\s+permanent\.\d+\s*—\s*(.+)$/i;
const CHRONOLOGY_SENTENCE = /Tu ne confonds pas les chronologies\s*:[^.]*\./i;

export interface EstablishedFacts {
  content: string;
  source: "field" | "extracted";
}

function paragraphs(text: string | undefined): string[] {
  return (text ?? "").replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
}

function capAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const end = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(".\n"));
  return end > 0 ? slice.slice(0, end + 1).trim() : "";
}

/** The sheet paragraph the extraction reads, so the selection never pays it twice. */
export function establishedFactsSourceParagraph(prompt: CharacterPrompt): string | null {
  return paragraphs(prompt.identite_fondamentale).find((block) => TRUE_TODAY_HEADING.test(block)) ?? null;
}

/** « Mona, ton aînée » : ties named as such by the permanent timeline titles. */
export function kinshipFromTimeline(timeline: string | undefined): string[] {
  const ties: string[] = [];
  for (const line of (timeline ?? "").split(/\r?\n/)) {
    const title = line.trim().match(PERMANENT_TITLE)?.[1]?.trim();
    if (title && KINSHIP_TITLE.test(title) && !ties.includes(title)) ties.push(title);
  }
  return ties;
}

export function characterEstablishedFacts(prompt: CharacterPrompt): EstablishedFacts | null {
  const field = prompt.ce_que_tu_sais_aujourdhui?.trim();
  // A filled field is the only source: the identity paragraph is never read next to it.
  if (field) {
    const content = capAtSentence(field, ESTABLISHED_FACTS_MAX_CHARS);
    return content ? { content, source: "field" } : null;
  }
  const paragraph = establishedFactsSourceParagraph(prompt);
  if (!paragraph) return null;
  const ties = kinshipFromTimeline(prompt.timeline);
  const tiesLine = ties.length ? `Les tiens : ${ties.join(" ; ")}.` : "";
  const chronology = (prompt.ce_que_tu_ne_fais_jamais ?? "").match(CHRONOLOGY_SENTENCE)?.[0]?.trim() ?? "";
  // The family ties are short and never stated elsewhere in the core: they go first in the budget.
  const head = tiesLine.length < ESTABLISHED_FACTS_MAX_CHARS / 4 ? tiesLine : "";
  const body = capAtSentence(paragraph, ESTABLISHED_FACTS_MAX_CHARS - (head ? head.length + 1 : 0));
  if (!body) return null;
  let content = head ? `${body}\n${head}` : body;
  if (chronology && !body.includes(chronology) && content.length + chronology.length + 1 <= ESTABLISHED_FACTS_MAX_CHARS) {
    content = `${content}\n${chronology}`;
  }
  return { content, source: "extracted" };
}

/** Avoid paying twice for the extracted paragraph; the saved sheet is never rewritten. */
export function withoutEstablishedFacts(prompt: CharacterPrompt): CharacterPrompt {
  if (prompt.ce_que_tu_sais_aujourdhui?.trim()) return prompt;
  const paragraph = establishedFactsSourceParagraph(prompt);
  if (!paragraph) return prompt;
  return { ...prompt, identite_fondamentale: prompt.identite_fondamentale.replace(/\r\n?/g, "\n").replace(paragraph, "").trim() };
}

// ------------------------------------------------------- the awaited call (guard only)

const SHEET_TEXT_FIELDS = [
  "identite_fondamentale", "qui_tu_es", "ce_que_tu_ne_fais_jamais", "ce_que_tu_sais_utilisateur",
  "dynamique_conversation", "sujets_sensibles", "references_intellectuelles", "timeline",
  "maniere_de_parler", "situation_summary", "ce_que_tu_sais_aujourdhui",
] as const;

/** « il/elle/tu attend(s) l'appel », « attend un appel », « l'appel que tu attends ». */
const AWAITED_CALL = /\battends?\s+(?:l['’]|un\s+|cet\s+)appel|l['’]appel que tu attends\b/gi;

export interface AwaitedCallHit { field: string; excerpt: string }

/**
 * Lot F guard. The code no longer rewrites the sheet: since the 19 November 2026 retouch the
 * synced sheets describe the call in progress. A sheet that says « tu attends l'appel » again
 * is a source fault, reported here (test and `eval:judge:sheets`) to be fixed in Notion.
 */
export function findAwaitedCallSentences(prompt: CharacterPrompt): AwaitedCallHit[] {
  const hits: AwaitedCallHit[] = [];
  for (const key of SHEET_TEXT_FIELDS) {
    const value = prompt[key];
    if (typeof value !== "string" || !value) continue;
    for (const match of value.matchAll(AWAITED_CALL)) {
      const at = match.index ?? 0;
      hits.push({ field: key, excerpt: value.slice(Math.max(0, at - 30), at + 90).replace(/\s+/g, " ").trim() });
    }
  }
  return hits;
}
