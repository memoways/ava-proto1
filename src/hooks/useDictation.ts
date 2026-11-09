/**
 * Dictation for the conversational questionnaire: one microphone press opens a
 * capture through the STT facade (`src/services/stt`, the only STT entry), the
 * text is shown while the participant speaks, and the stop gesture flushes the
 * last words. The caller keeps the text editable; nothing is sent on its own.
 * No audio is stored.
 *
 * Lot 4: if the provider returns no final text when the participant stops,
 * the words already shown (last partial) are kept instead of being erased.
 * `conversational_dictation_finished` records lengths only (no content), to
 * diagnose a cut answer during the human test run.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createConfiguredSTT, type STTSession } from "@/services/stt";
import { describeMicStartError } from "@/services/micStartError";
import { trackEvent } from "@/services/posthogService";

export type DictationStatus = "idle" | "starting" | "listening" | "finalizing";

export interface DictationHandlers {
  /** Live hypothesis of the current utterance (replaces the previous one). */
  onPartial: (text: string) => void;
  /** Final text of the utterance, to append to the field. */
  onFinal: (text: string) => void;
}

export function useDictation(handlers: DictationHandlers) {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const sttRef = useRef<STTSession | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  /** Text currently shown but not yet final. */
  const lastPartialRef = useRef("");
  /** Characters of final text received since the stop gesture (null = not stopping). */
  const finalCharsSinceStopRef = useRef<number | null>(null);

  const release = useCallback((session: STTSession | null) => {
    if (!session) return;
    try { void Promise.resolve(session.stop()).catch(() => {}); } catch { /* already closed */ }
  }, []);

  const start = useCallback(async () => {
    if (sttRef.current) return;
    setError(null);
    setStatus("starting");
    // Requested synchronously from the gesture (iOS needs it).
    const initialStream = navigator.mediaDevices?.getUserMedia({ audio: true });
    initialStream?.catch(() => { /* reported below */ });
    let session: STTSession | null = null;
    try {
      session = await createConfiguredSTT(
        (text, isFinal) => {
          if (sttRef.current !== session) return;
          if (isFinal) {
            if (text.trim()) {
              handlersRef.current.onFinal(text.trim());
              if (finalCharsSinceStopRef.current !== null) finalCharsSinceStopRef.current += text.trim().length;
            }
            lastPartialRef.current = "";
            handlersRef.current.onPartial("");
          } else {
            lastPartialRef.current = text;
            handlersRef.current.onPartial(text);
          }
        },
        {
          initialStream,
          onError: (err) => {
            if (sttRef.current !== session) return;
            console.warn("[Conversational questionnaire] dictation error:", err);
            sttRef.current = null;
            release(session);
            handlersRef.current.onPartial("");
            setStatus("idle");
            setError("Micro indisponible — tu peux écrire ta réponse.");
          },
        },
      );
      sttRef.current = session;
      await session.start();
      session.setManualMode(true);
      setStatus("listening");
    } catch (err) {
      void initialStream?.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => {});
      if (session) release(session);
      sttRef.current = null;
      setStatus("idle");
      const info = describeMicStartError(err);
      setError(`${info.title} — ${info.description} Tu peux aussi écrire ta réponse.`);
    }
  }, [release]);

  const stop = useCallback(async () => {
    const session = sttRef.current;
    if (!session) return;
    setStatus("finalizing");
    const partialAtStop = lastPartialRef.current.trim();
    finalCharsSinceStopRef.current = 0;
    let flushFailed = false;
    try {
      await session.flush();
    } catch (err) {
      flushFailed = true;
      console.warn("[Conversational questionnaire] dictation flush failed:", err);
    } finally {
      if (sttRef.current === session) sttRef.current = null;
      release(session);
      const finalChars = finalCharsSinceStopRef.current ?? 0;
      finalCharsSinceStopRef.current = null;
      // Keep what the participant saw rather than erasing it.
      const keptPartial = finalChars === 0 ? lastPartialRef.current.trim() : "";
      if (keptPartial) handlersRef.current.onFinal(keptPartial);
      lastPartialRef.current = "";
      handlersRef.current.onPartial("");
      setStatus("idle");
      trackEvent("conversational_dictation_finished", {
        partial_chars_at_stop: partialAtStop.length,
        final_chars: finalChars,
        kept_partial_chars: keptPartial.length,
        flush_failed: flushFailed,
      });
    }
  }, [release]);

  const cancel = useCallback(() => {
    const session = sttRef.current;
    sttRef.current = null;
    lastPartialRef.current = "";
    release(session);
    handlersRef.current.onPartial("");
    setStatus("idle");
  }, [release]);

  useEffect(() => () => { release(sttRef.current); sttRef.current = null; }, [release]);

  return { status, error, start, stop, cancel };
}
