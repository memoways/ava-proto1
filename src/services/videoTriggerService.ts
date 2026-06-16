/**
 * Video Trigger service — read from Supabase (synced from Notion "🎬 Vidéos AVA"),
 * write back to Notion via update-notion-video edge function.
 */
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export interface VideoTriggerRow {
  id: string;
  notion_id: string | null;
  title: string;
  type: string;
  themes: string[];
  video_url: string | null;
  context: string | null;
  description: string | null;
  priority: number | null;
  transition_style: string | null;
  post_video_context: string | null;
  updated_at: string | null;
}

const SELECT = "id, notion_id, title, type, themes, video_url, context, description, priority, transition_style, post_video_context, updated_at";

export async function listVideoTriggers(): Promise<VideoTriggerRow[]> {
  const { data, error } = await supabase
    .from("video_triggers")
    .select(SELECT)
    .order("priority", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as VideoTriggerRow[];
}

/** Lightweight cache used by the Game Master decision (avoids hammering the DB each turn). */
let cache: { rows: VideoTriggerRow[]; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getVideoTriggersCached(): Promise<VideoTriggerRow[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.rows;
  const rows = await listVideoTriggers().catch((err) => {
    console.warn("[videoTriggerService] fetch failed:", err);
    return [] as VideoTriggerRow[];
  });
  cache = { rows, ts: Date.now() };
  return rows;
}

export function invalidateVideoTriggerCache() {
  cache = null;
}

export interface UpdateVideoTriggerPatch {
  title?: string;
  context?: string;
  description?: string;
  priority?: number;
  themes?: string[];
  type?: string;
  transition_style?: string;
  video_url?: string | null;
}

export async function updateVideoTriggerOnNotion(
  notionId: string,
  patch: UpdateVideoTriggerPatch,
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/update-notion-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notion_id: notionId, ...patch }),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) {
    const errMsg = (parsed as { error?: string } | null)?.error || text || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  invalidateVideoTriggerCache();
}
