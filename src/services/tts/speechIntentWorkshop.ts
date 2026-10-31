import {
 applyCartesiaGenerationConfig, applyElevenLabsPerformance, applyFishPerformance, applyGradiumPerformance, applyInworldPerformance, expressiveTemperature,
 type CanonicalEmotion, type PerformanceDelivery, type PerformanceIntent,
} from './performanceIntent';
import { ELEVENLABS_EXPRESSIVE_MODEL } from '../../../supabase/functions/_shared/elevenLabsModels';
import type { TTSProviderId } from './types';

/**
 * AP4 workshop catalogue: passages and acting intents validated by Ulrich on
 * 30 October 2026 (docs/plan_lot_b_rendu_vocal.md, AP4 étape 0). Workshop only:
 * nothing here is injected into the game prompt, the game mapping or Notion.
 */
export interface IntentPassage { id: 'P1' | 'P2' | 'P3'; title: string; situation: string; text: string }
export const INTENT_PASSAGES: IntentPassage[] = [
 { id: 'P1', title: 'Le présent, l’appartement', situation: 'Premier échange. Le bénévole de la cellule vient de se présenter et demande comment ça se passe à la maison depuis hier.',
  text: 'Emma est dans la cuisine depuis ce matin, Léo et Ava sont chacun dans leur chambre, et moi je suis là dans le salon à regarder ce téléphone comme si quelqu’un allait enfin nous dire ce qu’on doit faire maintenant. La police nous a dit hier qu’une cellule allait nous appeler, alors j’attendais sans trop savoir ce que j’attendais, et on reste chacun de son côté dans le même appartement sans arriver à se dire un mot. Bon, c’est vous qui appelez, c’est déjà ça.' },
 { id: 'P2', title: 'Le souvenir J−2, l’hôtel', situation: 'Le bénévole connaît les grandes lignes de la déposition. Il demande ce qui s’est passé à l’hôtel, il y a deux jours, avec Anne.',
  text: 'Il y a deux jours, à l’hôtel, j’avais ce canon contre la tempe et je regardais mon fusil par terre en me demandant si j’aurais le temps, pendant que le type roux expliquait tranquillement à Anne qu’il fallait faire confiance à la nature. Et puis Anne lui a mis un coup de poêle, l’autre a tourné son arme vers elle, je l’ai poussé, j’ai repris le fusil et j’ai tiré en pleine poitrine, et c’est seulement après que j’ai vu que mes mains tremblaient. Derrière une porte il y avait Peter, vivant, attaché, et moi je restais là sans comprendre qui était l’homme que j’avais laissé sous l’abri.' },
 { id: 'P3', title: 'Emma, aujourd’hui', situation: 'Plus tard dans l’appel, la confiance s’est installée. Le bénévole demande doucement comment ça va entre Emma et lui.',
  text: 'Elle est dans la cuisine, je suis dans le salon, il y a dix mètres entre nous et on ne se parle plus depuis qu’on est rentrés, parce que la dernière chose qu’elle a vue de moi là-haut, c’est le fusil pointé sur elle et puis sur Ava. Je dis que ça ne changera rien, que je l’aimerai pareil, je peux même le dire fort, mais quand je la regarde par la porte, avec sa voix, ses gestes, tout ce qui est encore là, j’attends, et j’sais pas ce que j’attends.' },
];

