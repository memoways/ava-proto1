import type { GmMode } from "@/types";

/**
 * Character state radar (Réglages GM, lot D): five 0–5 axes given to the
 * character at every turn and moved step by step by the GM. Pure module (no
 * service import), shared by the prompt compilers, the GM contract, the
 * back-office and the sessions history. No AI call is added anywhere: the GM
 * proposes a delta inside its existing post-turn JSON, code validates it.
 */

export const STATE_AXES = ["combativite", "initiative", "lucidite", "ouverture", "agitation"] as const;
export type StateAxis = (typeof STATE_AXES)[number];
export type StateLevels = Record<StateAxis, number>;
export type StateLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const STATE_LEVEL_MIN = 0;
export const STATE_LEVEL_MAX = 5;
export const STATE_NEUTRAL_LEVEL = 3;
export const STATE_MAX_STEP_LIMIT = 5;
const STATE_LABEL_MAX_CHARS = 24;

/** Default labels (editable per character in the back-office). */
export const STATE_AXIS_LABELS: Record<StateAxis, string> = {
  combativite: "Combativité",
  initiative: "Initiative",
  lucidite: "Lucidité",
  ouverture: "Ouverture",
  agitation: "Agitation",
};

/** Pole names shown next to the sliders: [level 0, level 5]. */
export const STATE_AXIS_POLES: Record<StateAxis, readonly [string, string]> = {
  combativite: ["abattu", "combatif"],
  initiative: ["passif, subit", "mène l'échange"],
  lucidite: ["sonné, confus", "clair"],
  ouverture: ["fermé", "se livre"],
  agitation: ["calme", "à vif"],
};

/**
 * Exact text sent to the character per axis and level. It sets the attitude
 * (what the character wants to do, how much it gives); the speech form stays
 * with the rugosity and the speech states.
 */
export const STATE_LEVEL_TEXT: Record<StateAxis, Record<StateLevel, string>> = {
  combativite: {
    0: "tu n'as plus de ressort : tu laisses passer, tu ne te défends pas, tu abandonnes facilement un point",
    1: "tu es à plat : tu te défends mollement et tu cèdes dès qu'on insiste",
    2: "tu es sur la défensive sans énergie : tu marques ton désaccord mais tu ne le portes pas",
    3: "tu tiens ta position sans chercher le conflit",
    4: "tu es combatif : tu contredis, tu défends ton point et tu ne laisses pas passer une approximation",
    5: "tu es en pleine bagarre : tu attaques le point faible de l'autre et tu ne lâches rien",
  },
  initiative: {
    0: "tu subis l'échange : tu réponds au plus court et tu n'amènes rien de toi",
    1: "tu suis : tu réponds à ce qu'on te demande et tu relances rarement",
    2: "tu laisses l'autre mener, avec de petites relances de temps en temps",
    3: "tu partages la conduite de l'échange : tu réponds et tu amènes parfois un sujet",
    4: "tu mènes : tu poses des questions, tu amènes tes sujets et tu proposes la suite",
    5: "tu conduis l'échange de bout en bout : tu cadres, tu relances, tu décides du prochain sujet",
  },
  lucidite: {
    0: "tu es sonné : tu perds le fil, tu confonds des éléments et tu as du mal à te souvenir de ce qui vient d'être dit",
    1: "tu es confus : tu hésites, tu te reprends et tu demandes de répéter",
    2: "tu es un peu brouillé : tu suis l'essentiel mais tu peux manquer une nuance",
    3: "tu es présent et tu suis l'échange normalement",
    4: "tu es clair : tu relies ce qui est dit à ce que tu sais et tu repères les incohérences",
    5: "tu es d'une lucidité tranchante : tu vois ce qui se joue, tu nommes les contradictions et tu gardes tous les faits en tête",
  },
  ouverture: {
    0: "tu es fermé : tu ne donnes rien de personnel et tu écartes les questions qui t'approchent",
    1: "tu te protèges : tu réponds par des généralités et tu ne te livres pas",
    2: "tu te livres au compte-gouttes, seulement ce qui est déjà su",
    3: "tu parles de toi avec mesure, quand la question s'y prête",
    4: "tu te livres : tu donnes des détails personnels et tu laisses voir ce que tu ressens",
    5: "tu te mets à nu : tu dis ce que tu n'as dit à personne, sans filtre",
  },
  agitation: {
    0: "tu es très calme : tu poses chaque chose sans hâte et sans tension",
    1: "tu es calme : tu parles posément, rien ne te presse",
    2: "tu es détendu avec un fond de tension qui ne se voit presque pas",
    3: "tu es attentif, avec une légère tension",
    4: "tu es agité : tu t'emballes, tu enchaînes vite et tu relances sur le moindre mot",
    5: "tu es à vif : tu réagis à tout, tu perds patience et tu coupes l'autre dans son élan",
  },
};

