/**
 * Conversational end-of-experience questionnaire — voice path (lot 2) and
 * final validation (lot 3, `ConversationalReview`).
 *
 * Plan: docs/plan_questionnaire_conversationnel.md. One dimension at a time
 * with a « X/5 » marker. Questions and follow-ups are DISPLAYED, never read
 * aloud (no TTS here). Answers are dictated through the STT facade or typed,
 * shown while speaking and editable before validation. Nothing advances on
 * its own. A score is a tapped 1–5 pastille, a confirmed spoken score, or
 * « je préfère ne pas noter » (null) — never a default value.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import type {
  ConversationalDimensionKey,
  ConversationalScore,
  ConversationalSessionContext,
  QuestionnaireConversationalData,
} from "@/types";
import { CONVERSATIONAL_DIMENSIONS } from "@/services/conversationalQuestionnaire";
import {
  applyFollowUp,
  confirmScore,
  currentDimension,
  DIMENSION_LABELS,
  progressLabel,
  startFlow,
  submitAnswer,
  submitFollowUpAnswer,
  type FlowState,
} from "@/services/conversationalQuestionnaireFlow";
import type { FollowUpRequest } from "@/services/conversationalFollowUp";
import { useDictation } from "@/hooks/useDictation";
import ConversationalReview from "./ConversationalReview";

interface Props {
  questions: Record<ConversationalDimensionKey, string>;
  sessionContext: ConversationalSessionContext;
  /** Resolves to a follow-up question or null (none, failure, timeout). */
  requestFollowUp: (request: FollowUpRequest, signal: AbortSignal) => Promise<string | null>;
  onSave: (data: QuestionnaireConversationalData) => void | Promise<void>;
  onSkip?: () => void;
  submitting?: boolean;
}

const fieldClass =
  "min-h-[120px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";
const primaryButton =
  "min-h-11 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "min-h-11 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-primary disabled:opacity-50";

function VoiceAnswerField({
  id,
  label,
  value,
  onChange,
  placeholder,
  minRows = true,
  onListeningChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: boolean;
  onListeningChange?: (listening: boolean) => void;
}) {
  const [partial, setPartial] = useState("");
  const valueRef = useRef(value);
  valueRef.current = value;
  const dictation = useDictation({
    onPartial: setPartial,
    onFinal: (text) => {
      const current = valueRef.current.trim();
      onChange(current ? `${current} ${text}` : text);
    },
  });
  const listening = dictation.status === "listening" || dictation.status === "finalizing";
  const shown = partial ? `${value.trim() ? `${value.trim()} ` : ""}${partial}` : value;

  const busy = dictation.status !== "idle";
  useEffect(() => { onListeningChange?.(busy); }, [busy, onListeningChange]);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea
        id={id}
        value={shown}
        readOnly={listening}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Réponds à la voix ou écris ici…"}
        className={minRows ? fieldClass : `${fieldClass} min-h-[64px]`}
        aria-live={listening ? "polite" : undefined}
      />
      <div className="flex flex-wrap items-center gap-3">
        {listening ? (
          <button
            type="button"
            onClick={() => void dictation.stop()}
            disabled={dictation.status === "finalizing"}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
          >
            <Square className="h-4 w-4" aria-hidden />
            {dictation.status === "finalizing" ? "Je termine…" : "J'ai fini de parler"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void dictation.start()}
            disabled={dictation.status === "starting"}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary"
          >
            {dictation.status === "starting" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
            {dictation.status === "starting" ? "Micro en cours d'ouverture…" : "Répondre à la voix"}
          </button>
        )}
        {listening && <span className="text-xs text-muted-foreground">Je t'écoute — le texte s'affiche au fil de ta parole.</span>}
      </div>
      {dictation.error && <p role="alert" className="text-xs text-destructive">{dictation.error}</p>}
    </div>
  );
}

