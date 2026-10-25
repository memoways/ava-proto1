import { guardCharacterResponse, type CharacterExecutionContext } from './characterIdentityGuard';
import { AVA_CHARACTER_REGISTRY } from './characterRegistry';

export interface ResponseIntent { goal: string; points: string[]; parole?: string }
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
  return `\n# FORMAT DE SORTIE IMPÉRATIF\nDans cette même réponse, écris d'abord une seule ligne JSON {"goal":"objectif privé","points":[],"parole":"état"}. Garde cet en-tête privé compact : ${intent}. Objectif ≤240 caractères, chaque point ≤160 caractères. Ce sont des intentions de communication, pas un raisonnement détaillé. "parole" : le nom exact d'un état de « Tes états de parole » que tu joues dans cette réponse (≤40 caractères) ; omets-le si aucun ne convient. Puis écris le marqueur <speech> seul sur une ligne entre le JSON et ton discours in character, avec de vrais retours à la ligne. Limite du discours : ${speechWords} mots maximum, y compris citations et questions. Le budget total de ${budget} tokens inclut le JSON et la parole : ne consomme pas la place de la parole avec l'intention. Choisis l'essentiel si la demande est large ; achève ta réponse dans cette limite. Les fragments volontaires, reprises et suspensions de ta fiche sont permis : ne les transforme pas en phrases explicatives. Aucun markdown, aucune autre métadonnée, aucun tag dans le discours. L'intention est privée, jamais entendue. Une intention ou une continuation privée n'est jamais une confidence déjà entendue. Respecte les mêmes limites de confidences et le canon.\n`;
}

export function normalizeResponseIntent(value: unknown): ResponseIntent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(k => k !== 'goal' && k !== 'points' && k !== 'parole') || typeof raw.goal !== 'string'
    || !raw.goal.trim() || raw.goal.length > 240 || !Array.isArray(raw.points) || raw.points.length > 4
    || raw.points.some(p => typeof p !== 'string' || !p.trim() || p.length > 160)) return null;
  // "parole" est déclaratif : une valeur malformée est ignorée, jamais fatale au tour.
  const parole = typeof raw.parole === 'string' && raw.parole.trim() && raw.parole.trim().length <= 40
    ? raw.parole.trim()
    : undefined;
  return { goal: raw.goal.trim(), points: raw.points.map(p => (p as string).trim()), ...(parole ? { parole } : {}) };
}

/** Closed quotes and a safe spoken unit are required before identity checks/emission. */
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
    // A suspension is part of the utterance, not an incremental sentence
    // boundary. Otherwise Gradium prepares "Je…" / "je sais" as "Je." / "je sais".
    if (/[.…]/.test(c) && (c === '…' || text.slice(i, j).includes('..'))) {
      if (!eof || j < text.length) { i = j - 1; continue; }
    }
    // A single terminal period may still become "..." in the next token.
    if (!eof && j === text.length) { i = j - 1; continue; }
    if (!quotes.length && (j < text.length && /\s/.test(text[j]) || eof && j === text.length)) end = j;
    i = j - 1;
  }
  if (eof && !quotes.length && /\s[—–]$/.test(text.trimEnd())) end = text.trimEnd().length;
  if (eof && !quotes.length && /[.!?…]\s*[»”"]$/.test(text.trimEnd())) end = text.trimEnd().length;
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
      // The marker is structural. CRLF, extra whitespace or a model spelling
      // the documented newline escapes must not discard an otherwise valid
      // private JSON header and complete speech. JSON validation stays strict.
      const boundary = this.header.indexOf('<speech>');
      if (boundary < 0) { if (this.header.length > 1200) throw new Error('Response intent header too large'); return; }
      if (boundary > 1100) throw new Error('Response intent header too large');
      let value: unknown;
      try { value = JSON.parse(this.header.slice(0, boundary).replace(/(?:\\[rn]|\s)+$/, '')); } catch { throw new Error('Invalid response intent JSON'); }
      const intent = normalizeResponseIntent(value);
      if (!intent) throw new Error('Invalid response intent');
      this.intentValue = intent;
      this.pending = this.header.slice(boundary + '<speech>'.length);
      this.header = '';
      this.onIntent(intent);
    } else this.pending += chunk;
    if (this.generated.length > 12000) throw new Error('Response stream too large');
    this.emit(false);
  }
  private emit(eof: boolean) {
    if (!this.emitted) this.pending = this.pending.replace(/^(?:\\[rn]|\s)+/, '');
    const end = safeSentenceEnd(this.pending, eof);
    if (!end) return;
    const segment = this.pending.slice(0, end);
    const prefix = this.emitted + segment;
    // Do not make an interrupted self-identification pronounceable simply by
    // adding a suspension. Full foreign claims still use the shared guard.
    const identityText = prefix.replace(/«[^»]*»|“[^”]*”|"[^"]*"/g, ' ');
    const interruptedClaims = [...identityText.matchAll(/\b(?:je\s+suis|(?:je|on)\s+m['’]appelle|mon\s+nom\s+est|ici|moi\s*,?\s*c['’]est|appelle[z]?[- ]moi)\s+([\p{L}-]+)\s*(?:…|\.{2,}|[—–])/giu)];
    if (interruptedClaims.some(claim => AVA_CHARACTER_REGISTRY.entries.some(entry =>
      entry.availability === 'active' && entry.key !== this.context.characterKey
      && entry.displayName.toLocaleLowerCase('fr').startsWith(claim[1].toLocaleLowerCase('fr'))))) {
      throw new Error('Incomplete identity in response stream');
    }
    if (guardCharacterResponse(prefix, this.context).blocked) throw new Error('Foreign character identity in response stream');
    // Tags/structured payloads in speech fail closed, including a repeated private header.
    if (/[<>[\]{}]/.test(segment)) throw new Error('Structured data in speech');
    this.emitted = prefix;
    this.pending = this.pending.slice(end);
    this.onSegment(segment.trim());
  }
  finish() {
    if (!this.intentValue) throw new Error('Missing response intent');
    // Some models close the opening protocol marker. Consume only this exact
    // terminal marker; sentence, quote, identity and structured-data guards follow.
    this.pending = this.pending.replace(/\s*<\/speech>\s*$/, '');
    this.emit(true);
    if (this.pending.trim()) throw new Error('Incomplete response sentence or quote');
    if (!this.emitted.trim()) throw new Error('Empty response speech');
    this.terminal = true;
    return this.emitted.trim();
  }
}

/** Validate a complete recovery before emitting any of it; same speech guards. */
export function validateRecoverySpeech(text: string, context: CharacterExecutionContext): string {
  const parser = new ResponseIntentParser(context, () => {}, () => {});
  parser.push(JSON.stringify({ goal: 'Validation de parole', points: [] }) + SPEECH_BOUNDARY + text);
  return parser.finish();
}
