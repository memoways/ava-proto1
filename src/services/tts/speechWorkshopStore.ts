import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { getActiveEnvironment, type EnvironmentId } from '../environmentContext';
import { auditionKey, type AuditionEvidence, type AuditionLine } from './speechAudition';
import type { SpeechAuditionSnapshot } from './speechPerformanceSettings';

// Deliberately outside ava_*: invitation/runtime read policies cannot expose these documents.
export const WORKSHOP_KEY = 'speech_workshop_documents';
const short = z.string().max(500);
const mapping = z.object({ emotion: short, delivery: short, speed: z.number().min(0.7).max(1.2), pauses: z.enum(['short', 'normal', 'long']), instruction: z.string().max(70) });
const tuning = z.object({ temp: z.number(), cfgCoef: z.number(), paddingBonus: z.number(), rewriteRules: short, pronunciationId: short });
const snapshotSchema = z.object({
 kind: z.literal('speech_audition'), environment: short, character: short, validStates: z.array(short).max(50),
 settings: z.object({ enabled: z.boolean(), version: short, gradiumTagsEnabled: z.literal(false), gradiumPausesEnabled: z.boolean().optional(), byCharacter: z.record(z.record(mapping)) }),
 gradium: tuning.extend({ voiceId: short, outputFormat: short, streamingEnabled: z.boolean(), streamingFormat: short, byCharacter: z.record(tuning.partial()), settingsVersion: z.number().optional() }),
}) as unknown as z.ZodType<SpeechAuditionSnapshot>;
const scalar = z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()]);
const evidenceSchema = z.object({
 variant: z.enum(['A', 'B']), kind: z.enum(['provider_request', 'simulation', 'unattested']),
 requestedTransport: z.enum(['rest', 'websocket']).optional(), transport: z.enum(['rest', 'websocket', 'rest_fallback']),
 model: short.optional(), cached: z.boolean(), providerCalls: z.number().int().min(0),
 firstByteMs: z.number().optional(), firstSoundMs: z.number().optional(), totalMs: z.number().optional(), durationMs: z.number().optional(),
 pauseRendering: short.optional(), auditionCapture: short.optional(),
 requests: z.array(z.object({ transport: z.enum(['rest', 'websocket']), parameters: z.record(z.union([scalar, z.record(scalar)])) })).max(10),
});
export const comparisonSchema = z.object({
 id: short.min(1), name: z.string().trim().min(1).max(100), hypothesis: z.string().trim().min(1).max(500),
 environment: short, createdAt: short, updatedAt: short,
 character: short, provider: z.enum(['gradium', 'fish', 'inworld', 'elevenlabs', 'cartesia']), voice: short.min(1), level: z.number().int().min(0).max(3),
 line: z.object({ id: short, text: z.string().trim().min(1).max(500), context: short, state: short.min(1) }),
 a: snapshotSchema, b: snapshotSchema,
 control: z.enum(['paddingBonus', 'temp', 'cfgCoef', 'pauses', 'speed', 'emotion', 'delivery', 'instruction']), diff: short,
 transport: z.enum(['rest', 'websocket']), bufferPreset: z.enum(['current', '160', '240']).optional(),
 references: z.record(z.string().max(8000)), evidence: z.array(evidenceSchema).max(2),
 notes: z.object({ words: short, rhythm: short, timbre: short, artifacts: short }),
 decision: z.enum(['relisten', 'preferred', 'rejected']), cost: z.null(),
});
export type WorkshopComparison = z.infer<typeof comparisonSchema> & {
 line: AuditionLine; notes: Record<'words' | 'rhythm' | 'timbre' | 'artifacts', string>;
};
export interface WorkshopDocument { schemaVersion: 1; environment: string; version: string; comparisons: WorkshopComparison[]; [key: string]: unknown }
const documentSchema = z.object({ schemaVersion: z.literal(1), environment: short, version: short.min(1), comparisons: z.array(comparisonSchema.passthrough()).max(100) }).passthrough();
export type WorkshopFailure = 'context' | 'forbidden' | 'unavailable' | 'schema' | 'conflict' | 'readback';
export class WorkshopError extends Error { constructor(public code: WorkshopFailure, message: string) { super(message); } }
function assertEnvironment(environment: EnvironmentId) {
 if (environment === 'prod' || getActiveEnvironment() !== environment) throw new WorkshopError('context', 'Atelier réservé à la même sandbox ; recharger après un changement d’environnement.');
}
async function authorize(environment: EnvironmentId) {
 assertEnvironment(environment);
 const { data, error } = await supabase.auth.getUser();
 if (error || !data.user || data.user.is_anonymous) throw new WorkshopError('forbidden', 'Connexion administrateur requise.');
 const member = await supabase.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle();
 assertEnvironment(environment);
 if (member.error || !member.data) throw new WorkshopError('forbidden', 'Accès administrateur indisponible ou refusé.');
}
function validateDocument(value: unknown, environment: EnvironmentId): WorkshopDocument {
 const parsed = documentSchema.safeParse(value);
 if (!parsed.success) throw new WorkshopError('schema', 'Format d’atelier inconnu ou invalide ; aucune écriture autorisée.');
 if (parsed.data.environment !== environment || parsed.data.comparisons.some(c => c.environment !== environment || c.a.environment !== environment || c.b.environment !== environment))
  throw new WorkshopError('context', 'Document provenant d’un autre environnement.');
 // Keep validated extensions byte-for-byte in the CAS baseline and other entries.
 return structuredClone(value) as WorkshopDocument;
}
async function readDocument(environment: EnvironmentId): Promise<WorkshopDocument | null> {
 assertEnvironment(environment);
 const { data, error } = await supabase.from('admin_settings').select('value').eq('key', WORKSHOP_KEY).eq('environment_id', environment).maybeSingle();
 assertEnvironment(environment);
 if (error) throw new WorkshopError('unavailable', 'Lecture de l’atelier indisponible. Vos changements restent en brouillon.');
 return data ? validateDocument(data.value, environment) : null;
}
export async function readWorkshop(environment: EnvironmentId) { await authorize(environment); return readDocument(environment); }
function mergeExtensions(before: unknown, after: unknown): unknown {
 if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) return after;
 const merged = { ...before } as Record<string, unknown>;
 for (const [key, value] of Object.entries(after)) merged[key] = mergeExtensions(merged[key], value);
 return merged;
}
/** Add/update one document only; concurrent editors must explicitly reload before retrying. */
export async function saveWorkshopComparison(value: WorkshopComparison, baseline: WorkshopDocument | null, environment: EnvironmentId) {
 await authorize(environment);
 const comparison = comparisonSchema.parse(value);
 if (comparison.environment !== environment || comparison.a.environment !== environment || comparison.b.environment !== environment)
  throw new WorkshopError('context', 'Variante provenant d’un autre environnement.');
 if (comparison.a.character !== comparison.character || comparison.b.character !== comparison.character || !comparison.a.validStates.includes(comparison.line.state) || !comparison.b.validStates.includes(comparison.line.state))
  throw new WorkshopError('context', 'Personnage ou état incompatible avec la comparaison.');
 // Enforce one change, even for callers other than the workshop UI.
 const expectedB = structuredClone(comparison.a);
 if (comparison.control === 'pauses') expectedB.settings.gradiumPausesEnabled = true;
 else if (['speed', 'emotion', 'delivery', 'instruction'].includes(comparison.control)) {
  const target = comparison.b.settings.byCharacter[comparison.character]?.[comparison.line.state];
  const source = expectedB.settings.byCharacter[comparison.character]?.[comparison.line.state];
  if (!source || !target) throw new WorkshopError('schema', 'Mapping de l’état absent pour cet essai.');
  Object.assign(source, { [comparison.control]: target[comparison.control as keyof typeof target] });
 } else { const key = comparison.control as 'temp' | 'cfgCoef' | 'paddingBonus'; expectedB.gradium[key] = comparison.b.gradium[key]; }
 if (auditionKey(comparison.a) === auditionKey(comparison.b) || auditionKey(expectedB) !== auditionKey(comparison.b)) throw new WorkshopError('schema', 'Une seule différence est autorisée entre les deux versions.');
 const current = await readDocument(environment);
 if (auditionKey(current) !== auditionKey(baseline)) throw new WorkshopError('conflict', 'Comparaisons modifiées ailleurs. Rechargez les variantes avant de réenregistrer votre brouillon.');
 const previous = current?.comparisons.find(c => c.id === comparison.id);
 const next: WorkshopDocument = { ...current, schemaVersion: 1, environment, version: crypto.randomUUID(), comparisons: [
  { ...(mergeExtensions(previous, comparison) as WorkshopComparison), createdAt: previous?.createdAt ?? comparison.createdAt } as WorkshopComparison,
  ...(current?.comparisons ?? []).filter(c => c.id !== comparison.id),
 ] };
 documentSchema.parse(next);
 assertEnvironment(environment);
 const row = { key: WORKSHOP_KEY, environment_id: environment, value: JSON.parse(JSON.stringify(next)), updated_at: new Date().toISOString() };
 const query = supabase.from('admin_settings');
 const result = current
  ? await query.update({ value: row.value, updated_at: row.updated_at }).eq('key', WORKSHOP_KEY).eq('environment_id', environment).eq('value', JSON.stringify(current)).select('key')
  : await query.insert(row).select('key');
 assertEnvironment(environment);
 if (result.error) {
  if (result.error.code === '23505') throw new WorkshopError('conflict', 'Un autre administrateur a créé l’atelier. Rechargez avant de réessayer.');
  throw new WorkshopError('unavailable', 'Écriture indisponible ; sauvegarde non confirmée.');
 }
 if (!result.data || result.data.length !== 1) throw new WorkshopError('conflict', 'Modification concurrente : écriture refusée.');
 let confirmed: WorkshopDocument | null;
 try { confirmed = await readDocument(environment); }
 catch (error) { if (error instanceof WorkshopError && error.code === 'context') throw error; throw new WorkshopError('readback', 'Écriture envoyée, mais relecture impossible. Rechargez pour vérifier avant de réessayer.'); }
 if (auditionKey(confirmed) !== auditionKey(next)) throw new WorkshopError('readback', 'Relecture différente : sauvegarde non confirmée. Rechargez les variantes.');
 return confirmed!;
}
// Persist only parameter evidence, never arbitrary provider request bodies, text traces or credentials.
const PARAMETER_KEYS = ['model', 'model_id', 'modelId', 'model_name', 'voice_id', 'voiceId', 'referenceId', 'format', 'output_format', 'outputFormat', 'speed', 'volume', 'temperature', 'topP', 'latency', 'normalize', 'chunkLength', 'mp3Bitrate'];
const CONFIG_KEYS = ['temp', 'cfg_coef', 'padding_bonus', 'rewrite_rules', 'pronunciation_id'];
export function workshopEvidence(evidence: AuditionEvidence, variant: 'A' | 'B', simulated = false): WorkshopComparison['evidence'][number] {
 return evidenceSchema.parse({ ...evidence, variant, kind: simulated ? 'simulation' : evidence.requests.length ? 'provider_request' : 'unattested', requests: evidence.requests.map(request => ({
  transport: request.transport, parameters: {
   ...Object.fromEntries(PARAMETER_KEYS.filter(key => scalar.safeParse(request.body[key]).success).map(key => [key, request.body[key]])),
   ...Object.fromEntries(['json_config', 'jsonConfig'].filter(key => request.body[key] && typeof request.body[key] === 'object').map(key => [key, Object.fromEntries(CONFIG_KEYS.filter(k => scalar.safeParse((request.body[key] as Record<string, unknown>)[k]).success).map(k => [k, (request.body[key] as Record<string, unknown>)[k]]))])),
  },
 })) });
}
export function exportWorkshop(comparison: WorkshopComparison, format: 'json' | 'text') {
 const c = comparisonSchema.parse(comparison);
 if (format === 'json') return JSON.stringify({ ...c, audio: 'Non conservé. Une nouvelle écoute régénère un son différent.', humanOpinion: true }, null, 2);
 return [`Comparaison : ${c.name}`, `Sandbox : ${c.environment}`, `Hypothèse : ${c.hypothesis}`, `${c.character} · ${c.line.id} · état ${c.line.state} · voix ${c.voice}`, c.line.text, `Différence : ${c.diff}`, `Transport demandé : ${c.transport}`, `Décision humaine : ${c.decision}`, ...Object.entries(c.notes).map(([key, value]) => `${key} : ${value || 'non renseigné'}`), `Écoutes : ${c.evidence.map(e => `${e.variant} · ${e.kind} · ${e.transport} · ${e.providerCalls} appel(s)`).join('; ') || 'aucune preuve d’écoute'}`, 'Coût : inconnu. Audio non conservé ; réécouter régénère un son différent. Aucune application au jeu.'].join('\n');
}
