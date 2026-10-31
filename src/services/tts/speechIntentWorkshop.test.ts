import { describe, expect, it } from 'vitest';
import {
 INTENT_PASSAGES, INTENT_PROVIDERS, WORKSHOP_INTENTS, exportIntentResults, intentPerformance, intentResults, providerPlan, recipeWords, resolveCardVoice,
 type ProviderBaseSettings,
} from './speechIntentWorkshop';

const base: ProviderBaseSettings = {
 gradium: { temp: 0.7, paddingBonus: 0.2, cfgCoef: 2 }, fish: { speed: 1, emotionTags: true, defaultEmotion: '', model: 's1' },
 elevenlabs: { style: 0.18, stability: 0.5, speed: 1 }, inworld: { deliveryMode: 'BALANCED', speakingRate: 1, modelId: 'inworld-tts-2' }, cartesia: { language: 'fr', modelId: 'sonic-3.5' },
};
const value = (provider: (typeof INTENT_PROVIDERS)[number], id: string, label: string) => providerPlan(provider, WORKSHOP_INTENTS.find(i => i.id === id)!, base).parameters.find(p => p.label === label)?.value;

describe('AP4 — validated catalogue', () => {
 it('keeps the three passages (AP4-quater: spoken, broken, with real repetitions and hesitations)', () => {
  expect(INTENT_PASSAGES.map(p => p.id)).toEqual(['P1', 'P2', 'P3']);
  for (const passage of INTENT_PASSAGES) {
   const sentences = passage.text.split(/[.!?](?:\s|$)/).filter(s => s.trim());
   expect(sentences.length).toBeGreaterThanOrEqual(6); expect(sentences.length).toBeLessThanOrEqual(16);
   expect(passage.text).toMatch(/…/); expect(passage.situation.length).toBeGreaterThan(20);
  }
  expect(INTENT_PASSAGES[1].text).toMatch(/^Il y a deux jours, à l’hôtel/);
 });
 it('plans the ElevenLabs card on the expressive v4 model (AP4-ter)', () => {
  expect(providerPlan('elevenlabs', WORKSHOP_INTENTS.find(i => i.id === 'confidence')!, base).model).toBe('eleven_v4_turbo');
 });
 it('defines ten intents with plain labels, explanations and bounded neutral recipes', () => {
  expect(WORKSHOP_INTENTS.map(i => i.label)).toEqual(['Posé', 'Détaché', 'Moyennement dramatique', 'Très dramatique', 'Essoufflé / pressé', 'Peur', 'Perdu, ne sait plus quoi dire', 'Colère contenue', 'Espoir qui revient', 'Confidence à voix basse']);
  for (const intent of WORKSHOP_INTENTS) {
   expect(intent.explanation).toMatch(/\.$/); expect(intent.recipe.actingNl.length).toBeLessThanOrEqual(100);
   expect(intent.recipe.speedHint).toBeGreaterThanOrEqual(0.7); expect(intent.recipe.speedHint).toBeLessThanOrEqual(1.2);
   expect(intentPerformance(intent)).toMatchObject({ source: 'manual', emotion: intent.recipe.emotion });
  }
  expect(recipeWords(WORKSHOP_INTENTS[9].recipe)).toBe('triste, à voix basse, plus lent (×0.96), pauses longues');
 });
});

