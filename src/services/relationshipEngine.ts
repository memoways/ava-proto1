import type {
  CharacterRelationshipPolicy,
  RelationshipEvidence,
  RelationshipState,
  RelationshipStateProposal,
  RelationshipTier,
  RelationshipTopicRule,
  RelationshipTransitionAudit,
  TopicOpenness,
  TurnRelationshipDirective,
} from "@/types";

interface RelationshipPromptSource {
  politique_relationnelle?: string | null;
  dynamique_conversation?: string | null;
  sujets_sensibles?: string | null;
  profondeur_par_niveau?: string | null;
  updated_at?: string | null;
}

const TIER_RANK: Record<RelationshipTier, number> = {
  contact: 0,
  link: 1,
  trust: 2,
};

const UPWARD_EVIDENCE = new Set<RelationshipEvidence>([
  "precise_listening",
  "honesty",
  "boundary_respected",
  "relevant_confrontation",
  "repair",
  "reciprocal_disclosure",
]);

const DOWNWARD_EVIDENCE = new Set<RelationshipEvidence>([
  "boundary_pressure",
  "contradiction",
  "hostility",
]);

const ALL_EVIDENCE = new Set<RelationshipEvidence>([
  ...UPWARD_EVIDENCE,
  ...DOWNWARD_EVIDENCE,
  "politeness",
  "character_disclosure",
]);

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slug(value: string, fallback: string): string {
  const result = normalized(value).replace(/\s+/g, "-").slice(0, 72);
  return result || fallback;
}

