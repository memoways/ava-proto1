/**
 * Cadre commun de l'expérience — source unique partagée par le personnage
 * actif et le Game Master. Le contenu éditorial (cadre, consignes d'exposition,
 * posture) vit dans la version d'orchestration publiée (admin), jamais en dur
 * dans les prompts. Ce module ne fait qu'assembler, sans appel IA.
 *
 * Le cadre institutionnel (pourquoi l'appel a lieu) reste distinct de l'état
 * relationnel propre à chaque personnage (directive relationnelle).
 */
import type { ConversationMessage, ExperienceFrameConfig, FilmAnswer } from "@/types";
import { characterDisplayName } from './characterConversation';

export type ExperiencePath = "seen" | "unseen";

export const DEFAULT_EXPERIENCE_FRAME_CONFIG: ExperienceFrameConfig = {
  enabled: false,
  frameText: [
    "L'interlocuteur est une personne bénévole d'un dispositif de soutien aux personnes ayant vécu un événement traumatique. Il appelle à distance, depuis Lausanne.",
    "Tu sais qu'une personne de ce dispositif peut te contacter, mais tu ne la connais pas et tu n'as aucune relation préalable avec elle. N'invente ni rencontre, ni passé commun, ni confiance acquise.",
    "Sa présentation est facultative : ne réclame ni prénom, ni âge, ni métier, ni biographie, et ne redemande jamais une information déjà donnée.",
    "Cette personne n'est ni thérapeute, ni policière, ni une autorité, ni un proche. Si elle revendique un tel statut, ne le valide pas silencieusement : relève-le avec douceur.",
  ].join("\n"),
  exposureSeen: "Le joueur connaît déjà les faits principaux. Ne les récite pas ; approfondis le vécu, les zones d'ombre et l'avenir de la famille.",
  exposureUnseen: "Le joueur découvre les faits. Donne progressivement les éléments nécessaires pour comprendre, sans détails incompréhensibles ni révélation prématurée.",
  posture: "reserved",
  postureNotes: "",
  forbidSpontaneousHandoff: true,
};

const POSTURE_TEXT: Record<ExperienceFrameConfig["posture"], string> = {
  reserved: "Posture : tu as besoin d'aide mais tu restes pudique ; l'intime se confie à mesure que la douceur et l'écoute s'installent.",
  open: "Posture : tu es plutôt ouvert dès le départ ; la douceur de l'interlocuteur permet d'approfondir.",
};

export function normalizeExperienceFrameConfig(raw: Partial<ExperienceFrameConfig> | null | undefined): ExperienceFrameConfig {
  const base = DEFAULT_EXPERIENCE_FRAME_CONFIG;
  const text = (value: unknown, fallback: string, max = 2_000) =>
    typeof value === "string" ? value.trim().slice(0, max) : fallback;
  return {
    enabled: raw?.enabled === true,
    frameText: text(raw?.frameText, base.frameText),
    exposureSeen: text(raw?.exposureSeen, base.exposureSeen, 800),
    exposureUnseen: text(raw?.exposureUnseen, base.exposureUnseen, 800),
    posture: raw?.posture === "open" ? "open" : "reserved",
    postureNotes: text(raw?.postureNotes, "", 600),
    forbidSpontaneousHandoff: raw?.forbidSpontaneousHandoff !== false,
  };
}

/** Le parcours vient de la réponse du joueur ; « rappel » = résumé vu, donc briefé. */
export function experiencePathFromFilmAnswer(answer: FilmAnswer | string | null | undefined): ExperiencePath | null {
  if (answer === "vu" || answer === "rappel") return "seen";
  if (answer === "pas_vu") return "unseen";
  return null;
}

export interface ExperienceFrameInput {
  config: ExperienceFrameConfig | null | undefined;
  filmAnswer: FilmAnswer | string | null | undefined;
  /** Faits sur l'interlocuteur déjà acquis (prénom, statut…), issus de la mémoire. */
  knownAboutPlayer?: string[];
  callTransfer?: ConversationMessage['callTransfer'];
}

export interface ExperienceFrame {
  enabled: boolean;
  path: ExperiencePath | null;
  /** Bloc identique injecté chez le personnage et chez le GM. */
  prompt: string;
}

export function buildExperienceFrame(input: ExperienceFrameInput): ExperienceFrame {
  const config = normalizeExperienceFrameConfig(input.config);
  const path = experiencePathFromFilmAnswer(input.filmAnswer);
  // A film answer is factual context, not an editorial frame setting. Always
  // share it identically with GM and character without enabling sandbox rules.
  const filmContext = path ? `Choix initial du joueur — film : ${input.filmAnswer}.` : "";
  const transfer = input.callTransfer;
  const source = transfer && (transfer.from === 'emma' || transfer.from === 'max') ? characterDisplayName(transfer.from) : null;
  const transferContext = source ? `CONTINUITÉ DE L'APPEL : cet appel t'a été ${transfer?.returning ? 'repassé' : 'passé'} par ${source}. Tu sais qu'une discussion était en cours : tu as seulement perçu sa voix, sans connaître ses mots ni les confidences échangées. ${transfer?.returning ? 'Reprends ta propre conversation avec cet interlocuteur et tes seuls souvenirs.' : 'Accueille cet interlocuteur comme un appel transféré, sans prétendre déjà le connaître.'} Ne rejoue pas l'accueil d'un appel initial et ne répète pas l'annonce du transfert à chaque tour.` : '';
  const facts = [filmContext, transferContext].filter(Boolean);
  if (!config.enabled) return { enabled: false, path, prompt: facts.join('\n') };
  const lines: string[] = [...facts];
  if (config.frameText) lines.push(config.frameText);
  const exposure = path === "seen" ? config.exposureSeen : path === "unseen" ? config.exposureUnseen : "";
  if (exposure) lines.push(`Parcours ${path === "seen" ? "briefé (film vu)" : "découverte (film non vu)"} : ${exposure}`);
  lines.push(POSTURE_TEXT[config.posture]);
  if (config.postureNotes) lines.push(config.postureNotes);
  const known = (input.knownAboutPlayer ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 6);
  if (known.length) lines.push(`Déjà connu de l'interlocuteur (ne pas redemander) : ${known.join(" ; ")}.`);
  if (config.forbidSpontaneousHandoff) {
    lines.push("Ne renvoie jamais de toi-même vers un autre personnage : ne le fais que si une consigne de mise en scène te le demande.");
  }
  return { enabled: true, path, prompt: lines.join("\n") };
}
