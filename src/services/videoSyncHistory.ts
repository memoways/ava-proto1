import { loadEnvironmentSetting, saveEnvironmentSetting } from "@/services/environmentContext";

export const VIDEO_SYNC_HISTORY_KEY = "ava_video_sync_history";

export interface VideoSyncRunSummary {
  /** ISO timestamp of the sync run. */
  at: string;
  /** Videos with État = "En ligne" written to the app. */
  synced: number;
  /** Notion rows ignored because État ≠ "En ligne". */
  skipped: number;
  /** Titles present in the app after this run. */
  titles: string[];
  /** Titles added compared to the previous run. */
  added: string[];
  /** Titles removed compared to the previous run. */
  removed: string[];
  /** Videos without a Gumlet URL. */
  missingMedia: number;
  errors: string[];
  latencyMs: number;
}

interface VideoSyncHistory {
  runs: VideoSyncRunSummary[];
}

const defaults: VideoSyncHistory = { runs: [] };

export async function loadVideoSyncHistory(): Promise<VideoSyncRunSummary[]> {
  const stored = await loadEnvironmentSetting<VideoSyncHistory>(VIDEO_SYNC_HISTORY_KEY, defaults);
  return Array.isArray(stored?.runs) ? stored.runs.slice(0, 3) : [];
}

/** Keeps only the last 3 runs so the panel stays readable. */
export async function appendVideoSyncRun(
  run: VideoSyncRunSummary,
  previous: VideoSyncRunSummary[],
): Promise<VideoSyncRunSummary[]> {
  const runs = [run, ...previous].slice(0, 3);
  await saveEnvironmentSetting<VideoSyncHistory>(VIDEO_SYNC_HISTORY_KEY, { runs });
  return runs;
}

export function diffTitles(current: string[], previousRun?: VideoSyncRunSummary) {
  const before = new Set(previousRun?.titles ?? []);
  const after = new Set(current);
  return {
    added: previousRun ? current.filter((t) => !before.has(t)) : [],
    removed: previousRun ? (previousRun.titles ?? []).filter((t) => !after.has(t)) : [],
  };
}
