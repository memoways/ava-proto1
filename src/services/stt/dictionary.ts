/**
 * STT custom dictionary — a project-wide list of proper nouns and jargon to
 * bias transcription toward. Each provider consumes it through its native
 * mechanism:
 *   - Deepgram Nova-3 → `keyterm` query param (up to 100 terms).
 *   - AssemblyAI v3    → `keyterms_prompt` query param (JSON array).
 *   - OpenAI Whisper / gpt-4o-transcribe → `prompt` field (≤ 224 tokens).
 *   - Gradium / Gamilab → not yet wired.
 *
 * Terms are stored in `admin_settings.value = { terms: string[] }` under the
 * key `ava_stt_dictionary`. Client-only read; nothing here is secret.
 */

import { supabase } from "@/integrations/supabase/client";

export const STT_DICTIONARY_KEY = "ava_stt_dictionary";
/** Deepgram Nova-3 keyterm cap. AssemblyAI is stricter but we soft-cap the same. */
export const STT_DICTIONARY_MAX_TERMS = 100;

/** Baseline: proper nouns from the AVA storyworld — used when the DB is empty. */
export const DEFAULT_STT_DICTIONARY_TERMS: string[] = [
  "Max",
  "Ava",
  "Emma",
  "Léo",
  "Protogyny",
  "MemoWays",
  "Ulrich Fischer",
];

export interface STTDictionary {
  terms: string[];
}

let cached: STTDictionary | null = null;
let loadPromise: Promise<STTDictionary> | null = null;

function normalize(input: unknown): STTDictionary {
  const raw = (input && typeof input === "object" && Array.isArray((input as { terms?: unknown }).terms))
    ? (input as { terms: unknown[] }).terms
    : [];
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const term = item.trim();
    if (!term) continue;
    const dedupeKey = term.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    cleaned.push(term);
    if (cleaned.length >= STT_DICTIONARY_MAX_TERMS) break;
  }
  return { terms: cleaned };
}

/** Synchronous accessor used by STT providers when opening a session. */
export function getDictionaryTerms(): string[] {
  if (cached) return [...cached.terms];
  try {
    const stored = localStorage.getItem(STT_DICTIONARY_KEY);
    if (stored) {
      cached = normalize(JSON.parse(stored));
      return [...cached.terms];
    }
  } catch {
    // fall through to defaults
  }
  cached = { terms: [...DEFAULT_STT_DICTIONARY_TERMS] };
  return [...cached.terms];
}

export async function loadDictionaryFromDB(): Promise<STTDictionary> {
  if (cached) return { terms: [...cached.terms] };
  if (loadPromise) return loadPromise;
  loadPromise = loadDictionaryUncached().finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}

async function loadDictionaryUncached(): Promise<STTDictionary> {
  try {
    const { data, error } = await supabase
      .from("admin_settings" as never)
      .select("value")
      .eq("key", STT_DICTIONARY_KEY)
      .maybeSingle();
    if (!error && data) {
      const loaded = normalize((data as { value: unknown }).value);
      localStorage.setItem(STT_DICTIONARY_KEY, JSON.stringify(loaded));
      cached = loaded;
      return { terms: [...loaded.terms] };
    }
  } catch (err) {
    console.warn("[STT Dictionary] DB load failed:", err);
  }
  const fallback = { terms: getDictionaryTerms() };
  cached = fallback;
  return { terms: [...fallback.terms] };
}

export async function saveDictionaryToDB(dict: STTDictionary): Promise<STTDictionary> {
  const normalized = normalize(dict);
  localStorage.setItem(STT_DICTIONARY_KEY, JSON.stringify(normalized));
  cached = normalized;
  try {
    const { error } = await supabase
      .from("admin_settings" as never)
      .upsert(
        { key: STT_DICTIONARY_KEY, value: normalized, updated_at: new Date().toISOString() } as never,
        { onConflict: "key" },
      );
    if (error) console.error("[STT Dictionary] DB save failed:", error.message);
  } catch (err) {
    console.error("[STT Dictionary] DB save exception:", err);
  }
  return { terms: [...normalized.terms] };
}

export function resetSTTDictionaryCache(): void {
  cached = null;
  loadPromise = null;
}

/** Helpers for UI textarea ↔ list conversion. */
export function termsToText(terms: string[]): string {
  return terms.join("\n");
}

export function textToTerms(text: string): string[] {
  return normalize({ terms: text.split(/\r?\n/) }).terms;
}
