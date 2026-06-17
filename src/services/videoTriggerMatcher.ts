/**
 * PRD4 — Matcher déterministe de vidéos cinématiques par thématique.
 *
 * Plutôt que de demander au LLM de choisir l'id de vidéo (peu fiable), le
 * matching se fait côté client : normalisation + synonymes + tolérance aux
 * coquilles présentes dans Notion. Un seul label/synonyme commun avec les
 * `themes` d'une vidéo suffit pour la déclencher.
 */
import type { PRD4TurnLabels } from "@/types";
import type { VideoTriggerRow } from "@/services/videoTriggerService";

/** Coquilles connues côté Notion → forme canonique. */
const TYPO_FIXES: Record<string, string> = {
  patricarcat: "patriarcat",
  patriarchat: "patriarcat",
  patriacrat: "patriarcat",
};

/** Famille de synonymes : un seul match suffit pour déclencher. */
const SYNONYMS: Record<string, string[]> = {
  famille: ["pere", "mere", "soeur", "frere", "parents", "enfance", "fratrie", "fils", "fille", "papa", "maman"],
  patriarcat: ["male", "homme", "machisme", "domination", "viril", "violent", "violence"],
  trahison: ["mensonge", "menti", "cacher", "secret", "secrets", "tromper", "trahi"],
  secrets: ["cacher", "verite", "dissimuler", "mensonge", "secret"],
  confiance: ["trahison", "fiabilite", "loyaute"],
  pandemie: ["virus", "epidemie", "maladie", "contagion", "protogynie", "protogyny"],
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeTheme(raw: string): string {
  const base = stripAccents(String(raw || "").toLowerCase().trim());
  return TYPO_FIXES[base] ?? base;
}

export function tokenize(text: string): string[] {
  return stripAccents(String(text || "").toLowerCase())
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function matchesTheme(candidate: string, videoTheme: string): boolean {
  const c = normalizeTheme(candidate);
  const v = normalizeTheme(videoTheme);
  if (!c || !v) return false;
  if (c === v || c.includes(v) || v.includes(c)) return true;
  const syn = SYNONYMS[v] ?? [];
  for (const w of syn) {
    const nw = normalizeTheme(w);
    if (nw === c || c.includes(nw) || nw.includes(c)) return true;
  }
  return false;
}

export interface VideoMatchResult {
  row: VideoTriggerRow;
  matchedVideoTheme: string;
  source: "themes" | "topics" | "intentions" | "raw_message";
  matchedTerm: string;
}

/**
 * Choisit la vidéo à jouer ce tour. Retourne null si rien ne matche.
 * Priorité asc (la plus petite = la plus prioritaire). Ignore les vidéos déjà déclenchées.
 */
export function pickVideoForLabels(
  labels: PRD4TurnLabels | null | undefined,
  videos: VideoTriggerRow[],
  alreadyTriggeredIds: string[] = [],
  rawUserMessage?: string,
): VideoMatchResult | null {
  const triggered = new Set(alreadyTriggeredIds);
  const candidates: VideoMatchResult[] = [];

  const tryAgainst = (terms: string[], source: VideoMatchResult["source"]) => {
    for (const term of terms) {
      for (const row of videos) {
        if (triggered.has(row.id)) continue;
        if (!row.video_url) continue;
        const themes = Array.isArray(row.themes) ? row.themes : [];
        for (const t of themes) {
          if (matchesTheme(term, t)) {
            candidates.push({ row, matchedVideoTheme: normalizeTheme(t), source, matchedTerm: term });
          }
        }
      }
    }
  };

  if (labels) {
    tryAgainst(labels.themes ?? [], "themes");
    tryAgainst(labels.topics ?? [], "topics");
    tryAgainst(labels.intentions ?? [], "intentions");
  }
  if (candidates.length === 0 && rawUserMessage) {
    tryAgainst(tokenize(rawUserMessage), "raw_message");
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const pa = a.row.priority ?? Number.POSITIVE_INFINITY;
    const pb = b.row.priority ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });
  return candidates[0];
}
