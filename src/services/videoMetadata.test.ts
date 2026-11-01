import { describe, expect, it } from "vitest";
import {
  ALL_CHARACTERS,
  isMissingVideoMetadataColumnError,
  mapVideoCharacters,
  mapVideoNature,
} from "../../supabase/functions/_shared/videoMetadata";

describe("video Nature mapping", () => {
  it("reconnaît les deux valeurs Notion", () => {
    expect(mapVideoNature("Extrait du film")).toBe("extract");
    expect(mapVideoNature("Vidéo transformée")).toBe("transformed");
  });

  it("tolère casse, accents et espaces", () => {
    expect(mapVideoNature("  extrait  DU film ")).toBe("extract");
    expect(mapVideoNature("video transformee")).toBe("transformed");
  });

  it("vide ou inconnu → vidéo transformée", () => {
    expect(mapVideoNature(null)).toBe("transformed");
    expect(mapVideoNature(undefined)).toBe("transformed");
    expect(mapVideoNature("")).toBe("transformed");
    expect(mapVideoNature("Bande-annonce")).toBe("transformed");
  });
});

describe("video Personnages mapping", () => {
  it("convertit les noms en identifiants", () => {
    expect(mapVideoCharacters(["Max", "Emma"])).toEqual(["max", "emma"]);
    expect(mapVideoCharacters(["Léo", "Ava"])).toEqual(["leo", "ava"]);
  });

  it("vide → tout le monde", () => {
    expect(mapVideoCharacters([])).toEqual([ALL_CHARACTERS]);
    expect(mapVideoCharacters(null)).toEqual([ALL_CHARACTERS]);
    expect(mapVideoCharacters(["  "])).toEqual([ALL_CHARACTERS]);
  });

  it("« Tous » l'emporte sur les autres valeurs", () => {
    expect(mapVideoCharacters(["Max", "Tous"])).toEqual([ALL_CHARACTERS]);
    expect(mapVideoCharacters(["TOUS"])).toEqual([ALL_CHARACTERS]);
  });

  it("garde les valeurs inconnues normalisées, sans doublon", () => {
    expect(mapVideoCharacters(["Émilie Rose", "max", "Max"])).toEqual(["emilie_rose", "max"]);
  });
});

describe("missing metadata column detection", () => {
  it("détecte une colonne absente (migration non appliquée)", () => {
    expect(isMissingVideoMetadataColumnError({ code: "PGRST204", message: "Could not find the 'nature' column of 'video_triggers' in the schema cache" })).toBe(true);
    expect(isMissingVideoMetadataColumnError({ code: "42703", message: 'column "ai_description" does not exist' })).toBe(true);
  });

  it("ignore les autres erreurs", () => {
    expect(isMissingVideoMetadataColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingVideoMetadataColumnError({ code: "PGRST204", message: "Could not find the 'title' column" })).toBe(false);
    expect(isMissingVideoMetadataColumnError(null)).toBe(false);
  });
});
