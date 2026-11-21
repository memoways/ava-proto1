/**
 * Current video vocabulary (themes, emotions, stakes, who is on screen).
 * The snapshot is replaced on each Notion sync. The Game Master reads it;
 * until the table exists, the union of the video rows is the fallback.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  isMissingVocabularyStoreError,
  uniqueLabels,
  type VideoLabelLists,
} from "../../supabase/functions/_shared/videoVocabulary";

export type { VideoLabelLists };

export interface VocabularyLoad {
  lists: VideoLabelLists | null;
  /** A successful read that returned no row. Access rules can look the same. */
  zeroRows: boolean;
  /** Table not migrated yet. Not an error: the caller falls back to the video rows. */
  unavailable: boolean;
  error: string | null;
}

export function labelKey(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** A kept label that is not in the current list. No list → nothing is marked. */
export function isOutsideList(value: string, list: readonly string[] | null | undefined): boolean {
  if (!list) return false;
  const key = labelKey(value);
  if (!key) return false;
  return !list.some((item) => labelKey(item) === key);
}

export function vocabularyFromRows(
  rows: readonly {
    themes?: readonly string[] | null;
    emotions?: readonly string[] | null;
    stakes?: readonly string[] | null;
    on_screen?: readonly string[] | null;
  }[],
): VideoLabelLists | null {
  const themes = uniqueLabels(rows.flatMap((row) => row.themes ?? []));
  const emotionsKnown = rows.some((row) => Array.isArray(row.emotions));
  const stakesKnown = rows.some((row) => Array.isArray(row.stakes));
  const onScreenKnown = rows.some((row) => Array.isArray(row.on_screen));
  const emotions = emotionsKnown ? uniqueLabels(rows.flatMap((row) => row.emotions ?? [])) : [];
  const stakes = stakesKnown ? uniqueLabels(rows.flatMap((row) => row.stakes ?? [])) : [];
  const on_screen = onScreenKnown ? uniqueLabels(rows.flatMap((row) => row.on_screen ?? [])) : [];
  if (!themes.length && !emotions.length && !stakes.length && !on_screen.length) return null;
  return { themes, emotions, stakes, on_screen };
}

/**
 * Block appended to the post-turn prompt. Empty when no list is published:
 * themes, topics and intentions then stay exactly as the editorial prompt asks.
 */
export function buildVideoVocabularyBlock(lists: VideoLabelLists | null | undefined): string {
  if (!lists) return "";
  const lines: string[] = [];
  if (lists.themes.length) lines.push(`themes : ${lists.themes.join(", ")}`);
  if (lists.emotions.length) lines.push(`emotions : ${lists.emotions.join(", ")}`);
  if (lists.stakes.length) lines.push(`stakes : ${lists.stakes.join(", ")}`);
  if (!lines.length) return "";
  return [
    "",
    "LISTE COURANTE DES VIDÉOS (Notion, remplacée à chaque synchronisation) :",
    ...lines,
    "Recopie labels.themes, labels.emotions et labels.stakes depuis les listes écrites ci-dessus. Une valeur hors liste est gardée telle quelle, sans la remplacer par un terme proche. Si aucune ne convient, laisse la liste vide.",
    "topics et intentions restent libres. Le plafond de 4 labels reste la somme themes + topics + intentions : emotions et stakes ne prennent pas leur place.",
  ].join("\n");
}

export function interpretVocabularyRead(result: {
  data: Partial<VideoLabelLists> | null;
  error: { code?: string; message?: string } | null;
}): VocabularyLoad {
  if (result.error) {
    if (isMissingVocabularyStoreError(result.error)) {
      return { lists: null, zeroRows: false, unavailable: true, error: null };
    }
    return { lists: null, zeroRows: false, unavailable: false, error: result.error.message ?? "lecture impossible" };
  }
  if (!result.data) return { lists: null, zeroRows: true, unavailable: false, error: null };
  return {
    lists: {
      themes: result.data.themes ?? [],
      emotions: result.data.emotions ?? [],
      stakes: result.data.stakes ?? [],
      on_screen: result.data.on_screen ?? [],
    },
    zeroRows: false,
    unavailable: false,
    error: null,
  };
}

const EMPTY_LOAD: VocabularyLoad = { lists: null, zeroRows: false, unavailable: true, error: null };

/** Live read. Unit tests skip the network and let the caller use the video rows. */
export async function loadVideoLabelVocabulary(): Promise<VocabularyLoad> {
  if (import.meta.env.MODE === "test" || import.meta.env.VITEST) return EMPTY_LOAD;
  try {
    const { data, error } = await supabase
      .from("video_label_vocabulary")
      .select("themes, emotions, stakes, on_screen")
      .eq("id", "current")
      .maybeSingle();
    return interpretVocabularyRead({ data, error });
  } catch (error) {
    return {
      lists: null,
      zeroRows: false,
      unavailable: false,
      error: error instanceof Error ? error.message : "lecture impossible",
    };
  }
}
