import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY") ?? "";

interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
}

const FIELD_ALIASES: Record<string, string[]> = {
  question: ["Question", "question"],
  gold_answer: ["Reponse visee", "Réponse visée", "Reponse visée", "Réponse visee", "Gold", "Réponse idéale"],
  must_include: ["Must include", "Doit inclure", "Must include"],
  must_not: ["Must not", "Ne doit pas", "Must not"],
  tone: ["Ton", "Tone"],
  max_length: ["Longueur max", "Longueur", "Max length"],
  category: ["Categorie", "Catégorie", "Category"],
  active: ["Actif", "Active"],
  character_name: ["Personnage", "Character"],
  sort_order: ["Ordre", "Order"],
  judge_notes: ["Notes juge", "Notes", "Judge notes"],
};

function extractRichText(prop: unknown): string {
  const value = prop as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  if (!value?.rich_text) return "";
  return value.rich_text.map((t) => t.plain_text ?? "").join("");
}

function extractTitle(prop: unknown): string {
  const value = prop as { title?: Array<{ plain_text?: string }> } | undefined;
  if (!value?.title) return "";
  return value.title.map((t) => t.plain_text ?? "").join("");
}

function extractSelect(prop: unknown): string | null {
  const value = prop as { select?: { name?: string } } | undefined;
  return value?.select?.name || null;
}

function extractNumber(prop: unknown): number | null {
  const value = prop as { number?: number | null } | undefined;
  return typeof value?.number === "number" ? value.number : null;
}

function extractCheckbox(prop: unknown): boolean | null {
  const value = prop as { checkbox?: boolean } | undefined;
  return typeof value?.checkbox === "boolean" ? value.checkbox : null;
}

function findProp(props: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (alias in props) return props[alias];
  }
  const keys = Object.keys(props);
  for (const alias of aliases) {
    const hit = keys.find((key) => key.toLowerCase() === alias.toLowerCase());
    if (hit) return props[hit];
  }
  return undefined;
}

export function mapNotionEvalPage(page: NotionPage): {
  notion_page_id: string;
  question: string;
  gold_answer: string;
  must_include: string;
  must_not: string;
  tone: string | null;
  max_length: number | null;
  category: string | null;
  active: boolean;
  character_name: string;
  sort_order: number;
  judge_notes: string;
} | null {
  const props = page.properties ?? {};
  const titleProp = findProp(props, FIELD_ALIASES.question);
  const question = (extractTitle(titleProp) || extractRichText(titleProp)).trim();
  if (!question) return null;

  const activeRaw = extractCheckbox(findProp(props, FIELD_ALIASES.active));
  const character = extractSelect(findProp(props, FIELD_ALIASES.character_name)) || "Max";

  return {
    notion_page_id: page.id.replace(/-/g, ""),
    question,
    gold_answer: extractRichText(findProp(props, FIELD_ALIASES.gold_answer)).trim(),
    must_include: extractRichText(findProp(props, FIELD_ALIASES.must_include)).trim(),
    must_not: extractRichText(findProp(props, FIELD_ALIASES.must_not)).trim(),
    tone: extractSelect(findProp(props, FIELD_ALIASES.tone)),
    max_length: extractNumber(findProp(props, FIELD_ALIASES.max_length)),
    category: extractSelect(findProp(props, FIELD_ALIASES.category)),
    active: activeRaw !== false,
    character_name: character,
    sort_order: extractNumber(findProp(props, FIELD_ALIASES.sort_order)) ?? 0,
    judge_notes: extractRichText(findProp(props, FIELD_ALIASES.judge_notes)).trim(),
  };
}

async function fetchNotionDatabase(databaseId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(`${NOTION_API_URL}/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion API error [${res.status}]: ${err}`);
    }
    const data = await res.json();
    pages.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminAuth = await requireAdmin(req, corsHeaders);
  if (!adminAuth.ok) return adminAuth.response!;

  try {
    const body = await req.json().catch(() => ({})) as { database_id?: string };
    const databaseId = (body.database_id || "").replace(/-/g, "");
    if (!databaseId) {
      return new Response(JSON.stringify({ error: "database_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const pages = await fetchNotionDatabase(databaseId);
    const mapped = pages.map(mapNotionEvalPage).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const now = new Date().toISOString();
    const seenIds = mapped.map((row) => row.notion_page_id);

    for (const row of mapped) {
      const { error } = await supabase.from("eval_items").upsert(
        { ...row, synced_at: now, updated_at: now },
        { onConflict: "notion_page_id" },
      );
      if (error) throw new Error(`upsert eval_items: ${error.message}`);
    }

    const { data: existing } = await supabase.from("eval_items").select("id, notion_page_id");
    const seen = new Set(seenIds);
    const staleIds = (existing ?? [])
      .filter((row) => !seen.has(row.notion_page_id))
      .map((row) => row.id);
    if (staleIds.length > 0) {
      await supabase.from("eval_items").update({ active: false, updated_at: now }).in("id", staleIds);
    }

    return new Response(
      JSON.stringify({
        synced_at: now,
        pages_seen: pages.length,
        items_upserted: mapped.length,
        skipped_empty_title: pages.length - mapped.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
