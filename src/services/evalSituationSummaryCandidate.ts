/**
 * Candidate PRÉSENT for the LLM judge (lot P): generated in memory from the
 * synced sheet of the active environment, with the same generator prompt,
 * model and temperature as `sync-notion`. Read-only: nothing is written to
 * `character_prompts`, `characters` or `admin_settings`.
 */
import { supabase } from "@/integrations/supabase/client";
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { loadCharacterPrompt } from "@/services/characterPromptService";
import { getCharacterRuntimeReadiness } from "@/services/experienceOrchestration";
import { EVAL_FEATURE_KEY, EVAL_SITUATION_SUMMARY_MAX_CHARS } from "@/services/evalJudgePipeline";
import {
  buildSituationSummaryPrompt,
  situationSummaryRequest,
  type SituationSummaryPromptVersion,
} from "../../supabase/functions/_shared/situationSummaryPrompt";

export type EvalPresentCharacter = "max" | "emma";

export interface CandidatePresent {
  character: EvalPresentCharacter;
  name: string;
  stored: string;
  candidate: string;
  model: string;
}

export interface CandidatePresentDeps {
  loadSources: (character: EvalPresentCharacter) => Promise<{ name: string; timeline: string; identity: string; pageContent: string; stored: string }>;
  generate: (prompt: string, version: SituationSummaryPromptVersion) => Promise<{ content: string; model: string }>;
}

async function loadSources(character: EvalPresentCharacter) {
  const runtime = await getCharacterRuntimeReadiness(character);
  if (!runtime?.characterId) throw new Error(`Fiche active introuvable pour ${character}`);
  const fields = await loadCharacterPrompt(runtime.characterId);
  if (!fields) throw new Error(`Champs synchronisés introuvables pour ${character}`);
  const { data, error } = await supabase.from("characters").select("name, backstory").eq("id", runtime.characterId).maybeSingle();
  if (error) throw new Error(`Lecture du récit de ${character} refusée : ${error.message}`);
  return {
    name: data?.name || fields.name || runtime.displayName,
    timeline: fields.timeline,
    identity: fields.identite_fondamentale,
    pageContent: data?.backstory ?? "",
    stored: fields.situation_summary,
  };
}

async function generate(prompt: string, version: SituationSummaryPromptVersion) {
  const request = situationSummaryRequest(prompt, version);
  const result = await callLLMWithUsage(request.messages, {
    model: request.model,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    reasoning: false,
    feature_key: EVAL_FEATURE_KEY,
    timeoutMs: 45_000,
  });
  return { content: result.content, model: request.model };
}

const DEFAULT_DEPS: CandidatePresentDeps = { loadSources, generate };

/** One generation per character; any failure stops the run before a single turn is played. */
export async function generateCandidatePresents(
  characters: EvalPresentCharacter[],
  version: SituationSummaryPromptVersion,
  deps: CandidatePresentDeps = DEFAULT_DEPS,
): Promise<CandidatePresent[]> {
  const out: CandidatePresent[] = [];
  for (const character of characters) {
    const sources = await deps.loadSources(character);
    const prompt = buildSituationSummaryPrompt(sources, version);
    if (!prompt) throw new Error(`Rien à résumer pour ${character} : timeline et récit vides`);
    const { content, model } = await deps.generate(prompt, version);
    const candidate = content.trim();
    if (!candidate) throw new Error(`PRÉSENT candidat vide pour ${character}`);
    if (candidate.length > EVAL_SITUATION_SUMMARY_MAX_CHARS) {
      throw new Error(`PRÉSENT candidat trop long pour ${character} (${candidate.length} caractères)`);
    }
    out.push({ character, name: sources.name, stored: sources.stored, candidate, model });
  }
  return out;
}

/** Snapshot fragment for `--candidate-json` / the candidate side of a comparison. */
export function candidatePresentSnapshot(presents: CandidatePresent[], version: SituationSummaryPromptVersion) {
  return {
    situationSummarySource: version,
    situationSummaries: Object.fromEntries(presents.map((present) => [present.character, present.candidate])),
  };
}
