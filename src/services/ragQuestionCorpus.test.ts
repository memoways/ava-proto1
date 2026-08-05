import { describe, expect, it } from "vitest";
import { isQuestionLike, parseRAGQuestionCorpus } from "./ragQuestionCorpus";
import {
  groupExactQuestions,
  questionQuality,
  structuredJsonOptions,
  type CorpusOccurrence,
} from "../../supabase/functions/rag-question-corpus/core";

describe("corpus sémantique de questions du laboratoire RAG", () => {
  it("reconnaît les questions vocales même sans point d’interrogation", () => {
    expect(isQuestionLike("Tu sais où habite Ava")).toBe(true);
    expect(isQuestionLike("Pourquoi elle est partie")).toBe(true);
    expect(isQuestionLike("Je voulais simplement vous remercier")).toBe(false);
  });

  it("valide et normalise la réponse légère du cache serveur", () => {
    const result = parseRAGQuestionCorpus({
      questions: [{
        id: "q-ava",
        question: "Pourquoi Ava a-t-elle disparu ?",
        occurrences: 17,
        variants: ["Pourquoi Ava a disparu ?"],
        characterNames: ["Max"],
        latestAt: null,
        pinned: false,
        sourceKeys: [],
      }],
      sourceQuestionCount: 96,
      excludedQuestionCount: 42,
      userTurnCount: 138,
      uniqueQuestionCount: 61,
      sessionCount: 25,
      sourceRevision: 9,
      builtRevision: 9,
      updatedAt: "2026-07-21T10:00:00Z",
      generationModel: "google/gemini-2.5-flash",
      processing: false,
      stale: false,
      error: null,
    });

    expect(result.questions[0]).toMatchObject({ occurrences: 17, question: "Pourquoi Ava a-t-elle disparu ?" });
    expect(result).toMatchObject({ sourceQuestionCount: 96, excludedQuestionCount: 42, processing: false });
  });

  it("écarte le small talk, les fragments et les questions sans contexte", () => {
    expect(questionQuality("Comment ça va ?")).toMatchObject({ keep: false, reason: "small_talk" });
    expect(questionQuality("Et pourquoi ?")).toMatchObject({ keep: false, reason: "question_sans_contexte" });
    expect(questionQuality("Est-ce que Ava aurait découvert quelque chose avant sa disparition ?").keep).toBe(true);
  });

  it("compte toutes les répétitions exactes avant la synthèse sémantique", () => {
    const base: Omit<CorpusOccurrence, "sourceKey" | "question"> = {
      characterName: "Max",
      occurredAt: null,
      pinned: false,
    };
    const groups = groupExactQuestions([
      { ...base, sourceKey: "s1:0", question: "Pourquoi Ava a disparu ?" },
      { ...base, sourceKey: "s2:0", question: "Pourquoi Ava a disparu?" },
      { ...base, sourceKey: "s3:0", question: "Où habite Max ?" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].occurrences).toHaveLength(2);
  });

  it("impose un schéma JSON strict et active la réparation OpenRouter", () => {
    const options = structuredJsonOptions("rag_question_test", {
      type: "object",
      properties: { items: { type: "array" } },
      required: ["items"],
    });

    expect(options).toMatchObject({
      response_format: {
        type: "json_schema",
        json_schema: { name: "rag_question_test", strict: true },
      },
      plugins: [{ id: "response-healing" }],
      provider: { require_parameters: true },
    });
  });
});
