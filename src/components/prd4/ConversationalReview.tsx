/**
 * Conversational questionnaire — final validation (lot 3).
 *
 * Summary per dimension, every text editable; a score changes only after the
 * participant opens « Modifier la note » and taps a pastille. Radar of the
 * scores (not-rated dimensions listed apart, never at 0). Consent to keep the
 * transcript (never the audio) is required; email and opt-ins are optional.
 * « Valider et envoyer » is the only trigger of the definitive save.
 *
 * Phone (lot 4): compact radar, dimension cards folded to a summary line (one
 * tap opens the editor), « Valider et envoyer » docked at the bottom.
 */
import { useMemo, useState } from "react";
import type {
  ConversationalDimensionKey,
  ConversationalScore,
  ConversationalSessionContext,
  DimensionAnswer,
  QuestionnaireConversationalData,
} from "@/types";
import { CONVERSATIONAL_DIMENSIONS } from "@/services/conversationalQuestionnaire";
import { DIMENSION_LABELS } from "@/services/conversationalQuestionnaireFlow";
import {
  buildFinalQuestionnaire,
  changeScore,
  editDimensionText,
  isValidEmail,
  reviewBlockers,
  startReview,
  type ReviewState,
} from "@/services/conversationalQuestionnaireReview";
import ConversationalRadar from "@/components/questionnaire/ConversationalRadar";
import type { QuestionnaireLayout } from "@/services/conversationalQuestionnaireLayout";
import { cn } from "@/lib/utils";
import QuestionnaireActionBar from "./QuestionnaireActionBar";

interface Props {
  dimensions: Record<ConversationalDimensionKey, DimensionAnswer>;
  sessionContext: ConversationalSessionContext;
  onSave: (data: QuestionnaireConversationalData) => void | Promise<void>;
  submitting?: boolean;
  layout?: QuestionnaireLayout;
}

const textareaClass =
  "min-h-[72px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";
const linkButton = "min-h-11 text-sm text-primary underline-offset-4 hover:underline";

function ScoreEditor({
  dimensionKey,
  score,
  onChange,
}: {
  dimensionKey: ConversationalDimensionKey;
  score: ConversationalScore;
  onChange: (score: ConversationalScore) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = DIMENSION_LABELS[dimensionKey];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3">
        <p className="text-sm text-foreground" data-testid={`review-score-${dimensionKey}`}>
          Note : <span className="font-medium">{score === null ? "non évalué" : `${score}/5`}</span>
        </p>
        <button type="button" className={linkButton} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Garder cette note" : "Modifier la note"}
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Note de ${label}`}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${label} : ${value} sur 5`}
              aria-pressed={score === value}
              onClick={() => onChange(value as ConversationalScore)}
              className={`h-11 w-11 rounded-full border text-sm font-medium ${
                score === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary"
              }`}
            >
              {value}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={score === null}
            onClick={() => onChange(null)}
            className={`min-h-11 rounded-full border px-3 text-sm ${score === null ? "border-primary text-primary" : "border-border text-foreground"}`}
          >
            Ne pas noter
          </button>
        </div>
      )}
    </div>
  );
}

function DimensionCard({
  dimensionKey,
  dimension,
  onEdit,
  onScore,
  folded = false,
}: {
  dimensionKey: ConversationalDimensionKey;
  dimension: DimensionAnswer;
  onEdit: (field: "answer" | "follow_up" | "score_comment", text: string) => void;
  onScore: (score: ConversationalScore) => void;
  /** Phone: start as a summary line; one tap opens the editor. */
  folded?: boolean;
}) {
  const [showComment, setShowComment] = useState(!!dimension.score_comment);
  const [open, setOpen] = useState(!folded);
  const label = DIMENSION_LABELS[dimensionKey];
  if (!open) {
    return (
      <article className="rounded-md border border-border bg-background/40" data-testid={`review-${dimensionKey}`}>
        <button
          type="button"
          className="flex min-h-11 w-full flex-col items-start gap-1 p-4 text-left"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          <span className="flex w-full items-center justify-between gap-3">
            <span className="text-base font-medium text-foreground">{label}</span>
            <span className="text-sm text-foreground" data-testid={`review-score-${dimensionKey}`}>
              {dimension.score === null ? "non évalué" : `${dimension.score}/5`}
            </span>
          </span>
          <span className="line-clamp-2 text-sm text-muted-foreground">{dimension.answer || "—"}</span>
          <span className="text-sm text-primary">Relire ou corriger — {label}</span>
        </button>
      </article>
    );
  }
  return (
    <article className="space-y-3 rounded-md border border-border bg-background/40 p-4" data-testid={`review-${dimensionKey}`}>
      <h3 className="text-base font-medium text-foreground">{label}</h3>
      <p className="text-xs text-muted-foreground">{dimension.question}</p>
      <label className="block space-y-1">
        <span className="sr-only">Ta réponse — {label}</span>
        <textarea
          className={textareaClass}
          value={dimension.answer}
          onChange={(e) => onEdit("answer", e.target.value)}
          aria-label={`Ta réponse — ${label}`}
        />
      </label>
      {dimension.follow_up && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{dimension.follow_up.question}</p>
          <textarea
            className={textareaClass}
            value={dimension.follow_up.answer}
            onChange={(e) => onEdit("follow_up", e.target.value)}
            placeholder="Pas de précision"
            aria-label={`Ta précision — ${label}`}
          />
        </div>
      )}
      <ScoreEditor dimensionKey={dimensionKey} score={dimension.score} onChange={onScore} />
      {showComment ? (
        <textarea
          className={textareaClass}
          value={dimension.score_comment ?? ""}
          onChange={(e) => onEdit("score_comment", e.target.value)}
          placeholder="Un mot sur cette note (facultatif)"
          aria-label={`Commentaire sur la note — ${label}`}
        />
      ) : (
        <button type="button" className={linkButton} onClick={() => setShowComment(true)}>
          Ajouter un mot sur la note
        </button>
      )}
    </article>
  );
}

