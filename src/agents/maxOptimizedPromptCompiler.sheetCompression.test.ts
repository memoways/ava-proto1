import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/souvenirsSandboxRomed20261123.json";
import {
  buildOptimizedPromptAssembly,
  OPTIMIZED_V3_LIMITS,
  type OptimizedPromptInput,
} from "./maxOptimizedPromptCompiler";
import { buildCharacterRulesInvariant, previewCharacterIdentity } from "./characterRulesInvariant";
import { measureSheetCoverage, SHEET_COMPRESSION_WHOLE_FIELDS, type SheetCompressionLevel } from "./sheetCompression";
import { mergeConversationMemory } from "@/services/conversationMemoryV1";
import { buildExperienceFrame } from "@/services/experienceFrame";
import type { CharacterPrompt } from "@/services/characterPromptService";

/**
 * Compression de la fiche lot 1 — the three levels on the real Max and Emma
 * sheets (read-only copy of sandbox-romed) and real souvenirs.
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

type Trace = ReturnType<typeof buildOptimizedPromptAssembly>;
const at = (turn: FixtureTurn, level?: SheetCompressionLevel, overrides: Partial<OptimizedPromptInput> = {}) =>
  buildOptimizedPromptAssembly({ ...longTurn(turn), ...(level ? { sheetCompression: level } : {}), ...overrides });
const core = (trace: Trace) => trace.injectedSections.find((item) => item.key === "character_core")?.content ?? "";
const chars = (trace: Trace, key: string) => trace.budget?.sections.find((item) => item.key === key)?.chars ?? 0;
/** Head of the prompt: rules and core, the part a provider cache can reuse. */
const head = (trace: Trace) => trace.finalSystemPrompt.slice(0, trace.finalSystemPrompt.indexOf("\n\n# CADRE DE L'APPEL"));

describe("optimized_v3 — compression de la fiche (lot 1)", () => {
  it("« Actuel » (défaut) : prompt identique à l'assemblage sans réglage", () => {
    for (const turn of turns) {
      const plain = at(turn);
      const current = at(turn, "current");
      expect(current.finalSystemPrompt).toBe(plain.finalSystemPrompt);
      expect(current.budget?.contextLimitChars).toBe(OPTIMIZED_V3_LIMITS.generatedContextChars);
      expect(current.budget?.sheetCompression).toEqual({ level: "current", wholeFields: [], roomChars: 0 });
    }
  });

  it.each(turns.map((turn) => [`${turn.character} · ${turn.expected}`, turn] as const))("« Consignes entières » %s : consignes en entier dans le noyau, avec leur propre place", (_label, turn) => {
    const current = at(turn, "current");
    const trace = at(turn, "guidelines");
    const sheet = sheets[turn.character];
    const sent = measureSheetCoverage(sheet, trace.finalSystemPrompt);
    for (const key of SHEET_COMPRESSION_WHOLE_FIELDS.guidelines) {
      const row = sent.fields.find((field) => field.key === key)!;
      expect(row.sentChars, `${key} en entier`).toBe(row.chars);
    }
    // The reference material stays sorted: the timeline is not sent whole.
    const timeline = sent.fields.find((field) => field.key === "timeline")!;
    expect(timeline.sentChars).toBeLessThan(timeline.chars);
    expect(trace.budget?.sheetCompression?.wholeFields).toEqual([...SHEET_COMPRESSION_WHOLE_FIELDS.guidelines]);
    const room = trace.budget!.sheetCompression!.roomChars;
    expect(room).toBeGreaterThan(10_000);
    expect(trace.budget?.contextLimitChars).toBe(OPTIMIZED_V3_LIMITS.generatedContextChars + room);
    // Frame, directive, speech, state and turn keep their place.
    for (const key of ["experience_frame", "relationship_directive", "speech_state", "character_state", "runtime_context"]) {
      expect(chars(trace, key), key).toBe(chars(current, key));
    }
    expect(trace.budget?.sections.find((item) => item.key === "conversation_memory")?.included).toBe(true);
    expect(trace.budget?.sections.find((item) => item.key === "rag_context")?.included).toBe(true);
    expect(trace.budget?.withinBudget).toBe(true);
    expect(core(trace)).toContain(`## INVARIANTS DE ${(sheet.name ?? "").toLocaleUpperCase("fr")}`);
  });

  it("« Fiche entière » : toute la fiche, rien de trié, aucun canon pertinent", () => {
    for (const turn of turns) {
      const trace = at(turn, "full");
      const sent = measureSheetCoverage(sheets[turn.character], trace.finalSystemPrompt);
      expect(sent.sentChars).toBe(sent.chars);
      expect(trace.finalSystemPrompt).not.toContain("# CANON PERTINENT");
      expect(core(trace)).toContain("## TIMELINE CANONIQUE\n");
      expect(core(trace)).toContain("## SUJETS SENSIBLES\n");
      expect(trace.budget?.sections.find((item) => item.key === "conversation_memory")?.included).toBe(true);
      expect(trace.budget?.withinBudget).toBe(true);
      expect(trace.budget?.warnings ?? []).toEqual([]);
    }
  });

  it("au-dessus d'« Actuel », la tête du prompt (règles et noyau) ne dépend plus de la question", () => {
    const [first, second] = turns.filter((turn) => turn.character === turns[0].character);
    for (const level of ["guidelines", "full"] as const) {
      expect(head(at(first, level))).toBe(head(at(first, level, { userMessage: "Il fait quel temps chez vous ?" })));
      if (second) expect(head(at(first, level))).toBe(head(at(second, level)));
    }
  });

  it("la part de la fiche envoyée grandit d'un niveau à l'autre", () => {
    const turn = turns[0];
    const share = (level: SheetCompressionLevel) => measureSheetCoverage(sheets[turn.character], at(turn, level).finalSystemPrompt).share;
    expect(share("current")).toBeLessThan(0.3);
    expect(share("guidelines")).toBeGreaterThan(0.45);
    expect(share("full")).toBe(1);
  });
});
