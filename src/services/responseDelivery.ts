import type { ConversationMessage, RuntimeCharacter } from '@/types';
import { normalizeResponseIntent, type ResponseIntent } from './responseIntentStream';

export interface ResponseDeliveryReceipt {
  turnId: string;
  turnIndex: number;
  character: RuntimeCharacter;
  intent: ResponseIntent | null;
  generated: string;
  delivered: string;
  uncertain: string;
  privateContinuation: string;
  status: 'completed' | 'interrupted' | 'failed' | 'cancelled' | 'unknown';
  scheduledSamples: number | null;
  playedSamples: number | null;
  sampleRate: number | null;
}
export type DeliveryByCharacter = Partial<Record<RuntimeCharacter, ResponseDeliveryReceipt[]>>;
export function normalizeDeliveries(raw: unknown): DeliveryByCharacter {
  const result: DeliveryByCharacter = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const character of ['max', 'emma'] as const) {
    const entries = (raw as Record<string, unknown>)[character];
    if (!Array.isArray(entries)) continue;
    result[character] = entries.slice(-16).flatMap(entry => {
      if (!entry || typeof entry !== 'object') return [];
      const r = entry as ResponseDeliveryReceipt;
      if (r.character !== character || typeof r.turnId !== 'string' || !r.turnId || r.turnId.length > 160
        || !Number.isInteger(r.turnIndex) || r.turnIndex < 1 || typeof r.generated !== 'string' || r.generated.length > 12000) return [];
      const delivered = typeof r.delivered === 'string' && r.generated.startsWith(r.delivered) ? r.delivered : '';
      const uncertain = typeof r.uncertain === 'string' && r.generated.slice(delivered.length).startsWith(r.uncertain) ? r.uncertain : '';
      const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
      return [{ ...r, intent: normalizeResponseIntent(r.intent), delivered, uncertain,
        privateContinuation: r.generated.slice(delivered.length + uncertain.length),
        status: ['completed','interrupted','failed','cancelled','unknown'].includes(r.status) ? r.status : 'unknown' as const,
        scheduledSamples: number(r.scheduledSamples), playedSamples: number(r.playedSamples), sampleRate: number(r.sampleRate) }];
    });
  }
  return result;
}
export function projectDeliveredConversation(history: ConversationMessage[]): ConversationMessage[] {
  return history.flatMap(m => m.role === 'user' || !m.delivery ? [m]
    : m.delivery.delivered.trim() ? [{ ...m, content: m.delivery.delivered }] : []);
}
export function formatPrivateDeliveryContext(receipts: ResponseDeliveryReceipt[] = []): string {
  return receipts.slice(-2).map(r => {
    if (r.status === 'completed') return '';
    return `Tour ${r.turnIndex} : livraison ${r.status}. Préfixe entendu : ${r.delivered || '(aucun confirmé)'}. Portion incertaine (ne pas affirmer entendue) : ${r.uncertain.slice(0, 400)}. Intention privée à reprendre si pertinente : ${JSON.stringify(r.intent)}. Continuation effectivement générée mais privée : ${r.privateContinuation.slice(0, 600)}. Ne jamais traiter ces éléments privés comme une confidence, un engagement ou un accord déjà partagé.`;
  }).filter(Boolean).join('\n');
}
