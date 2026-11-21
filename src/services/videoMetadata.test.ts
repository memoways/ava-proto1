import { describe, expect, it } from "vitest";
import {
  ALL_CHARACTERS,
  extractTranscriptStatus,
  isExtractTranscriptReliable,
  isMissingExtractColumnError,
  mapVideoDialogue,
  mapVideoTranscription,
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

describe("extract Dialogue and Transcription mapping", () => {
  it("maps the Notion Dialogue select, tolerating case and accents", () => {
    expect(mapVideoDialogue("Parlé")).toBe("spoken");
    expect(mapVideoDialogue(" parle ")).toBe("spoken");
    expect(mapVideoDialogue("Silencieux")).toBe("silent");
  });

  it("leaves an empty or unknown Dialogue unset instead of guessing silent", () => {
    expect(mapVideoDialogue(null)).toBeNull();
    expect(mapVideoDialogue("")).toBeNull();
    expect(mapVideoDialogue("Musique")).toBeNull();
  });

  it("writes an absent or cleared transcription as null and keeps the text otherwise", () => {
    expect(mapVideoTranscription(undefined)).toBeNull();
    expect(mapVideoTranscription("   \n ")).toBeNull();
    expect(mapVideoTranscription("  MAX : Il faut partir.  ")).toBe("MAX : Il faut partir.");
  });

  it("recognises a missing transcription migration only for its own columns", () => {
    expect(isMissingExtractColumnError({ code: "PGRST204", message: "Could not find the 'transcription' column" })).toBe(true);
    expect(isMissingExtractColumnError({ code: "42703", message: 'column "dialogue" does not exist' })).toBe(true);
    expect(isMissingExtractColumnError({ code: "PGRST204", message: "Could not find the 'nature' column" })).toBe(false);
    expect(isMissingExtractColumnError(null)).toBe(false);
  });
});

describe("extract transcript reliability", () => {
  it("is reliable for a silent extract", () => {
    expect(extractTranscriptStatus({ dialogue: "silent" })).toBe("silent");
    expect(isExtractTranscriptReliable({ dialogue: "silent" })).toBe(true);
  });

  it("is reliable for a spoken extract only with a verified transcription", () => {
    const base = { dialogue: "spoken" as const, transcription: "MAX : Il faut partir." };
    expect(extractTranscriptStatus({ ...base, transcription_verified: true })).toBe("spoken_verified");
    expect(extractTranscriptStatus({ ...base, transcription_verified: false })).toBe("spoken_unverified");
    expect(extractTranscriptStatus({ dialogue: "spoken", transcription: " ", transcription_verified: true })).toBe("spoken_missing");
    expect(isExtractTranscriptReliable({ ...base, transcription_verified: false })).toBe(false);
    expect(isExtractTranscriptReliable({ dialogue: "spoken", transcription_verified: true })).toBe(false);
  });

  it("never treats an unfilled Dialogue as silent", () => {
    expect(extractTranscriptStatus({})).toBe("unknown");
    expect(extractTranscriptStatus({ dialogue: null, transcription_verified: true })).toBe("unknown");
    expect(isExtractTranscriptReliable({})).toBe(false);
  });
});
