import type { MaxPromptAssemblyTrace, PromptSectionsDigest } from "@/types";

/**
 * Souvenirs lot 1 — the light, always-written trace of what the character really
 * received at one turn: each non-empty section (key, size, why it was left out),
 * the ids of the souvenirs sent whole and the budget warnings. No prompt text, so
 * it can live in `conversation_log[].pipeline` without the diagnostic trace.
 */
export function buildPromptSectionsDigest(trace: MaxPromptAssemblyTrace | null | undefined): PromptSectionsDigest | undefined {
  const budget = trace?.budget;
  if (!budget) return undefined;
  return {
    variant: budget.variant,
    systemChars: budget.totalSystemChars,
    limitChars: budget.limitChars,
    sections: budget.sections
      .filter((section) => section.included || section.omissionReason !== "section_vide")
      .map((section) => ({
        key: section.key,
        chars: section.chars,
        included: section.included,
        ...(section.truncated ? { truncated: true } : {}),
        ...(!section.included && section.omissionReason ? { reason: section.omissionReason } : {}),
      })),
    ...(budget.sentRagIds ? { souvenirs: [...budget.sentRagIds] } : {}),
    ...(budget.warnings?.length ? { warnings: budget.warnings.map((warning) => warning.code) } : {}),
  };
}

const SECTION_LABELS: Record<string, string> = {
  technical_rules: "règles",
  identity_invariant: "identité",
  character_core: "noyau",
  experience_frame: "cadre",
  relationship_directive: "directive",
  speech_state: "parole",
  character_state: "état",
  runtime_context: "état du tour",
  conversation_memory: "mémoire",
  character_canon: "canon",
  post_video: "après vidéo",
  watched_videos: "vidéos vues",
  rag_context: "souvenirs",
};

const WARNING_LABELS: Record<string, string> = {
  souvenirs_evinces: "souvenirs retirés",
  memoire_evincee: "mémoire retirée",
  canon_evince: "canon retiré",
  canon_squeezed: "canon serré",
  established_facts_dropped: "faits établis retirés",
};

/** Plain lines for Admin › Sessions › « Détail du tour ». */
export function describePromptSections(digest: PromptSectionsDigest | null | undefined): { sent: string; dropped: string | null; warnings: string | null } | null {
  if (!digest?.sections?.length) return null;
  const label = (key: string) => SECTION_LABELS[key] ?? key;
  const sent = digest.sections.filter((section) => section.included)
    .map((section) => `${label(section.key)} ${section.chars}${section.truncated ? " (coupé)" : ""}`);
  const dropped = digest.sections.filter((section) => !section.included)
    .map((section) => `${label(section.key)}${section.reason === "budget_contexte_epuise" ? " (manque de place)" : section.reason ? ` (${section.reason})` : ""}`);
  const souvenirs = digest.souvenirs ? ` · ${digest.souvenirs.length} souvenir${digest.souvenirs.length > 1 ? "s" : ""} envoyé${digest.souvenirs.length > 1 ? "s" : ""}` : "";
  return {
    sent: `Reçu par le personnage : ${digest.systemChars} / ${digest.limitChars} car.${souvenirs} — ${sent.join(", ")}`,
    dropped: dropped.length ? `Retiré : ${dropped.join(", ")}` : null,
    warnings: digest.warnings?.length ? `⚠ ${digest.warnings.map((code) => WARNING_LABELS[code] ?? code).join(", ")}` : null,
  };
}