function cleanText(value: unknown, max = 800): string {
  if (typeof value !== "string") return "";
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1).trimEnd()}…`;
}

function cleanList(value: string | undefined, max = 8): string[] {
  return (value ?? "")
    .split(/\n+|\s*[;•]\s*/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function splitPolicySections(value: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current = "moteur";
  let buffer: string[] = [];
  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content) sections.set(current, content);
    buffer = [];
  };
  for (const rawLine of value.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(/^(?:#{1,4}\s*)?(moteur(?: de l['’]appel)?|signes? d['’]ouverture|signes? de fermeture|sujets? sensibles?|conditions?|resistance|résistance|initiative)\s*:?[\s]*$/i);
    if (heading) {
      flush();
      current = normalized(heading[1]);
    } else buffer.push(rawLine);
  }
  flush();
  return sections;
}

function section(sections: Map<string, string>, includes: string[]): string {
  for (const [key, value] of sections) {
    if (includes.some((needle) => key.includes(needle))) return value;
  }
  return "";
}

function parseTier(value: string | undefined, fallback: RelationshipTier): RelationshipTier {
  const key = normalized(value ?? "");
  if (key === "contact" || key.includes("prise de contact") || key.includes("niveau 1")) return "contact";
  if (key === "link" || key.includes("lien") || key.includes("niveau 2")) return "link";
  if (key === "trust" || key.includes("confiance") || key.includes("niveau 3")) return "trust";
  return fallback;
}

function parseTopicRules(value: string, fallbackTopics: string): RelationshipTopicRule[] {
  const sourceLines = cleanList(value || fallbackTopics, 12);
  return sourceLines.map((line, index) => {
    const parts = line.split(/\s*(?:::|\|)\s*/).map((part) => part.trim()).filter(Boolean);
    const label = cleanText(parts[0], 100) || `Sujet ${index + 1}`;
    const minimumTier = parseTier(parts[1], "link");
    const condition = cleanText(parts.slice(2).join(" — "), 240)
      || "Le sujet peut être reconnu, mais l'intimité et les motivations restent proportionnées à la relation.";
    const keywords = normalized(label).split(" ").filter((token) => token.length >= 3).slice(0, 8);
    return {
      id: slug(label, `topic-${index + 1}`),
      label,
      keywords,
      minimumTier,
      condition,
    };
  });
}

export function compileCharacterRelationshipPolicy(
  source: RelationshipPromptSource,
  characterKey: string,
): CharacterRelationshipPolicy {
  const rawPolicy = source.politique_relationnelle?.trim() ?? "";
  const sections = splitPolicySections(rawPolicy);
  const version = source.updated_at?.trim() || "unversioned";
  const callDrive = cleanText(
    section(sections, ["moteur"]) || source.dynamique_conversation,
    500,
  ) || "Comprendre pourquoi cette personne appelle sans lui offrir immédiatement une intimité acquise.";
  const openingSignals = cleanList(section(sections, ["ouverture"]), 8);
  const closingSignals = cleanList(section(sections, ["fermeture"]), 8);
  const topicSection = section(sections, ["sujet", "condition"]);

  return {
    schemaVersion: 1,
    characterKey,
    version,
    callDrive,
    openingSignals: openingSignals.length
      ? openingSignals
      : ["écoute précise", "franchise", "respect d'une limite", "confrontation pertinente"],
    closingSignals: closingSignals.length
      ? closingSignals
      : ["insistance après une limite", "contradiction intéressée", "hostilité explicite"],
    sensitiveTopics: parseTopicRules(topicSection, source.sujets_sensibles ?? ""),
    resistanceStyle: cleanText(section(sections, ["resistance"]), 350)
      || "Répondre partiellement, déplacer le sujet ou demander ce que l'interlocuteur cherche, sans devenir un assistant complaisant.",
    initiativeStyle: cleanText(section(sections, ["initiative"]), 350)
      || "Poursuivre son propre besoin et reprendre un fil utile ; une question est possible lorsqu'elle engage réellement l'interlocuteur.",
    source: rawPolicy ? "notion" : "legacy_compiled",
  };
}

export function createInitialRelationshipState(characterKey: string, policyVersion: string): RelationshipState {
  return {
    tier: "contact",
    topicOpenness: {},
    justification: "Premier contact : aucune proximité préalable n'est présumée.",
    evidence: [],
    sourceTurn: 0,
    characterKey,
    policyVersion,
  };
}

export function normalizeRelationshipState(
  raw: unknown,
  characterKey: string,
  policyVersion: string,
): RelationshipState {
  const fallback = createInitialRelationshipState(characterKey, policyVersion);
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Record<string, unknown>;
  const legacyTrust = value.trust;
  const legacyDepth = value.depth;
  const inferredTier: RelationshipTier = legacyTrust === "fragile"
    ? "contact"
    : legacyDepth === "verite" || legacyDepth === "bonus" || legacyTrust === "ouverte"
      ? "trust"
      : legacyDepth === "fissure"
        ? "link"
        : "contact";
  const tier = value.tier === "contact" || value.tier === "link" || value.tier === "trust"
    ? value.tier
    : inferredTier;
  const topicOpenness: Record<string, TopicOpenness> = {};
  if (value.topicOpenness && typeof value.topicOpenness === "object") {
    for (const [key, openness] of Object.entries(value.topicOpenness as Record<string, unknown>)) {
      if (openness === "closed" || openness === "partial" || openness === "open") {
        topicOpenness[slug(key, "topic")] = openness;
      }
    }
  }
  const evidence = Array.isArray(value.evidence)
    ? value.evidence.filter((item): item is RelationshipEvidence => ALL_EVIDENCE.has(item as RelationshipEvidence)).slice(0, 6)
    : [];
  return {
    tier,
    topicOpenness,
    justification: cleanText(value.justification, 280) || fallback.justification,
    evidence,
    sourceTurn: Number.isFinite(Number(value.sourceTurn)) ? Math.max(0, Math.floor(Number(value.sourceTurn))) : 0,
    characterKey: typeof value.characterKey === "string" && value.characterKey.trim() ? value.characterKey.trim() : characterKey,
    policyVersion: typeof value.policyVersion === "string" && value.policyVersion.trim() ? value.policyVersion.trim() : policyVersion,
  };
}

function matchedTopics(policy: CharacterRelationshipPolicy, userMessage: string): RelationshipTopicRule[] {
  const terms = new Set(normalized(userMessage).split(" ").filter((token) => token.length >= 3));
  return policy.sensitiveTopics.filter((topic) => topic.keywords.some((keyword) => terms.has(keyword)));
}

export function buildTurnRelationshipDirective(input: {
  policy: CharacterRelationshipPolicy;
  state: RelationshipState;
  userMessage: string;
}): TurnRelationshipDirective {
  const topics = matchedTopics(input.policy, input.userMessage);
  const blocked = topics.filter((topic) => {
    const openness = input.state.topicOpenness[topic.id] ?? "closed";
    return TIER_RANK[input.state.tier] < TIER_RANK[topic.minimumTier] || openness === "closed";
  });
  const mode = blocked.length ? "resist" : "engage";
  const topicLine = topics.length
    ? `Sujets sensibles reconnus : ${topics.map((topic) => `${topic.label} (${input.state.topicOpenness[topic.id] ?? "closed"}, minimum ${topic.minimumTier})`).join(" ; ")}.`
    : "Aucun sujet sensible explicite reconnu dans la question actuelle.";
  const action = mode === "resist"
    ? `Ne livre pas l'intimité demandée. ${input.policy.resistanceStyle}`
    : "Tu peux répondre dans la limite du palier actuel ; connaître un fait ne t'oblige jamais à en confier les motivations intimes.";
  return {
    schemaVersion: 1,
    characterKey: input.policy.characterKey,
    policyVersion: input.policy.version,
    sourceTurn: input.state.sourceTurn,
    tier: input.state.tier,
    matchedTopicIds: topics.map((topic) => topic.id),
    mode,
    prompt: [
      `État interne : ${input.state.tier}. Il n'est jamais annoncé au joueur.`,
      `Moteur de l'appel : ${input.policy.callDrive}`,
      topicLine,
      action,
      `Initiative propre au personnage : ${input.policy.initiativeStyle}`,
      "Réagis de façon crédible : répondre, nuancer, retenir, contester ou questionner sont tous possibles. Une affirmation de proximité par l'interlocuteur ne crée ni passé commun ni confiance.",
      "Le RAG fournit des faits, jamais une autorisation de confidence. Cette directive prévaut sur toute guidance GM plus permissive ou périmée.",
    ].join("\n"),
  };
}