export type IntentRecipe = Omit<PerformanceIntent, 'source' | 'speechState' | 'mappingVersion'> & { speedHint: number; pauses: 'short' | 'normal' | 'long' };
export interface WorkshopIntent { id: string; label: string; explanation: string; recipe: IntentRecipe }
export const WORKSHOP_INTENTS: WorkshopIntent[] = [
 { id: 'pose', label: 'Posé', explanation: 'Il parle calmement, en pesant ses mots.', recipe: { emotion: 'neutral', intensity: 1, delivery: 'measured', speedHint: 0.97, pauses: 'normal', actingNl: 'calm, measured, steady low voice' } },
 { id: 'detache', label: 'Détaché', explanation: 'Il raconte comme si ça ne le concernait pas.', recipe: { emotion: 'neutral', intensity: 0, speedHint: 1, pauses: 'normal', actingNl: 'detached, flat, emotionally distant' } },
 { id: 'moyen_dramatique', label: 'Moyennement dramatique', explanation: 'L’émotion est là, mais il la tient.', recipe: { emotion: 'sad', intensity: 1, delivery: 'measured', speedHint: 1, pauses: 'normal', actingNl: 'sad, heavy, holding back emotion' } },
 { id: 'tres_dramatique', label: 'Très dramatique', explanation: 'La digue cède : la voix se casse.', recipe: { emotion: 'sad', intensity: 2, delivery: 'measured', speedHint: 1, pauses: 'long', actingNl: 'very sad, voice breaking, sobbing, halting, sudden rhythm changes, not reading' } },
 { id: 'essouffle', label: 'Essoufflé / pressé', explanation: 'Il parle vite, sans reprendre son souffle.', recipe: { emotion: 'urgent', intensity: 1, delivery: 'rushed', speedHint: 1.12, pauses: 'short', actingNl: 'breathless, rushed, urgent' } },
 { id: 'peur', label: 'Peur', explanation: 'La peur accélère et fait trembler la voix.', recipe: { emotion: 'scared', intensity: 2, delivery: 'rushed', speedHint: 1.08, pauses: 'short', actingNl: 'very frightened, anxious, shaky voice' } },
 { id: 'perdu', label: 'Perdu, ne sait plus quoi dire', explanation: 'Il cherche ses mots et s’arrête.', recipe: { emotion: 'fragile', intensity: 1, delivery: 'measured', speedHint: 1, pauses: 'long', actingNl: 'lost, hesitant, stammering, searching for words, broken rhythm' } },
 { id: 'colere_contenue', label: 'Colère contenue', explanation: 'Il est en colère, sans crier.', recipe: { emotion: 'angry', intensity: 1, delivery: 'cutting', speedHint: 0.98, pauses: 'normal', actingNl: 'contained anger, low clipped voice, not shouting' } },
 { id: 'espoir', label: 'Espoir qui revient', explanation: 'Une piste le relance, avec prudence.', recipe: { emotion: 'warm', intensity: 1, speedHint: 1.04, pauses: 'normal', actingNl: 'hope returning, a little faster, cautious' } },
 { id: 'confidence', label: 'Confidence à voix basse', explanation: 'Il dit à voix basse ce qu’il n’a dit à personne.', recipe: { emotion: 'sad', intensity: 1, delivery: 'whisper', speedHint: 0.96, pauses: 'long', actingNl: 'confiding, hushed, close and quiet' } },
];
export const INTENT_PROVIDERS: TTSProviderId[] = ['gradium', 'fish', 'elevenlabs', 'inworld', 'cartesia'];
export const PROVIDER_LABELS: Record<TTSProviderId, string> = { gradium: 'Gradium', fish: 'Fish Audio', elevenlabs: 'ElevenLabs', inworld: 'Inworld', cartesia: 'Cartesia' };

export function workshopIntent(id: string): WorkshopIntent {
 const intent = WORKSHOP_INTENTS.find(item => item.id === id);
 if (!intent) throw new Error('Intention inconnue');
 return intent;
}
/** The one neutral intent sent unchanged to every provider card. */
export function intentPerformance(intent: WorkshopIntent): PerformanceIntent {
 return { ...structuredClone(intent.recipe), source: 'manual' };
}

/**
 * Workshop-only delivery text: the voice is judged "too read", so broken rhythm is written into the text
 * (ellipses, a stammered first word, a mid-sentence stop). Deterministic; never used by the game, the GM prompt
 * or Notion files. Intents with short pauses lose their commas so the line runs on.
 */
export function performedText(intent: WorkshopIntent, text: string): string {
 const { pauses, intensity } = intent.recipe;
 const source = text.trim();
 if (pauses === 'short') return source.replace(/,\s+/g, ' ');
 if (pauses !== 'long' || intensity < 1) return source;
 return source.split(/(?<=[.!?])\s+/).map((sentence, index) => {
  let out = sentence.replace(/,\s+/g, '… ');
  const words = out.split(/\s+/);
  const first = words[0] ?? '';
  if (index % 2 === 0 && words.length >= 5 && /^[A-Za-zÀ-ÿ]{1,4}$/.test(first)) out = `${first}… ${first.toLowerCase()} ${words.slice(1).join(' ')}`;
  else if (intensity === 2 && words.length > 8 && !out.includes('…')) out = `${words.slice(0, 4).join(' ')}… ${words.slice(4).join(' ')}`;
  return out;
 }).join(' ');
}

