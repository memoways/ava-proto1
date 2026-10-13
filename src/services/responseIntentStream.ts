import { guardCharacterResponse, type CharacterExecutionContext } from './characterIdentityGuard';

export interface ResponseIntent { goal: string; points: string[] }
export const SPEECH_BOUNDARY = '\n<speech>\n';
/** Output guidance reserves space for the private header without raising the API budget.
 * Word bounds are conservative guidance, not a tokenizer; SSE still rejects length. */
export function buildResponseStreamContract(maxTokens: number): string {
  const budget = Number.isFinite(maxTokens) ? Math.max(1, Math.floor(maxTokens)) : 220;
  const small = budget < 120;
  const speechWords = Math.min(45, Math.max(1, Math.floor((budget - (small ? 32 : 70)) / 3)));
  const intent = small
    ? 'goal : 4 mots maximum ; points : tableau vide []'
    : 'goal : 8 mots maximum ; points : 0 à 2 points de 4 mots maximum chacun';
  return `\n# FORMAT DE SORTIE IMPÉRATIF\nDans cette même réponse, écris d'abord une seule ligne JSON {"goal":"objectif privé","points":[]}. Garde cet en-tête privé compact : ${intent}. Objectif ≤240 caractères, chaque point ≤160 caractères. Ce sont des intentions de communication, pas un raisonnement détaillé. Puis écris exactement la frontière \\n<speech>\\n et ton discours in character. Limite du discours : ${speechWords} mots maximum, y compris citations et questions. Le budget total de ${budget} tokens inclut le JSON et la parole : ne consomme pas la place de la parole avec l'intention. Choisis l'essentiel si la demande est large ; termine tes phrases dans cette limite. Aucun markdown, aucune autre métadonnée, aucun tag dans le discours. L'intention est privée, jamais entendue. Une intention ou une continuation privée n'est jamais une confidence déjà entendue. Respecte les mêmes limites de confidences et le canon.\n`;
}

export function normalizeResponseIntent(value: unknown): ResponseIntent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(k => k !== 'goal' && k !== 'points') || typeof raw.goal !== 'string'
    || !raw.goal.trim() || raw.goal.length > 240 || !Array.isArray(raw.points) || raw.points.length > 4
    || raw.points.some(p => typeof p !== 'string' || !p.trim() || p.length > 160)) return null;
  return { goal: raw.goal.trim(), points: raw.points.map(p => (p as string).trim()) };
}

/** Closed quotes and sentence punctuation are required before any identity check/emission. */
export function safeSentenceEnd(text: string, eof = false): number {
  const quotes: string[] = [];
  let end = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '«' || c === '“') quotes.push(c === '«' ? '»' : '”');
    else if (c === '"') { if (quotes.at(-1) === '"') quotes.pop(); else quotes.push('"'); }
    else if (quotes.at(-1) === c) quotes.pop();
    if (!/[.!?…]/.test(c)) continue;
    if (c === '.' && (/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')
      || /(?:\b(?:M|Mme|Mlle|Dr|Pr|etc|p|ex)|\b[A-Z])$/u.test(text.slice(0, i)))) continue;
    let j = i + 1;
    while (/[.!?…»”"]/.test(text[j] ?? '') && j < text.length) {
      if (quotes.at(-1) === text[j]) quotes.pop();
      j++;
    }
    if (!quotes.length && (j < text.length && /\s/.test(text[j]) || eof && j === text.length)) end = j;
    i = j - 1;
  }
  return end;
}

export class ResponseIntentParser {
  private header = '';
  private pending = '';
  private emitted = '';
  private intentValue: ResponseIntent | null = null;
  private terminal = false;
  constructor(private context: CharacterExecutionContext, private onIntent: (i: ResponseIntent) => void,
    private onSegment: (text: string) => void) {}
  get intent() { return this.intentValue; }
  get generated() { return this.emitted + this.pending; }
  push(chunk: string) {
    if (this.terminal) throw new Error('Response stream already closed');
    if (!this.intentValue) {
      this.header += chunk;
      const boundary = this.header.indexOf(SPEECH_BOUNDARY);
      if (boundary < 0) { if (this.header.length > 1200) throw new Error('Response intent header too large'); return; }
      if (boundary > 1100) throw new Error('Response intent header too large');
      let value: unknown;
      try { value = JSON.parse(this.header.slice(0, boundary)); } catch { throw new Error('Invalid response intent JSON'); }
      const intent = normalizeResponseIntent(value);
      if (!intent) throw new Error('Invalid response intent');
      this.intentValue = intent;
      this.pending = this.header.slice(boundary + SPEECH_BOUNDARY.length);
      this.header = '';
      this.onIntent(intent);
    } else this.pending += chunk;
    if (this.generated.length > 12000) throw new Error('Response stream too large');
    this.emit(false);
  }
  private emit(eof: boolean) {
    const end = safeSentenceEnd(this.pending, eof);
    if (!end) return;
    const segment = this.pending.slice(0, end);
    const prefix = this.emitted + segment;
    if (guardCharacterResponse(prefix, this.context).blocked) throw new Error('Foreign character identity in response stream');
    // Tags/structured payloads in speech fail closed, including a repeated private header.
    if (/[<>[\]{}]/.test(segment)) throw new Error('Structured data in speech');
    this.emitted = prefix;
    this.pending = this.pending.slice(end);
    this.onSegment(segment.trim());
  }
  finish() {
    if (!this.intentValue) throw new Error('Missing response intent');
    this.emit(true);
    if (this.pending.trim()) throw new Error('Incomplete response sentence or quote');
    if (!this.emitted.trim()) throw new Error('Empty response speech');
    this.terminal = true;
    return this.emitted.trim();
  }
}
