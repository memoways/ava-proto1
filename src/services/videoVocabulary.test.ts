import { describe, expect, it } from "vitest";
import {
  exportLabelList,
  exportVideoVocabulary,
  isMissingVideoLabelColumnError,
  isMissingVocabularyStoreError,
  multiSelectNames,
  EMOTION_PROPERTY_NAMES,
} from "../../supabase/functions/_shared/videoVocabulary";
import {
  buildVideoVocabularyBlock,
  interpretVocabularyRead,
  isOutsideList,
  vocabularyFromRows,
} from "./videoLabelVocabulary";

const emotion = (options: string[]) => ({
  Émotion: { type: "multi_select", multi_select: { options: options.map((name) => ({ name })) } },
});

describe("video vocabulary export", () => {
  it("uses Notion options, including a term no video carries yet", () => {
    const list = exportLabelList(emotion(["peur", "culpabilité"]), EMOTION_PROPERTY_NAMES, [["peur"]]);
    expect(list).toEqual(["peur", "culpabilité"]);
  });

  it("falls back to the union of page values when the property has no options", () => {
    const list = exportLabelList(
      { Émotion: { type: "multi_select", multi_select: { options: [] } } },
      EMOTION_PROPERTY_NAMES,
      [["peur"], ["colère", "peur"]],
    );
    expect(list).toEqual(["peur", "colère"]);
  });

  it("exports an empty list when the property is absent, and does not keep a previous term", () => {
    const cleared = exportVideoVocabulary(
      { Thèmes: { type: "multi_select", multi_select: { options: [{ name: "famille" }] } } },
      { themes: [["famille"]], emotions: [[]], stakes: [[]], on_screen: [[]] },
    );
    expect(cleared.emotions).toEqual([]);
    expect(cleared.themes).toEqual(["famille"]);
    const removed = exportLabelList(
      { Émotion: { type: "multi_select", multi_select: { options: [{ name: "peur" }] } } },
      EMOTION_PROPERTY_NAMES,
      [["peur", "angoisse"]],
    );
    expect(removed).toEqual(["peur"]);
    expect(removed).not.toContain("culpabilité");
  });

  it("writes an empty page selection as an empty array", () => {
    expect(multiSelectNames(undefined)).toEqual([]);
    expect(multiSelectNames({ multi_select: [] })).toEqual([]);
    expect(multiSelectNames({ multi_select: [{ name: "  " }, { name: "Max" }, { name: "Max" }] })).toEqual(["Max"]);
  });

  it("recognises a missing column or a missing vocabulary table, and ignores other errors", () => {
    expect(isMissingVideoLabelColumnError({ code: "PGRST204", message: "Could not find the 'emotions' column of 'video_triggers' in the schema cache" })).toBe(true);
    expect(isMissingVideoLabelColumnError({ code: "42703", message: 'column "on_screen" does not exist' })).toBe(true);
    expect(isMissingVideoLabelColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingVocabularyStoreError({ code: "PGRST205", message: "Could not find the table 'public.video_label_vocabulary' in the schema cache" })).toBe(true);
    expect(isMissingVocabularyStoreError({ code: "PGRST205", message: "Could not find the table 'public.video_triggers'" })).toBe(false);
  });
});

describe("vocabulary read and the Game Master block", () => {
  it("treats zero rows as unread, and a missing table as unavailable", () => {
    expect(interpretVocabularyRead({ data: null, error: null })).toMatchObject({ lists: null, zeroRows: true, unavailable: false });
    expect(interpretVocabularyRead({
      data: null,
      error: { code: "42P01", message: 'relation "video_label_vocabulary" does not exist' },
    })).toMatchObject({ lists: null, zeroRows: false, unavailable: true, error: null });
    expect(interpretVocabularyRead({
      data: { themes: ["famille"], emotions: [], stakes: ["protéger"], on_screen: [] },
      error: null,
    }).lists).toEqual({ themes: ["famille"], emotions: [], stakes: ["protéger"], on_screen: [] });
  });

  it("builds the block only when a list has terms, and marks values outside that list", () => {
    expect(buildVideoVocabularyBlock(null)).toBe("");
    expect(buildVideoVocabularyBlock({ themes: [], emotions: [], stakes: [], on_screen: [] })).toBe("");
    const block = buildVideoVocabularyBlock({ themes: ["famille"], emotions: ["peur"], stakes: [], on_screen: ["Max"] });
    expect(block).toContain("themes : famille");
    expect(block).toContain("emotions : peur");
    expect(block).not.toContain("stakes :");
    expect(block).toContain("hors liste");
    expect(isOutsideList("Angoisse", ["peur"])).toBe(true);
    expect(isOutsideList("Peur", ["peur"])).toBe(false);
    expect(isOutsideList("déni", ["deni"])).toBe(false);
    expect(isOutsideList("famille", null)).toBe(false);
  });

  it("unions row values and ignores a column that is not on the rows yet", () => {
    expect(vocabularyFromRows([
      { themes: ["famille", "Contamination"], emotions: ["peur"] },
      { themes: ["famille"], emotions: [] },
    ])).toEqual({ themes: ["famille", "Contamination"], emotions: ["peur"], stakes: [], on_screen: [] });
    expect(vocabularyFromRows([{ themes: [] }])).toBeNull();
  });
});
