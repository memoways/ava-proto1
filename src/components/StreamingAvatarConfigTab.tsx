import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronRight, Loader2, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  checkTavusConfiguration,
  getAvatarProviderStatus,
  type TavusConfigurationCheck,
} from "@/services/streamingAvatar/api";
import {
  HEYGEN_CARTESIA_MODELS,
  HEYGEN_ELEVENLABS_MODELS,
  HEYGEN_ELEVENLABS_STABILITY_ONLY,
  HEYGEN_FISH_MODELS,
  normalizeTavusLanguages,
  STREAMING_AVATAR_BOUNDS,
  type NumberBounds,
} from "../../supabase/functions/_shared/streamingAvatarRequest";
import {
  getStreamingAvatarSettings,
  loadStreamingAvatarSettingsFromDB,
  saveStreamingAvatarSettingsToDB,
  TAVUS_EMOTIONS,
  type HeyGenAvatarSettings,
  type HeyGenElevenLabsVoice,
  type HeyGenVoiceSettings,
  type StreamingAvatarProviderId,
  type StreamingAvatarSettings,
  type TavusEmotion,
} from "@/services/streamingAvatar";
import StreamingAvatarTestPanel from "@/components/StreamingAvatarTestPanel";


const providerCopy: Record<StreamingAvatarProviderId, { title: string; description: string }> = {
  heygen: {
    title: "HeyGen LiveAvatar",
    description: "Le texte Ava est envoyé avec avatar.speak_text. Le LLM HeyGen n'est pas utilisé.",
  },
  tavus: {
    title: "Tavus",
    description: "Une persona Echo reçoit conversation.echo : Perception, STT et LLM Tavus restent désactivés.",
  },
};

