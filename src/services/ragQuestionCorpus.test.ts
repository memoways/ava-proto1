import { describe, expect, it } from "vitest";
import {
  clusterConversationQuestions,
  isQuestionLike,
  questionSimilarity,
  type ConversationQuestionOccurrence,
} from "./ragQuestionCorpus";

function occurrence(
  sourceKey: string,
  question: string,
  options: Partial<ConversationQuestionOccurrence> = {},
): ConversationQuestionOccurrence {
  return {
    sourceKey,
    sessionId: sourceKey.split(":")[0],
    messageIndex: Number(sourceKey.split(":")[1]),
    question,
    characterName: "Max",
    occurredAt: "2026-07-21T10:00:00Z",
    pinned: false,
    ...options,
  };
}

describe("corpus de questions du laboratoire RAG", () => {
  it("reconnaît les questions vocales même sans point d’interrogation", () => {
    expect(isQuestionLike("Tu sais où habite Ava")).toBe(true);
    expect(isQuestionLike("Pourquoi elle est partie")).toBe(true);
    expect(isQuestionLike("Je voulais simplement vous remercier")).toBe(false);
  });

  it("rapproche des formulations sémantiquement équivalentes courantes", () => {
    expect(questionSimilarity("Où habites-tu ?", "Tu vis où ?")).toBeGreaterThan(0.9);
    expect(questionSimilarity("Où habites-tu ?", "Pourquoi Ava a disparu ?")).toBeLessThan(0.4);
  });

  it("compacte les variantes, choisit une formulation centrale et priorise les questions épinglées", () => {
    const result = clusterConversationQuestions([
      occurrence("s1:0", "Où habites-tu ?"),
      occurrence("s2:0", "Tu vis où ?"),
      occurrence("s3:0", "Où habitez-vous ?"),
      occurrence("s4:0", "Pourquoi Ava a disparu ?"),
      occurrence("s5:0", "Quel est ton métier ?", { pinned: true }),
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ pinned: true, occurrences: 1 });
    const homeCluster = result.find((question) => question.variants.includes("Où habites-tu ?"));
    expect(homeCluster?.occurrences).toBe(3);
    expect(homeCluster?.variants).toEqual(expect.arrayContaining(["Où habites-tu ?", "Tu vis où ?", "Où habitez-vous ?"]));
  });
});