function ScoreStep({
  state,
  onConfirm,
}: {
  state: FlowState;
  onConfirm: (score: ConversationalScore, source: "touch" | "voice_confirmed", comment: string | null) => void;
}) {
  const [choice, setChoice] = useState<{ score: ConversationalScore; source: "touch" | "voice_confirmed" } | null>(null);
  const [comment, setComment] = useState("");
  const [dictating, setDictating] = useState(false);
  const proposed = state.proposedScore;
  const key = currentDimension(state);

  return (
    <div className="space-y-5">
      <p className="text-base text-foreground">Quelle note donnerais-tu à « {DIMENSION_LABELS[key].toLowerCase()} », de 1 à 5 ?</p>
      {proposed !== null && (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm text-foreground">Tu as parlé de {proposed}/5. Tu confirmes cette note ?</p>
          <button
            type="button"
            className={secondaryButton}
            aria-pressed={choice?.source === "voice_confirmed"}
            onClick={() => setChoice({ score: proposed, source: "voice_confirmed" })}
          >
            Confirmer {proposed}/5
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-3" role="group" aria-label="Note de 1 à 5">
        {[1, 2, 3, 4, 5].map((value) => {
          const selected = choice?.score === value;
          return (
            <button
              key={value}
              type="button"
              aria-label={`Note ${value} sur 5`}
              aria-pressed={selected}
              onClick={() => setChoice({ score: value as ConversationalScore, source: "touch" })}
              className={`h-12 w-12 rounded-full border text-base font-medium transition-colors ${
                selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-pressed={choice !== null && choice.score === null}
        onClick={() => setChoice({ score: null, source: "touch" })}
        className={`${secondaryButton} ${choice !== null && choice.score === null ? "border-primary text-primary" : ""}`}
      >
        Je préfère ne pas noter
      </button>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Un mot sur cette note ? (facultatif)</p>
        <VoiceAnswerField id={`score-comment-${key}`} label="Commentaire sur la note" value={comment} onChange={setComment} minRows={false} placeholder="Facultatif" onListeningChange={setDictating} />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButton}
          disabled={choice === null || dictating}
          onClick={() => choice && onConfirm(choice.score, choice.source, comment)}
        >
          {state.index >= CONVERSATIONAL_DIMENSIONS.length - 1 ? "Terminer" : "Question suivante"}
        </button>
      </div>
    </div>
  );
}

const ConversationalQuestionnaire = ({ questions, sessionContext, requestFollowUp, onSave, onSkip, submitting }: Props) => {
  const [state, setState] = useState<FlowState>(() => startFlow(questions));
  const [draft, setDraft] = useState("");
  const [dictating, setDictating] = useState(false);
  const requestRef = useRef(requestFollowUp);
  requestRef.current = requestFollowUp;
  const key = currentDimension(state);
  const dimension = state.dimensions[key];

  useEffect(() => {
    if (state.step !== "follow_up_pending") return;
    const controller = new AbortController();
    let active = true;
    requestRef
      .current({ dimension: key, question: dimension.question, answer: dimension.answer, context: sessionContext }, controller.signal)
      .catch(() => null)
      .then((question) => { if (active) setState((current) => applyFollowUp(current, question)); });
    return () => { active = false; controller.abort(); };
    // Runs once per pending request; the dimension texts are frozen at that point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.index]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 tablet:px-10">
      <div className="mx-auto max-w-xl space-y-6 tablet:max-w-2xl">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-primary">Ton retour</p>
            {state.step !== "review" && (
              <p className="font-mono text-sm text-muted-foreground" aria-label={`Question ${progressLabel(state)}`}>{progressLabel(state)}</p>
            )}
          </div>
          {state.step !== "review" && <p className="text-sm text-muted-foreground">{DIMENSION_LABELS[key]}</p>}
        </header>

        {state.step !== "review" && (
          <section className="space-y-5 rounded-lg border border-border bg-secondary/30 p-5">
            <h2 className="font-serif text-xl leading-snug text-foreground tablet:text-2xl">{dimension.question}</h2>

            {state.step === "answer" && (
              <>
                <VoiceAnswerField key={`answer-${key}`} id={`answer-${key}`} label="Ta réponse" value={draft} onChange={setDraft} onListeningChange={setDictating} />
                <div className="flex justify-end">
                  <button
                    type="button"
                    className={primaryButton}
                    disabled={!draft.trim() || dictating}
                    onClick={() => { setState((current) => submitAnswer(current, draft)); setDraft(""); }}
                  >
                    Valider ma réponse
                  </button>
                </div>
              </>
            )}

            {state.step !== "answer" && dimension.answer && (
              <blockquote className="border-l-2 border-primary/50 pl-3 text-sm text-muted-foreground">{dimension.answer}</blockquote>
            )}

            {state.step === "follow_up_pending" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Un instant…
              </p>
            )}

            {state.step === "follow_up" && dimension.follow_up && (
              <>
                <p className="text-base font-medium text-foreground">{dimension.follow_up.question}</p>
                <VoiceAnswerField key={`follow-up-${key}`} id={`follow-up-${key}`} label="Ta précision" value={draft} onChange={setDraft} onListeningChange={setDictating} />
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => { setState((current) => submitFollowUpAnswer(current, "")); setDraft(""); }}
                  >
                    Passer
                  </button>
                  <button
                    type="button"
                    className={primaryButton}
                    disabled={!draft.trim() || dictating}
                    onClick={() => { setState((current) => submitFollowUpAnswer(current, draft)); setDraft(""); }}
                  >
                    Valider ma précision
                  </button>
                </div>
              </>
            )}

            {state.step === "score" && dimension.follow_up?.answer && (
              <blockquote className="border-l-2 border-primary/50 pl-3 text-sm text-muted-foreground">{dimension.follow_up.answer}</blockquote>
            )}

            {state.step === "score" && (
              <ScoreStep
                key={key}
                state={state}
                onConfirm={(score, source, comment) => setState((current) => confirmScore(current, score, source, comment))}
              />
            )}
          </section>
        )}

        {state.step === "review" && (
          <ConversationalReview dimensions={state.dimensions} sessionContext={sessionContext} onSave={onSave} submitting={submitting} />
        )}

        {onSkip && (
          <div className="text-center">
            <button type="button" onClick={onSkip} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              Passer le questionnaire
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationalQuestionnaire;
