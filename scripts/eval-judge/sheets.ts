/**
 * Read-only snapshot of the synced Max and Emma sheets of a sandbox, for the
 * offline canon diagnostic (lot K1).
 *
 *   npm run eval:judge:sheets -- [--env sandbox-ulrich] [--out output/eval-judge/fiches_sandbox.json]
 *
 * Reads `character_prompts` only (the Lovable Cloud copy, never Notion) and
 * writes nothing to the database. Use it after a `fields_only` resync to
 * compare with the versioned test copy (`src/agents/__fixtures__/`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, log, openEvalSession, readArgs } from "./session";

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const session = await openEvalSession(args.get("env") ?? "sandbox-ulrich");
  const { loadCharacterPromptByName } = await import("@/services/characterPromptService");
  const characters: Record<string, unknown> = {};
  for (const key of ["max", "emma"] as const) {
    const sheet = await loadCharacterPromptByName(key === "max" ? "Max" : "Emma");
    if (!sheet) fail(`Fiche ${key} introuvable dans ${session.environment}`);
    characters[key] = sheet;
    log(`• ${sheet.name} · mise à jour ${sheet.updated_at}`);
  }
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
