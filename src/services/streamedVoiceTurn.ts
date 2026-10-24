import { playAudioBlobRobust } from "./audioPlayback";
import { observeVoice } from "./voiceTurnTelemetryV2";
import { observeService } from "./voiceTurnTelemetryV2";
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
    fallback?: (text: string, signal: AbortSignal) => Promise<ResponseOutputResult> }) {
  const outputLifetime = new AbortController();
  let intent: ResponseDeliveryReceipt['intent'] = null;
  let generated = '', settled = false;
  const segments: string[] = [];
  let finalReceipt: ResponseDeliveryReceipt | null = null;
  let audioError: unknown = null, playbackStarted = false, fallbackActive = false;
  const t0 = performance.now();
  let resolveDelivery!: (s: string) => void, rejectDelivery!: (e: unknown) => void;
  const delivery = new Promise<string>((resolve, reject) => { resolveDelivery = resolve; rejectDelivery = reject; });
  delivery.catch(() => {});
  const session = createGradiumIncrementalTurn({ ...context, signal: outputLifetime.signal });
  session.started.then(() => {
    if (settled || context.signal?.aborted) return;
    playbackStarted = true;
    observeService(context.onServiceObserved, { service: 'tts', requested_provider: 'gradium', requested_model: 'gradium-tts',
      resolved_provider: 'gradium', resolved_model: 'gradium-tts', effective_provider: 'gradium', effective_model: 'gradium-tts',
      transport: 'websocket', character_override: true, fallback: false });
    hooks.onPlaybackStart();
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
        const start = generated.indexOf(segment, delivered.length);
        if (start < 0) break;
        delivered = generated.slice(0, start + segment.length);
      }
      if (!generated.startsWith(delivered)) delivered = '';
    }
    const remainder = generated.slice(delivered.length);
    // Without alignment there is no invented text/audio ratio. The whole submitted
    // remainder is uncertain; a fragment not sent to the synth stays private.
    let submittedEnd = 0;
    for (const segment of segments) {
      const start = generated.indexOf(segment, submittedEnd);
      if (start < 0) break;
      submittedEnd = start + segment.length;
    }
    const uncertain = fallbackActive ? generated.slice(delivered.length) : progress.playedSamples > 0 && !fullyPlayed ? generated.slice(delivered.length, submittedEnd) : '';
    return { turnId: context.turn_id, turnIndex: context.turn_index, character: context.characterKey,
      intent, generated, delivered, uncertain, privateContinuation: remainder.slice(uncertain.length), status,
      scheduledSamples: fallbackActive ? null : progress.scheduledSamples, playedSamples: fallbackActive ? null : progress.playedSamples, sampleRate: fallbackActive ? null : progress.sampleRate };
  };
  const finalize = (r: ResponseDeliveryReceipt) => {
    if (settled) return;
    settled = true; finalReceipt = r; hooks.onReceipt(r);
    if (r.delivered.trim()) resolveDelivery(r.delivered); else rejectDelivery(new Error('No confirmed audio delivery'));
  };
  const onAbort = () => {
    outputLifetime.abort(context.signal?.reason);
    session.cancel(context.signal?.reason);
    finalize(receipt(context.signal?.reason === 'player-barge-in' ? 'interrupted' : 'cancelled'));
  };
  if (context.signal?.aborted) onAbort();
  else context.signal?.addEventListener('abort', onAbort, { once: true });
  return {
    delivery,
    estimatedStopAt: () => settled || fallbackActive ? null : session.estimatedStopAt(),
    get reversibleOutput() {
      if (settled || fallbackActive || audioError) return null;
      return { attenuate: () => session.attenuate(), pause: () => session.pause(),
        resume: () => session.resume(), playedText: () => session.progress().confirmedText };
    },
    onEvent(event: PRD4StreamEvent) {
      if (settled) {
        if ((event.type === 'interrupted' || event.type === 'failed') && finalReceipt) {
          // Only enrich the immutable abandoned turn's receipt; never resume audio.
          generated = event.generated; intent = event.intent;
          finalReceipt = receipt(finalReceipt.status);
          hooks.onReceipt(finalReceipt);
        }
        return;
      }
      if (event.type === 'reset' && !segments.length) intent = null;
      else if (event.type === 'intent') intent = event.intent;
      else if (event.type === 'segment') {
        if (!segments.length && context.resolveSpeechPerformance) {
          session.setPerformance(context.resolveSpeechPerformance(intent?.parole ?? null, event.text));
        }
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
          fallbackActive = true;
          try {
          let result: ResponseOutputResult;
          if (hooks.fallback) result = await hooks.fallback(generated, outputLifetime.signal);
          else {
            const generationStarted = performance.now();
            const speech = await session.generateFallback(generated, outputLifetime.signal);
            if (outputLifetime.signal.aborted || settled) return cancelled();
            const generationWallMs = performance.now() - generationStarted;
            observeVoice(context.onVoiceObservation, 'audio_blob_ready');
            observeService(context.onServiceObserved, { service: 'tts', requested_provider: 'gradium', requested_model: 'gradium-tts',
              resolved_provider: 'gradium', resolved_model: 'gradium-tts', effective_provider: 'gradium', effective_model: speech.meta.model ?? null,
              transport: 'rest_fallback', character_override: true, fallback: true });
            const playback = await playAudioBlobRobust(speech.blob, undefined, () => {
              if (outputLifetime.signal.aborted || settled) return;
              playbackStarted = true;
              observeVoice(context.onVoiceObservation, 'output_estimated');
              hooks.onPlaybackStart();
            }, outputLifetime.signal);
            result = { status: playback.status, provider: 'gradium', model: speech.meta.model,
              started: playbackStarted, firstPlaybackStartMs: playback.playbackStartMs ?? 0,
              playbackTotalMs: playback.playbackTotalMs ?? 0, generationWallMs,
              generatedSegments: 1, playedSegments: playback.status === 'played' ? 1 : 0,
              failedSegments: playback.status === 'failed' ? 1 : 0, error: playback.error };
          }
          if (!context.signal?.aborted && !settled) {
            const r = receipt(result.status === 'played' ? 'completed' : 'failed');
            if (result.status === 'played') { r.delivered = generated; r.uncertain = ''; r.privateContinuation = ''; }
            // Blob fallback has no sample-clock coverage.
            r.scheduledSamples = r.playedSamples = r.sampleRate = null;
            finalize(r);
          }
          return outputLifetime.signal.aborted ? cancelled() : result;
          } catch (fallbackError) {
            if (!settled) finalize(receipt('failed'));
            return { ...cancelled(), status: outputLifetime.signal.aborted ? 'cancelled' : 'failed',
              error: fallbackError instanceof Error ? fallbackError : new Error('Gradium fallback failed') };
          }
        }
        finalize(receipt('failed'));
        return { ...cancelled(), status: 'failed', started: playbackStarted, error: error instanceof Error ? error : new Error('TTS stream failed') };
      } finally { context.signal?.removeEventListener('abort', onAbort); }
    },
    cancel(reason?: unknown) { outputLifetime.abort(reason); session.cancel(reason); if (!settled) finalize(receipt('cancelled')); context.signal?.removeEventListener('abort', onAbort); },
  };
  function cancelled(): ResponseOutputResult {
    return { status: 'cancelled', provider: 'gradium', model: 'gradium-tts', started: playbackStarted,
      firstPlaybackStartMs: 0, playbackTotalMs: performance.now() - t0,
      generatedSegments: segments.length, playedSegments: 0, failedSegments: 0 };
  }
}
