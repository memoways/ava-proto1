import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/souvenirsSandboxRomed20261123.json";
import {
  buildOptimizedPromptAssembly,
  OPTIMIZED_V3_LIMITS,
  OPTIMIZED_V3_SECTION_RESERVATIONS,
  type OptimizedPromptInput,
} from "./maxOptimizedPromptCompiler";
import { buildCharacterRulesInvariant, previewCharacterIdentity } from "./characterRulesInvariant";
import { mergeConversationMemory } from "@/services/conversationMemoryV1";
import { buildExperienceFrame } from "@/services/experienceFrame";
import type { CharacterPrompt } from "@/services/characterPromptService";

/**
 * Souvenirs lot 1 — non-regression on the real Max and Emma sheets (read-only
 * copy of sandbox-romed, 23 November) and the souvenirs `query-rag` really
 * returned for Romed's questions. A long turn must still carry the whole core,
 * the conversation memory, the relevant canon and at least two whole souvenirs.
 */
type FixtureTurn = { character: "max" | "emma"; question: string; expected: string; candidates: Array<{ id: string; content: string }> };
const sheets = fixture.characters as unknown as Record<"max" | "emma", CharacterPrompt>;
const turns = fixture.turns as FixtureTurn[];

/** A turn deep in a long call: transfer, full memory, directive, radar, speech line. */
function longTurn(turn: FixtureTurn, sheet: CharacterPrompt = sheets[turn.character]): OptimizedPromptInput {
  const name = sheet.name ?? turn.character;
  const other = turn.character === "max" ? "emma" : "max";
  const memory = mergeConversationMemory(null, {
    interlocutor: { name: "Romed", role: "bénévole de la cellule d'écoute" },
    topics: ["Mona", "le camp", "le fusil", "le père de Max", "la contamination", "la culpabilité", "la police"],
    commitments: ["Romed rappellera après avoir parlé à l'autre parent."],
    openThreads: ["Pourquoi le fusil était-il au chalet ?", "Comment Mona a-t-elle été contaminée ?"],
    lastExchange: "Romed a demandé pourquoi le père a envoyé Mona au camp, puis a insisté sur le fusil trouvé au chalet ; le personnage a répondu en retenant sa colère et en revenant sur la nuit du retour.",
  }, 40, turn.character);
  return {
    character: sheet,
    characterName: name,
    identityInvariant: buildCharacterRulesInvariant(previewCharacterIdentity({
      displayName: name, characterKey: turn.character, characterId: sheet.character_id,
      environmentId: "sandbox-romed", promptUpdatedAt: sheet.updated_at ?? null,
    })),
    userMessage: turn.question,
    historyChars: 1_200,
    conversationMemory: memory,
    userRole: "Bénévole d'une cellule d'écoute, appelle pour comprendre ce qui s'est passé.",
    temporalContext: "Milieu de l'appel : il reste du temps, rien ne presse la fin.",
    experienceFrame: buildExperienceFrame({ config: null, filmAnswer: "vu", callTransfer: { from: other, returning: true } }).prompt,
    relationshipDirective: "Palier : confiance prudente. ".repeat(30).trim(),
    speechState: "Parole du tour : phrases courtes, hésitations retenues, aucune fuite dans l'anecdote.",
    characterState: Array.from({ length: 6 }, (_, axis) => `- Axe ${axis + 1} : tension tenue, qui affleure quand on touche au père, à Mona ou au fusil, sans jamais devenir une explosion.`).join("\n").padEnd(880, " ."),
    ragCandidates: turn.candidates.map((candidate, index) => ({ id: candidate.id, content: candidate.content, rank: index + 1 })),
  };
}

const sentSouvenirs = (trace: ReturnType<typeof buildOptimizedPromptAssembly>) => trace.budget?.sentRagIds ?? [];
const section = (trace: ReturnType<typeof buildOptimizedPromptAssembly>, key: string) => trace.budget?.sections.find((item) => item.key === key);

