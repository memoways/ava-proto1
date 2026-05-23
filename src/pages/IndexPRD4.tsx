/**
 * IndexPRD4 — Nouveau parcours (mai 2026).
 *
 * Phase 3 : Max contextualisé (résumé du rôle joueur injecté), conversation
 * réelle STT + TTS via TTSQueue, GM post-turn PRD4 en void (jamais bloquant).
 * Fin de session : 5 min OU `end_recommended` du GM.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useExperienceState } from "@/hooks/useExperienceState";
import type { AudioState, ConversationMessage, FilmAnswer } from "@/types";
import { trackEvent } from "@/services/posthogService";
import { summarizeRole } from "@/services/roleProfileService";
import { processPRD4Turn } from "@/services/prd4Orchestrator";
import { createPRD4Session, endPRD4Session, updatePRD4Conversation } from "@/services/prd4Session";
import { DeepgramSTT } from "@/services/deepgramSTT";
import { TTSQueue, chunkTextForTTS } from "@/services/elevenLabsTTS";
import { useTimer } from "@/hooks/useTimer";
import { toast } from "@/hooks/use-toast";

import WelcomeScreen from "@/components/prd4/WelcomeScreen";
import FilmQuestionScreen from "@/components/prd4/FilmQuestionScreen";
import TeaserScreen from "@/components/prd4/TeaserScreen";
import RoleCaptureScreen from "@/components/prd4/RoleCaptureScreen";
import RoleSummaryScreen from "@/components/prd4/RoleSummaryScreen";
import CharacterSelectScreen from "@/components/prd4/CharacterSelectScreen";
import CallingMaxScreen from "@/components/prd4/CallingMaxScreen";
import ConversationScreen from "@/components/prd4/ConversationScreen";
import EndSessionScreen from "@/components/prd4/EndSessionScreen";
import QuestionnaireScreenPRD4 from "@/components/prd4/QuestionnaireScreenPRD4";
import ThanksScreen from "@/components/ThanksScreen";
import { savePRD4Questionnaire, syncPRD4QuestionnaireToNotion } from "@/services/prd4Questionnaire";
import type { QuestionnairePRD4Answers, QuestionnairePRD4Data } from "@/types";

const SESSION_DURATION_S = 5 * 60; // PRD4 §11 : ~5 min cible.


const IndexPRD4 = () => {
  const {
    state,
    setPhase,
    setFilmAnswer,
    markTeaserSeen,
    setRoleProfile,
    setAudioState,
    addMessage,
    incrementPttError,
    endExperience,
    reset,
  } = useExperienceState();

  const [userSubtitle, setUserSubtitle] = useState("");
  const [maxSubtitle, setMaxSubtitle] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  // Refs pour pipeline conversation
  const sttRef = useRef<DeepgramSTT | null>(null);
  const ttsQueueRef = useRef<TTSQueue | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const conversationRef = useRef<ConversationMessage[]>([]);
  const isProcessingRef = useRef(false);
  const endedRef = useRef(false);
  const userRoleRef = useRef(state.userRoleProfile);
  userRoleRef.current = state.userRoleProfile;
  const turnLatenciesRef = useRef<number[]>([]);
  const sessionDurationRef = useRef<number>(0);
  const [submittingQuestionnaire, setSubmittingQuestionnaire] = useState(false);


  // Timer 5 minutes — démarré quand on entre en conversation, fin auto à 0.
  const handleTimeout = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    void finalizeAndEnd("timeout_5min");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const timer = useTimer(SESSION_DURATION_S, handleTimeout);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // PostHog : phase tracking
  useEffect(() => {
    trackEvent("prd4_phase_changed", { phase: state.phase });
  }, [state.phase]);

  // ---- Helpers conversation -------------------------------------------------
  const cleanupAudio = useCallback(() => {
    try { sttRef.current?.stop(); } catch { /* ignore */ }
    sttRef.current = null;
    try { ttsQueueRef.current?.cancel(); } catch { /* ignore */ }
    ttsQueueRef.current = null;
  }, []);

  const finalizeAndEnd = useCallback(
    async (reason: string) => {
      cleanupAudio();
      const sid = sessionIdRef.current;
      const duration = SESSION_DURATION_S - (timerRef.current?.remaining ?? SESSION_DURATION_S);
      sessionDurationRef.current = duration;
      if (sid) {
        await endPRD4Session(sid, reason, conversationRef.current, duration).catch((e) =>
          console.warn("[PRD4] endSession failed:", e),
        );
      }
      trackEvent("prd4_session_ended", { reason, duration_s: duration, turns: conversationRef.current.filter((m) => m.role === "user").length });
      endExperience(reason);
    },
    [cleanupAudio, endExperience],
  );


  // ---- Welcome / Film / Teaser ----------------------------------------------
  const handleStart = useCallback(() => setPhase("film_question"), [setPhase]);
  const handleFilmAnswer = useCallback(
    (a: FilmAnswer) => { setFilmAnswer(a); setPhase(a === "vu" ? "role_capture" : "teaser"); },
    [setFilmAnswer, setPhase],
  );
  const handleTeaserContinue = useCallback(() => { markTeaserSeen(false); setPhase("role_capture"); }, [markTeaserSeen, setPhase]);
  const handleTeaserSkip = useCallback(() => { markTeaserSeen(true); setPhase("role_capture"); }, [markTeaserSeen, setPhase]);

  // ---- Role capture → summarize-role (LLM) ----------------------------------
  const handleRoleSubmit = useCallback(
    async (rawInput: string) => {
      setSummarizing(true);
      try {
        const { profile, model, latency_ms } = await summarizeRole(rawInput);
        setRoleProfile(profile);
        trackEvent("prd4_role_created", { length: rawInput.length, model, latency_ms, relationship: profile.relationship_to_family });
        setPhase("role_summary");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        trackEvent("prd4_role_failed", { length: rawInput.length, error: msg.slice(0, 200) });
        toast({ title: "Impossible d'analyser ta présentation", description: "Réessaie dans un instant.", variant: "destructive" });
      } finally {
        setSummarizing(false);
      }
    },
    [setRoleProfile, setPhase],
  );

  const handleRolePTTError = useCallback(
    (err: Error) => {
      incrementPttError();
      trackEvent("prd4_ptt_error", { phase: "role_capture", message: err.message });
    },
    [incrementPttError],
  );

  const handleRoleConfirm = useCallback(() => setPhase("character_select"), [setPhase]);
  const handleRoleRestart = useCallback(() => { setRoleProfile(null); setPhase("role_capture"); }, [setRoleProfile, setPhase]);

  // ---- Character select / Calling -------------------------------------------
  const handleSelectMax = useCallback(() => setPhase("calling_max"), [setPhase]);
  const handleLockedClick = useCallback(
    (id: "emma" | "ava" | "leo") => trackEvent("prd4_character_locked_clicked", { character: id }),
    [],
  );

  // ---- Calling → conversation : créer session + ouvrir TTS ------------------
  const handleAnswered = useCallback(async () => {
    setPhase("conversation_max");
    endedRef.current = false;
    conversationRef.current = [];
    turnLatenciesRef.current = [];
    sessionDurationRef.current = 0;


    // Crée la session DB
    try {
      if (state.userRoleProfile) {
        const sid = await createPRD4Session(state.userRoleProfile, "max");
        sessionIdRef.current = sid;
        trackEvent("prd4_session_started", { session_id: sid });
      }
    } catch (err) {
      console.warn("[PRD4] createSession failed (continuing without DB persistence):", err);
    }

    // Démarre le timer 5 min
    timer.reset();
    timer.start();

    // Réplique d'ouverture de Max (scriptée pour amorcer)
    const opening = state.userRoleProfile?.summary_for_user
      ? "Allô ?… Oui, j'écoute. À qui ai-je affaire ?"
      : "Allô ?";
    setMaxSubtitle(opening);
    const openingMsg: ConversationMessage = { role: "max", content: opening, timestamp: Date.now() };
    conversationRef.current = [openingMsg];
    addMessage(openingMsg);
    setAudioState("max_speaking");

    // TTS de l'ouverture
    try {
      const queue = new TTSQueue({ onError: (e) => console.warn("[TTS] opening error:", e.message) });
      ttsQueueRef.current = queue;
      for (const chunk of chunkTextForTTS(opening)) {
        queue.enqueue(chunk, { session_id: sessionIdRef.current ?? undefined });
      }
      await queue.drain();
    } catch (err) {
      console.warn("[TTS] opening failed:", err);
    }
    setAudioState("idle");
  }, [addMessage, setAudioState, setPhase, state.userRoleProfile, timer]);

  // ---- Conversation : process turn ------------------------------------------
  const processTurn = useCallback(
    async (userText: string) => {
      if (isProcessingRef.current || !userText.trim() || endedRef.current) return;
      isProcessingRef.current = true;
      setAudioState("max_thinking");
      setUserSubtitle(userText);

      const userMsg: ConversationMessage = { role: "user", content: userText, timestamp: Date.now() };
      conversationRef.current = [...conversationRef.current, userMsg];
      addMessage(userMsg);

      const elapsed = SESSION_DURATION_S - (timerRef.current?.remaining ?? SESSION_DURATION_S);

      try {
        const result = await processPRD4Turn({
          sessionId: sessionIdRef.current,
          conversationHistory: conversationRef.current.slice(0, -1),
          userMessage: userText,
          userRole: userRoleRef.current,
          timeElapsedSeconds: elapsed,
          characterName: "Max",
        });

        const ttsStart = performance.now();
        const blocker =
          (result.timings.max_ms ?? 0) >= (result.timings.rag_ms ?? 0) ? "max_ms" : "rag_ms";
        const maxMsg: ConversationMessage = {
          role: "max",
          content: result.maxResponse,
          timestamp: Date.now(),
          pipeline: {
            rag_ms: result.timings.rag_ms,
            max_ms: result.timings.max_ms,
            total_ms: result.timings.total_ms,
            blocker,
          },
        };
        conversationRef.current = [...conversationRef.current, maxMsg];
        addMessage(maxMsg);
        setMaxSubtitle(result.maxResponse);
        setAudioState("max_speaking");

        // TTS streaming
        const queue = new TTSQueue({ onError: (e) => console.warn("[TTS] turn error:", e.message) });
        ttsQueueRef.current = queue;
        for (const chunk of chunkTextForTTS(result.maxResponse)) {
          queue.enqueue(chunk, { session_id: sessionIdRef.current ?? undefined });
        }
        await queue.drain();
        const tts_ms = Math.round(performance.now() - ttsStart);
        if (maxMsg.pipeline) {
          maxMsg.pipeline.tts_ms = tts_ms;
          maxMsg.pipeline.total_ms = (maxMsg.pipeline.total_ms ?? 0) + tts_ms;
          if (tts_ms > (maxMsg.pipeline.max_ms ?? 0) && tts_ms > (maxMsg.pipeline.rag_ms ?? 0)) {
            maxMsg.pipeline.blocker = "tts_ms";
          }
        }

        // Persist conversation (best effort, fire-and-forget)
        if (sessionIdRef.current) {
          void updatePRD4Conversation(sessionIdRef.current, conversationRef.current);
        }

        // GM post-turn : vérifie end_recommended sans bloquer
        void result.postTurnPromise.then((ev) => {
          trackEvent("prd4_gm_post_turn", {
            session_id: sessionIdRef.current,
            turn_index: ev.turn_index,
            engagement_delta: ev.engagement_delta,
            end_recommended: ev.end_recommended,
            latency_ms: ev.latency_ms,
          });
          if (ev.end_recommended && !endedRef.current) {
            endedRef.current = true;
            void finalizeAndEnd("gm_end_recommended");
          }
        });

        trackEvent("prd4_turn_completed", {
          session_id: sessionIdRef.current,
          ...result.timings,
          rag_matches: result.ragMatches,
        });
        if (typeof result.timings?.total_ms === "number") {
          turnLatenciesRef.current.push(result.timings.total_ms);
        }

      } catch (err) {
        console.error("[PRD4] turn failed:", err);
        toast({ title: "Erreur dans la conversation", description: "Réessaie.", variant: "destructive" });
      } finally {
        isProcessingRef.current = false;
        setAudioState("idle");
      }
    },
    [addMessage, finalizeAndEnd, setAudioState],
  );

  // ---- PTT handlers : démarre/reprend STT, finalise au release -------------
  const ensureSTT = useCallback(async () => {
    if (sttRef.current?.isActive) return sttRef.current;
    const stt = new DeepgramSTT(
      (text, isFinal) => {
        setUserSubtitle(text);
        if (isFinal && text.trim()) {
          stt.pause();
          void processTurn(text);
        }
      },
      {
        onError: (err) => {
          console.error("[PRD4 STT]", err);
          incrementPttError();
          trackEvent("prd4_ptt_error", { phase: "conversation", message: err.message });
          setUserSubtitle("Micro indisponible — réessaie.");
        },
      },
    );
    await stt.start();
    stt.setManualMode(true); // toggle-to-talk: pas de silence auto-finalize
    stt.pause(); // démarre muet
    sttRef.current = stt;
    return stt;
  }, [incrementPttError, processTurn]);

  const handlePTTPress = useCallback(async () => {
    if (isProcessingRef.current || endedRef.current) return;
    try {
      const stt = await ensureSTT();
      stt?.resume();
      setAudioState("user_speaking");
      setUserSubtitle("");
    } catch (err) {
      console.warn("[PRD4] PTT start failed:", err);
      incrementPttError();
    }
  }, [ensureSTT, incrementPttError, setAudioState]);

  const handlePTTRelease = useCallback(() => {
    const stt = sttRef.current;
    if (!stt) return;
    stt.flush(); // déclenche le isFinal → processTurn
  }, []);

  const handleHangUp = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    void finalizeAndEnd("user_hangup");
  }, [finalizeAndEnd]);

  // Cleanup au démontage
  useEffect(() => () => { cleanupAudio(); }, [cleanupAudio]);

  // ---- End / Questionnaire --------------------------------------------------
  const handleEndContinue = useCallback(() => setPhase("questionnaire"), [setPhase]);

  const handleQuestionnaireSubmit = useCallback(
    async (answers: QuestionnairePRD4Answers) => {
      setSubmittingQuestionnaire(true);
      const latencies = turnLatenciesRef.current;
      const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
      const max = latencies.length ? Math.max(...latencies) : null;
      const data: QuestionnairePRD4Data = {
        version: "prd4",
        answers,
        technical: {
          session_id: sessionIdRef.current,
          submitted_at: new Date().toISOString(),
          duration_seconds: sessionDurationRef.current,
          teaser_seen: state.teaserSeen,
          teaser_skipped: state.teaserSkipped,
          role_profile: state.userRoleProfile,
          active_character: state.selectedCharacter,
          turn_count: conversationRef.current.filter((m) => m.role === "user").length,
          avg_latency_ms: avg,
          max_latency_ms: max,
          ptt_errors: state.pttErrors,
          transcript_available: conversationRef.current.length > 0,
        },
      };
      try {
        if (sessionIdRef.current) {
          await savePRD4Questionnaire(sessionIdRef.current, data);
          void syncPRD4QuestionnaireToNotion(sessionIdRef.current, data);
        }
        trackEvent("prd4_questionnaire_submitted", {
          session_id: sessionIdRef.current,
          turn_count: data.technical.turn_count,
          duration_s: data.technical.duration_seconds,
          ptt_errors: data.technical.ptt_errors,
          q1_film_seen: answers.q1_film_seen,
          q9_duration_feeling: answers.q9_duration_feeling,
        });
      } catch (err) {
        console.warn("[PRD4] questionnaire submit failed:", err);
      } finally {
        setSubmittingQuestionnaire(false);
        setPhase("thanks");
      }
    },
    [setPhase, state.pttErrors, state.selectedCharacter, state.teaserSeen, state.teaserSkipped, state.userRoleProfile],
  );

  const handleRestart = useCallback(() => {
    reset();
    setUserSubtitle("");
    setMaxSubtitle("");
    sessionIdRef.current = null;
    conversationRef.current = [];
    turnLatenciesRef.current = [];
    sessionDurationRef.current = 0;
    endedRef.current = false;
  }, [reset]);


  // ---- Render ---------------------------------------------------------------
  switch (state.phase) {
    case "welcome":
      return <WelcomeScreen onStart={handleStart} />;
    case "film_question":
      return <FilmQuestionScreen onAnswer={handleFilmAnswer} />;
    case "teaser":
      return <TeaserScreen onContinue={handleTeaserContinue} onSkip={handleTeaserSkip} />;
    case "role_capture":
      return (
        <RoleCaptureScreen
          onSubmit={handleRoleSubmit}
          onPTTError={handleRolePTTError}
          submitting={summarizing}
        />
      );
    case "role_summary":
      return state.userRoleProfile ? (
        <RoleSummaryScreen
          profile={state.userRoleProfile}
          onConfirm={handleRoleConfirm}
          onRestart={handleRoleRestart}
        />
      ) : null;
    case "character_select":
      return <CharacterSelectScreen onSelectMax={handleSelectMax} onLockedClick={handleLockedClick} />;
    case "calling_max":
      return <CallingMaxScreen onAnswered={handleAnswered} />;
    case "conversation_max":
      return (
        <ConversationScreen
          audioState={state.audioState}
          userSubtitle={userSubtitle}
          maxSubtitle={maxSubtitle}
          conversationLog={state.conversationLog}
          onPTTPress={handlePTTPress}
          onPTTRelease={handlePTTRelease}
          onHangUp={handleHangUp}
        />
      );
    case "end_session":
      return <EndSessionScreen onContinue={handleEndContinue} />;
    case "questionnaire":
      return (
        <QuestionnaireScreenPRD4
          teaserSeen={state.teaserSeen}
          onSubmit={handleQuestionnaireSubmit}
          submitting={submittingQuestionnaire}
        />
      );
    case "thanks":
      return <ThanksScreen onRestart={handleRestart} />;
    default:
      return null;

  }
};

export default IndexPRD4;
