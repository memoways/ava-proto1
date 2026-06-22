import { supabase } from "@/integrations/supabase/client";

export interface CharacterPrompt {
  character_id: string;
  name?: string;
  identite_fondamentale: string;
  qui_tu_es: string;
  ce_que_tu_ne_fais_jamais: string;
  ce_que_tu_sais_utilisateur: string;
  dynamique_conversation: string;
  sujets_sensibles: string;
  profondeur_par_niveau: string;
  situation_summary: string;
  updated_at?: string;
}

export const CHARACTER_PROMPT_FIELDS: Array<{
  key: keyof Omit<CharacterPrompt, "character_id" | "name" | "situation_summary" | "updated_at">;
  label: string;
  hint: string;
}> = [
  { key: "identite_fondamentale", label: "Identité fondamentale", hint: "Qui le personnage est, fondamentalement." },
  { key: "qui_tu_es", label: "Qui tu es", hint: "Posture, ton, manière d'être dans la conversation." },
  { key: "ce_que_tu_ne_fais_jamais", label: "Ce que tu ne fais jamais", hint: "Interdits absolus." },
  { key: "ce_que_tu_sais_utilisateur", label: "Qui t'appelle", hint: "Cadrage de la relation à l'interlocuteur (champ Notion : « Qui t'appelle »)." },
  { key: "dynamique_conversation", label: "Dynamique de la conversation", hint: "Comment la conversation se déroule, rythme, retenue." },
  { key: "sujets_sensibles", label: "Sujets sensibles", hint: "Sujets délicats et manière de les aborder ou esquiver." },
  { key: "profondeur_par_niveau", label: "Profondeur par niveau", hint: "Ce qui peut être révélé / abordé selon le niveau de confiance." },
];

const EMPTY: Omit<CharacterPrompt, "character_id" | "name" | "updated_at"> = {
  identite_fondamentale: "",
  qui_tu_es: "",
  ce_que_tu_ne_fais_jamais: "",
  ce_que_tu_sais_utilisateur: "",
  dynamique_conversation: "",
  sujets_sensibles: "",
  profondeur_par_niveau: "",
  situation_summary: "",
};

const byIdCache = new Map<string, CharacterPrompt>();
const byNameCache = new Map<string, CharacterPrompt>();

export function clearCharacterPromptCache(characterId?: string) {
  if (!characterId) {
    byIdCache.clear();
    byNameCache.clear();
    return;
  }
  const existing = byIdCache.get(characterId);
  byIdCache.delete(characterId);
  if (existing?.name) byNameCache.delete(existing.name);
}

