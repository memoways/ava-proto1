/**
 * Generator of the PRÉSENT text (`character_prompts.situation_summary`).
 *
 * Shared by the `sync-notion` Edge Function (which stores the text per
 * environment) and by the LLM judge (which can generate a candidate in memory
 * and compare it with the stored one). Pure: no I/O, no Deno or browser API.
 * See docs/plan_parole_lot_p.md.
 */

export type SituationSummaryPromptVersion = "v1_coverage" | "v2_second_person";

export const SITUATION_SUMMARY_PROMPT_VERSIONS: SituationSummaryPromptVersion[] = ["v1_coverage", "v2_second_person"];

/** Version used by `sync-notion`. A change applies only after a Lovable redeploy and an explicit resync. */
export const ACTIVE_SITUATION_SUMMARY_PROMPT_VERSION: SituationSummaryPromptVersion = "v1_coverage";

export const SITUATION_SUMMARY_MODEL = "google/gemini-2.5-flash";
export const SITUATION_SUMMARY_TEMPERATURE = 0.3;
export const SITUATION_SUMMARY_STORY_TAIL_CHARS = 4500;

export function situationSummaryMaxTokens(version: SituationSummaryPromptVersion): number {
  return version === "v2_second_person" ? 420 : 260;
}

export function isSituationSummaryPromptVersion(value: unknown): value is SituationSummaryPromptVersion {
  return typeof value === "string" && (SITUATION_SUMMARY_PROMPT_VERSIONS as string[]).includes(value);
}

export interface SituationSummarySources {
  name: string;
  /** Full Notion page body; only its tail is used. */
  pageContent: string;
  timeline: string;
  identity: string;
}

export interface TimelineDay {
  heading: string;
  entries: string[];
}