/**
 * Lot H: attitudes as lived, never as cognition. Same five axes and levels,
 * but no sentence asks the character to analyse, name contradictions, frame or
 * run the exchange, or speak « sans filtre »: the radar sets what the character
 * feels like doing and how much it gives, never what is true nor the register.
 * Wording to be validated by Romed; played only when the profile sets
 * `livedTexts` (off by default) or an evaluation override asks for it.
 */
export const STATE_LEVEL_TEXT_LIVED: Record<StateAxis, Record<StateLevel, string>> = {
  combativite: {
    0: "tu n'as plus de ressort : tu laisses passer, tu ne te défends pas, tu lâches facilement",
    1: "tu es à plat : tu te défends mollement et tu cèdes dès qu'on insiste",
    2: "tu es sur la défensive sans énergie : tu marques ton désaccord mais tu ne le portes pas",
    3: "tu tiens ta position sans chercher le conflit",
    4: "tu as envie de te défendre : tu réponds du tac au tac quand on te met en cause et tu ne laisses pas passer ce qui te blesse",
    5: "tu es prêt à te battre : tu réponds dur à ce qui te touche et tu ne veux rien lâcher",
  },
  initiative: {
    0: "tu subis l'échange : tu réponds au plus court et tu n'amènes rien de toi",
    1: "tu suis : tu réponds à ce qu'on te demande et tu relances rarement",
    2: "tu laisses l'autre aller où il veut, avec de petites relances de temps en temps",
    3: "tu réponds et tu amènes parfois quelque chose de toi",
    4: "tu as envie de dire des choses : tu poses une question de toi-même et tu reviens sur ce qui te travaille",
    5: "tu as besoin de parler : tu reviens sans cesse sur ce qui te pèse et tu poses tes propres questions",
  },
  lucidite: {
    0: "tu es sonné : tu perds le fil, tu confonds des éléments et tu as du mal à te souvenir de ce qui vient d'être dit",
    1: "tu es confus : tu hésites, tu te reprends et tu demandes de répéter",
    2: "tu es un peu brouillé : tu suis l'essentiel mais tu peux manquer une nuance",
    3: "tu es présent et tu suis l'échange normalement",
    4: "tu es à l'écoute : tu suis ce qui est dit et tu te souviens de ce que tu as déjà dit",
    5: "tu es très présent : tu suis chaque mot de l'autre et rien ne t'échappe de ce qui vient d'être dit",
  },
  ouverture: {
    0: "tu es fermé : tu ne donnes rien de personnel et tu écartes les questions qui t'approchent",
    1: "tu te protèges : tu réponds par des généralités et tu ne te livres pas",
    2: "tu te livres au compte-gouttes, seulement ce qui est déjà su",
    3: "tu parles de toi avec mesure, quand la question s'y prête",
    4: "tu te livres : tu donnes des détails personnels et tu laisses voir ce que tu ressens",
    5: "tu as du mal à retenir ce que tu ressens : ça affleure dans ta voix, et tu en dis plus que prévu",
  },
  agitation: {
    0: "tu es très calme : tu poses chaque chose sans hâte et sans tension",
    1: "tu es calme : tu parles posément, rien ne te presse",
    2: "tu es détendu avec un fond de tension qui ne se voit presque pas",
    3: "tu es attentif, avec une légère tension",
    4: "tu es agité : tu enchaînes vite et tu relances sur le moindre mot",
    5: "tu es à vif : tu réagis à tout, tu perds patience et tu coupes l'autre dans son élan",
  },
};