export default function StreamingAvatarConfigTab() {
  const [settings, setSettings] = useState<StreamingAvatarSettings>(
    getStreamingAvatarSettings,
  );
  const [saved, setSaved] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<StreamingAvatarProviderId, boolean> | null>(null);

  useEffect(() => {
    void loadStreamingAvatarSettingsFromDB()
      .then((value) => {
        setSettings(value);
        setSaved(value);
      })
      .finally(() => setLoading(false));
    void getAvatarProviderStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(saved),
    [saved, settings],
  );

  const update = (patch: Partial<StreamingAvatarSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await saveStreamingAvatarSettingsToDB(settings);
      setSaved(settings);
      toast.success("Configuration Streaming Avatar sauvegardée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sauvegarde impossible");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div>;
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Video className="h-5 w-5" />
          Streaming Avatar Config
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ava produit le texte final. Le fournisseur sélectionné ne fait que le prononcer et le rendre en vidéo temps réel.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(["heygen", "tavus"] as const).map((provider) => {
          const active = settings.activeProvider === provider;
          return (
            <button
              type="button"
              key={provider}
              onClick={() => update({ activeProvider: provider })}
              className={`rounded-lg border p-4 text-left transition-colors ${
                active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{providerCopy[provider].title}</span>
                <ProviderStatus configured={status?.[provider]} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {providerCopy[provider].description}
              </p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connexion et repli</CardTitle>
          <CardDescription>Les délais sont figés au début de chaque appel.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <NumberField
            label="Timeout de connexion (ms)"
            value={settings.connectionTimeoutMs}
            min={3000}
            max={30000}
            onChange={(connectionTimeoutMs) => update({ connectionTimeoutMs })}
          />
          <NumberField
            label="Délai avant repli TTS (ms)"
            value={settings.fallbackTimeoutMs}
            min={1000}
            max={15000}
            onChange={(fallbackTimeoutMs) => update({ fallbackTimeoutMs })}
          />
        </CardContent>
      </Card>

      {settings.activeProvider === "heygen" ? (
        <HeyGenFields
          value={settings.heygen}
          onChange={(heygen) => update({ heygen })}
        />
      ) : (
        <TavusFields
          value={settings.tavus}
          onChange={(tavus) => update({ tavus })}
        />
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sauvegarder
        </Button>
      </div>

      <StreamingAvatarTestPanel settings={settings} dirty={dirty} />
    </div>
  );
}


function HeyGenFields({
  value,
  onChange,
}: {
  value: StreamingAvatarSettings["heygen"];
  onChange: (value: StreamingAvatarSettings["heygen"]) => void;
}) {
  const patch = (next: Partial<typeof value>) => onChange({ ...value, ...next });
  const voice = value.voiceSettings;
  const patchVoice = (next: Partial<HeyGenVoiceSettings>) => patch({ voiceSettings: { ...voice, ...next } });
  const eleven = voice.elevenLabs;
  const patchEleven = (next: Partial<HeyGenElevenLabsVoice>) => patchVoice({ elevenLabs: { ...eleven, ...next } });
  const fish = voice.fish;
  const cartesia = voice.cartesia;
  const stabilityOnly = HEYGEN_ELEVENLABS_STABILITY_ONLY.includes(eleven.model);
  const b = STREAMING_AVATAR_BOUNDS;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">HeyGen LiveAvatar</CardTitle>
        <CardDescription>Mode FULL commandé uniquement par avatar.speak_text ; interruption par avatar.interrupt, posture d'écoute pendant que le joueur parle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SectionTitle>Essentiel</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Avatar ID" value={value.avatarId} onChange={(avatarId) => patch({ avatarId })} />
          <TextField label="Voice ID" value={value.voiceId} onChange={(voiceId) => patch({ voiceId })} />
          <TextField label="Langue" hint="Code de langue LiveAvatar, ex. fr." value={value.language} onChange={(language) => patch({ language })} />
          <EnumField
            label="Qualité vidéo"
            hint="Très haute : plus nette, plus de débit."
            value={value.quality}
            options={HEYGEN_QUALITY_LABELS}
            onChange={(quality) => patch({ quality })}
          />
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div><Label>Sandbox</Label><p className="text-xs text-muted-foreground">À garder actif pendant les essais.</p></div>
            <Switch checked={value.sandbox} onCheckedChange={(sandbox) => patch({ sandbox })} />
          </div>
        </div>
        <Advanced>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Context ID (optionnel)" value={value.contextId} onChange={(contextId) => patch({ contextId })} />
            <EnumField
              label="Encodage vidéo"
              hint="H264 par défaut ; VP8 si un navigateur décode mal."
              value={value.encoding}
              options={{ H264: "H264 (défaut)", VP8: "VP8" }}
              onChange={(encoding) => patch({ encoding })}
            />
            <NumberField
              label="Durée maximale de session (s)"
              hint="0 = limite de l'offre LiveAvatar ; sinon 60 à 3 600."
              bounds={b.heygenMaxSessionSeconds}
              value={value.maxSessionDurationSeconds}
              onChange={(maxSessionDurationSeconds) => patch({ maxSessionDurationSeconds })}
            />
            <EnumField
              label="Réglages de voix"
              hint="Seuls les champs lus par le moteur choisi sont envoyés."
              value={voice.engine}
              options={HEYGEN_VOICE_ENGINE_LABELS}
              onChange={(engine) => patchVoice({ engine })}
            />
          </div>
          {voice.engine === "elevenLabs" && (
            <div className="grid gap-4 md:grid-cols-2">
              <EnumField
                label="Modèle ElevenLabs"
                hint="v3, v3 conversationnel et v4 Turbo ne lisent que la stabilité."
                value={eleven.model}
                options={sameLabels(HEYGEN_ELEVENLABS_MODELS)}
                onChange={(model) => patchEleven({ model })}
              />
              <NumberField label="Stabilité" hint="0 à 1 ; haut = voix plus égale." bounds={b.elevenLabsStability} value={eleven.stability} onChange={(stability) => patchEleven({ stability })} />
              <NumberField label="Vitesse" hint="0,8 à 1,2." bounds={b.elevenLabsSpeed} value={eleven.speed} disabled={stabilityOnly} onChange={(speed) => patchEleven({ speed })} />
              <NumberField label="Similarité" hint="0 à 1 ; fidélité au timbre d'origine." bounds={b.elevenLabsSimilarity} value={eleven.similarityBoost} disabled={stabilityOnly} onChange={(similarityBoost) => patchEleven({ similarityBoost })} />
              <NumberField label="Style" hint="0 à 1 ; exagération du jeu." bounds={b.elevenLabsStyle} value={eleven.style} disabled={stabilityOnly} onChange={(style) => patchEleven({ style })} />
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div><Label>Speaker boost</Label><p className="text-xs text-muted-foreground">Renforce la ressemblance, un peu plus lent.</p></div>
                <Switch checked={eleven.useSpeakerBoost} disabled={stabilityOnly} onCheckedChange={(useSpeakerBoost) => patchEleven({ useSpeakerBoost })} />
              </div>
            </div>
          )}
          {voice.engine === "fish" && (
            <div className="grid gap-4 md:grid-cols-2">
              <EnumField
                label="Modèle Fish"
                value={fish.model}
                options={sameLabels(HEYGEN_FISH_MODELS)}
                onChange={(model) => patchVoice({ fish: { ...fish, model } })}
              />
              <NumberField label="Vitesse" hint="0,8 à 1,2." bounds={b.fishSpeed} value={fish.speed} onChange={(speed) => patchVoice({ fish: { ...fish, speed } })} />
              <EnumField
                label="Latence"
                hint="Basse : réponse plus rapide, voix un peu moins riche."
                value={fish.latencyMode}
                options={{ balanced: "Équilibrée (défaut)", normal: "Normale", low: "Basse" }}
                onChange={(latencyMode) => patchVoice({ fish: { ...fish, latencyMode } })}
              />
            </div>
          )}
          {voice.engine === "cartesia" && (
            <div className="grid gap-4 md:grid-cols-2">
              <EnumField
                label="Modèle Cartesia"
                value={cartesia.model}
                options={sameLabels(HEYGEN_CARTESIA_MODELS)}
                onChange={(model) => patchVoice({ cartesia: { ...cartesia, model } })}
              />
              <NumberField label="Vitesse" hint="0,6 à 1,5." bounds={b.cartesiaSpeed} value={cartesia.speed} onChange={(speed) => patchVoice({ cartesia: { ...cartesia, speed } })} />
            </div>
          )}
        </Advanced>
      </CardContent>
    </Card>
  );
}

function TavusFields({
  value,
  onChange,
}: {
  value: StreamingAvatarSettings["tavus"];
  onChange: (value: StreamingAvatarSettings["tavus"]) => void;
}) {
  const patch = (next: Partial<typeof value>) => onChange({ ...value, ...next });
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<TavusConfigurationCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const b = STREAMING_AVATAR_BOUNDS;
  const runCheck = async () => {
    setChecking(true);
    setCheck(null);
    setCheckError(null);
    try {
      setCheck(await checkTavusConfiguration(value));
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tavus</CardTitle>
        <CardDescription>API v2 actuelle : « Replica » s'appelle désormais <strong>Face ID</strong> (GET /v2/faces) et « Persona » s'appelle <strong>PAL ID</strong> (GET /v2/pals, préfixe <code>p…</code>). Le PAL doit être en pipeline_mode « echo » : il porte la voix, Ava fournit exclusivement le texte. Interruption par <code>conversation.interrupt</code>.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SectionTitle>Essentiel</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Face ID (ex-Replica ID)" value={value.replicaId} onChange={(replicaId) => patch({ replicaId })} />
          <TextField label="PAL ID (ex-Persona ID)" value={value.personaId} onChange={(personaId) => patch({ personaId })} />
          <LanguagesField value={value.languages} onChange={(languages) => patch({ languages })} />
          <NumberField label="Durée maximale (s)" hint="60 à 3 600." bounds={b.tavusMaxCallSeconds} value={value.maxDurationSeconds} onChange={(maxDurationSeconds) => patch({ maxDurationSeconds })} />
          <div className="space-y-2">
            <Label>Émotion en parlant</Label>
            <Select value={value.emotion} onValueChange={(emotion: TavusEmotion) => patch({ emotion })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAVUS_EMOTIONS.map((emotion) => (
                  <SelectItem key={emotion} value={emotion}>{TAVUS_EMOTION_LABELS[emotion]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Émotion en écoutant</Label>
            <Select value={value.listeningEmotion} onValueChange={(listeningEmotion: TavusEmotion) => patch({ listeningEmotion })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAVUS_EMOTIONS.map((emotion) => (
                  <SelectItem key={emotion} value={emotion}>{TAVUS_EMOTION_LABELS[emotion]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            En parlant : <code>conversation.set_emotion</code> et balise Echo sur chaque réplique. En écoutant : <code>set_emotion</code> à la connexion, à la fin de chaque réplique et toutes les 5 s. « Tristesse » en écoute donne un air de chien battu ; « Neutre » (défaut) reste fermé sans apitoyer. Exige un Face Phoenix-4 ou 4.5.
          </p>
        </div>
        <Advanced>
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField label="Fermeture si personne ne rejoint (s)" hint="10 à 3 600 ; défaut 120." bounds={b.tavusAbsentTimeoutSeconds} value={value.participantAbsentTimeoutSeconds} onChange={(participantAbsentTimeoutSeconds) => patch({ participantAbsentTimeoutSeconds })} />
            <NumberField label="Fermeture après départ du joueur (s)" hint="0 à 3 600 ; défaut 30." bounds={b.tavusLeftTimeoutSeconds} value={value.participantLeftTimeoutSeconds} onChange={(participantLeftTimeoutSeconds) => patch({ participantLeftTimeoutSeconds })} />
            <SwitchField label="Sous-titres Tavus" hint="enable_closed_captions ; Ava affiche déjà ses sous-titres." checked={value.enableClosedCaptions} onChange={(enableClosedCaptions) => patch({ enableClosedCaptions })} />
            <SwitchField label="Fond vert" hint="apply_greenscreen ; sans effet sur un Face Phoenix-4.5." checked={value.applyGreenscreen} onChange={(applyGreenscreen) => patch({ applyGreenscreen })} />
            <SwitchField label="Politique UE" hint="policy « eu » : réglages automatiques résolus selon l'AI Act." checked={value.euPolicy} onChange={(euPolicy) => patch({ euPolicy })} />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Vérifier la configuration</Label>
                <p className="text-xs text-muted-foreground">Conversation test_mode : aucune salle, le PAL ne rejoint pas. Affiche la voix du PAL en lecture seule.</p>
              </div>
              <Button variant="outline" size="sm" onClick={runCheck} disabled={checking || !value.personaId}>
                {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vérifier
              </Button>
            </div>
            {checkError && <p className="text-xs text-destructive">{checkError}</p>}
            {check && (
              <div className="space-y-1 text-xs">
                <p className="text-emerald-600">Accepté par Tavus (statut {check.conversationStatus || "—"}).</p>
                <p className="text-muted-foreground">Voix du PAL (modifiable seulement dans Tavus) :</p>
                <pre className="overflow-x-auto rounded bg-muted p-2">{JSON.stringify(check.palVoice, null, 2)}</pre>
              </div>
            )}
          </div>
        </Advanced>
      </CardContent>
    </Card>
  );
}

const HEYGEN_QUALITY_LABELS: Record<HeyGenAvatarSettings["quality"], string> = {
  very_high: "Très haute",
  high: "Haute (défaut)",
  medium: "Moyenne",
  low: "Basse",
};

const HEYGEN_VOICE_ENGINE_LABELS: Record<HeyGenVoiceSettings["engine"], string> = {
  default: "Réglages de la voix dans LiveAvatar (défaut)",
  elevenLabs: "ElevenLabs",
  fish: "Fish",
  cartesia: "Cartesia",
};

const TAVUS_EMOTION_LABELS: Record<TavusEmotion, string> = {
  sadness: "Tristesse — abattu (défaut)",
  fear: "Peur",
  anger: "Colère",
  disgust: "Dégoût",
  contempt: "Mépris",
  surprise: "Surprise",
  neutral: "Neutre — fermé, impassible",
  happiness: "Joie — sourit (déconseillé)",
};

function sameLabels<T extends string>(values: readonly T[]): Record<T, string> {
  return Object.fromEntries(values.map((value) => [value, value as string])) as Record<T, string>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium">{children}</p>;
}

function Advanced({ children }: { children: ReactNode }) {
  return (
    <Collapsible className="space-y-4 border-t pt-3">
      <CollapsibleTrigger className="group flex w-full items-center gap-1 text-sm font-medium">
        <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
        Avancé
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Hint({ text }: { text?: string }) {
  return text ? <p className="text-xs text-muted-foreground">{text}</p> : null;
}

function TextField({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} /><Hint text={hint} /></div>;
}

function NumberField({ label, hint, value, min, max, step, bounds, disabled, onChange }: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  bounds?: NumberBounds;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className={disabled ? "text-muted-foreground" : undefined}>{label}</Label>
      <Input
        type="number"
        min={bounds?.min ?? min}
        max={bounds?.max ?? max}
        step={bounds?.step ?? step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <Hint text={disabled ? "Non lu par ce modèle : non envoyé." : hint} />
    </div>
  );
}

function EnumField<T extends string>({ label, hint, value, options, onChange }: {
  label: string;
  hint?: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.entries(options) as [T, string][]).map(([key, text]) => (
            <SelectItem key={key} value={key}>{text}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Hint text={hint} />
    </div>
  );
}

function SwitchField({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div><Label>{label}</Label><Hint text={hint} /></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Comma separated codes, committed on blur so typing "fr, " keeps the comma. */
function LanguagesField({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState(value.join(", "));
  useEffect(() => setDraft(value.join(", ")), [value]);
  return (
    <div className="space-y-2">
      <Label>Langues</Label>
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onChange(normalizeTavusLanguages(draft.split(",")))}
      />
      <Hint text="Codes séparés par des virgules (fr, en…) ; la première ouvre la conversation." />
    </div>
  );
}

function ProviderStatus({ configured }: { configured?: boolean }) {
  if (configured === undefined) return <span className="text-xs text-muted-foreground">Statut inconnu</span>;
  return configured
    ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Secret configuré</span>
    : <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" />Secret absent</span>;
}
