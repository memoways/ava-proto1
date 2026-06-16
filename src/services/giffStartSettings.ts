/**
 * Configuration du démarrage GIFF (PRD 16/06/2026).
 * Persistée dans admin_settings (key: ava_giff_start_settings).
 */
import { supabase } from "@/integrations/supabase/client";

export type AvaStartVariant = "gm_host" | "gm_invisible" | "voiceover_hybrid";

export interface GiffStartSettings {
  use_giff_flow: boolean;
  active_start_variant: AvaStartVariant;
  max_start_duration_seconds: number;
  welcome_text: string;
  promise_text: string;
  teaser_text_short: string;
  posture_question: string;
  allow_surprise_me: boolean;
  gm_host_intro_text: string;
  gm_host_handoff_text: string;
  voiceover_intro_text: string;
}

export const GIFF_START_DEFAULTS: GiffStartSettings = {
  use_giff_flow: true,
  active_start_variant: "gm_host",
  max_start_duration_seconds: 45,
  welcome_text: "Bienvenue dans l'expérience AVA.",
  promise_text:
    "Tu vas pouvoir entrer en conversation avec les personnages du film.",
  teaser_text_short:
    "Le film suit une famille confrontée à une transformation radicale du monde et des corps. Après les événements du film, certains personnages peuvent encore répondre. Tu peux leur amener une question, un doute ou une émotion.",
  posture_question:
    "Tu peux venir avec une question, une émotion, un doute, ou te laisser surprendre.",
  allow_surprise_me: true,
  gm_host_intro_text:
    "Je suis ton hôte pour cette expérience. Quelques secondes pour t'installer, puis on entre dans le film.",
  gm_host_handoff_text: "Très bien. Je te passe la main.",
  voiceover_intro_text:
    "Une voix t'accompagne. Respire. L'expérience commence.",
};

const STORAGE_KEY = "ava_giff_start_settings";

let cache: GiffStartSettings | null = null;

export function getGiffStartSettings(): GiffStartSettings {
  if (cache) return cache;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cache = { ...GIFF_START_DEFAULTS, ...JSON.parse(stored) };
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = { ...GIFF_START_DEFAULTS };
  return cache;
}

export async function loadGiffStartSettingsFromDB(): Promise<GiffStartSettings> {
  try {
    const { data, error } = await supabase
      .from("admin_settings" as any)
      .select("value")
      .eq("key", STORAGE_KEY)
      .maybeSingle();
    if (!error && data) {
      const dbValue = (data as any).value as Partial<GiffStartSettings>;
      cache = { ...GIFF_START_DEFAULTS, ...dbValue };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      return cache;
    }
  } catch (err) {
    console.warn("[GIFF settings] load failed:", err);
  }
  return getGiffStartSettings();
}

export async function saveGiffStartSettings(
  settings: GiffStartSettings,
): Promise<void> {
  cache = { ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  try {
    const { error } = await supabase
      .from("admin_settings" as any)
      .upsert(
        { key: STORAGE_KEY, value: cache, updated_at: new Date().toISOString() } as any,
        { onConflict: "key" },
      );
    if (error) console.error("[GIFF settings] save failed:", error.message);
  } catch (err) {
    console.error("[GIFF settings] save exception:", err);
  }
}

export function resetGiffStartCache(): void {
  cache = null;
}