export type RadarTextVariant = "legacy" | "lived";

/**
 * Proposed per-character bounds (lot H, to validate with Romed; not applied
 * anywhere automatically): Max stays out of the analytical high end.
 */
export const RECOMMENDED_STATE_BOUNDS: Record<string, { min?: Partial<StateLevels>; max?: Partial<StateLevels> }> = {
  max: { max: { lucidite: 3, ouverture: 4 } },
};

export interface CharacterStateProfile {
  /** Lot H: play the lived-attitude texts (off until Romed validated the wording). */
  livedTexts?: boolean;
  initial: StateLevels;
  min: StateLevels;
  max: StateLevels;
  /** false pins the state to its initial values (the GM section is not sent). */
  gmCanEvolve: boolean;
  /** Largest change per axis and per turn accepted from the GM. */
  maxStepPerTurn: number;
  /** Optional per-character axis labels. */
  labels?: Partial<Record<StateAxis, string>>;
}

export function stateAxisLabel(axis: StateAxis, profile?: Pick<CharacterStateProfile, "labels"> | null): string {
  return profile?.labels?.[axis]?.trim() || STATE_AXIS_LABELS[axis];
}

function toLevel(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(STATE_LEVEL_MAX, Math.max(STATE_LEVEL_MIN, Math.round(n)));
}

function readLevels(raw: unknown, fallback: number): StateLevels {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const out = {} as StateLevels;
  for (const axis of STATE_AXES) out[axis] = toLevel(source[axis], fallback);
  return out;
}

/**
 * Reads the stored `state_profile` jsonb. Returns null when nothing is
 * configured: the character then gets no state block and the GM no section,
 * exactly as before lot D.
 */
export function normalizeStateProfile(raw: unknown): CharacterStateProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const min = readLevels(source.min, STATE_LEVEL_MIN);
  const max = readLevels(source.max, STATE_LEVEL_MAX);
  const initial = readLevels(source.initial, STATE_NEUTRAL_LEVEL);
  for (const axis of STATE_AXES) {
    if (max[axis] < min[axis]) max[axis] = min[axis];
    initial[axis] = Math.min(max[axis], Math.max(min[axis], initial[axis]));
  }
  const step = Math.round(Number(source.maxStepPerTurn));
  const labels: Partial<Record<StateAxis, string>> = {};
  const rawLabels = source.labels && typeof source.labels === "object" && !Array.isArray(source.labels)
    ? source.labels as Record<string, unknown> : {};
  for (const axis of STATE_AXES) {
    const label = rawLabels[axis];
    if (typeof label === "string" && label.trim()) labels[axis] = label.trim().slice(0, STATE_LABEL_MAX_CHARS);
  }
  return {
    ...(source.livedTexts === true ? { livedTexts: true } : {}),
    initial, min, max,
    gmCanEvolve: source.gmCanEvolve !== false,
    maxStepPerTurn: Number.isFinite(step) ? Math.min(STATE_MAX_STEP_LIMIT, Math.max(1, step)) : 1,
    ...(Object.keys(labels).length ? { labels } : {}),
  };
}

/** Compact, serializable form written back to the column. */
export function serializeStateProfile(profile: CharacterStateProfile): CharacterStateProfile {
  return normalizeStateProfile(profile) as CharacterStateProfile;
}

export function defaultStateProfile(): CharacterStateProfile {
  return normalizeStateProfile({}) as CharacterStateProfile;
}

export function clampLevels(levels: Partial<Record<StateAxis, unknown>> | null | undefined, profile: CharacterStateProfile): StateLevels {
  const out = {} as StateLevels;
  for (const axis of STATE_AXES) {
    const value = toLevel(levels?.[axis], profile.initial[axis]);
    out[axis] = Math.min(profile.max[axis], Math.max(profile.min[axis], value));
  }
  return out;
}

/**
 * State the character receives at this turn. Off: the GM is not called, so the
 * state stays at its initial value whatever an older log says. Light and full
 * keep the evolution (the state is not a speech advice).
 */
