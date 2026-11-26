import { getCachedSession } from "@/services/gameAuth";
import type { GumletVideo, ImportDefaults } from "../../supabase/functions/_shared/gumletImport";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface GumletListResult {
  videos: GumletVideo[];
  /** Missing from Notion but whose details Gumlet did not return. */
  unreadable: string[];
  total_gumlet: number;
  already_in_notion: number;
  /** Missing videos beyond the per-load limit. */
  not_shown: number;
}

export interface GumletImportResult {
  created: Array<{ asset_id: string; title: string; notion_url: string }>;
  skipped: string[];
  failed: Array<{ asset_id: string; error: string }>;
  ignored_properties: string[];
}

const ERROR_MESSAGES: Record<string, string> = {
  gumlet_key_missing: "La clé API Gumlet n'est pas configurée : ajoute le secret GUMLET_API_KEY dans Lovable Cloud.",
  gumlet_unauthorized: "Gumlet refuse la clé API (GUMLET_API_KEY).",
  gumlet_rate_limited: "Limite d'appels Gumlet atteinte. Réessaie dans une heure.",
  gumlet_other_workspace: "Cette vidéo appartient à un autre espace Gumlet : le lecteur d'Ava ne la lirait pas.",
  notion_schema_mismatch: "La base Notion « Vidéos AVA » n'a plus les champs Titre de la vidéo, URL Gumlet ou État attendus.",
  notion_403: "L'intégration Notion n'a pas le droit de créer des fiches dans « Vidéos AVA ».",
  notion_404: "L'intégration Notion ne trouve pas la base « Vidéos AVA » (partage à vérifier).",
};

export function gumletImportErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? code;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const session = await getCachedSession();
  const token = session?.access_token;
  // A function that is not deployed fails the CORS preflight: the browser only reports a network error.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-gumlet-videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error("La fonction d'import ne répond pas : elle n'est pas encore déployée dans Lovable Cloud, ou le réseau est coupé.");
  });
  const parsed = await res.json().catch(() => null) as (T & { error?: string }) | null;
  if (!res.ok || !parsed) {
    if (res.status === 404 && !parsed?.error) {
      throw new Error("La fonction d'import n'est pas encore déployée dans Lovable Cloud.");
    }
    throw new Error(gumletImportErrorMessage(parsed?.error ?? `HTTP ${res.status}`));
  }
  return parsed;
}

export function listMissingGumletVideos(): Promise<GumletListResult> {
  return call<GumletListResult>({ action: "list" });
}

export function importGumletVideos(assetIds: string[], defaults: ImportDefaults): Promise<GumletImportResult> {
  return call<GumletImportResult>({ action: "import", asset_ids: assetIds, defaults });
}
