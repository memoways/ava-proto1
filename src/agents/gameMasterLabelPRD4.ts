/**
 * PRD4 — Label Pass du Game Master (LLM léger, mono-tâche).
 *
 * Lancé EN PARALLÈLE de Max LLM par `processPRD4Turn`. Extrait uniquement les
 * labels {themes, topics, intentions} (≤4 au total) à partir du DERNIER message
 * utilisateur. Pas de guidance, pas de trigger : ce dernier est produit côté
 * client (matcher déterministe).
 */
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { getLLMSettings } from "@/services/settingsService";
import type { ConversationMessage, PRD4TurnLabels } from "@/types";

const LABEL_TIMEOUT_MS = 4000;

const SYSTEM_PROMPT = `Tu es l'analyste du Game Master d'une expérience narrative en temps réel. Pour CHAQUE message utilisateur que tu reçois, tu extrais des labels concis. Retourne EXCLUSIVEMENT un JSON strict :
{
  "themes": string[],      // grand thème narratif (1-3 mots, minuscules, sans accents). Ex: "famille", "patriarcat", "trahison", "secrets", "confiance", "deuil", "violence", "memoire", "identite", "amour", "mensonge", "pandemie".
  "topics": string[],      // sujet concret (1-3 mots). Ex: "soeur", "enfance", "disparition", "police", "film".
  "intentions": string[]   // intention exprimée (1-2 mots). Ex: "question", "defi", "empathie", "doute", "provocation".
}

RÈGLES STRICTES :
- MAX 4 labels au TOTAL (themes + topics + intentions cumulés).
- NE PAS inventer. Si le message est trop court / vague / général ("salut", "ok", "je sais pas"), retourne des listes vides.
- Mots simples, minuscules, sans accents, sans phrase, pas plus de 25 caractères.
- Pas de markdown, pas de \`\`\`. Uniquement l'objet JSON.`;

export interface PRD4LabelInput {
  sessionId: string | null;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  userPostureRaw?: string | null;
}

export interface PRD4LabelResult {
  labels: PRD4TurnLabels;
  latency_ms: number;
  model: string;
  ok: boolean;
}

const EMPTY: PRD4TurnLabels = { themes: [], topics: [], intentions: [] };

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*|```$/g, "").trim();
  try { return JSON.parse(trimmed); } catch { /* fallthrough */ }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function cleanList(list: unknown, max = 4): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((v) => String(v).trim().toLowerCase())
    .filter((v) => v && v.length <= 30)
    .slice(0, max);
}

function buildUserPrompt(input: PRD4LabelInput): string {
  const recent = input.conversationHistory
    .slice(-4)
    .map((m) => `${m.role === "user" ? "U" : "M"}: ${m.content}`)
    .join("\n");
  return `Posture initiale: ${input.userPostureRaw?.trim() || "(non renseignée)"}

Contexte récent:
${recent || "(aucun)"}

Message utilisateur À LABÉLISER:
${input.userMessage}

Retourne uniquement le JSON {themes, topics, intentions}.`;
}

export async function labelUserTurnPRD4(input: PRD4LabelInput): Promise<PRD4LabelResult> {
  const startedAt = performance.now();
  let model = "";
  try {
    const llm = getLLMSettings();
    model = llm.LLM_MODEL_GM;
    const res = await callLLMWithUsage(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      {
        model: llm.LLM_MODEL_GM,
        temperature: 0.1,
        max_tokens: 120,
        timeoutMs: LABEL_TIMEOUT_MS,
        feature_key: "prd4_gm_label",
        session_id: input.sessionId ?? undefined,
      },
    );
    model = res.model || model;
    const parsed = extractJson(res.content) as Partial<PRD4TurnLabels> | null;
    if (!parsed) {
      console.warn("[GM-label] no JSON in response:", res.content.slice(0, 160));
      return { labels: EMPTY, latency_ms: Math.round(performance.now() - startedAt), model, ok: false };
    }
    const themes = cleanList(parsed.themes);
    const topics = cleanList(parsed.topics);
    const intentions = cleanList(parsed.intentions);
    const cap = 4;
    const total = () => themes.length + topics.length + intentions.length;
    while (total() > cap) {
      if (intentions.length) intentions.pop();
      else if (topics.length) topics.pop();
      else themes.pop();
    }
    return {
      labels: { themes, topics, intentions },
      latency_ms: Math.round(performance.now() - startedAt),
      model,
      ok: true,
    };
  } catch (err) {
    console.warn("[GM-label] failed:", err);
    return { labels: EMPTY, latency_ms: Math.round(performance.now() - startedAt), model, ok: false };
  }
}
