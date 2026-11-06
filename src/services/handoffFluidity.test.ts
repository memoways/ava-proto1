import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '@/types';
import { detectPlayerSwitchRequest, playerUtteranceSinceLastReply, PLAYER_UTTERANCE_MAX_CHARS } from './characterConversation';
import { candidateEvidence, recoverHandoffAssessment } from './handoffCoordinator';
import { advanceHandoffTurn, restoreHandoffOffer } from './characterHandoffState';
import { validateCharacterHandoff } from './characterHandoff';
import { playerGaveHandoffReason, withheldHandoffReply } from './characterConversationContinuity';

/**
 * Recette Max → Emma des 1er-4 novembre 2026 (sessions 6b438965, bb1e433e,
 * 5e8c0d40, ac9fd074, 26d5a06a, 0519c59f). Excerpts are the player's real
 * transcribed fragments; Max's candidate lines are the accepting replies the
 * GM described as « Max accepte » before the proof was rejected.
 */
const CALL = { id: 'call', startedAt: 0, durationSeconds: 600, remainingSeconds: 600, deadlineAt: 600_000 };
const user = (content: string): ConversationMessage => ({ role: 'user', content, timestamp: 0, spokenWith: 'max' });
const max = (content: string, extra: Partial<ConversationMessage> = {}): ConversationMessage =>
  ({ role: 'max', content, timestamp: 0, spokenWith: 'max', ...extra });

describe('player utterance across STT fragments', () => {
  it('joins the fragments since the last character reply (session 6b438965)', () => {
    const history = [max('Je ne sais pas si elle me fait encore confiance.'), user('Tout soit tout se mélange dans ta tête'),
      user("Max, mais j'aimerais pouvoir parler avec Emma. Est-ce que tu peux me la"),
      user("passer, elle n'est pas très loin, juste pouvoir échanger avec elle, comment elle va")];
    expect(playerUtteranceSinceLastReply(history)).toBe("Tout soit tout se mélange dans ta tête Max, mais j'aimerais pouvoir"
      + " parler avec Emma. Est-ce que tu peux me la passer, elle n'est pas très loin, juste pouvoir échanger avec elle, comment elle va");
    expect(playerUtteranceSinceLastReply(history, 3)).toContain('me la');
    expect(playerUtteranceSinceLastReply([...history, max('Je te la passe.')])).toBe('');
  });

  it('keeps the most recent text within the shared bound', () => {
    const long = playerUtteranceSinceLastReply([user('a'.repeat(1500)), user(`${'b'.repeat(1500)} Emma`)]);
    expect(long).toHaveLength(PLAYER_UTTERANCE_MAX_CHARS);
    expect(long.endsWith('Emma')).toBe(true);
  });
});

describe('player switch requests heard in the recette', () => {
  it.each([
    ['Rentier Max, si tu peux me passer Emma, ce serait sympa.', 'emma'],
    ["Oui volontiers, je veux bien que vous me passiez Emma. Passez-moi l'appel", 'emma'],
    ["Oui Max, en fait, je serais très curieux de pouvoir échanger avec Emma", 'emma'],
    ['Est-ce que tu penses que je pourrais lui parler à Emma', 'emma'],
    ['Est-ce que tu penses que je pourrais parler avec Emma', 'emma'],
  ] as const)('detects %s', (text, target) => {
    expect(detectPlayerSwitchRequest(text, 'max')).toBe(target);
  });

  it.each([
    "Max, j'aimerais savoir est-ce que tu as pu parler avec Emma depuis",
    'Est-ce que tu as pu en parler avec elle',
    "Je voudrais savoir si tu as pu parler avec Emma.",
    'Et Emma, comment on voit Emma',
    "Je ne veux pas parler avec Emma.",
  ])('does not open a request for %s', text => {
    expect(detectPlayerSwitchRequest(text, 'max')).toBeNull();
  });
});

const context = (userText: string, reply: string, extra: Partial<Parameters<typeof recoverHandoffAssessment>[0]> = {}) => ({
  currentCharacter: 'max' as const, turnId: 's:9', turnIndex: 9, orchestrationVersionId: 'v1', userText,
  delivery: candidateEvidence(reply, 's:9', 9, 'max'), openRequest: null, ...extra,
});
const evaluation = (assessment: unknown) => ({ execution_status: 'executed' as const, character_key: 'max' as const,
  turn_index: 9, orchestration_version_id: 'v1', handoff_assessment: assessment as never,
  action: { type: 'handoff' as const, targetCharacter: 'emma' as const, reason: 'r', proposalGuidance: 'g' } });

