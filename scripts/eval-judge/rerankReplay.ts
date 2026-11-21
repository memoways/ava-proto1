/**
 * Lot T5: replays real RAG-lab questions through `query-rag` with rerank on and
 * records both the cosine order (`retrieval_matches`) and the reranked top 5, so
 * a conditional-rerank rule can be checked against the full rerank.
 * Usage: npm run eval:rerank-replay -- --questions q.json --out replay.json [--env sandbox-ulrich]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fail, log, openEvalSession, readArgs } from "./session";

const args = readArgs(process.argv.slice(2));
const questionsFile = args.get("questions");
const outFile = args.get("out");
if (!questionsFile || !outFile) fail("--questions et --out sont requis.");
const questions = JSON.parse(readFileSync(questionsFile, "utf8")) as string[];

const session = await openEvalSession(args.get("env") ?? "sandbox-ulrich");
const { data: chars, error } = await session.supabase.from("embeddings").select("character_id").limit(1000);
if (error) fail(`Lecture des personnages impossible : ${error.message}`);
const characterIds = [...new Set((chars ?? []).map((row) => row.character_id as string))];
log(`${characterIds.length} personnages, ${questions.length} questions`);

const rows: unknown[] = [];
for (const characterId of characterIds) {
  for (const query of questions) {
    const { data, error: invokeError } = await session.supabase.functions.invoke("query-rag", {
      body: { query, character_id: characterId, match_count: 5, retrieve_k: 15, rerank: true, include_retrieval_matches: true },
    });
    if (invokeError || !data?.matches) { rows.push({ characterId, query, error: String(invokeError?.message ?? "no matches") }); continue; }
    rows.push({
      characterId, query, rerankUsed: data.rerank_used,
      retrieval: (data.retrieval_matches ?? []).map((m: { id: string; retrieval_similarity: number }) => ({ id: m.id, s: m.retrieval_similarity })),
      reranked: data.matches.map((m: { id: string; rerank_score?: number; retrieval_similarity: number }) => ({ id: m.id, rerank: m.rerank_score, s: m.retrieval_similarity })),
    });
  }
}
writeFileSync(outFile, JSON.stringify(rows, null, 1));
log(`✓ ${rows.length} rejeux écrits dans ${outFile}`);
await session.close();