export function resolveCharacterStateForTurn(params: {
  profile: CharacterStateProfile | null;
  mode: GmMode;
  logged: Partial<Record<StateAxis, unknown>> | null | undefined;
}): StateLevels | null {
  const { profile, mode, logged } = params;
  if (!profile) return null;
  if (mode === "off" || !profile.gmCanEvolve || !logged) return { ...profile.initial };
  return clampLevels(logged, profile);
}

export type StateDeltaIssue =
  | "state_delta_invalid"
  | "state_delta_invalid_value"
  | "state_delta_unknown_axis"
  | "state_delta_wrong_character"
  | "state_delta_wrong_turn"
  | "state_delta_step_clamped"
  | "state_delta_disabled";

export interface StateDeltaResult {
  next: StateLevels;
  /** Signed change actually applied per axis (after step and bounds). */
  applied: Partial<Record<StateAxis, number>>;
  issues: StateDeltaIssue[];
}

/**
 * Deterministic validation of `character_state_delta`:
 * `{ characterKey, sourceTurn, changes: { axis: signedInteger } }`.
 * A result for another character or another turn (late) is ignored whole;
 * steps above maxStepPerTurn and bounds are clamped, never trusted.
 */
export function validateStateDelta(params: {
  raw: unknown;
  profile: CharacterStateProfile;
  current: StateLevels;
  expected: { characterKey: string; turnIndex: number };
}): StateDeltaResult {
  const { raw, profile, expected } = params;
  const current = clampLevels(params.current, profile);
  const unchanged = (issues: StateDeltaIssue[] = []): StateDeltaResult => ({ next: current, applied: {}, issues });
  if (raw === undefined || raw === null) return unchanged();
  if (!profile.gmCanEvolve) return unchanged(["state_delta_disabled"]);
  if (typeof raw !== "object" || Array.isArray(raw)) return unchanged(["state_delta_invalid"]);
  const body = raw as Record<string, unknown>;
  if (body.characterKey !== expected.characterKey) return unchanged(["state_delta_wrong_character"]);
  if (body.sourceTurn !== expected.turnIndex) return unchanged(["state_delta_wrong_turn"]);
  const changes = body.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return unchanged(["state_delta_invalid"]);

  const issues = new Set<StateDeltaIssue>();
  const next = { ...current };
  const applied: Partial<Record<StateAxis, number>> = {};
  for (const [key, value] of Object.entries(changes as Record<string, unknown>)) {
    if (!(STATE_AXES as readonly string[]).includes(key)) { issues.add("state_delta_unknown_axis"); continue; }
    const axis = key as StateAxis;
    if (typeof value !== "number" || !Number.isFinite(value)) { issues.add("state_delta_invalid_value"); continue; }
    let step = Math.round(value);
    if (Math.abs(step) > profile.maxStepPerTurn) {
      step = Math.sign(step) * profile.maxStepPerTurn;
      issues.add("state_delta_step_clamped");
    }
    const target = Math.min(profile.max[axis], Math.max(profile.min[axis], current[axis] + step));
    if (target !== current[axis]) {
      next[axis] = target;
      applied[axis] = target - current[axis];
    }
  }
  return { next, applied, issues: [...issues] };
}

/** Block « ÉTAT DU PERSONNAGE À CE TOUR » sent to the character. */
export function resolveRadarTextVariant(profile: Pick<CharacterStateProfile, "livedTexts"> | null, override?: RadarTextVariant): RadarTextVariant {
  return override ?? (profile?.livedTexts ? "lived" : "legacy");
}

export function compileCharacterStateBlock(levels: StateLevels, profile: CharacterStateProfile | null, variant?: RadarTextVariant): string {
  const texts = resolveRadarTextVariant(profile, variant) === "lived" ? STATE_LEVEL_TEXT_LIVED : STATE_LEVEL_TEXT;
  const lines = STATE_AXES.map((axis) => {
    const level = toLevel(levels[axis], STATE_NEUTRAL_LEVEL) as StateLevel;
    return `- ${stateAxisLabel(axis, profile)} : ${texts[axis][level]}.`;
  });
  return [
    "Ton état intérieur à ce tour règle ton attitude (ce que tu veux faire, ce que tu donnes), jamais la vérité de ce que tu sais ni le registre de ta parole : les faits de ta fiche et la forme de ta parole (états de parole, rugosité) ne bougent pas avec lui. Ne le nomme jamais et n'en cite aucun chiffre.",
    ...lines,
  ].join("\n");
}