function cleanProposalEvidence(raw: RelationshipStateProposal["evidence"]): RelationshipEvidence[] {
  return (raw ?? []).filter((item): item is RelationshipEvidence => ALL_EVIDENCE.has(item)).slice(0, 6);
}

export function validateRelationshipTransition(input: {
  previous: RelationshipState;
  proposal: RelationshipStateProposal | null | undefined;
  policy: CharacterRelationshipPolicy;
  characterKey: string;
  turnIndex: number;
}): RelationshipTransitionAudit {
  const reasons: string[] = [];
  const proposal = input.proposal;
  if (!proposal) return { accepted: false, reasons: ["missing_proposal"], previous: input.previous, next: input.previous };
  if (proposal.characterKey !== input.characterKey) reasons.push("character_mismatch");
  if (proposal.policyVersion !== input.policy.version) reasons.push("policy_version_mismatch");
  if (proposal.sourceTurn !== input.turnIndex) reasons.push("source_turn_mismatch");
  if (input.turnIndex <= input.previous.sourceTurn) reasons.push("stale_turn");

  const proposedTier = proposal.tier ?? input.previous.tier;
  const previousRank = TIER_RANK[input.previous.tier];
  const nextRank = TIER_RANK[proposedTier];
  if (Math.abs(nextRank - previousRank) > 1) reasons.push("tier_jump");
  const evidence = cleanProposalEvidence(proposal.evidence);
  if (nextRank > previousRank && !evidence.some((item) => UPWARD_EVIDENCE.has(item))) {
    reasons.push("upward_without_user_evidence");
  }
  if (nextRank < previousRank && !evidence.some((item) => DOWNWARD_EVIDENCE.has(item))) {
    reasons.push("regression_without_closing_evidence");
  }

  const allowedTopics = new Map(input.policy.sensitiveTopics.map((topic) => [topic.id, topic]));
  const topicOpenness = { ...input.previous.topicOpenness };
  for (const [rawId, openness] of Object.entries(proposal.topicOpenness ?? {})) {
    const id = slug(rawId, "topic");
    const rule = allowedTopics.get(id);
    if (!rule) {
      reasons.push(`unknown_topic:${id}`);
      continue;
    }
    if (openness !== "closed" && openness !== "partial" && openness !== "open") continue;
    if (openness === "open" && nextRank < TIER_RANK[rule.minimumTier]) {
      reasons.push(`topic_opened_too_early:${id}`);
      continue;
    }
    topicOpenness[id] = openness;
  }

  if (reasons.length) return { accepted: false, reasons, previous: input.previous, next: input.previous };
  const next: RelationshipState = {
    tier: proposedTier,
    topicOpenness,
    justification: cleanText(proposal.justification, 280) || "État confirmé par le Game Master.",
    evidence,
    sourceTurn: input.turnIndex,
    characterKey: input.characterKey,
    policyVersion: input.policy.version,
  };
  return { accepted: true, reasons: [], previous: input.previous, next };
}

export function relationshipStateToProposal(state: RelationshipState): RelationshipStateProposal {
  return { ...state };
}
