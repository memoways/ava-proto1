/**
 * Shared bootstrap of the small headless judge scripts (sheet snapshot,
 * calibration): in-memory storage, read-only `admin_settings`, admin sign-in on
 * a sandbox. Same rules as `run.ts` (lot J2); production is always refused.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createMemoryStorage, guardAdminSettingsWrites } from "@/services/evalJudgeNodeRuntime";
import type { EnvironmentId } from "@/services/environmentContext";

// Must run before any app module creates the Supabase client.
Object.assign(globalThis, { localStorage: createMemoryStorage(), sessionStorage: createMemoryStorage() });
const settingsGuard = guardAdminSettingsWrites(globalThis.fetch.bind(globalThis));
for (const level of ["log", "info", "debug"] as const) console[level] = (...args: unknown[]) => console.error(...args);
globalThis.fetch = settingsGuard.fetch;

export function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function fail(message: string, code = 1): never {
  log(`✖ ${message}`);
  process.exit(code);
}

function loadLocalEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

/** `--key value` / `--key=value` / bare `--flag`. */
export function readArgs(argv: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--") || arg === "--") continue;
    const eq = arg.indexOf("=");
    if (eq > 0) out.set(arg.slice(2, eq), arg.slice(eq + 1));
    else if (argv[index + 1] !== undefined && !argv[index + 1].startsWith("--")) out.set(arg.slice(2), argv[++index]);
    else out.set(arg.slice(2), "true");
  }
  return out;
}

export async function openEvalSession(requested: string) {
  if (requested === "prod") fail("Le juge sans navigateur ne tourne jamais sur prod.");
  loadLocalEnvFile(path.resolve(process.cwd(), ".env.eval.local"));
  try {
    const commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
    loadLocalEnvFile(path.resolve(commonDir, "..", ".env.eval.local"));
  } catch {
    // Not a git checkout: environment variables only.
  }
  const email = process.env.AVA_EVAL_EMAIL?.trim();
  const password = process.env.AVA_EVAL_PASSWORD;
  if (!email || !password) fail("AVA_EVAL_EMAIL et AVA_EVAL_PASSWORD manquent (environnement ou .env.eval.local).");
  const [{ supabase }, env, settings, { resolveHeadlessEnvironment }] = await Promise.all([
    import("@/integrations/supabase/client"),
    import("@/services/environmentContext"),
    import("@/services/settingsService"),
    import("@/services/evalJudgeHeadless"),
  ]);
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !auth.user) fail(`Connexion Lovable Cloud refusée : ${error?.message ?? "pas d'utilisateur"}`);
  const profile = await env.getAdminUserProfile(auth.user);
  if (!profile) fail("Ce compte n'est pas administrateur Ava (admin_users).");
  const resolved = resolveHeadlessEnvironment(profile, requested as EnvironmentId);
  if (resolved.error || !resolved.environment) fail(resolved.error ?? "Environnement introuvable");
  if (resolved.note) log(`ℹ ${resolved.note}`);
  env.configureRuntimeContext({ profile, requestedEnvironment: resolved.environment });
  await settings.hydrateAllSettings({ readOnly: true });
  log(`✓ Connecté (${profile.display_name}) · environnement ${resolved.environment}`);
  return {
    supabase,
    environment: resolved.environment,
    blockedSettingsWrites: settingsGuard.blocked,
    close: () => supabase.auth.signOut({ scope: "local" }),
  };
}
