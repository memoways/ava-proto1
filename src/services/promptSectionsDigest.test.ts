import { describe, expect, it } from "vitest";
import fixture from "@/agents/__fixtures__/souvenirsSandboxRomed20261123.json";
import { buildOptimizedPromptAssembly } from "@/agents/maxOptimizedPromptCompiler";
import { buildCharacterRulesInvariant, previewCharacterIdentity } from "@/agents/characterRulesInvariant";
import type { CharacterPrompt } from "@/services/characterPromptService";
import { buildLongTurnSimulation, LONG_TURN_HISTORY_CHARS } from "./characterReceivedSimulation";
import { buildPromptSectionsDigest, describePromptSections } from "./promptSectionsDigest";

const max = (fixture.characters as unknown as Record<string, CharacterPrompt>).max;
const turn = fixture.turns[0];

function longTrace() {
  return buildOptimizedPromptAssembly({
    character: max,
    characterName: max.name!,
    identityInvariant: buildCharacterRulesInvariant(previewCharacterIdentity({
      displayName: max.name!, characterKey: "max", characterId: max.character_id, environmentId: "sandbox-romed", promptUpdatedAt: max.updated_at ?? null,
    })),
    ...buildLongTurnSimulation({
      sheet: max, characterKey: "max", question: turn.question,
      ragCandidates: turn.candidates.map((candidate, index) => ({ id: candidate.id, content: candidate.content, rank: index + 1 })),
    }),
  });
}

describe("trace légère des sections envoyées (lot souvenirs 1)", () => {
  it("garde clés, tailles, souvenirs envoyés et alertes, sans aucun texte de prompt", () => {
    const trace = longTrace();
    const digest = buildPromptSectionsDigest(trace)!;
    expect(digest.variant).toBe("optimized_v3");
    expect(digest.souvenirs).toEqual(trace.budget?.sentRagIds);
    expect(digest.souvenirs?.length).toBeGreaterThanOrEqual(2);
    expect(digest.sections.map((section) => section.key)).toEqual(expect.arrayContaining(["technical_rules", "character_core", "conversation_memory", "character_canon", "rag_context"]));
    // Empty sections are left out; no prompt text travels in the log.
    expect(digest.sections.every((section) => section.included || section.reason !== "section_vide")).toBe(true);
    const serialized = JSON.stringify(digest);
    expect(serialized).not.toContain(max.situation_summary.slice(0, 40));
    expect(serialized.length).toBeLessThan(1_500);
  });

  it("la simulation reproduit un tour long : historique, mémoire, transfert, question saisie", () => {
    const trace = longTrace();
    expect(trace.budget?.historyChars).toBe(LONG_TURN_HISTORY_CHARS);
    expect(trace.injectedSections.find((section) => section.key === "experience_frame")?.content).toMatch(/Emma/);
    expect(trace.injectedSections.some((section) => section.key === "conversation_memory")).toBe(true);
    // The live rules (identity, gravity, transfer) are counted, not the bare identity line.
    expect(trace.budget?.sections.find((section) => section.key === "technical_rules")?.chars).toBeGreaterThan(4_500);
  });

  it("décrit en clair ce qui est reçu, retiré et signalé", () => {
    const text = describePromptSections({
      variant: "optimized_v3", systemChars: 12_900, limitChars: 12_910,
      sections: [
        { key: "character_core", chars: 7_300, included: true },
        { key: "rag_context", chars: 0, included: false, reason: "budget_contexte_epuise" },
        { key: "conversation_memory", chars: 0, included: false, reason: "budget_contexte_epuise" },
      ],
      souvenirs: [],
      warnings: ["souvenirs_evinces", "memoire_evincee"],
    })!;
    expect(text.sent).toContain("noyau 7300");
    expect(text.sent).toContain("0 souvenir envoyé");
    expect(text.dropped).toBe("Retiré : souvenirs (manque de place), mémoire (manque de place)");
    expect(text.warnings).toBe("⚠ souvenirs retirés, mémoire retirée");
    expect(describePromptSections(undefined)).toBeNull();
  });
});
