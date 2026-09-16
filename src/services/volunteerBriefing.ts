/**
 * Onboarding du bénévole — source de vérité unique.
 *
 * Contient le texte des cartes affichées entre l'introduction et le choix du
 * personnage, le cadre transmis aux personnages (canal `player_role`) et la
 * mémoire locale de complétion. Générique : aucun personnage n'est nommé.
 *
 * Voir docs/plan_onboarding_benevole.md
 */
import type { UserRoleProfile } from "@/types";

export const VOLUNTEER_BRIEFING_VERSION = "2026-09-16";
export const VOLUNTEER_BRIEFING_STORAGE_KEY = "ava_volunteer_briefing";

export interface VolunteerBriefingCard {
  id: string;
  title: string;
  paragraphs: string[];
}

export const VOLUNTEER_BRIEFING_CARDS: readonly VolunteerBriefingCard[] = [
  {
    id: "role",
    title: "Tu es bénévole.",
    paragraphs: [
      "Tu fais partie d'un dispositif de soutien aux personnes qui viennent de vivre un événement traumatique.",
      "Les services officiels sont débordés. Ce dispositif ajoute simplement une présence humaine.",
    ],
  },
  {
    id: "posture",
    title: "Ton rôle : être là.",
    paragraphs: [
      "Écouter, soutenir, chercher à comprendre.",
      "Tu n'es ni psychologue ni professionnel·le de santé. Tu n'as pas de solution à apporter, et personne n'attend ça de toi.",
    ],
  },
  {
    id: "knowledge",
    title: "Ce que tu sais déjà.",
    paragraphs: [
      "Tu as lu le compte rendu des événements transmis aux autorités. Tu connais donc certains faits.",
      "Mais tu ne connais personne personnellement. Tu pourras te présenter comme tu veux, ou pas, pendant l'appel.",
    ],
  },
];

/** Cadre transmis au personnage, à la mémoire et au Game Master dès le 1er tour. */
export const VOLUNTEER_FRAME_FOR_CHARACTER = [
  "La personne qui t'appelle est bénévole d'un dispositif de soutien aux personnes ayant vécu un événement traumatique. Les services officiels sont débordés ; ce dispositif complète leur action par une présence humaine, fondée sur l'écoute et le soutien.",
  "Elle n'est ni psychologue ni professionnelle de santé. Elle a eu accès au compte rendu des événements transmis aux autorités : elle connaît donc certains faits, sans les avoir vécus.",
  "Tu savais qu'un contact bénévole de ce type était possible. Mais tu ne connais pas cette personne : n'invente aucune rencontre antérieure, aucune relation passée, aucune confiance déjà acquise, aucun élément biographique la concernant (nom, âge, genre, métier, situation).",
  "Si elle ne se présente pas, ne le lui reproche pas et ne devine rien. La confiance se construit progressivement au fil de la conversation.",
].join("\n");

/** Profil joueur système, sans aucune donnée personnelle. */
export function buildVolunteerRoleProfile(now: Date = new Date()): UserRoleProfile {
  return {
    raw_input: "",
    summary_for_user:
      "Tu es bénévole d'un dispositif de soutien : tu es là pour écouter, soutenir et comprendre.",
    summary_for_max: VOLUNTEER_FRAME_FOR_CHARACTER,
    relationship_to_family: "aucune relation préalable",
    age: "",
    gender: "",
    proximity_level: "institutionnel",
    intent: "écouter, soutenir et comprendre",
    created_by_system: true,
    created_at: now.toISOString(),
  };
}

export interface VolunteerBriefingProgress {
  version: string;
  completed: boolean;
  lastCardIndex: number;
  replays: number;
  updatedAt: string;
}

const emptyProgress: VolunteerBriefingProgress = {
  version: VOLUNTEER_BRIEFING_VERSION,
  completed: false,
  lastCardIndex: 0,
  replays: 0,
  updatedAt: "",
};

export function getVolunteerBriefingProgress(): VolunteerBriefingProgress {
  try {
    const raw = localStorage.getItem(VOLUNTEER_BRIEFING_STORAGE_KEY);
    if (!raw) return { ...emptyProgress };
    const parsed = JSON.parse(raw) as Partial<VolunteerBriefingProgress>;
    if (parsed.version !== VOLUNTEER_BRIEFING_VERSION) return { ...emptyProgress };
    return {
      version: VOLUNTEER_BRIEFING_VERSION,
      completed: parsed.completed === true,
      lastCardIndex: Math.min(
        Math.max(typeof parsed.lastCardIndex === "number" ? parsed.lastCardIndex : 0, 0),
        VOLUNTEER_BRIEFING_CARDS.length - 1,
      ),
      replays: typeof parsed.replays === "number" ? parsed.replays : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { ...emptyProgress };
  }
}

export function saveVolunteerBriefingProgress(
  patch: Partial<Omit<VolunteerBriefingProgress, "version" | "updatedAt">>,
): VolunteerBriefingProgress {
  const next: VolunteerBriefingProgress = {
    ...getVolunteerBriefingProgress(),
    ...patch,
    version: VOLUNTEER_BRIEFING_VERSION,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(VOLUNTEER_BRIEFING_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // La progression reste en mémoire si le stockage local est indisponible.
  }
  return next;
}

export function clearVolunteerBriefingProgress(): void {
  try {
    localStorage.removeItem(VOLUNTEER_BRIEFING_STORAGE_KEY);
  } catch {
    // ignore
  }
}