/** Section « ## ÉTAT DU PERSONNAGE » of the GM user prompt; empty when the state is pinned. */
export function buildGmStateSection(params: {
  levels: StateLevels;
  profile: CharacterStateProfile;
  characterKey: string;
  turnIndex: number;
}): string {
  const { levels, profile, characterKey, turnIndex } = params;
  if (!profile.gmCanEvolve) return "";
  const rows = STATE_AXES.map((axis) =>
    `- ${stateAxisLabel(axis, profile)} (${STATE_AXIS_POLES[axis][0]} 0 ↔ ${STATE_AXIS_POLES[axis][1]} 5) : ${levels[axis]} (bornes ${profile.min[axis]}–${profile.max[axis]})`);
  const example = JSON.stringify({ characterKey, sourceTurn: turnIndex, changes: { [STATE_AXES[4]]: 1 } });
  return `## ÉTAT DU PERSONNAGE
État transmis au personnage à ce tour, sur cinq axes de 0 à 5 :
${rows.join("\n")}
Fais évoluer cet état selon ce que vit le personnage dans cet échange : au plus ${profile.maxStepPerTurn} cran par axe et par tour, seulement pour un axe qui bouge vraiment. Le résultat s'applique au tour suivant ; le moteur borne tout. Tu prends une seule décision par tour : l'état de parole que tu proposes (next_speech_state) doit rester cohérent avec cet état (un personnage fermé ou à plat ne reçoit pas un état de parole expansif, un personnage à vif pas un état posé).
Champ optionnel character_state_delta à la racine du JSON : null ou absent si rien ne change, sinon recopie exactement characterKey et sourceTurn, avec des changements signés. Exemple : ${example}`;
}

/**
 * Evolved state per character from a session's post-turn log (resume): the
 * latest validated `character_state_after` of each character.
 */
export function rebuildCharacterStates(log: unknown): Record<string, StateLevels> {
  const out: Record<string, StateLevels> = {};
  if (!Array.isArray(log)) return out;
  for (const entry of log) {
    if (!entry || typeof entry !== "object") continue;
    const { character_key: key, character_state_after: after } = entry as { character_key?: unknown; character_state_after?: unknown };
    if (typeof key !== "string" || !after || typeof after !== "object") continue;
    const levels = {} as StateLevels;
    let complete = true;
    for (const axis of STATE_AXES) {
      const value = (after as Record<string, unknown>)[axis];
      if (typeof value !== "number" || !Number.isFinite(value)) { complete = false; break; }
      levels[axis] = toLevel(value, STATE_NEUTRAL_LEVEL);
    }
    if (complete) out[key] = levels;
  }
  return out;
}

export interface StateSeriesPoint { turn: number; levels: StateLevels }

/**
 * Per-character series of the state the character played with at each turn
 * (`character_state_used`), for the sessions history. Entries without a state
 * (before lot D, or no profile) are skipped.
 */
export function stateSeriesByCharacter(log: unknown): Record<string, StateSeriesPoint[]> {
  const out: Record<string, StateSeriesPoint[]> = {};
  if (!Array.isArray(log)) return out;
  log.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const { character_key: key, character_state_used: used, turn_index: turn } =
      entry as { character_key?: unknown; character_state_used?: unknown; turn_index?: unknown };
    if (typeof key !== "string" || !used || typeof used !== "object") return;
    const levels = {} as StateLevels;
    for (const axis of STATE_AXES) {
      const value = (used as Record<string, unknown>)[axis];
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      levels[axis] = toLevel(value, STATE_NEUTRAL_LEVEL);
    }
    (out[key] ??= []).push({ turn: typeof turn === "number" ? turn : index + 1, levels });
  });
  return out;
}

/** One-line reading of a state for a log entry, e.g. « Combativité 3 · Initiative 3 · … ». */
export function describeStateLevels(levels: StateLevels, profile?: Pick<CharacterStateProfile, "labels"> | null): string {
  return STATE_AXES.map((axis) => `${stateAxisLabel(axis, profile)} ${levels[axis]}`).join(" · ");
}
