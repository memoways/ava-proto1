/**
 * Read-only snapshot of the synced Max and Emma sheets of a sandbox, for the
 * offline canon diagnostic (lot K1).
 *
 *   npm run eval:judge:sheets -- [--env sandbox-ulrich] [--out output/eval-judge/fiches_sandbox.json]
 *
 * Reads `character_prompts` only (the Lovable Cloud copy, never Notion) and
 * writes nothing to the database. With `--resync` it first runs the editorial
 * `fields_only` synchronisation of Max and Emma on the chosen sandbox (the same
 * call as the admin button: reads Notion, writes the sandbox copy only, no RAG).
 * Lot F: it also warns when a sheet still says « tu attends l'appel ».
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, log, openEvalSession, readArgs } from "./session";

async function resyncFields(session: Awaited<ReturnType<typeof openEvalSession>>): Promise<void> {
  if (session.environment === "prod") fail("Resynchro refusée sur prod.");
  const { AVA_NOTION_DATABASES } = await import("@/services/ragService");
  const { data: auth } = await session.supabase.auth.getSession();
  const token = auth.session?.access_token;
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!token || !base) fail("Jeton ou URL Supabase introuvables pour la resynchro.");
  for (const name of ["Max", "Emma"]) {
    const { resolveCharacterIdByName } = await import("@/services/characterPromptService");
    const id = await resolveCharacterIdByName(name);
    const { data: row } = id ? await session.supabase.from("characters").select("notion_id").eq("id", id).maybeSingle() : { data: null };
    if (!row?.notion_id) fail(`${name} : notion_id introuvable`);
    const res = await fetch(`${base}/functions/v1/sync-notion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        databases: { characters: AVA_NOTION_DATABASES.characters },
        only_notion_id: row.notion_id,
        mode: "fields_only",
        environment_id: session.environment,
      }),
    });
    const text = await res.text();
    if (!res.ok) fail(`Resynchro ${name} refusée (${res.status}) : ${text.slice(0, 300)}`);
    log(`✓ Resynchro fields_only ${name} (${session.environment}) : ${text.slice(0, 160)}`);
  }
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const session = await openEvalSession(args.get("env") ?? "sandbox-ulrich");
  const { loadCharacterPromptByName } = await import("@/services/characterPromptService");
  if (args.has("resync")) await resyncFields(session);
  const { findAwaitedCallSentences } = await import("@/services/establishedFacts");
  const characters: Record<string, unknown> = {};
  let faulty = 0;
  for (const key of ["max", "emma"] as const) {
    const sheet = await loadCharacterPromptByName(key === "max" ? "Max" : "Emma");
    if (!sheet) fail(`Fiche ${key} introuvable dans ${session.environment}`);
    characters[key] = sheet;
    log(`• ${sheet.name} · mise à jour ${sheet.updated_at}`);
    for (const hit of findAwaitedCallSentences(sheet)) {
      faulty += 1;
      log(`  ⚠ ${sheet.name} · ${hit.field} : « ${hit.excerpt} » (à corriger dans Notion, le code ne réécrit plus la fiche)`);
    }
  }
  if (faulty) log(`⚠ ${faulty} formule(s) « attend(s) l'appel » : liste à transmettre à Romed.`);
  const file = path.resolve(process.cwd(), args.get("out") ?? "output/eval-judge/fiches_sandbox.json");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({
    note: "Copie en lecture seule des fiches synchronisées (character_prompts). Source éditoriale : Notion, base Caractères. Ne pas éditer à la main.",
    environment: session.environment,
    capturedAt: new Date().toISOString(),
    characters,
  }, null, 2)}\n`, "utf8");
  log(`✓ ${path.relative(process.cwd(), file)}`);
  await session.close();
}

main().then(() => process.exit(0), (error: unknown) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
