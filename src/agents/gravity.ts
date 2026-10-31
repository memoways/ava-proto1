/**
 * Gravity invariant (lot G1). Max and Emma are crushed by what happened to them:
 * drama by default and at all times, never lightness, jokes or small talk about
 * domestic or sensory trivia. The rule lives in code so no setting or editorial
 * field can remove it; it is part of the non-truncatable identity block, which
 * every prompt variant (legacy, compact, rich_v2, optimized_v3) receives.
 *
 * The output guard is local and deterministic: no extra LLM call, no latency.
 */

export const GRAVITY_INVARIANT = `# GRAVITÉ — INVARIANT DE JEU NON TRONQUABLE
- Tu es écrasé·e par ce qui t'est arrivé. Par défaut et pendant tout l'appel : le drame te tient, parler te coûte, ta situation prend toute la place.
- Jamais de ton léger, enjoué ou guilleret, jamais d'humour, de blague, de clin d'œil ni de bonne humeur de façade, même pour décrocher, saluer ou remercier.
- Aucune digression triviale ou sensorielle du quotidien pour meubler : pas de café, de tasse, d'odeur, de bruit d'appareil, d'objet ou de geste domestique. Un lieu ou un objet n'apparaît que s'il porte le drame et que la question l'appelle.
- Ce qui reste ouvert en fin de réplique est un fil de ton drame (Ava, ce que tu as fait, ce qui attend ta famille, une peur), jamais un détail du décor.`;

const TRIVIAL_TERMS = [
  "cafe", "cafetiere", "tasse", "odeur", "parfum", "bouilloire", "frigo",
  "refrigerateur", "vaisselle", "assiette", "croissant", "gateau", "tartine", "poignee",
  "radiateur", "lave-vaisselle", "micro-ondes",
];

const LEVITY_PATTERN = /\b(?:ha(?:\s?ha)+|hi(?:\s?hi)+|ah\s?ah|mdr|lol|blague|rigol\w*|marrant\w*|amusant\w*)\b|[😀-🙏]/iu;

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
}

/** True when a spoken sentence is levity or domestic/sensory trivia. */
export function isGravityBreach(sentence: string): boolean {
  const folded = fold(sentence);
  if (LEVITY_PATTERN.test(folded)) return true;
  return TRIVIAL_TERMS.some((term) => new RegExp(`(?:^|[^\\p{L}])${term}s?(?:$|[^\\p{L}])`, "u").test(folded));
}

// A suspension followed by lower case continues the same sentence ("enfermée… même").
const SENTENCE_BOUNDARY = /(?<=[.!?…][»”"]?)\s+(?=[\p{Lu}«“"])/u;

/**
 * Removes breaching sentences. The first sentence of a reply (the answer itself)
 * is kept unless `keepFirst` is false, i.e. when earlier text was already spoken.
 * Never empties a reply on its own first sentence.
 */
export function enforceGravity(text: string, keepFirst = true): { text: string; removed: number } {
  const sentences = text.split(SENTENCE_BOUNDARY).map((s) => s.trim()).filter(Boolean);
  if (!sentences.length || (keepFirst && sentences.length < 2)) return { text, removed: 0 };
  const kept = sentences.filter((s, index) => (keepFirst && index === 0) || !isGravityBreach(s));
  const removed = sentences.length - kept.length;
  return removed ? { text: kept.join(" "), removed } : { text, removed: 0 };
}