describe("optimized_v3 — place réservée aux souvenirs (fiches réelles, lot souvenirs 1)", () => {
  it.each(turns.map((turn) => [`${turn.character} · ${turn.expected}`, turn] as const))("tour long %s : noyau, mémoire, canon et ≥ 2 souvenirs envoyés", (_label, turn) => {
    const trace = buildOptimizedPromptAssembly(longTurn(turn));
    for (const key of ["character_core", "conversation_memory", "character_canon", "character_state", "rag_context"]) {
      expect(section(trace, key)?.included, `${key} doit être envoyé`).toBe(true);
    }
    expect(section(trace, "character_core")?.truncated).toBe(false);
    expect(sentSouvenirs(trace).length).toBeGreaterThanOrEqual(2);
    // The souvenir Romed asked about is the first one sent.
    expect(sentSouvenirs(trace)[0]).toBe(turn.candidates[0].id);
    expect(trace.finalSystemPrompt).toContain(turn.expected);
    expect(trace.budget?.warnings?.map((warning) => warning.code) ?? []).toEqual([]);
    expect(trace.finalSystemPrompt.length + 1_200).toBeLessThanOrEqual(OPTIMIZED_V3_LIMITS.generatedContextChars);
  });

  it("le noyau et les faits établis restent entiers avec la place réservée", () => {
    for (const turn of turns) {
      const trace = buildOptimizedPromptAssembly(longTurn(turn));
      const core = trace.injectedSections.find((item) => item.key === "character_core")?.content ?? "";
      expect(core).toContain(sheets[turn.character].situation_summary.trim());
      expect(core).toMatch(/FAITS ÉTABLIS/);
    }
  });

  it("sans place réservée (retour arrière), le même tour perd souvenirs et mémoire, et le dit", () => {
    const saved = { enabled: OPTIMIZED_V3_SECTION_RESERVATIONS.enabled, limit: OPTIMIZED_V3_LIMITS.generatedContextChars };
    OPTIMIZED_V3_SECTION_RESERVATIONS.enabled = false;
    OPTIMIZED_V3_LIMITS.generatedContextChars = OPTIMIZED_V3_SECTION_RESERVATIONS.baseContextChars;
    try {
      const trace = buildOptimizedPromptAssembly(longTurn(turns[0]));
      expect(sentSouvenirs(trace)).toEqual([]);
      expect(trace.budget?.reservedSections).toEqual({});
      const codes = trace.budget?.warnings?.map((warning) => warning.code) ?? [];
      expect(codes).toEqual(expect.arrayContaining(["souvenirs_evinces", "memoire_evincee"]));
    } finally {
      OPTIMIZED_V3_SECTION_RESERVATIONS.enabled = saved.enabled;
      OPTIMIZED_V3_LIMITS.generatedContextChars = saved.limit;
    }
  });

  it("une fiche plus longue fait céder les sections non réservées, jamais mémoire, canon ni souvenirs — sinon l'alerte tombe", () => {
    const turn = turns[1];
    // ≈ 1 200 more characters of protected lived paragraph: the core grows, the reserved room stays.
    const longer = { ...sheets[turn.character], situation_summary: `${sheets[turn.character].situation_summary.trim()} ${"Le silence de la maison pèse encore sur chaque pièce. ".repeat(9)}`.trim() };
    const trace = buildOptimizedPromptAssembly(longTurn(turn, longer));
    expect(section(trace, "conversation_memory")?.included).toBe(true);
    expect(section(trace, "character_canon")?.included).toBe(true);
    expect(sentSouvenirs(trace).length).toBeGreaterThanOrEqual(2);
    // Same sheet, once the history eats the slack: a reserved section that drops is announced.
    const squeezed = buildOptimizedPromptAssembly({ ...longTurn(turn, longer), historyChars: 8_500 });
    const dropped = ["conversation_memory", "character_canon", "rag_context"].filter((key) => !section(squeezed, key)?.included);
    const codes = squeezed.budget?.warnings?.map((warning) => warning.code) ?? [];
    if (dropped.includes("rag_context") || sentSouvenirs(squeezed).length < 3) expect(codes).toContain("souvenirs_evinces");
    if (dropped.includes("conversation_memory")) expect(codes).toContain("memoire_evincee");
    if (dropped.includes("character_canon")) expect(codes).toContain("canon_evince");
    expect(dropped.length + codes.length).toBeGreaterThan(0);
  });

  it("les sections vidéo gardent la priorité sur les souvenirs (lot 5) sans toucher à la mémoire", () => {
    const turn = turns[2];
    const trace = buildOptimizedPromptAssembly({
      ...longTurn(turn),
      postVideoContext: "Le joueur vient de voir la vidéo du chalet. ".repeat(20),
    });
    expect(section(trace, "post_video")?.included).toBe(true);
    expect(section(trace, "conversation_memory")?.included).toBe(true);
  });
});
