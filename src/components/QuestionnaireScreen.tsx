import { useState, useMemo } from "react";
import type { QuestionnaireData, OnboardingVariant, VoiceModality } from "@/types";

interface QuestionnaireScreenProps {
  onSubmit: (data: QuestionnaireData) => void;
  variant?: OnboardingVariant | null;
  voiceModality?: VoiceModality | null;
}

const defaultData: QuestionnaireData = {
  experience_rating: 5,
  experience_word: "",
  nps: 5,
  gm_clarity: 3,
  gm_role_understood: "oui",
  gm_immersion_intro: 3,
  voice_naturalness: 3,
  voice_gm_naturalness: 3,
  voice_modality_comfort: 3,
  latency_perceived: "acceptable",
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

/* ───── Field helpers ───── */
const SliderField = ({ label, value, onChange, min = 1, max = 5, labels }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; labels?: [string, string] }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-foreground">{label}</span>
      <span className="font-mono text-primary">{value}/{max}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" />
    {labels && <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>{labels[0]}</span><span>{labels[1]}</span></div>}
  </div>
);

const RadioField = ({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-2">
    <p className="text-sm text-foreground">{label}</p>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className={`rounded-md border px-3 py-1.5 text-xs transition-all ${value === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

const TextInput = ({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1">
    <label className="text-sm text-foreground">{label}</label>
    <input className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

/* ───── Block definitions ───── */
type BlockId = "global" | "gm" | "variant" | "voice" | "latency" | "immersion" | "value" | "contact";

interface BlockDef {
  id: BlockId;
  title: string;
  subtitle?: string;
}

function getBlocks(variant: OnboardingVariant | null | undefined, voiceModality: VoiceModality | null | undefined): BlockDef[] {
  return [
    { id: "global", title: "Expérience globale" },
    { id: "gm", title: "Cadrage & introduction" },
    { id: "variant", title: variant === "A" ? "Variante A — Co-création" : "Variante B — Narrateur", subtitle: variant === "A" ? "Votre ressenti sur la co-création de personnage" : "Votre ressenti sur la narration d'introduction" },
    { id: "voice", title: "Voix & modalité", subtitle: voiceModality === "push_to_talk" ? "Vous étiez en mode Push-to-Talk" : "Vous étiez en micro ouvert" },
    { id: "latency", title: "Latence & réactivité" },
    { id: "immersion", title: "Immersion & mécanique" },
    { id: "value", title: "Valeur perçue" },
    { id: "contact", title: "Rester en contact", subtitle: "Facultatif" },
  ];
}

/* ───── Main component ───── */
const QuestionnaireScreen = ({ onSubmit, variant, voiceModality }: QuestionnaireScreenProps) => {
  const [data, setData] = useState<QuestionnaireData>(defaultData);
  const [blockIndex, setBlockIndex] = useState(0);
  const update = <K extends keyof QuestionnaireData>(key: K, value: QuestionnaireData[K]) => setData((d) => ({ ...d, [key]: value }));

  const blocks = useMemo(() => getBlocks(variant, voiceModality), [variant, voiceModality]);
  const block = blocks[blockIndex];
  const progress = ((blockIndex + 1) / blocks.length) * 100;
  const isLast = blockIndex === blocks.length - 1;

  const next = () => { if (!isLast) setBlockIndex((i) => i + 1); else onSubmit(data); };
  const prev = () => { if (blockIndex > 0) setBlockIndex((i) => i - 1); };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background py-10 px-5 animate-fade-in">
      {/* Progress bar */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/60 mb-1.5">
          <span>{blockIndex + 1}/{blocks.length}</span>
          <span>{block.title}</span>
        </div>
        <div className="h-1 w-full rounded-full bg-border/30 overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="w-full max-w-lg space-y-6 flex-1">
        {/* Block header */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">{block.title}</h2>
          {block.subtitle && <p className="text-xs text-muted-foreground mt-1">{block.subtitle}</p>}
        </div>

        {/* Block fields */}
        <div className="space-y-5">
          {block.id === "global" && (<>
            <SliderField label="Note globale de l'expérience" value={data.experience_rating} onChange={(v) => update("experience_rating", v)} min={1} max={10} labels={["Décevant", "Incroyable"]} />
            <TextInput label="En un mot, décrivez ce que vous venez de vivre" placeholder="Un mot…" value={data.experience_word} onChange={(v) => update("experience_word", v)} />
            <SliderField label="Recommanderiez-vous cette expérience ? (NPS)" value={data.nps} onChange={(v) => update("nps", v)} min={0} max={10} labels={["Pas du tout", "Absolument"]} />
          </>)}

          {block.id === "gm" && (<>
            <SliderField label="Le cadrage était-il clair ?" value={data.gm_clarity} onChange={(v) => update("gm_clarity", v)} labels={["Confus", "Très clair"]} />
            <RadioField label="Avez-vous compris votre rôle dans l'expérience ?" value={data.gm_role_understood} onChange={(v) => update("gm_role_understood", v as any)} options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }, { value: "partiellement", label: "Partiellement" }]} />
            <SliderField label="L'introduction était-elle immersive ?" value={data.gm_immersion_intro} onChange={(v) => update("gm_immersion_intro", v)} labels={["Pas du tout", "Très"]} />
          </>)}

          {block.id === "variant" && variant === "A" && (<>
            <SliderField label="Vous êtes-vous senti·e engagé·e dans la co-création ?" value={data.a_cocreation_engaged ?? 3} onChange={(v) => update("a_cocreation_engaged", v)} labels={["Passif", "Très actif"]} />
            <SliderField label="L'échange était-il naturel ?" value={data.a_cocreation_natural ?? 3} onChange={(v) => update("a_cocreation_natural", v)} labels={["Artificiel", "Naturel"]} />
            <TextInput label="Remarque sur cette phase (optionnel)" placeholder="Votre ressenti…" value={data.a_cocreation_freeform ?? ""} onChange={(v) => update("a_cocreation_freeform", v)} />
          </>)}

          {block.id === "variant" && variant === "B" && (<>
            <SliderField label="Le narrateur vous a-t-il plongé dans l'histoire ?" value={data.b_narrator_immersive ?? 3} onChange={(v) => update("b_narrator_immersive", v)} labels={["Pas du tout", "Très"]} />
            <TextInput label="Remarque sur cette phase (optionnel)" placeholder="Votre ressenti…" value={data.b_narrator_freeform ?? ""} onChange={(v) => update("b_narrator_freeform", v)} />
          </>)}

          {block.id === "variant" && !variant && (
            <p className="text-sm text-muted-foreground italic">Variante non identifiée — passez au bloc suivant.</p>
          )}

          {block.id === "voice" && (<>
            <SliderField label="Naturalité de la voix de Max" value={data.voice_naturalness} onChange={(v) => update("voice_naturalness", v)} labels={["Robotique", "Humaine"]} />
            <SliderField label="Naturalité de la voix du narrateur / GM" value={data.voice_gm_naturalness} onChange={(v) => update("voice_gm_naturalness", v)} labels={["Robotique", "Humaine"]} />
            <SliderField label="Confort de la modalité (micro ouvert / PTT)" value={data.voice_modality_comfort} onChange={(v) => update("voice_modality_comfort", v)} labels={["Inconfortable", "Très confortable"]} />
            {voiceModality === "push_to_talk" && (<>
              <SliderField label="Le bouton Push-to-Talk était-il clair ?" value={data.ptt_button_clear ?? 3} onChange={(v) => update("ptt_button_clear", v)} labels={["Confus", "Intuitif"]} />
              <RadioField label="Problèmes de relâchement du bouton ?" value={data.ptt_release_issues ?? "aucun"} onChange={(v) => update("ptt_release_issues", v as any)} options={[{ value: "aucun", label: "Aucun" }, { value: "parfois", label: "Parfois" }, { value: "souvent", label: "Souvent" }]} />
            </>)}
          </>)}

          {block.id === "latency" && (<>
            <RadioField label="Comment avez-vous perçu le temps de réponse ?" value={data.latency_perceived} onChange={(v) => update("latency_perceived", v as any)} options={[{ value: "fluide", label: "Fluide" }, { value: "acceptable", label: "Acceptable" }, { value: "genante", label: "Gênante" }]} />
            <RadioField label="La latence vous a-t-elle gêné·e ?" value={data.mechanic_latency} onChange={(v) => update("mechanic_latency", v as any)} options={[{ value: "pas_du_tout", label: "Pas du tout" }, { value: "un_peu", label: "Un peu" }, { value: "beaucoup", label: "Beaucoup" }]} />
            <TextInput label="Y a-t-il eu des moments où c'était pire ? (optionnel)" placeholder="Ex: au milieu, au début…" value={data.latency_moments ?? ""} onChange={(v) => update("latency_moments", v)} />
          </>)}

          {block.id === "immersion" && (<>
            <SliderField label='Vous êtes-vous senti·e "dans l&#39;histoire" ?' value={data.immersion_story} onChange={(v) => update("immersion_story", v)} labels={["Pas du tout", "Complètement"]} />
            <SliderField label="La conversation avec Max était-elle naturelle ?" value={data.immersion_natural} onChange={(v) => update("immersion_natural", v)} labels={["Artificielle", "Naturelle"]} />
            <SliderField label="Max vous écoutait-il vraiment ?" value={data.mechanic_listening} onChange={(v) => update("mechanic_listening", v)} labels={["Pas du tout", "Parfaitement"]} />
            <RadioField label="Avez-vous compris ce qu'on attendait de vous ?" value={data.narration_understood} onChange={(v) => update("narration_understood", v as any)} options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }, { value: "partiellement", label: "Partiellement" }]} />
            <SliderField label="Envie de continuer / d'en savoir plus ?" value={data.narration_continue} onChange={(v) => update("narration_continue", v)} labels={["Aucune", "Très forte"]} />
            <div className="space-y-1">
              <label className="text-sm text-foreground">Qu'améliorer en priorité ?</label>
              <textarea className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none min-h-[80px]" placeholder="Vos suggestions…" value={data.open_feedback} onChange={(e) => update("open_feedback", e.target.value)} />
            </div>
          </>)}

          {block.id === "value" && (<>
            <RadioField label="Prêt·e à payer pour une version complète ?" value={data.value_pay} onChange={(v) => update("value_pay", v as any)} options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }, { value: "peut_etre", label: "Peut-être" }]} />
            <RadioField label="Fourchette de prix" value={data.value_price} onChange={(v) => update("value_price", v)} options={[{ value: "0-5", label: "0–5€" }, { value: "5-15", label: "5–15€" }, { value: "15-30", label: "15–30€" }, { value: "30+", label: "30€+" }]} />
            <RadioField label="Format préféré" value={data.value_format} onChange={(v) => update("value_format", v)} options={[{ value: "web", label: "Web" }, { value: "mobile", label: "Mobile" }, { value: "vr", label: "VR" }, { value: "autre", label: "Autre" }]} />
          </>)}

          {block.id === "contact" && (<>
            <TextInput label="Prénom et nom" placeholder="Jean Dupont" value={data.contact_name} onChange={(v) => update("contact_name", v)} />
            <div className="space-y-1">
              <label className="text-sm text-foreground">Email</label>
              <input type="email" className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" placeholder="jean@example.com" value={data.contact_email} onChange={(e) => update("contact_email", e.target.value)} />
            </div>
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={data.opt_in_feedback} onChange={(e) => update("opt_in_feedback", e.target.checked)} className="mt-0.5 accent-primary h-4 w-4" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Je suis disponible pour partager plus de feedbacks</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={data.opt_in_updates} onChange={(e) => update("opt_in_updates", e.target.checked)} className="mt-0.5 accent-primary h-4 w-4" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Je souhaite être tenu·e au courant de la suite</span>
              </label>
            </div>
          </>)}
        </div>
      </div>

      {/* Nav buttons */}
      <div className="w-full max-w-lg flex items-center justify-between pt-8">
        <button onClick={prev} disabled={blockIndex === 0} className={`px-5 py-2.5 rounded-md text-sm transition-all ${blockIndex === 0 ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground border border-border hover:border-primary/50"}`}>
          ← Précédent
        </button>
        <button onClick={next} className="px-6 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all hover:bg-primary/90">
          {isLast ? "Envoyer" : "Suivant →"}
        </button>
      </div>
    </div>
  );
};

export default QuestionnaireScreen;
