/**
 * PRD4 §14.2 — Nouveau questionnaire (10 questions + email/opt-ins).
 */
import { useState } from "react";
import type { QuestionnairePRD4Answers } from "@/types";

interface Props {
  teaserSeen: boolean;
  onSubmit: (answers: QuestionnairePRD4Answers) => void;
  onSkip?: () => void;
  submitting?: boolean;
}


const defaultAnswers: QuestionnairePRD4Answers = {
  q1_film_seen: "non",
  q2_teaser_helpful: null,
  q3_role_clarity: 3,
  q4_role_summary_accuracy: 3,
  q5_ptt_clarity: 3,
  q6_max_used_role: 3,
  q7_max_credible: 3,
  q8_want_other_characters: 3,
  q8b_next_character_wanted: "aucun",
  q9_duration_feeling: "juste",
  q10_open_feedback: "",
  contact_email: "",
  opt_in_updates: false,
  opt_in_feedback: false,
};

const Slider = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-foreground">{label}</span>
      <span className="font-mono text-primary">{value}/5</span>
    </div>
    <input
      type="range"
      min={1}
      max={5}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-primary"
    />
  </div>
);

const Radio = <T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) => (
  <div className="space-y-2">
    <p className="text-sm text-foreground">{label}</p>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md border px-3 py-1.5 text-xs transition-all ${
            value === opt.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

const QuestionnaireScreenPRD4 = ({ teaserSeen, onSubmit, onSkip, submitting }: Props) => {
  const [a, setA] = useState<QuestionnairePRD4Answers>({
    ...defaultAnswers,
    q2_teaser_helpful: teaserSeen ? 3 : null,
  });
  const update = <K extends keyof QuestionnairePRD4Answers>(key: K, value: QuestionnairePRD4Answers[K]) =>
    setA((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-xl space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-primary">Feedback</p>
          <h2 className="font-serif text-3xl text-foreground">Ton retour sur l'expérience</h2>
          <p className="text-sm text-muted-foreground">10 questions courtes — 2 min.</p>
        </header>

        <section className="space-y-6 rounded-lg border border-border bg-secondary/30 p-6">
          <Radio
            label="1. Avais-tu vu le film avant l'expérience ?"
            options={[
              { value: "oui", label: "Oui" },
              { value: "non", label: "Non" },
            ]}
            value={a.q1_film_seen}
            onChange={(v) => update("q1_film_seen", v)}
          />

          {teaserSeen && (
            <Slider
              label="2. Le rappel / teaser t'a-t-il aidé à entrer dans l'histoire ?"
              value={a.q2_teaser_helpful ?? 3}
              onChange={(v) => update("q2_teaser_helpful", v)}
            />
          )}

          <Slider
            label="3. As-tu compris quel rôle tu devais inventer ?"
            value={a.q3_role_clarity}
            onChange={(v) => update("q3_role_clarity", v)}
          />
          <Slider
            label="4. Le résumé de ton personnage était-il juste ?"
            value={a.q4_role_summary_accuracy}
            onChange={(v) => update("q4_role_summary_accuracy", v)}
          />
          <Slider
            label="5. Le push-to-talk était-il clair à utiliser ?"
            value={a.q5_ptt_clarity}
            onChange={(v) => update("q5_ptt_clarity", v)}
          />
          <Slider
            label="6. As-tu eu l'impression que Max tenait compte de ton rôle ?"
            value={a.q6_max_used_role}
            onChange={(v) => update("q6_max_used_role", v)}
          />
          <Slider
            label="7. Max t'a-t-il semblé crédible comme personnage ?"
            value={a.q7_max_credible}
            onChange={(v) => update("q7_max_credible", v)}
          />
          <Slider
            label="8. As-tu eu envie d'appeler Emma, Ava ou Léo ?"
            value={a.q8_want_other_characters}
            onChange={(v) => update("q8_want_other_characters", v)}
          />
          <Radio
            label="Qui aurais-tu voulu appeler ensuite ?"
            options={[
              { value: "emma", label: "Emma" },
              { value: "ava", label: "Ava" },
              { value: "leo", label: "Léo" },
              { value: "max", label: "Max encore" },
              { value: "aucun", label: "Aucun" },
            ]}
            value={a.q8b_next_character_wanted}
            onChange={(v) => update("q8b_next_character_wanted", v)}
          />
          <Radio
            label="9. Comment as-tu ressenti la durée de l'expérience ?"
            options={[
              { value: "trop_court", label: "Trop court" },
              { value: "juste", label: "Juste" },
              { value: "trop_long", label: "Trop long" },
            ]}
            value={a.q9_duration_feeling}
            onChange={(v) => update("q9_duration_feeling", v)}
          />

          <div className="space-y-1">
            <label className="text-sm text-foreground">
              10. Qu'est-ce qui t'a le plus marqué ou sorti de l'expérience ?
            </label>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              placeholder="Quelques mots libres…"
              value={a.q10_open_feedback}
              onChange={(e) => update("q10_open_feedback", e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-secondary/30 p-6">
          <p className="text-sm text-foreground">Souhaites-tu laisser ton email ?</p>
          <p className="text-xs text-muted-foreground">
            Laisse ton email si tu veux être tenu·e au courant du projet ou si tu acceptes d'être contacté·e
            pour un feedback plus détaillé.
          </p>
          <input
            type="email"
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            placeholder="ton@email.com"
            value={a.contact_email}
            onChange={(e) => update("contact_email", e.target.value)}
          />
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={a.opt_in_updates}
              onChange={(e) => update("opt_in_updates", e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            Je souhaite être tenu·e au courant du projet.
          </label>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={a.opt_in_feedback}
              onChange={(e) => update("opt_in_feedback", e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            J'accepte d'être contacté·e pour un feedback plus détaillé.
          </label>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onSubmit(a)}
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Envoi…" : "Envoyer mon feedback"}
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={submitting}
              className="w-full rounded-md border border-border bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 sm:w-auto sm:px-6"
            >
              Passer
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default QuestionnaireScreenPRD4;
