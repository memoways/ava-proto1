import { useState } from "react";
import type { QuestionnaireData } from "@/types";

interface QuestionnaireScreenProps {
  onSubmit: (data: QuestionnaireData) => void;
}

const defaultData: QuestionnaireData = {
  experience_rating: 5,
  experience_word: "",
  nps: 5,
  immersion_story: 3,
  immersion_natural: 3,
  mechanic_listening: 3,
  mechanic_latency: "pas_du_tout",
  narration_understood: "oui",
  narration_continue: 3,
  value_pay: "peut_etre",
  value_price: "",
  value_format: "",
  open_feedback: "",
  contact_name: "",
  contact_email: "",
  opt_in_feedback: false,
  opt_in_updates: false,
};

const SliderField = ({ label, value, onChange, min = 1, max = 10 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-foreground">{label}</span>
      <span className="font-mono text-primary">{value}/{max}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-primary"
    />
  </div>
);

const RadioField = ({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-2">
    <p className="text-sm text-foreground">{label}</p>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
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

const QuestionnaireScreen = ({ onSubmit }: QuestionnaireScreenProps) => {
  const [data, setData] = useState<QuestionnaireData>(defaultData);
  const update = <K extends keyof QuestionnaireData>(key: K, value: QuestionnaireData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  return (
    <div className="flex min-h-screen flex-col items-center bg-background py-12 px-6 animate-fade-in">
      <div className="w-full max-w-lg space-y-10">
        <div className="text-center space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-primary">Questionnaire</p>
          <h2 className="text-2xl font-bold text-foreground">Votre avis compte</h2>
        </div>

        {/* 1. Expérience globale */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Expérience globale</h3>
          <SliderField label="Note de l'expérience" value={data.experience_rating} onChange={(v) => update("experience_rating", v)} />
          <div className="space-y-1">
            <label className="text-sm text-foreground">En un mot, décrivez ce que vous venez de vivre</label>
            <input
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              placeholder="Un mot…"
              value={data.experience_word}
              onChange={(e) => update("experience_word", e.target.value)}
            />
          </div>
          <SliderField label="Recommanderiez-vous cette expérience ? (NPS)" value={data.nps} min={0} max={10} onChange={(v) => update("nps", v)} />
        </section>

        {/* 2. Immersion */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Immersion</h3>
          <SliderField label='Vous êtes-vous senti·e "dans l&#39;histoire" ?' value={data.immersion_story} onChange={(v) => update("immersion_story", v)} min={1} max={5} />
          <SliderField label="La conversation avec Max était-elle naturelle ?" value={data.immersion_natural} onChange={(v) => update("immersion_natural", v)} min={1} max={5} />
        </section>

        {/* 3. Mécanique */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Mécanique</h3>
          <SliderField label="Max vous écoutait-il vraiment ?" value={data.mechanic_listening} onChange={(v) => update("mechanic_listening", v)} min={1} max={5} />
          <RadioField
            label="La latence vous a-t-elle gêné·e ?"
            value={data.mechanic_latency}
            onChange={(v) => update("mechanic_latency", v as QuestionnaireData["mechanic_latency"])}
            options={[
              { value: "pas_du_tout", label: "Pas du tout" },
              { value: "un_peu", label: "Un peu" },
              { value: "beaucoup", label: "Beaucoup" },
            ]}
          />
        </section>

        {/* 4. Narration */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Narration</h3>
          <RadioField
            label="Avez-vous compris ce qu'on attendait de vous ?"
            value={data.narration_understood}
            onChange={(v) => update("narration_understood", v as QuestionnaireData["narration_understood"])}
            options={[
              { value: "oui", label: "Oui" },
              { value: "non", label: "Non" },
              { value: "partiellement", label: "Partiellement" },
            ]}
          />
          <SliderField label="Envie de continuer / d'en savoir plus ?" value={data.narration_continue} onChange={(v) => update("narration_continue", v)} min={1} max={5} />
        </section>

        {/* 5. Valeur perçue */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Valeur perçue</h3>
          <RadioField
            label="Prêt·e à payer pour une version complète ?"
            value={data.value_pay}
            onChange={(v) => update("value_pay", v as QuestionnaireData["value_pay"])}
            options={[
              { value: "oui", label: "Oui" },
              { value: "non", label: "Non" },
              { value: "peut_etre", label: "Peut-être" },
            ]}
          />
          <RadioField
            label="Fourchette de prix"
            value={data.value_price}
            onChange={(v) => update("value_price", v)}
            options={[
              { value: "0-5", label: "0–5€" },
              { value: "5-15", label: "5–15€" },
              { value: "15-30", label: "15–30€" },
              { value: "30+", label: "30€+" },
            ]}
          />
          <RadioField
            label="Format préféré"
            value={data.value_format}
            onChange={(v) => update("value_format", v)}
            options={[
              { value: "web", label: "Web" },
              { value: "mobile", label: "Mobile" },
              { value: "vr", label: "VR" },
              { value: "autre", label: "Autre" },
            ]}
          />
        </section>

        {/* 6. Ouvert */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ouvert</h3>
          <div className="space-y-1">
            <label className="text-sm text-foreground">Qu'améliorer en priorité ?</label>
            <textarea
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none min-h-[80px]"
              placeholder="Vos suggestions…"
              value={data.open_feedback}
              onChange={(e) => update("open_feedback", e.target.value)}
            />
          </div>
        </section>

        {/* 7. Contact */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Rester en contact</h3>
          <p className="text-xs text-muted-foreground">Facultatif — laissez vos coordonnées si vous le souhaitez.</p>
          <div className="space-y-1">
            <label className="text-sm text-foreground">Prénom et nom</label>
            <input
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              placeholder="Jean Dupont"
              value={data.contact_name}
              onChange={(e) => update("contact_name", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-foreground">Email</label>
            <input
              type="email"
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              placeholder="jean@example.com"
              value={data.contact_email}
              onChange={(e) => update("contact_email", e.target.value)}
            />
          </div>
          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={data.opt_in_feedback}
                onChange={(e) => update("opt_in_feedback", e.target.checked)}
                className="mt-0.5 accent-primary h-4 w-4"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Je suis disponible pour partager plus de feedbacks sur l'expérience
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={data.opt_in_updates}
                onChange={(e) => update("opt_in_updates", e.target.checked)}
                className="mt-0.5 accent-primary h-4 w-4"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Je souhaite être tenu·e au courant de la suite du projet
              </span>
            </label>
          </div>
        </section>

        <button
          onClick={() => onSubmit(data)}
          className="w-full rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
};

export default QuestionnaireScreen;