describe('AP4 — intent → native parameters for each adapter', () => {
 it('stays within each provider’s bounds and always declares ignored levers', () => {
  for (const intent of WORKSHOP_INTENTS) for (const provider of INTENT_PROVIDERS) {
   const plan = providerPlan(provider, intent, base);
   expect(plan.parameters.length).toBeGreaterThan(0); expect(plan.ignored.length).toBeGreaterThan(0);
   expect(plan.ignored.some(item => item.startsWith('Pauses de la recette'))).toBe(true);
  }
  for (const intent of WORKSHOP_INTENTS) {
   expect(Number(value('gradium', intent.id, 'Variabilité (temp)'))).toBeLessThanOrEqual(0.85);
   expect(Math.abs(Number(value('gradium', intent.id, 'Rythme global (padding_bonus)')))).toBeLessThanOrEqual(4);
   for (const label of ['Style', 'Stabilité']) { const v = Number(value('elevenlabs', intent.id, label)); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
   const cartesia = Number(value('cartesia', intent.id, 'Vitesse')); expect(cartesia).toBeGreaterThanOrEqual(0.6); expect(cartesia).toBeLessThanOrEqual(1.5);
  }
 });
 it('keeps intents distinct where the provider allows it, and says where it cannot', () => {
  const signature = (provider: (typeof INTENT_PROVIDERS)[number]) => new Set(WORKSHOP_INTENTS.map(i => JSON.stringify(providerPlan(provider, i, base).parameters)));
  expect(signature('inworld').size).toBe(10);
  expect(signature('elevenlabs').size).toBe(10);
  expect(signature('fish').size).toBe(10);
  expect(signature('gradium').size).toBeLessThan(10);
  expect(value('gradium', 'pose', 'Variabilité (temp)')).toBe(value('gradium', 'perdu', 'Variabilité (temp)'));
  const gradium = providerPlan('gradium', WORKSHOP_INTENTS[0], base);
  expect(gradium.ignored).toContain('Émotion (Gradium n’a aucun réglage d’émotion)');
  expect(gradium.ignored.some(item => item.startsWith('Fidélité à la voix (cfg_coef)'))).toBe(true);
  expect(gradium.parameters.map(p => p.label)).toEqual(['Variabilité (temp)', 'Rythme global (padding_bonus)']);
  expect(gradium.note).toMatch(/aucune|ne joue pas d’émotion/);
  expect(value('fish', 'moyen_dramatique', 'Marqueur d’émotion')).toBe(value('fish', 'tres_dramatique', 'Marqueur d’émotion'));
  expect(providerPlan('fish', WORKSHOP_INTENTS[0], base).ignored[0]).toMatch(/aucun marqueur/);
  expect(value('fish', 'confidence', 'Marqueur d’émotion')).toBe('(sad) (whispering)');
  expect(value('elevenlabs', 'confidence', 'Balise d’émotion')).toBe('[sad][whispers]');
  expect(providerPlan('cartesia', WORKSHOP_INTENTS[7], base).ignored[0]).toMatch(/seulement en anglais/);
  expect(value('cartesia', 'colere_contenue', 'Volume')).toBe(1.15);
  expect(providerPlan('cartesia', WORKSHOP_INTENTS[7], { ...base, cartesia: { language: 'en' } }).parameters).toContainEqual({ label: 'Émotion', value: 'angry' });
  expect(value('inworld', 'tres_dramatique', 'Mode')).toBe('CREATIVE');
 });
});

describe('AP4 — voices and human results', () => {
 it('prefers the TTS configuration voice, then Max’s game voice, and never hides a default or missing voice', () => {
  const game = { provider: 'gradium' as const, voice: 'max-gradium' };
  expect(resolveCardVoice('gradium', game, undefined, 'default')).toMatchObject({ voice: 'max-gradium', source: 'game' });
  expect(resolveCardVoice('gradium', game, 'max-gradium-v2', 'default')).toMatchObject({ voice: 'max-gradium-v2', source: 'catalogue' });
  expect(resolveCardVoice('fish', game, undefined, 'fish-ref')).toMatchObject({ source: 'provider_default', label: expect.stringContaining('pas la voix de Max') });
  expect(resolveCardVoice('fish', game, ' max-fish ', 'fish-ref')).toMatchObject({ voice: 'max-fish', source: 'catalogue', label: 'Voix de Max (configuration TTS)' });
  expect(resolveCardVoice('cartesia', game, '', '')).toMatchObject({ voice: null, source: null, label: expect.stringMatching(/^Indisponible/) });
  expect(resolveCardVoice('elevenlabs', game, undefined, null)).toMatchObject({ voice: null, source: 'provider_default' });
 });
 it('averages ratings per intent and provider, ignoring unrated cards, and exports them', () => {
  const trials = [
   { intent: { id: 'peur' }, cards: [{ provider: 'fish' as const, rating: 4 }, { provider: 'gradium' as const, rating: null }] },
   { intent: { id: 'peur' }, cards: [{ provider: 'fish' as const, rating: 2 }, { provider: 'gradium' as const, rating: 1 }] },
  ];
  expect(intentResults(trials)).toEqual({ peur: { fish: { mean: 3, count: 2 }, gradium: { mean: 1, count: 1 } } });
  expect(exportIntentResults(trials, 'csv').split('\n')).toEqual(['Intention;Gradium;Fish Audio;ElevenLabs;Inworld;Cartesia', 'Peur;1 (1);3 (2);;;']);
  expect(JSON.parse(exportIntentResults(trials, 'json')).rows[0]).toMatchObject({ intent: 'Peur', fish: { mean: 3, count: 2 }, inworld: null });
 });
});

import { performedText } from './speechIntentWorkshop';
describe('AP4-quater — workshop delivery text', () => {
 const lost = WORKSHOP_INTENTS.find(i => i.id === 'perdu')!;
 const rushed = WORKSHOP_INTENTS.find(i => i.id === 'essouffle')!;
 const calm = WORKSHOP_INTENTS.find(i => i.id === 'detache')!;
 it('breaks the rhythm for long-pause intents, deterministically', () => {
  const out = performedText(lost, 'Je ne sais pas, je crois que tout est fini. Elle est partie hier soir sans rien dire à personne.');
  expect(out).toContain('Je… je ne sais pas… je crois');
  expect(out).toBe(performedText(lost, 'Je ne sais pas, je crois que tout est fini. Elle est partie hier soir sans rien dire à personne.'));
 });
 it('removes commas for short pauses and leaves other intents untouched', () => {
  expect(performedText(rushed, 'Vite, vite, viens.')).toBe('Vite vite viens.');
  expect(performedText(calm, ' Bonjour, ça va. ')).toBe('Bonjour, ça va.');
 });
});