describe('deterministic proof when the character clearly accepts', () => {
  const fragments = "Max, mais j'aimerais pouvoir parler avec Emma. Est-ce que tu peux me la passer, elle n'est pas très loin";

  it.each(['Oui. Je te la passe. Emma est dans la cuisine.', 'Je te passe Emma maintenant.',
    'D’accord. Je peux vous passer Emma, dans la cuisine.'])('accepts « %s » for a request split across fragments', reply => {
    const ctx = context(fragments, reply);
    const assessment = recoverHandoffAssessment(ctx, null);
    expect(assessment).toMatchObject({ targetCharacter: 'emma', sourceCharacter: 'max',
      origin: { type: 'player_request', turnIndex: 9, evidence: fragments }, consent: { stance: 'accept' } });
    expect(validateCharacterHandoff({ ...ctx, evaluation: evaluation(assessment) }).authorized).toBe(true);
  });

  it('respects a GM objection, deferral or refusal', () => {
    for (const gm of [{ stance: 'object' }, { stance: 'defer' }, { stance: 'accept', refusal: true }]) {
      expect(recoverHandoffAssessment(context(fragments, 'Je te la passe.'), gm)).toBeNull();
    }
  });

  it('keeps the veto on « je vais lui demander si elle accepte » (ac9fd074, 0519c59f)', () => {
    expect(recoverHandoffAssessment(context(fragments,
      'Je comprends. Je peux lui passer l’appel, mais je ne sais pas dans quel état elle est… Je vais lui demander si elle accepte de vous parler.'), null)).toBeNull();
  });

  it('never invents a request the player did not make', () => {
    expect(recoverHandoffAssessment(context('Comment elle va ?', 'Je te la passe.'), null)).toBeNull();
    expect(recoverHandoffAssessment(context(fragments, 'Elle est dans la cuisine. Elle ne dit rien.'), null)).toBeNull();
  });

  it('uses a still-open earlier request when the confirmation does not name Emma (5e8c0d40)', () => {
    const openRequest = { turnId: 's:7', turnIndex: 7, expiresAfterTurnIndex: Number.MAX_SAFE_INTEGER,
      userText: 'Rentier Max, si tu peux me passer Emma, ce serait sympa.', sourceCharacter: 'max' as const,
      targetCharacter: 'emma' as const, orchestrationVersionId: 'v1' };
    const ctx = context('Donc volontiers si tu pouvais me la passer.', 'Je te passe Emma. Elle est dans la cuisine.', { openRequest });
    const assessment = recoverHandoffAssessment(ctx, { stance: 'accept' });
    expect(assessment?.origin).toMatchObject({ turnId: 's:7', turnIndex: 7, evidence: openRequest.userText });
    expect(validateCharacterHandoff({ ...ctx, evaluation: evaluation(assessment) }).authorized).toBe(true);
  });

  it('opens the request from the whole utterance, not the last fragment', () => {
    const state = advanceHandoffTurn(null, { sessionId: 's', sourceCharacter: 'max', orchestrationVersionId: 'v1',
      turnId: 's:9', turnIndex: 9 }, fragments);
    expect(state).toMatchObject({ state: 'awaiting_character', openRequest: { targetCharacter: 'emma', userText: fragments } });
  });

  it('restores an offer proven on fragments after a reload', () => {
    const reply = 'Oui. Je te la passe.';
    const ctx = context(fragments, reply);
    const assessment = recoverHandoffAssessment(ctx, null)!;
    const history: ConversationMessage[] = [max('Allô.', { callStart: CALL }),
      ...Array.from({ length: 7 }, (_, i) => [user(`Question ${i}`), max(`Réponse ${i}.`)]).flat(),
      user("Max, mais j'aimerais pouvoir parler avec Emma."), user("Est-ce que tu peux me la passer, elle n'est pas très loin"),
      max(reply, { delivery: { ...ctx.delivery } })];
    const fragmentsText = playerUtteranceSinceLastReply(history, history.length - 1);
    const proof = recoverHandoffAssessment(context(fragmentsText, reply), null)!;
    expect(proof).not.toBeNull();
    const raw = { schemaVersion: 2, sessionId: 's', sourceCharacter: 'max', orchestrationVersionId: 'v1', turnId: 's:9',
      turnIndex: 9, revision: 'r', state: 'available', openRequest: null, offer: { targetCharacter: 'emma', reason: 'r',
        proposalGuidance: 'g', gmApproval: { turnId: 's:9', orchestrationVersionId: 'v1' }, assessment: proof } };
    expect(assessment.targetCharacter).toBe('emma');
    expect(restoreHandoffOffer(raw, { sessionId: 's', sourceCharacter: 'max', orchestrationVersionId: 'v1',
      turnId: 's:9', turnIndex: 9 }, history)).toMatchObject({ targetCharacter: 'emma' });
  });
});

describe('a withheld transfer never loops on the same question', () => {
  const asked = [max('Allô.', { callStart: CALL }), user('Tu pourrais me passer Emma'), max('De quoi veux-tu lui parler, au juste ?')];

  it.each(["J'aimerais juste savoir comment elle va.", "Vraiment de l'écouter en fait.",
    'discuter avec Emma pour voir comment elle va'])('recognizes a reason: %s', text => {
    expect(playerGaveHandoffReason(text)).toBe(true);
  });

  it('asks the purpose once, only when the player gave no reason', () => {
    expect(withheldHandoffReply('max', [max('Allô.', { callStart: CALL })], 'Je te passe Emma.', 'Tu peux me passer Emma ?'))
      .toMatch(/\?$/);
  });

  it('keeps the character’s own words once the player explained (26d5a06a)', () => {
    expect(withheldHandoffReply('max', [max('Allô.', { callStart: CALL })],
      'Je comprends. Je te passe Emma.', 'Je pourrais lui parler ? Juste savoir comment elle va.')).toBe('Je comprends.');
  });

  it('never asks the purpose twice in the same call (5e8c0d40, ac9fd074)', () => {
    for (let i = 0; i < 4; i += 1) {
      const reply = withheldHandoffReply('max', asked, 'Je te passe Emma.', 'passe-la moi');
      expect(reply).not.toMatch(/lui (?:dire|parler)/);
      expect(reply).not.toMatch(/\?$/);
    }
  });

  it('a previous call’s question does not count against the next call', () => {
    const nextCall = [...asked, max('Me revoilà.', { callTransfer: { from: 'emma', returning: true } })];
    expect(withheldHandoffReply('max', nextCall, 'Je te passe Emma.', 'Tu peux me passer Emma ?')).toMatch(/\?$/);
  });
});