export default function ConversationalReview({ dimensions, sessionContext, onSave, submitting, layout = "desktop" }: Props) {
  const phone = layout === "phone";
  const touchLabel = layout !== "desktop" ? "min-h-11" : "";
  const [review, setReview] = useState<ReviewState>(() => startReview(dimensions));
  const blockers = reviewBlockers(review);
  const emailInvalid = blockers.includes("email");
  const hasEmail = review.email.trim().length > 0 && isValidEmail(review.email);
  const radarValues = useMemo(() => {
    const values: Partial<Record<ConversationalDimensionKey, number | null>> = {};
    for (const key of CONVERSATIONAL_DIMENSIONS) values[key] = review.dimensions[key].score;
    return values;
  }, [review.dimensions]);

  const send = () => {
    const data = buildFinalQuestionnaire(review, sessionContext);
    if (data) void onSave(data);
  };

  return (
    <section className="space-y-6 rounded-lg border border-border bg-secondary/30 p-5" aria-label="Validation finale">
      <header className="space-y-1">
        <h2 className="font-serif text-xl text-foreground">Ta synthèse</h2>
        <p className="text-sm text-muted-foreground">
          Relis et corrige si besoin. Rien n'est envoyé avant « Valider et envoyer ».
        </p>
      </header>

      <ConversationalRadar values={radarValues} title="Tes notes par dimension" compact={phone} />

      <div className="space-y-4">
        {CONVERSATIONAL_DIMENSIONS.map((key) => (
          <DimensionCard
            key={key}
            dimensionKey={key}
            dimension={review.dimensions[key]}
            onEdit={(field, text) => setReview((current) => editDimensionText(current, key, field, text))}
            onScore={(score) => setReview((current) => changeScore(current, key, score))}
            folded={phone}
          />
        ))}
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <label className={cn("flex items-start gap-3 text-sm text-foreground", touchLabel)}>
          <input
            type="checkbox"
            checked={review.consent}
            onChange={(e) => setReview((current) => ({ ...current, consent: e.target.checked }))}
            className="mt-1 h-5 w-5 accent-primary"
          />
          J'accepte que la transcription de mes réponses soit conservée. L'audio n'est jamais enregistré.
        </label>

        <div className="space-y-2">
          <label htmlFor="conversational-email" className="text-sm text-foreground">Ton email (facultatif)</label>
          <p className="text-xs text-muted-foreground">
            Pour être tenu·e au courant du projet ou être contacté·e pour un feedback plus détaillé.
          </p>
          <input
            id="conversational-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="min-h-11 w-full rounded-md border border-border bg-secondary px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            placeholder="ton@email.com"
            value={review.email}
            aria-invalid={emailInvalid}
            onChange={(e) => setReview((current) => ({ ...current, email: e.target.value }))}
          />
          {emailInvalid && <p role="alert" className="text-xs text-destructive">Cet email ne semble pas valide.</p>}
          <label className={cn("flex items-start gap-3 text-sm", hasEmail ? "text-foreground" : "text-muted-foreground", touchLabel)}>
            <input
              type="checkbox"
              disabled={!hasEmail}
              checked={hasEmail && review.optInUpdates}
              onChange={(e) => setReview((current) => ({ ...current, optInUpdates: e.target.checked }))}
              className="mt-1 h-5 w-5 accent-primary"
            />
            Je souhaite être tenu·e au courant du projet.
          </label>
          <label className={cn("flex items-start gap-3 text-sm", hasEmail ? "text-foreground" : "text-muted-foreground", touchLabel)}>
            <input
              type="checkbox"
              disabled={!hasEmail}
              checked={hasEmail && review.optInFeedback}
              onChange={(e) => setReview((current) => ({ ...current, optInFeedback: e.target.checked }))}
              className="mt-1 h-5 w-5 accent-primary"
            />
            J'accepte d'être contacté·e pour un feedback plus détaillé.
          </label>
        </div>
      </div>

      <QuestionnaireActionBar docked={phone}>
        <button
          type="button"
          className="min-h-11 w-full rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={blockers.length > 0 || submitting}
          onClick={send}
        >
          {submitting ? "Envoi…" : "Valider et envoyer"}
        </button>
      </QuestionnaireActionBar>
    </section>
  );
}
