import type { ConversationMessage, RuntimeCharacter } from '@/types';
import { characterDisplayName, hasSpokenWithCharacter, sliceConversationForCharacter } from './characterConversation';
import type { ResponseDeliveryReceipt } from './responseDelivery';
import type { ResponseOutputResult } from './streamingAvatar/types';

/** Scripted audio has no word alignment: partial playback stays uncertain. */
export function greetingDelivery(turnId: string, turnIndex: number, character: RuntimeCharacter, text: string,
  output?: Pick<ResponseOutputResult, 'status' | 'started'>): ResponseDeliveryReceipt {
  const complete = output?.status === 'played';
  const uncertain = !complete && output?.started ? text : '';
  return { turnId, turnIndex, character, intent: null, generated: text,
    delivered: complete ? text : '', uncertain, privateContinuation: complete || uncertain ? '' : text,
    status: complete ? 'completed' : output?.status === 'cancelled' ? 'cancelled' : output?.status === 'failed' ? 'failed' : 'unknown',
    scheduledSamples: null, playedSamples: null, sampleRate: null };
}

/** App greeting content approved by Ulrich on 2026-10-26, sandbox-ulrich only. */
const approvedSandboxGreetings: Record<RuntimeCharacter, readonly string[]> = {
  max: ['Allô. Max à l’appareil. Je vous écoute.', 'Oui, c’est Max. Qu’est-ce qui vous amène ?'],
  emma: ['Allô… c’est Emma. À qui je parle ?', 'Oui… je suis là. Vous vouliez me parler ?'],
};

export function initialGreetingLines(character: RuntimeCharacter, openingLine: string | null, environment = 'prod'): readonly string[] {
  const line = openingLine?.trim();
  const approved = approvedSandboxGreetings[character];
  // The profile remains a single line for already published clients. An author
  // changing that reference always takes precedence over this approved repertoire.
  if (environment === 'sandbox-ulrich' && line === approved[0]) return approved;
  return [line || (character === 'max' ? 'Hallo... à qui ai-je affaire ?' : 'Allô ?')];
}

/** Kept by the experience across calls, with bounded memory and no private history. */
export function createInitialGreetingSelector() {
  const calls = new Map<string, string>();
  const last = new Map<string, string>();
  return (callId: string, environment: string, character: RuntimeCharacter, openingLine: string | null): string => {
    const owner = JSON.stringify([environment, character]);
    const key = JSON.stringify([callId, environment, character]);
    const selected = calls.get(key);
    if (selected !== undefined) return selected;
    const lines = initialGreetingLines(character, openingLine, environment);
    const alternatives = lines.filter(line => line !== last.get(owner));
    const available = alternatives.length ? alternatives : lines;
    const line = available[Math.floor(Math.random() * available.length)];
    calls.set(key, line);
    last.set(owner, line);
    if (calls.size > 16) calls.delete(calls.keys().next().value!);
    if (last.size > 16) last.delete(last.keys().next().value!);
    return line;
  };
}

type Register = 'vous' | 'tu';

