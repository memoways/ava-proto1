import { createGradiumIncrementalTurn, prepareTextForGradium } from './tts/providers/gradium';
import type { TTSGenerateContext } from './tts/types';
import type { PRD4StreamEvent } from './prd4Orchestrator';
import type { ResponseDeliveryReceipt } from './responseDelivery';
import type { ResponseOutputResult } from './streamingAvatar/types';
import type { RuntimeCharacter } from '@/types';

const canonical = (text: string) => text.toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]/gu, '');

/** Delivery is based on the audio clock, never on LLM/TTS generation completion. */
export function prepareStreamedVoiceTurn(context: TTSGenerateContext & { characterKey: RuntimeCharacter; turn_id: string; turn_index: number },
  hooks: { onPlaybackStart: () => void; onReceipt: (receipt: ResponseDeliveryReceipt) => void;
    fallback: (text: string) => Promise<ResponseOutputResult> }) {
  let intent: ResponseDeliveryReceipt['intent'] = null;
  let generated = '', settled = false;
  const segments: string[] = [];
  let finalReceipt: ResponseDeliveryReceipt | null = null;
  let audioError: unknown = null, playbackStarted = false;
  const t0 = performance.now();
  let resolveDelivery!: (s: string) => void, rejectDelivery!: (e: unknown) => void;
  const delivery = new Promise<string>((resolve, reject) => { resolveDelivery = resolve; rejectDelivery = reject; });
  delivery.catch(() => {});
  const session = createGradiumIncrementalTurn(context);
  session.started.then(() => {
    if (settled || context.signal?.aborted) return;
    playbackStarted = true; hooks.onPlaybackStart();
  }).catch(error => { audioError = error; });
  session.generationDone.catch(error => { audioError = error; });
  session.finished.catch(error => { audioError = error; });
  const receipt = (status: ResponseDeliveryReceipt['status'], fullyPlayed = false): ResponseDeliveryReceipt => {
    const progress = session.progress();
    let delivered = '';
    if (fullyPlayed) delivered = generated;
    else {
      let prepared = '';
      const confirmed = canonical(progress.confirmedText);
      for (const segment of segments) {
        prepared += prepareTextForGradium(segment);
        if (!confirmed.startsWith(canonical(prepared))) break;
        delivered += (delivered ? ' ' : '') + segment;
      }
      if (!generated.startsWith(delivered)) delivered = '';
    }
    const remainder = generated.slice(delivered.length);
    // Without alignment there is no invented text/audio ratio. The whole submitted
    // remainder is uncertain; a fragment not sent to the synth stays private.
    const submitted = segments.join(' ');
    const submittedRemainder = Math.max(0, submitted.length - delivered.length);
    const uncertain = progress.playedSamples > 0 && !fullyPlayed ? remainder.slice(0, submittedRemainder) : '';
    return { turnId: context.turn_id, turnIndex: context.turn_index, character: context.characterKey,
      intent, generated, delivered, uncertain, privateContinuation: remainder.slice(uncertain.length), status,
      scheduledSamples: progress.scheduledSamples, playedSamples: progress.playedSamples, sampleRate: progress.sampleRate };
  };
  const finalize = (r: ResponseDeliveryReceipt) => {
    if (settled) return;
    settled = true; finalReceipt = r; hooks.onReceipt(r);
    if (r.delivered.trim()) resolveDelivery(r.delivered); else rejectDelivery(new Error('No confirmed audio delivery'));
  };
  const onAbort = () => {
    session.cancel(context.signal?.reason);
    finalize(receipt(context.signal?.reason === 'player-barge-in' ? 'interrupted' : 'cancelled'));
  };
  if (context.signal?.aborted) onAbort();
  else context.signal?.addEventListener('abort', onAbort, { once: true });
  return {
    delivery,
    onEvent(event: PRD4StreamEvent) {
      if (settled) {
        if ((event.type === 'interrupted' || event.type === 'failed') && finalReceipt) {
          // Only enrich the immutable abandoned turn's receipt; never resume audio.
          generated = event.generated; intent = event.intent;
          finalReceipt = { ...finalReceipt, generated, intent,
            privateContinuation: generated.slice(finalReceipt.delivered.length + finalReceipt.uncertain.length) };
          hooks.onReceipt(finalReceipt);
        }
        return;
      }
      if (event.type === 'intent') intent = event.intent;
      else if (event.type === 'segment') {
        segments.push(event.text); generated = segments.join(' ');
        if (!audioError) {
          try { session.appendText(prepareTextForGradium(event.text)); session.open(); }
          catch (error) { audioError = error; }
        }
      } else if (event.type === 'complete') {
        generated = event.response;
        if (!audioError) session.finish();
      } else if (event.type === 'interrupted' || event.type === 'failed') {
        if (!settled) {
          intent = event.intent; generated = event.generated;
          session.cancel(event.error); finalize(receipt(event.type === 'interrupted' ? 'interrupted' : 'failed'));
        }
      }
    },
    async finish(): Promise<ResponseOutputResult> {
      try {
        if (audioError) throw audioError;
        const playback = await session.finished;
        const stats = await session.generationDone;
        if (context.signal?.aborted || settled) return cancelled();
        finalize(receipt('completed', true));
        return { status: 'played', provider: 'gradium', model: 'gradium-tts', started: true,
          firstPlaybackStartMs: stats.firstByteMs, playbackTotalMs: playback.playbackTotalMs,
          generationWallMs: stats.totalGenMs, generatedSegments: segments.length, playedSegments: segments.length, failedSegments: 0 };
      } catch (error) {
        session.cancel(error);
        if (context.signal?.aborted || settled) return cancelled();
        // A transport fallback uses the same generated speech, once, only before output.
        if (!playbackStarted && !session.hasAudibleOutput) {
          const result = await hooks.fallback(generated);
          if (!context.signal?.aborted && !settled) {
            const r = receipt(result.status === 'played' ? 'completed' : 'failed');
            if (result.status === 'played') { r.delivered = generated; r.uncertain = ''; r.privateContinuation = ''; }
            // Blob fallback has no sample-clock coverage.
            r.scheduledSamples = r.playedSamples = r.sampleRate = null;
            finalize(r);
          }
          return result;
        }
        finalize(receipt('failed'));
        return { ...cancelled(), status: 'failed', started: playbackStarted, error: error instanceof Error ? error : new Error('TTS stream failed') };
      } finally { context.signal?.removeEventListener('abort', onAbort); }
    },
    cancel(reason?: unknown) { session.cancel(reason); if (!settled) finalize(receipt('cancelled')); context.signal?.removeEventListener('abort', onAbort); },
  };
  function cancelled(): ResponseOutputResult {
    return { status: 'cancelled', provider: 'gradium', model: 'gradium-tts', started: playbackStarted,
      firstPlaybackStartMs: 0, playbackTotalMs: performance.now() - t0,
      generatedSegments: segments.length, playedSegments: 0, failedSegments: 0 };
  }
}