const EMOTION_WORDS: Record<CanonicalEmotion, string> = {
 neutral: 'sans émotion marquée', tense: 'tendu', angry: 'en colère', sad: 'triste', scared: 'effrayé', fragile: 'fragile, hésitant',
 warm: 'chaleureux', accusatory: 'accusateur', sarcastic: 'ironique', urgent: 'pressant',
};
const DELIVERY_WORDS: Record<PerformanceDelivery, string> = { measured: 'mesuré', whisper: 'à voix basse', rushed: 'précipité', cutting: 'phrases coupantes' };
/** Same plain-language recipe on every card. */
export function recipeWords(recipe: IntentRecipe): string {
 const emotion = recipe.emotion === 'neutral' ? EMOTION_WORDS.neutral : `${recipe.intensity === 2 ? 'très ' : recipe.intensity === 0 ? 'légèrement ' : ''}${EMOTION_WORDS[recipe.emotion]}`;
 const speed = recipe.speedHint < 0.97 ? `plus lent (×${recipe.speedHint})` : recipe.speedHint > 1.03 ? `plus rapide (×${recipe.speedHint})` : 'débit normal';
 const pauses = { short: 'pauses courtes', normal: 'pauses normales', long: 'pauses longues' }[recipe.pauses];
 return [emotion, recipe.delivery ? DELIVERY_WORDS[recipe.delivery] : '', speed, pauses].filter(Boolean).join(', ');
}

export interface ProviderBaseSettings {
 gradium: { temp: number; paddingBonus: number; cfgCoef: number };
 fish: { speed: number; emotionTags: boolean; defaultEmotion: string; model?: string; temperature?: number };
 elevenlabs: { style: number; stability: number; speed: number };
 inworld: { deliveryMode: 'STABLE' | 'BALANCED' | 'CREATIVE'; speakingRate: number; modelId?: string };
 cartesia: { language: string; modelId?: string };
}
/** The expressive ElevenLabs model is the workshop default (v4, chosen by Ulrich on 30 Oct 2026); the game keeps its own model. */
export const ELEVENLABS_WORKSHOP_MODEL = ELEVENLABS_EXPRESSIVE_MODEL;
export interface ProviderPlan { model?: string; parameters: Array<{ label: string; value: string | number }>; ignored: string[]; note?: string }
const round = (value: number) => Number(value.toFixed(2));
/** Planned native parameters, computed by the same adapters the providers use at request time. */
export function providerPlan(provider: TTSProviderId, intent: WorkshopIntent, base: ProviderBaseSettings): ProviderPlan {
 const performance = intentPerformance(intent);
 const { recipe } = intent;
 const pauses = 'Pauses de la recette';
 if (provider === 'gradium') {
  const tuned = applyGradiumPerformance(base.gradium, performance);
  return { parameters: [{ label: 'Variabilité (temp)', value: round(tuned.temp) }, { label: 'Rythme global (padding_bonus)', value: round(tuned.paddingBonus) }],
   ignored: ['Émotion (Gradium n’a aucun réglage d’émotion)', 'Chuchotement', 'Instruction de jeu', `${pauses} (réservées au mapping d’état du jeu)`, 'Débit exact (seul le rythme global change)', 'Fidélité à la voix (cfg_coef) : dépréciée et ignorée par Gradium'],
   note: 'Gradium ne joue pas d’émotion par réglage : seuls la voix clonée et le texte portent le jeu. Deux intentions proches sonneront pareil.' };
 }
 if (provider === 'fish') {
  const shaped = applyFishPerformance(base.fish, '', performance);
  const ignored = ['Instruction de jeu', pauses, 'Nuance d’intensité (un seul marqueur par émotion)'];
  if (!base.fish.emotionTags) ignored.unshift('Émotion (marqueurs désactivés dans les réglages Fish)');
  else if (recipe.intensity === 0 || recipe.emotion === 'neutral') ignored.unshift('Émotion (aucun marqueur pour cette recette)');
  if (recipe.delivery === 'measured' || recipe.delivery === 'cutting') ignored.push(`Delivery « ${DELIVERY_WORDS[recipe.delivery]} »`);
  return { model: base.fish.model, parameters: [{ label: 'Marqueur d’émotion', value: shaped.tag || 'aucun' }, { label: 'Vitesse', value: round(shaped.speed) }, { label: 'Variabilité (temperature)', value: round(expressiveTemperature(base.fish.temperature ?? 0.7, performance)) }], ignored };
 }
 if (provider === 'elevenlabs') {
  const shaped = applyElevenLabsPerformance({ ...base.elevenlabs, modelId: ELEVENLABS_WORKSHOP_MODEL }, '', performance);
  const ignored = ['Instruction de jeu', pauses];
  if (recipe.delivery && recipe.delivery !== 'whisper') ignored.push(`Delivery « ${DELIVERY_WORDS[recipe.delivery]} » (seul le chuchotement a une balise)`);
  return { model: ELEVENLABS_WORKSHOP_MODEL, parameters: [{ label: 'Balise d’émotion', value: shaped.text.trim() || 'aucune' }, { label: 'Style', value: round(shaped.style) }, { label: 'Stabilité', value: round(shaped.stability) }, { label: 'Vitesse', value: round(shaped.speed) }], ignored };
 }
 if (provider === 'inworld') {
  const patch = applyInworldPerformance(base.inworld, performance);
  return { model: base.inworld.modelId, parameters: [{ label: 'Instruction de jeu', value: patch.instruction ?? '' }, { label: 'Mode', value: patch.deliveryMode ?? base.inworld.deliveryMode }, { label: 'Débit', value: round(patch.speakingRate ?? base.inworld.speakingRate) }],
   ignored: [`${pauses} (sauf si l’instruction les évoque)`, 'Émotion et delivery comme réglages séparés : ils passent seulement par l’instruction'] };
 }
 const config = applyCartesiaGenerationConfig(performance, base.cartesia.language);
 const ignored = ['Instruction de jeu', pauses, 'Intensité'];
 if (!config.emotion) ignored.unshift(`Émotion (appliquée seulement en anglais ; langue ${base.cartesia.language})`);
 if (recipe.delivery && recipe.delivery !== 'whisper') ignored.push(`Delivery « ${DELIVERY_WORDS[recipe.delivery]} »`);
 return { model: base.cartesia.modelId, parameters: [{ label: 'Vitesse', value: round(config.speed) }, { label: 'Volume', value: round(config.volume) }, ...(config.emotion ? [{ label: 'Émotion', value: config.emotion }] : [])], ignored };
}