export async function loadCharacterPrompt(characterId: string): Promise<CharacterPrompt | null> {
  if (byIdCache.has(characterId)) return byIdCache.get(characterId)!;
  const { data, error } = await supabase
    .from("character_prompts" as any)
    .select("*, characters!inner(name)")
    .eq("character_id", characterId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as any;
  const prompt: CharacterPrompt = {
    character_id: row.character_id,
    name: row.characters?.name,
    identite_fondamentale: row.identite_fondamentale || "",
    qui_tu_es: row.qui_tu_es || "",
    ce_que_tu_ne_fais_jamais: row.ce_que_tu_ne_fais_jamais || "",
    ce_que_tu_sais_utilisateur: row.ce_que_tu_sais_utilisateur || "",
    dynamique_conversation: row.dynamique_conversation || "",
    sujets_sensibles: row.sujets_sensibles || "",
    profondeur_par_niveau: row.profondeur_par_niveau || "",
    situation_summary: row.situation_summary || "",
    updated_at: row.updated_at,
  };
  byIdCache.set(characterId, prompt);
  if (prompt.name) byNameCache.set(prompt.name, prompt);
  return prompt;
}

/**
 * Lookup a character by display name with fallback cascade:
 *   1. exact match (case-insensitive)
 *   2. starts-with "Name " (handles "Max" → "Max Lorenzo")
 *   3. starts-with "Name"
 * This protects against name drift between UI ("Max") and DB ("Max Lorenzo").
 */
async function findCharacterRowByName(name: string): Promise<{ id: string; name: string } | null> {
  if (!name?.trim()) return null;
  const trimmed = name.trim();
  // 1. Exact
  let res = await supabase.from("characters").select("id, name").ilike("name", trimmed).maybeSingle();
  if (res.data) return res.data as { id: string; name: string };
  // 2. "Name " prefix (most common: first name lookup)
  res = await supabase.from("characters").select("id, name").ilike("name", `${trimmed} %`).limit(1).maybeSingle();
  if (res.data) return res.data as { id: string; name: string };
  // 3. "Name" prefix (looser)
  res = await supabase.from("characters").select("id, name").ilike("name", `${trimmed}%`).limit(1).maybeSingle();
  if (res.data) return res.data as { id: string; name: string };
  console.warn(`[characterPromptService] No character found for name="${name}"`);
  return null;
}

export async function loadCharacterPromptByName(name: string): Promise<CharacterPrompt | null> {
  if (byNameCache.has(name)) return byNameCache.get(name)!;
  const charRow = await findCharacterRowByName(name);
  if (!charRow) return null;
  const prompt = await loadCharacterPrompt(charRow.id);
  if (prompt) byNameCache.set(name, prompt);
  return prompt;
}

const idByNameCache = new Map<string, string>();
/** Resolve the characters.id row from a display name with fallback cascade. Cached in-memory. */
export async function resolveCharacterIdByName(name: string): Promise<string | null> {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (idByNameCache.has(key)) return idByNameCache.get(key)!;
  const row = await findCharacterRowByName(name);
  const id = row?.id || null;
  if (id) idByNameCache.set(key, id);
  return id;
}

/** Resolve the canonical full character name (e.g. "Max" → "Max Lorenzo"). */
export async function resolveCanonicalCharacterName(name: string): Promise<string | null> {
  const row = await findCharacterRowByName(name);
  return row?.name || null;
}

export async function saveCharacterPrompt(
  characterId: string,
  partial: Partial<Omit<CharacterPrompt, "character_id" | "name" | "updated_at">>,
): Promise<void> {
  const payload = { character_id: characterId, ...partial };
  const { error } = await supabase
    .from("character_prompts" as any)
    .upsert(payload as any, { onConflict: "character_id" });
  if (error) throw new Error(error.message);
  clearCharacterPromptCache(characterId);
}

export interface CharacterListEntry {
  character_id: string;
  name: string;
  has_prompt: boolean;
  updated_at?: string | null;
  prompt_chars: number;
}

export async function listCharactersWithPrompts(): Promise<CharacterListEntry[]> {
  const { data: chars } = await supabase
    .from("characters")
    .select("id, name")
    .order("name");
  if (!chars) return [];
  const { data: prompts } = await supabase
    .from("character_prompts" as any)
    .select("*");
  const byId = new Map<string, any>();
  (prompts || []).forEach((p: any) => byId.set(p.character_id, p));
  return chars.map((c: any) => {
    const p = byId.get(c.id);
    const len = p
      ? [p.identite_fondamentale, p.qui_tu_es, p.ce_que_tu_ne_fais_jamais, p.ce_que_tu_sais_utilisateur, p.dynamique_conversation, p.sujets_sensibles, p.profondeur_par_niveau]
          .reduce((s: number, v: string) => s + (v?.length || 0), 0)
      : 0;
    return {
      character_id: c.id,
      name: c.name,
      has_prompt: !!p,
      updated_at: p?.updated_at,
      prompt_chars: len,
    };
  });
}

export function buildCharacterPromptSections(p: CharacterPrompt | null): string {
  if (!p) return "";
  const sections: Array<[string, string]> = [
    // Situation actuelle d'abord : c'est le résumé factuel le plus dense (lieu, âge, famille…).
    ["SITUATION ACTUELLE (canon — faits vrais que tu peux énoncer librement)", p.situation_summary],
    ["IDENTITÉ FONDAMENTALE", p.identite_fondamentale],
    ["QUI TU ES", p.qui_tu_es],
    ["CE QUE TU NE FAIS JAMAIS", p.ce_que_tu_ne_fais_jamais],
    ["QUI T'APPELLE", p.ce_que_tu_sais_utilisateur],
    ["DYNAMIQUE DE LA CONVERSATION", p.dynamique_conversation],
    ["SUJETS SENSIBLES", p.sujets_sensibles],
    ["PROFONDEUR PAR NIVEAU", p.profondeur_par_niveau],
  ];
  return sections
    .filter(([, v]) => v && v.trim())
    .map(([title, v]) => `## ${title}\n${v.trim()}`)
    .join("\n\n");
}

export { EMPTY as EMPTY_CHARACTER_PROMPT };