const informalAddress = /(?:^|[^\p{L}])(?:(?:tu|te|toi|ton|ta|tes)(?=$|[^\p{L}])|t['’])/giu;
const formalAddress = /(?:^|[^\p{L}])(?:vous|votre|vos)(?=$|[^\p{L}])/giu;

/**
 * The register a character already uses with the player in this call. A scripted
 * line in the middle of a call must not switch back to « vous » once the
 * character says « tu » (recette G1.2). First contact stays formal.
 */
export function characterRegister(character: RuntimeCharacter, history: ConversationMessage[]): Register {
  const own = sliceConversationForCharacter(history, character).filter(message => message.role === character);
  for (const message of own.reverse()) {
    const informal = message.content.match(informalAddress)?.length ?? 0;
    const formal = message.content.match(formalAddress)?.length ?? 0;
    if (informal !== formal) return informal > formal ? 'tu' : 'vous';
  }
  return 'vous';
}

const recoveryLinesInformal: Record<RuntimeCharacter, readonly string[]> = {
  max: [
    'Un instant. Reprends les derniers mots.',
    'Je t’ai perdu un moment. Redisons ça simplement.',
    'Attends. Tu peux reprendre la fin ?',
    'Ça a coupé. Juste la dernière phrase ?',
    'Reprends, je t’écoute.',
  ],
  emma: [
    'Pardon… La fin m’a échappé. Tu peux reprendre ?',
    'Attends, je n’ai pas tout saisi. Encore une fois ?',
    'Je suis là… Redis-moi juste la fin.',
    'Excuse-moi, ça a coupé un instant. Tu disais ?',
    'Je t’écoute. On reprend doucement ?',
  ],
};

const recoveryLines: Record<RuntimeCharacter, readonly string[]> = {
  max: [
    'Un instant. Reprenez les derniers mots.',
    'Je vous ai perdu un moment. Redisons ça simplement.',
    'Attendez. Vous pouvez reprendre la fin ?',
    'Ça a coupé. Juste la dernière phrase ?',
    'Reprenez, je vous écoute.',
  ],
  emma: [
    'Pardon… La fin m’a échappé. Vous pouvez reprendre ?',
    'Attendez, je n’ai pas tout saisi. Encore une fois ?',
    'Je suis là… Redites-moi juste la fin.',
    'Excusez-moi, ça a coupé un instant. Vous disiez ?',
    'Je vous écoute. On reprend doucement ?',
  ],
};

function unusedLine(lines: readonly string[], character: RuntimeCharacter, history: ConversationMessage[]): string {
  const own = sliceConversationForCharacter(history, character).filter(message => message.role === character);
  const spoken = own.map(message => message.content);
  const available = lines.filter(line => !spoken.includes(line));
  // Exhaust the repertoire before reusing its least recently spoken line.
  if (!available.length) return [...lines].sort((a, b) => spoken.lastIndexOf(a) - spoken.lastIndexOf(b))[0];
  return available[Math.floor(Math.random() * available.length)];
}

export function characterRecoveryLine(character: RuntimeCharacter, history: ConversationMessage[]): string {
  const lines = characterRegister(character, history) === 'tu' ? recoveryLinesInformal : recoveryLines;
  return unusedLine(lines[character], character, history);
}

/** A withheld transfer stays in the scene: no technical status, invented consent or audio outage. */
export function characterHandoffPauseLine(character: RuntimeCharacter, history: ConversationMessage[]): string {
  const informal = characterRegister(character, history) === 'tu';
  const lines = character === 'max'
    ? informal
      ? ['Attends. Qu’est-ce que tu voudrais lui dire ?', 'De quoi veux-tu lui parler, au juste ?']
      : ['Attendez. Qu’est-ce que vous voudriez lui dire ?', 'De quoi voulez-vous lui parler, au juste ?']
    : informal
      ? ['Attends… Qu’est-ce que tu veux lui dire ?', 'Qu’est-ce qui te donne envie de lui parler ?']
      : ['Attendez… Qu’est-ce que vous voulez lui dire ?', 'Qu’est-ce qui vous amène à vouloir lui parler ?'];
  return unusedLine(lines, character, history);
}

export function characterHandoffGreeting(target: RuntimeCharacter, from: RuntimeCharacter, history: ConversationMessage[]): string {
  const source = characterDisplayName(from);
  const returning = hasSpokenWithCharacter(history, target);
  const informal = returning && characterRegister(target, history) === 'tu';
  const lines = target === 'max'
    ? returning
      ? informal
        ? [`${source} m’a repassé l’appel. On reprend.`, 'Me revoilà. Je t’écoute.', 'Oui, c’est de nouveau Max. On en était où ?', 'Je suis toujours là. Continuons.']
        : [`${source} m’a repassé l’appel. On reprend.`, 'Me revoilà. Je vous écoute.', 'Oui, c’est de nouveau Max. Nous en étions où ?', 'Je suis toujours là. Continuons.']
      : [`${source} m’a passé l’appel. Je vous écoute.`, `C’est Max. Je reprends l’appel de ${source}. Dites-moi.`, `Allô. ${source} m’a transmis l’appel. Dites-moi.`, `Oui, Max à l’appareil. ${source} vient de me passer la ligne.`]
    : returning
      ? informal
        ? [`${source} m’a repassé l’appel. Je suis là.`, 'Me revoilà… Prenons le temps de reprendre.', 'Oui, c’est de nouveau Emma. Je t’écoute.', 'Je suis là. On peut continuer.']
        : [`${source} m’a repassé l’appel. Je suis là.`, 'Me revoilà… Prenons le temps de reprendre.', 'Oui, c’est de nouveau Emma. Je vous écoute.', 'Je suis là. On peut continuer.']
      : [`Allô… ${source} m’a passé l’appel. Je vous écoute.`, `C’est Emma. Vous étiez avec ${source}… Je suis là.`, `${source} vient de me passer la ligne… Je vous écoute.`, `Oui, Emma à l’appareil… ${source} m’a transmis l’appel.`];
  return unusedLine(lines, target, history);
}

/** Only an executed transfer event, never the other character's private words. */
export function latestCallTransfer(character: RuntimeCharacter, history: ConversationMessage[]): ConversationMessage['callTransfer'] {
  const event = sliceConversationForCharacter(history, character).reverse().find(message => message.role === character && message.callTransfer)?.callTransfer;
  if (!event || !['max', 'emma'].includes(event.from) || event.from === character || typeof event.returning !== 'boolean') return undefined;
  return { from: event.from, returning: event.returning };
}

export function canRetryCharacterResponse(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return false;
  const message = error instanceof Error ? error.message : String(error);
  if (/identity|identit|Structured data|Fiche personnage|context|\b(?:400|401|403|404)\b/i.test(message)) return false;
  return /LLM|fetch|network|timeout|timed out|Missing response|Invalid response|Incomplete response|Empty response|Response intent/i.test(message);
}

/** Direct grid calls never invent a transfer by the previous character. */
export function characterRecallGreeting(character: RuntimeCharacter, history: ConversationMessage[], openingLine: string | null): string {
  if (!hasSpokenWithCharacter(history, character)) return initialGreetingLines(character, openingLine)[0];
  const informal = characterRegister(character, history) === 'tu';
  return unusedLine(character === 'max'
    ? informal
      ? ['Oui, c’est de nouveau Max. Je t’écoute.', 'Me revoilà. On en était où ?']
      : ['Oui, c’est de nouveau Max. Je vous écoute.', 'Me revoilà. Nous en étions où ?']
    : informal
      ? ['Oui… c’est de nouveau Emma. Je t’écoute.', 'Me revoilà… On peut reprendre.']
      : ['Oui… c’est de nouveau Emma. Je vous écoute.', 'Me revoilà… On peut reprendre.'], character, history);
}