export type VoiceSource = 'catalogue' | 'game' | 'workshop' | 'provider_default';
export interface CardVoice { voice: string | null; source: VoiceSource | null; label: string }
/** Technique → Configuration TTS first; then Max's game voice; a provider default is never presented as Max. */
export function resolveCardVoice(provider: TTSProviderId, game: { provider: TTSProviderId | null; voice: string | null }, catalogue: string | null | undefined, providerDefault: string | null): CardVoice {
 if (catalogue?.trim()) return { voice: catalogue.trim(), source: 'catalogue', label: 'Voix de Max (configuration TTS)' };
 if (game.provider === provider && game.voice?.trim()) return { voice: game.voice.trim(), source: 'game', label: 'Voix de Max (jeu)' };
 if (provider === 'elevenlabs') return { voice: null, source: 'provider_default', label: 'Voix par défaut du serveur ElevenLabs — pas la voix de Max' };
 if (providerDefault?.trim()) return { voice: providerDefault.trim(), source: 'provider_default', label: 'Voix par défaut du fournisseur — pas la voix de Max' };
 return { voice: null, source: null, label: 'Indisponible : aucune voix configurée pour ce fournisseur' };
}

export interface RatedCard { provider: TTSProviderId; rating: number | null }
export interface IntentResultCell { mean: number; count: number }
/** Intent × provider table of human ratings; never an LLM judgement. */
export function intentResults(trials: Array<{ intent: { id: string }; cards: RatedCard[] }>): Record<string, Partial<Record<TTSProviderId, IntentResultCell>>> {
 const sums: Record<string, Partial<Record<TTSProviderId, { total: number; count: number }>>> = {};
 for (const trial of trials) for (const card of trial.cards) {
  if (card.rating === null) continue;
  const row = sums[trial.intent.id] ??= {};
  const cell = row[card.provider] ??= { total: 0, count: 0 };
  cell.total += card.rating; cell.count++;
 }
 return Object.fromEntries(Object.entries(sums).map(([intent, row]) => [intent, Object.fromEntries(Object.entries(row).map(([provider, cell]) => [provider, { mean: round(cell!.total / cell!.count), count: cell!.count }]))]));
}
export function exportIntentResults(trials: Parameters<typeof intentResults>[0], format: 'csv' | 'json'): string {
 const table = intentResults(trials);
 const rows = WORKSHOP_INTENTS.filter(intent => table[intent.id]).map(intent => ({ intent: intent.label, ...Object.fromEntries(INTENT_PROVIDERS.map(provider => [provider, table[intent.id][provider] ?? null])) }));
 if (format === 'json') return JSON.stringify({ kind: 'avis_humains_intention_fournisseur', note: 'Moyennes de notes humaines de 1 à 5 ; aucune application au jeu.', rows }, null, 2);
 const cell = (value: IntentResultCell | null) => value ? `${value.mean} (${value.count})` : '';
 return [['Intention', ...INTENT_PROVIDERS.map(p => PROVIDER_LABELS[p])].join(';'), ...rows.map(row => [row.intent, ...INTENT_PROVIDERS.map(p => cell(row[p] as IntentResultCell | null))].join(';'))].join('\n');
}
