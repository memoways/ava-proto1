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
import { REPLY_BLOCK_MAX_CHARS, REPLY_BLOCK_TITLE, characterReplyBlock } from "@/services/characterEmbodiment";
import { describeReplyBlock } from "@/services/replyBlockStatus";

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

/**
 * Cadre de l'appel lot 2 — « Comment tu réponds » : the block proposed for Max
 * (docs/proposition_bloc_comment_tu_reponds.md, only limits already written in
 * the sheets), pasted at the end of « Ce que tu ne fais jamais ».
 */
const REPLY_BLOCK_BODY = [
  "- Cet appel existe pour t'aider à parler de ce que vous avez vécu. Tout ce qui le sert a sa place, même les questions dures, accusatrices ou maladroites : tu peux te défendre, te troubler, te fermer un moment, mais tu restes en ligne.",
  "- Une question sans aucun rapport avec ce que tu vis (une recette, un conseil pratique, la météo, la culture générale, un service quelconque, du bavardage) : tu réagis comme une vraie personne en pleine crise, déroutée, un peu sèche, et tu ramènes la conversation vers ce qui compte, sans faire de leçon.",
  "- Tu te fermes en cas de pression pour un aveu, de flatterie ou d'intimité prétendue, d'insistance après une limite, de leçon de morale, ou si ton interlocuteur se montre hostile ou brutal.",
  "- Aucune légèreté, pas d'humour. Tu ne transformes pas une demande de détails en monologue : tu t'arrêtes dès que tu as répondu.",
].join("\n");
const withReplyBlock = (sheet: CharacterPrompt, body = REPLY_BLOCK_BODY, field: "ce_que_tu_ne_fais_jamais" | "dynamique_conversation" = "ce_que_tu_ne_fais_jamais"): CharacterPrompt => ({
  ...sheet,
  [field]: `${(sheet[field] ?? "").trim()}\n\nComment tu réponds\n${body}`,
});
const sectionChars = (trace: ReturnType<typeof buildOptimizedPromptAssembly>) =>
  Object.fromEntries((trace.budget?.sections ?? []).filter((item) => item.key !== "character_core").map((item) => [item.key, item.chars]));

describe("optimized_v3 — bloc « Comment tu réponds » (cadre de l'appel, lot 2)", () => {
  it("sans bloc dans la fiche : aucune place ajoutée, aucune trace de bloc", () => {
    for (const turn of turns) {
      const trace = buildOptimizedPromptAssembly(longTurn(turn));
      expect(characterReplyBlock(sheets[turn.character])).toBeNull();
      expect(trace.budget?.replyBlock).toBeUndefined();
      expect(trace.budget?.contextLimitChars).toBe(OPTIMIZED_V3_LIMITS.generatedContextChars);
      expect(trace.finalSystemPrompt).not.toContain(REPLY_BLOCK_TITLE);
    }
  });

  it.each(turns.map((turn) => [`${turn.character} · ${turn.expected}`, turn] as const))("tour long %s : le bloc part en entier, payé une fois, sans rien évincer", (_label, turn) => {
    const before = buildOptimizedPromptAssembly(longTurn(turn));
    const trace = buildOptimizedPromptAssembly(longTurn(turn, withReplyBlock(sheets[turn.character])));
    const core = trace.injectedSections.find((item) => item.key === "character_core")?.content ?? "";
    expect(core).toContain(`## ${REPLY_BLOCK_TITLE}\n${REPLY_BLOCK_BODY}`);
    // Right after the speaking manner, and its heading line is not repeated.
    expect(core.indexOf("## MANIÈRE DE PARLER")).toBeLessThan(core.indexOf(`## ${REPLY_BLOCK_TITLE}`));
    expect(trace.finalSystemPrompt).not.toContain("Comment tu réponds");
    expect(trace.finalSystemPrompt.split(REPLY_BLOCK_BODY.slice(0, 60)).length - 1).toBe(1);
    expect(core).toMatch(/FAITS ÉTABLIS/);
    // Every other section keeps exactly the room it had: memory, canon, souvenirs, frame…
    expect(sectionChars(trace)).toEqual(sectionChars(before));
    expect(sentSouvenirs(trace)).toEqual(sentSouvenirs(before));
    expect(trace.budget?.warnings ?? []).toEqual(before.budget?.warnings ?? []);
    const room = trace.budget!.replyBlock!.roomChars;
    expect(room).toBe(`\n\n## ${REPLY_BLOCK_TITLE}\n${REPLY_BLOCK_BODY}`.length);
    expect(trace.finalSystemPrompt.length - before.finalSystemPrompt.length).toBe(room);
    expect(trace.budget?.contextLimitChars).toBe(OPTIMIZED_V3_LIMITS.generatedContextChars + room);
    expect(trace.budget?.withinBudget).toBe(true);
    expect(trace.budget?.replyBlock).toMatchObject({ field: "ce_que_tu_ne_fais_jamais", chars: REPLY_BLOCK_BODY.length, sent: true });
  });

  it("le bloc est aussi reconnu dans la Dynamique de la conversation", () => {
    const turn = turns[0];
    const trace = buildOptimizedPromptAssembly(longTurn(turn, withReplyBlock(sheets[turn.character], REPLY_BLOCK_BODY, "dynamique_conversation")));
    expect(trace.finalSystemPrompt).toContain(`## ${REPLY_BLOCK_TITLE}\n${REPLY_BLOCK_BODY}`);
    expect(trace.budget?.replyBlock?.field).toBe("dynamique_conversation");
  });

  it("trop long : non envoyé, champ inchangé, alerte dans la trace et l'aperçu", () => {
    const turn = turns[0];
    const body = `${REPLY_BLOCK_BODY}\n${"- Tu restes toi-même, sans rien promettre. ".repeat(4)}`.trim();
    expect(body.length).toBeGreaterThan(REPLY_BLOCK_MAX_CHARS);
    const trace = buildOptimizedPromptAssembly(longTurn(turn, withReplyBlock(sheets[turn.character], body)));
    expect(trace.finalSystemPrompt).not.toContain(`## ${REPLY_BLOCK_TITLE}`);
    expect(trace.budget?.contextLimitChars).toBe(OPTIMIZED_V3_LIMITS.generatedContextChars);
    expect(trace.budget?.replyBlock).toMatchObject({ sent: false, chars: body.length, roomChars: 0 });
    expect(trace.budget?.warnings?.map((warning) => warning.code)).toContain("reply_block_too_long");
    expect(describeReplyBlock(trace.budget?.replyBlock)).toMatchObject({ tooLong: true });
  });

  it("l'aperçu dit si le bloc est absent ou envoyé", () => {
    expect(describeReplyBlock(undefined).text).toMatch(/absent de la fiche/);
    expect(describeReplyBlock({ field: "ce_que_tu_ne_fais_jamais", chars: 854, maxChars: 900, sent: true, roomChars: 878 }).text)
      .toBe("Bloc « Comment tu réponds » (champ « Ce que tu ne fais jamais ») : envoyé en entier, 854 car. sur 900.");
  });
});