const RECENT_DAY_HEADING = /^(aujourd['’]hui|hier|il y a (deux|trois) jours)\b/i;
const SOUVENIR_LINE = /^SOUVENIR\b/i;

/** "SOUVENIR MAX J-1.08 / devant le chalet / jour — Peter est tué par Agotha" → "devant le chalet / jour — Peter est tué par Agotha". */
function stripSouvenirCode(line: string): string {
  return line.trim().replace(/^SOUVENIR\s+\S+\s+\S+\s*(\/\s*)?/i, "").replace(/^—\s*/, "").trim();
}

/**
 * Day sections of the editorial timeline, most recent first: today, yesterday,
 * two and three days ago. A section is a heading line followed by SOUVENIR
 * lines; preamble paragraphs and older periods are left out.
 */
export function recentTimelineDays(timeline: string): TimelineDay[] {
  const blocks = (timeline || "").split(/\r?\n\s*\r?\n/);
  const days: TimelineDay[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2 || SOUVENIR_LINE.test(lines[0])) continue;
    const entries = lines.slice(1);
    if (!entries.every((line) => SOUVENIR_LINE.test(line))) continue;
    if (!RECENT_DAY_HEADING.test(lines[0])) continue;
    days.push({ heading: lines[0], entries: entries.map(stripSouvenirCode) });
  }
  const rank = (heading: string) => {
    const h = heading.toLocaleLowerCase("fr");
    if (h.startsWith("aujourd")) return 0;
    if (h.startsWith("hier")) return 1;
    if (h.includes("deux jours")) return 2;
    return 3;
  };
  return days.sort((a, b) => rank(a.heading) - rank(b.heading));
}

export function formatTimelineDays(days: TimelineDay[]): string {
  return days
    .map((day) => `${day.heading.toLocaleUpperCase("fr")}\n${day.entries.map((entry) => `- ${entry}`).join("\n")}`)
    .join("\n\n");
}

function buildV1(name: string, identity: string, timeline: string, storyTail: string): string {
  return `Tu rédiges la SITUATION ACTUELLE du personnage "${name}", au moment exact où commence l'expérience (l'utilisateur va lui parler au téléphone maintenant).

RÈGLES STRICTES D'ORDRE (impératives) :
1. Commence par le PRÉSENT IMMÉDIAT : où il/elle se trouve maintenant, ce qu'il/elle est en train de faire, dans quel état.
2. Puis les FAITS RÉCENTS : ce qui s'est passé aujourd'hui, puis hier, puis les jours précédents (du plus récent au plus ancien).
3. Puis ce qui le/la PRÉOCCUPE et ce qu'il/elle cherche ou attend maintenant.
4. EN DERNIER SEULEMENT, une seule phrase d'identité (âge, métier, proches), reprise littéralement de l'IDENTITÉ ci-dessous.

INTERDITS :
- Ne JAMAIS ouvrir par une phrase biographique du type "X est un ... de N ans" ou "X, journaliste, ...".
- Pas d'interprétation psychologique, pas de style littéraire, pas de spéculation.
- Aucun fait absent des sources ci-dessous.
- Ne jamais inventer ni approximer un âge, un métier, un nombre d'enfants ou un prénom : ces éléments viennent uniquement de l'IDENTITÉ.

OBLIGATION DE COUVERTURE : si les sources les mentionnent, aucun de ces éléments ne peut être omis — le lieu du présent, le retour de la montagne, l'arme pointée puis le désarmement, chaque enfant nommé (y compris un enfant absent ou retenu ailleurs, par exemple dans un camp), et l'attente d'une autorité qui ne répond pas.

FORME : 90-130 mots, français, 3e personne, présent de l'indicatif pour le présent immédiat, faits denses et vérifiables. Priorise la TIMELINE et la FIN DU RÉCIT : l'ouverture du document décrit le passé, pas le présent.

IDENTITÉ (source unique pour l'âge, le métier et les proches) :
${identity || '(absente)'}

TIMELINE STRUCTURÉE (source prioritaire du présent) :
${timeline || '(absente)'}

FIN DU RÉCIT :
${storyTail || '(absente)'}

Situation actuelle (présent d'abord, identité en dernier, 90-130 mots) :`;
}

function buildV2(name: string, identity: string, timeline: string, storyTail: string): string {
  const days = recentTimelineDays(timeline);
  const chronology = days.length
    ? formatTimelineDays(days)
    : timeline || "(absente)";
  return `Tu écris les REPÈRES DU PRÉSENT de ${name} : ce que ${name} sait de sa situation au moment exact où son téléphone sonne. Quelqu'un va lui parler maintenant. Ce texte lui est adressé : écris à la 2e personne (« tu », « ta femme », « tes enfants »), jamais « il », « elle » ni son prénom.

FORME IMPOSÉE (cinq paragraphes courts, 120 mots au total au maximum) :
1. Maintenant — 2 phrases qui commencent par « Tu es » : où tu es, où sont tes proches (un enfant absent compris), ce que tu attends. Présent de l'indicatif.
2. « Hier, … » — 3 phrases au plus.
3. « Il y a deux jours, … » — 2 phrases au plus.
4. « Il y a trois jours, … » — 1 phrase.
5. Une seule phrase d'identité tirée de l'IDENTITÉ (âge, métier, enfants), à la 2e personne.

CHOISIR, PAS RECOPIER :
- La CHRONOLOGIE ci-dessous est une liste de scènes : ne la recopie jamais scène par scène. Pour chaque jour, garde seulement ce qui pèse encore aujourd'hui sur toi et ta famille : qui est mort et par qui, ce que tu as fait toi-même, ce qui est arrivé à tes enfants. Laisse tomber le reste (trajets, repas, objets, décor).
- Chaque phrase d'un jour reformule un ou deux titres de CE jour dans la CHRONOLOGIE, rien d'autre : aucune déduction, aucun rapprochement entre deux jours, aucun fait tiré d'un autre jour. Si un titre ne dit pas ce qui est avoué, dit ou appris, n'invente pas son objet.
- Toutes les phrases sont à la 2e personne (« tu », « ta », « tes »), jamais « je », « nous », « il » ou « elle » pour toi.
- Aucun fait absent des sources. L'âge, le métier, les prénoms et le nombre d'enfants viennent uniquement de l'IDENTITÉ.
- Pas d'interprétation psychologique, pas d'émotion prêtée, pas de style littéraire, pas de liste à puces.

CHRONOLOGIE (impérative) :
- Chaque fait reste sous le jour où la CHRONOLOGIE le range. Ne déplace jamais un fait vers un autre jour et ne fusionne jamais deux jours.
- Une mort se date par son jour exact dans la CHRONOLOGIE, jamais par déduction. Chaque mort des derniers jours est nommée à son jour, avec qui l'a causée si la chronologie le dit : c'est le seul fait que tu n'omets jamais.
- Les lieux des jours passés (montagne, chalet, forêt, hôtel) ne sont jamais le lieu d'aujourd'hui. Ce qui s'est passé à l'hôtel n'est pas l'appartement.
- Si une croyance a été démentie plus tard (quelqu'un cru mort puis retrouvé vivant), écris-la comme une croyance à son jour (« Max t'a dit que… », « tu croyais que… »), puis la vérité au jour où elle a été apprise.

IDENTITÉ (source unique pour l'âge, le métier et les proches) :
${identity || '(absente)'}

CHRONOLOGIE DES DERNIERS JOURS (source prioritaire, rangée par jour, du plus récent au plus ancien) :
${chronology}

FIN DU RÉCIT (détails seulement ; ne change jamais le jour d'un fait de la chronologie) :
${storyTail || '(absente)'}

Repères du présent (2e personne, cinq paragraphes courts, 120 mots au maximum) :`;
}

/** Returns null when there is nothing to summarize (no timeline and no page body). */
export function buildSituationSummaryPrompt(
  sources: SituationSummarySources,
  version: SituationSummaryPromptVersion = ACTIVE_SITUATION_SUMMARY_PROMPT_VERSION,
): string | null {
  const timeline = (sources.timeline || "").trim();
  const identity = (sources.identity || "").trim();
  const storyTail = (sources.pageContent || "").trim().slice(-SITUATION_SUMMARY_STORY_TAIL_CHARS);
  if (!timeline && !storyTail) return null;
  return version === "v2_second_person"
    ? buildV2(sources.name, identity, timeline, storyTail)
    : buildV1(sources.name, identity, timeline, storyTail);
}

/** OpenRouter chat-completions body for the generator (same for the sync and the judge). */
export function situationSummaryRequest(prompt: string, version: SituationSummaryPromptVersion) {
  return {
    model: SITUATION_SUMMARY_MODEL,
    messages: [{ role: "user" as const, content: prompt }],
    temperature: SITUATION_SUMMARY_TEMPERATURE,
    max_tokens: situationSummaryMaxTokens(version),
  };
}
