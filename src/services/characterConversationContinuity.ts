import type { ConversationMessage, RuntimeCharacter } from '@/types';
import { characterDisplayName, hasSpokenWithCharacter, sliceConversationForCharacter } from './characterConversation';

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
  return unusedLine(recoveryLines[character], character, history);
}

export function characterHandoffGreeting(target: RuntimeCharacter, from: RuntimeCharacter, history: ConversationMessage[]): string {
  const source = characterDisplayName(from);
  const returning = hasSpokenWithCharacter(history, target);
  const lines = target === 'max'
    ? returning
      ? [`${source} m’a repassé l’appel. On reprend.`, 'Me revoilà. Je vous écoute.', 'Oui, c’est de nouveau Max. Nous en étions où ?', 'Je suis toujours là. Continuons.']
      : [`${source} m’a passé l’appel. Je vous écoute.`, `C’est Max. Je reprends l’appel de ${source}. Dites-moi.`, `Allô. ${source} m’a transmis l’appel. Dites-moi.`, `Oui, Max à l’appareil. ${source} vient de me passer la ligne.`]
    : returning
      ? [`${source} m’a repassé l’appel. Je suis là.`, 'Me revoilà… Prenons le temps de reprendre.', 'Oui, c’est de nouveau Emma. Je vous écoute.', 'Je suis là. On peut continuer.']
      : [`Allô… ${source} m’a passé l’appel. Je vous écoute.`, `C’est Emma. Vous étiez avec ${source}… Je suis là.`, `${source} vient de me passer la ligne. Bonjour.`, `Oui, Emma à l’appareil… ${source} m’a transmis l’appel.`];
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
