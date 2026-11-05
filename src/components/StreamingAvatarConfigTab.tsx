import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronRight, Loader2, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  checkAnamConfiguration,
  checkTavusConfiguration,
  getAvatarProviderStatus,
  type AnamConfigurationCheck,
  type TavusConfigurationCheck,
} from "@/services/streamingAvatar/api";
import {
  ANAM_CARTESIA_EMOTIONS,
  ANAM_DEFAULT_EMOTION_CUES,
  ANAM_DIRECTOR_NOTES_MODELS,
  ANAM_ELEVENLABS_MODELS,
  ANAM_ELEVENLABS_STABILITY_ONLY,
  ANAM_ELEVENLABS_V4,
  ANAM_PERFORMANCE_EMOTIONS,
  ANAM_SMILING_CUE_TAGS,
  ANAM_STYLE_PROMPT_MAX,
  type AnamAvatarModel,
  type AnamCueTag,
  type AnamEmotionCueMap,
  type AnamEmotionCueMode,
  type AnamPerformanceEmotion,
  type AnamPresetStyle,
  type AnamStyleMode,
  type AnamVoiceEngine,
  HEYGEN_CARTESIA_MODELS,
  HEYGEN_ELEVENLABS_MODELS,
  HEYGEN_ELEVENLABS_STABILITY_ONLY,
  HEYGEN_FISH_MODELS,
  LEMONSLICE_BOUNDS,
  LEMONSLICE_PROMPT_MAX,
  lemonSliceActionsAllowed,
  lemonSliceAspectRatioSent,
  lemonSliceEditImageRead,
  type LemonSliceAspectRatio,
  type LemonSliceEditImageMode,
  type LemonSliceEditImageVariant,
  type LemonSliceModel,
  normalizeTavusLanguages,
  STREAMING_AVATAR_BOUNDS,
  type NumberBounds,
} from "../../supabase/functions/_shared/streamingAvatarRequest";
import {
  getStreamingAvatarSettings,
  loadStreamingAvatarSettingsFromDB,
  saveStreamingAvatarSettingsToDB,
  TAVUS_EMOTIONS,
  type AnamAvatarSettings,
  type HeyGenAvatarSettings,
  type HeyGenElevenLabsVoice,
  type HeyGenVoiceSettings,
  type LemonSliceAvatarSettings,
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
  anam: {
    title: "Anam",
    description: "Le texte Ava est envoyé par talk stream (LLM Anam coupé) ; le micro n'est jamais ouvert côté Anam.",
  },
  lemonslice: {
    title: "LemonSlice",
    description: "La voix du personnage d'Ava (TTS actuel) anime le visage ; vidéo et son reviennent par une salle Daily privée.",
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
        {(["heygen", "tavus", "anam", "lemonslice"] as const).map((provider) => {
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
      ) : settings.activeProvider === "tavus" ? (
        <TavusFields
          value={settings.tavus}
          onChange={(tavus) => update({ tavus })}
        />
      ) : settings.activeProvider === "anam" ? (
        <AnamFields
          value={settings.anam}
          onChange={(anam) => update({ anam })}
        />
      ) : (
        <LemonSliceFields
          value={settings.lemonslice}
          onChange={(lemonslice) => update({ lemonslice })}
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

function AnamFields({
  value,
  onChange,
}: {
  value: AnamAvatarSettings;
  onChange: (value: AnamAvatarSettings) => void;
}) {
  const patch = (next: Partial<AnamAvatarSettings>) => onChange({ ...value, ...next });
  const notes = value.directorNotes;
  const patchNotes = (next: Partial<typeof notes>) => patch({ directorNotes: { ...notes, ...next } });
  const voice = value.voiceGenerationOptions;
  const patchVoice = (next: Partial<typeof voice>) => patch({ voiceGenerationOptions: { ...voice, ...next } });
  const eleven = voice.elevenLabs;
  const patchEleven = (next: Partial<typeof eleven>) => patchVoice({ elevenLabs: { ...eleven, ...next } });
  const cartesia = voice.cartesia;
  const fish = voice.fish;
  const session = value.sessionOptions;
  const patchSession = (next: Partial<typeof session>) => patch({ sessionOptions: { ...session, ...next } });
  const notesRead = ANAM_DIRECTOR_NOTES_MODELS.includes(value.avatarModel);
  const stabilityOnly = ANAM_ELEVENLABS_STABILITY_ONLY.includes(eleven.model);
  const v4 = ANAM_ELEVENLABS_V4.includes(eleven.model);
  const b = STREAMING_AVATAR_BOUNDS;
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<AnamConfigurationCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const runCheck = async () => {
    setChecking(true);
    setCheck(null);
    setCheckError(null);
    try {
      setCheck(await checkAnamConfiguration(value));
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Anam</CardTitle>
        <CardDescription>Persona éphémère : Ava force <code>llmId: CUSTOMER_CLIENT_V1</code> (LLM Anam coupé) et <code>skipGreeting</code>. Chaque réplique part en talk stream, texte nu, la balise de jeu passant par le canal de données ; l'accueil attend que la vidéo soit prête ; interruption par <code>interruptPersona</code>. Avatar et voix se choisissent dans le Lab Anam (identifiants UUID).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SectionTitle>Essentiel</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Avatar ID" value={value.avatarId} onChange={(avatarId) => patch({ avatarId })} />
          <TextField label="Voice ID" hint="Voix choisie chez Anam (D2a) ; la voix d'Ava n'est pas utilisée. Voix expressives recommandées par Anam : une voix Cartesia Sonic 3.6 (choisie par son Voice ID), ou ElevenLabs v3 conversational / v4." value={value.voiceId} onChange={(voiceId) => patch({ voiceId })} />
          <EnumField
            label="Modèle d'avatar"
            hint="Cara 4.1 Express recommandé par Anam. Les notes de jeu ne sont lues que par Cara 4."
            value={value.avatarModel}
            options={ANAM_AVATAR_MODEL_LABELS}
            onChange={(avatarModel) => patch({ avatarModel })}
          />
          <TextField label="Langue" hint="Code ISO 639, ex. fr." value={value.languageCode} onChange={(languageCode) => patch({ languageCode })} />
          <EnumField
            label="Émotion du visage"
            hint="Évolutive : la balise suit l'intention de jeu de chaque réplique (état de parole proposé par le Game Master, sa mémoire, ou la réplique). Fixe : la même balise toute la session."
            value={value.emotionCueMode}
            options={ANAM_EMOTION_CUE_MODE_LABELS}
            onChange={(emotionCueMode) => patch({ emotionCueMode })}
          />
          <EnumField
            label={value.emotionCueMode === "fixed" ? "Balise de jeu en parlant" : "Balise de repli"}
            hint={value.emotionCueMode === "fixed"
              ? "Envoyée au visage seul (Director Note cue) pour toute la réplique ; la voix garde son débit posé."
              : "Utilisée seulement pour une réplique sans intention de jeu."}
            value={value.speakingCue}
            options={ANAM_CUE_LABELS}
            onChange={(speakingCue) => patch({ speakingCue })}
          />
          <EnumField
            label="Style de jeu (Director Notes)"
            hint={notesRead ? "Personnalisé : attitude en parlant et au repos ; préréglé : un style, sans attitude au repos." : "Non lu par ce modèle : non envoyé."}
            value={notes.mode}
            options={ANAM_STYLE_MODE_LABELS}
            onChange={(mode) => patchNotes({ mode })}
          />
          {notes.mode === "preset" && (
            <EnumField
              label="Style préréglé"
              value={notes.presetStyle}
              options={ANAM_PRESET_LABELS}
              onChange={(presetStyle) => patchNotes({ presetStyle })}
            />
          )}
          {notes.mode !== "default" && (
            <NumberField label="Expressivité" hint="0 à 1 ; bas = plus posé." bounds={b.anamExpressivity} value={notes.expressivity} disabled={!notesRead} onChange={(expressivity) => patchNotes({ expressivity })} />
          )}
        </div>
        {value.emotionCueMode === "evolving" && (
          <AnamEmotionCueTables value={value.emotionCues} onChange={(emotionCues) => patch({ emotionCues })} />
        )}
        {notes.mode === "custom" && (
          <div className="grid gap-4 md:grid-cols-2">
            <PromptField label="Attitude en parlant" value={notes.customStylePrompt} disabled={!notesRead} onChange={(customStylePrompt) => patchNotes({ customStylePrompt })} />
            <PromptField label="Attitude au repos (écoute)" value={notes.customIdlingStylePrompt} disabled={!notesRead} onChange={(customIdlingStylePrompt) => patchNotes({ customIdlingStylePrompt })} />
          </div>
        )}
        <Advanced>
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField label="Durée maximale de session (s)" hint="60 à 3 600 ; défaut 900." bounds={b.anamMaxSessionSeconds} value={value.maxSessionLengthSeconds} onChange={(maxSessionLengthSeconds) => patch({ maxSessionLengthSeconds })} />
            <EnumField
              label="Qualité vidéo"
              value={session.videoQuality}
              options={{ high: "Haute (défaut)", auto: "Automatique" }}
              onChange={(videoQuality) => patchSession({ videoQuality })}
            />
            <EnumField
              label="Région"
              hint="Automatique : Anam choisit la plus proche."
              value={session.region}
              options={{ auto: "Automatique (défaut)", eu: "Europe", us: "États-Unis" }}
              onChange={(region) => patchSession({ region })}
            />
            <EnumField
              label="Politique de région"
              hint={session.region === "auto" ? "Sans région : non envoyée." : "Stricte : échoue plutôt que changer de région."}
              value={session.regionPolicy}
              options={{ preferred: "Préférée (défaut)", strict: "Stricte" }}
              onChange={(regionPolicy) => patchSession({ regionPolicy })}
            />
            <SwitchField label="Enregistrement chez Anam" hint="dataRetention.recording ; désactivé par défaut." checked={session.keepRecording} onChange={(keepRecording) => patchSession({ keepRecording })} />
            <SwitchField label="Transcriptions chez Anam" hint="dataRetention.transcripts ; désactivé par défaut." checked={session.keepTranscripts} onChange={(keepTranscripts) => patchSession({ keepTranscripts })} />
            <EnumField
              label="Réglages de voix"
              hint="Choisir le moteur de la voix Anam ; seuls les champs qu'il lit sont envoyés. Sans réglages, les voix ElevenLabs intégrées passent en eleven_v4_turbo depuis le 3 novembre 2026."
              value={voice.engine}
              options={ANAM_VOICE_ENGINE_LABELS}
              onChange={(engine) => patchVoice({ engine })}
            />
          </div>
          {voice.engine === "elevenLabs" && (
            <div className="grid gap-4 md:grid-cols-2">
              <EnumField
                label="Modèle ElevenLabs"
                hint="Expressifs : eleven_v3_conversational (stabilité seule) ou eleven_v4 / eleven_v4_turbo (stabilité et similarité). Choisir v3 conversational pour garder une voix intégrée en v3 après le 3 novembre."
                value={eleven.model}
                options={sameLabels(ANAM_ELEVENLABS_MODELS)}
                onChange={(model) => patchEleven({ model })}
              />
              <NumberField label="Stabilité" hint="0 à 1." bounds={b.elevenLabsStability} value={eleven.stability} onChange={(stability) => patchEleven({ stability })} />
              <NumberField label="Similarité" hint="0 à 1." bounds={b.elevenLabsSimilarity} value={eleven.similarityBoost} disabled={stabilityOnly} onChange={(similarityBoost) => patchEleven({ similarityBoost })} />
              <NumberField label="Style" hint="0 à 1." bounds={b.elevenLabsStyle} value={eleven.style} disabled={stabilityOnly || v4} onChange={(style) => patchEleven({ style })} />
              <NumberField label="Vitesse" hint="0,7 à 1,2." bounds={b.anamElevenLabsSpeed} value={eleven.speed} disabled={stabilityOnly || v4} onChange={(speed) => patchEleven({ speed })} />
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div><Label>Speaker boost</Label><Hint text={stabilityOnly || v4 ? "Non lu par ce modèle : non envoyé." : undefined} /></div>
                <Switch checked={eleven.useSpeakerBoost} disabled={stabilityOnly || v4} onCheckedChange={(useSpeakerBoost) => patchEleven({ useSpeakerBoost })} />
              </div>
            </div>
          )}
          {voice.engine === "cartesia" && (
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField label="Volume" hint="0,5 à 2." bounds={b.anamCartesiaVolume} value={cartesia.volume} onChange={(volume) => patchVoice({ cartesia: { ...cartesia, volume } })} />
              <NumberField label="Vitesse" hint="0,6 à 1,5." bounds={b.anamCartesiaSpeed} value={cartesia.speed} onChange={(speed) => patchVoice({ cartesia: { ...cartesia, speed } })} />
              <p className="text-xs text-muted-foreground md:col-span-2">Sonic 3 et Sonic 3.6 : volume, vitesse, émotion. Sonic 3.6, le plus expressif, se choisit par la voix (Voice ID) dans le Lab Anam.</p>
              <EnumField
                label="Émotion de la voix"
                value={cartesia.emotion}
                options={sameLabels(ANAM_CARTESIA_EMOTIONS)}
                onChange={(emotion) => patchVoice({ cartesia: { ...cartesia, emotion } })}
              />
            </div>
          )}
          {voice.engine === "fish" && (
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField label="Volume" hint="0,5 à 2." bounds={b.anamFishVolume} value={fish.volume} onChange={(volume) => patchVoice({ fish: { ...fish, volume } })} />
              <NumberField label="Vitesse" hint="0,5 à 2." bounds={b.anamFishSpeed} value={fish.speed} onChange={(speed) => patchVoice({ fish: { ...fish, speed } })} />
            </div>
          )}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Vérifier la configuration</Label>
                <p className="text-xs text-muted-foreground">Anam émet un jeton pour ces réglages, aussitôt abandonné : aucune session ne démarre.</p>
              </div>
              <Button variant="outline" size="sm" onClick={runCheck} disabled={checking || !value.avatarId || !value.voiceId}>
                {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vérifier
              </Button>
            </div>
            {checkError && <p className="text-xs text-destructive">{checkError}</p>}
            {check && (
              <div className="space-y-1 text-xs">
                <p className="text-emerald-600">Accepté par Anam.</p>
                <pre className="overflow-x-auto rounded bg-muted p-2">{JSON.stringify({ personaConfig: check.personaConfig, sessionOptions: check.sessionOptions }, null, 2)}</pre>
              </div>
            )}
          </div>
        </Advanced>
      </CardContent>
    </Card>
  );
}

const ANAM_AVATAR_MODEL_LABELS: Record<AnamAvatarModel, string> = {
  "cara-4.1-express": "Cara 4.1 Express — recommandé (défaut)",
  "cara-4": "Cara 4",
  "cara-4-latest": "Cara 4 latest — instable, déconseillé en production",
  "cara-3": "Cara 3 — sans notes de jeu",
};

const ANAM_CUE_LABELS: Record<AnamCueTag, string> = {
  none: "Aucune balise",
  sad: "[sad] — triste",
  distressed: "[distressed] — détresse",
  concerned: "[concerned] — inquiet",
  angry: "[angry] — colère",
  surprised: "[surprised] — surpris",
  curious: "[curious] — curieux",
  supportive: "[supportive] — bienveillant",
  warm: "[warm] — chaleureux (déconseillé)",
  playful: "[playful] — joueur (déconseillé)",
  happy: "[happy] — joyeux (déconseillé)",
  laughter: "[laughter] — rire (déconseillé)",
};

const ANAM_EMOTION_CUE_MODE_LABELS: Record<AnamEmotionCueMode, string> = {
  evolving: "Évolutive — suit l'intention de jeu (défaut)",
  fixed: "Fixe — une balise toute la session",
};

const ANAM_EMOTION_LABELS: Record<AnamPerformanceEmotion, string> = {
  neutral: "Neutre",
  tense: "Tendu",
  angry: "En colère",
  accusatory: "Accusateur",
  sad: "Triste",
  fragile: "Fragile",
  scared: "Apeuré",
  urgent: "Pressant",
  warm: "Chaleureux",
  sarcastic: "Sarcastique",
};

const ANAM_CHARACTER_LABELS: Record<string, string> = { max: "Max", emma: "Emma" };

/** Emotion → cue per character; defaults never smile, a smiling choice is flagged. */
function AnamEmotionCueTables({ value, onChange }: {
  value: Record<string, AnamEmotionCueMap>;
  onChange: (value: Record<string, AnamEmotionCueMap>) => void;
}) {
  return (
    <Collapsible className="rounded-md border p-3">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
        <ChevronRight className="h-4 w-4" />Correspondance émotion → balise, par personnage
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">
        <Hint text="Émotion de l'intention de jeu à gauche, balise envoyée au visage à droite. « Aucune balise » laisse le style de base (Director Notes). Défauts sans sourire." />
        {Object.entries(value).map(([character, table]) => {
          const smiling = ANAM_PERFORMANCE_EMOTIONS.filter((emotion) => ANAM_SMILING_CUE_TAGS.includes(table[emotion]));
          return (
            <div key={character} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <SectionTitle>{ANAM_CHARACTER_LABELS[character] ?? character}</SectionTitle>
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, [character]: { ...ANAM_DEFAULT_EMOTION_CUES } })}>
                  Défauts
                </Button>
              </div>
              {smiling.length > 0 && (
                <p className="text-xs text-destructive">Balise souriante pour : {smiling.map((emotion) => ANAM_EMOTION_LABELS[emotion]).join(", ")}.</p>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {ANAM_PERFORMANCE_EMOTIONS.map((emotion) => (
                  <EnumField
                    key={emotion}
                    label={ANAM_EMOTION_LABELS[emotion]}
                    value={table[emotion]}
                    options={ANAM_CUE_LABELS}
                    onChange={(cue) => onChange({ ...value, [character]: { ...table, [emotion]: cue } })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

const ANAM_STYLE_MODE_LABELS: Record<AnamStyleMode, string> = {
  custom: "Personnalisé — parler et repos (défaut)",
  preset: "Préréglé",
  default: "Aucun — style de l'avatar",
};

const ANAM_PRESET_LABELS: Record<AnamPresetStyle, string> = {
  sad: "Triste (sad)",
  distressed: "Détresse (distressed)",
  neutral: "Neutre",
  supportive: "Bienveillant",
  warm: "Chaleureux (déconseillé)",
  playful: "Joueur (déconseillé)",
  happy: "Joyeux (déconseillé)",
  angry: "Colère",
};

const ANAM_VOICE_ENGINE_LABELS: Record<AnamVoiceEngine, string> = {
  default: "Réglages de la voix dans Anam (défaut)",
  elevenLabs: "ElevenLabs",
  cartesia: "Cartesia Sonic-3",
  fish: "Fish Audio",
};

function PromptField({ label, value, disabled, max = ANAM_STYLE_PROMPT_MAX, onChange }: { label: string; value: string; disabled?: boolean; max?: number; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className={disabled ? "text-muted-foreground" : undefined}>{label}</Label>
      <Textarea rows={4} maxLength={max} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      <Hint text={disabled ? "Non lu par ce modèle : non envoyé." : `${value.length} / ${max} caractères ; en anglais de préférence.`} />
    </div>
  );
}

function LemonSliceFields({
  value,
  onChange,
}: {
  value: LemonSliceAvatarSettings;
  onChange: (value: LemonSliceAvatarSettings) => void;
}) {
  const patch = (next: Partial<LemonSliceAvatarSettings>) => onChange({ ...value, ...next });
  const b = LEMONSLICE_BOUNDS;
  const ratioSent = lemonSliceAspectRatioSent(value);
  const editRead = lemonSliceEditImageRead(value);
  const actions = lemonSliceActionsAllowed(value);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">LemonSlice</CardTitle>
        <CardDescription>Ava garde micro, STT, LLM et la voix de ses personnages : chaque réplique est synthétisée par le TTS actuel, convertie en PCM16 et envoyée au visage (<code>audio</code> puis <code>audio_end</code>) ; <code>playback_finished</code> marque la fin. Salle Daily privée créée par Ava, navigateur en réception seule. Secrets <code>LEMONSLICE_API_KEY</code> et <code>DAILY_API_KEY</code>.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SectionTitle>Essentiel</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Agent ID" hint="Avatar créé sur lemonslice.com ; prioritaire sur l'image." value={value.agentId} onChange={(agentId) => patch({ agentId })} />
          <TextField label="Image de l'avatar (URL https)" hint={value.agentId.trim() ? "Ignorée : l'Agent ID est utilisé." : "Image publique, 368×560 conseillé."} value={value.agentImageUrl} onChange={(agentImageUrl) => patch({ agentImageUrl })} />
          <EnumField label="Modèle" hint="Flash et CWM-1 : offres Ultra/Entreprise." value={value.model} options={LEMONSLICE_MODEL_LABELS} onChange={(model) => patch({ model })} />
          <EnumField
            label="Fréquence audio"
            hint="Le TTS d'Ava est rééchantillonné à cette fréquence ; 16 kHz évite un rééchantillonnage chez LemonSlice."
            value={String(value.audioSampleRate) as "16000" | "24000"}
            options={{ "16000": "16 kHz (défaut)", "24000": "24 kHz" }}
            onChange={(rate) => patch({ audioSampleRate: rate === "24000" ? 24_000 : 16_000 })}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <PromptField label="Attitude en parlant (agent_prompt)" max={LEMONSLICE_PROMPT_MAX} value={value.agentPrompt} onChange={(agentPrompt) => patch({ agentPrompt })} />
          <PromptField label="Attitude au repos (agent_idle_prompt)" max={LEMONSLICE_PROMPT_MAX} value={value.agentIdlePrompt} onChange={(agentIdlePrompt) => patch({ agentIdlePrompt })} />
        </div>
        <Advanced>
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField label="Délai d'inactivité (s)" hint="30 à 900 ; défaut 300. Remis à zéro quand le joueur parle." bounds={b.idleTimeoutSeconds} value={value.idleTimeoutSeconds} onChange={(idleTimeoutSeconds) => patch({ idleTimeoutSeconds })} />
            <NumberField label="Fin de réponse sans audio (s)" hint="0 = délai LemonSlice (non envoyé) ; jusqu'à 10." bounds={b.responseDoneTimeoutSeconds} value={value.responseDoneTimeoutSeconds} onChange={(responseDoneTimeoutSeconds) => patch({ responseDoneTimeoutSeconds })} />
            <NumberField label="Durée maximale de la salle (s)" hint="300 à 3 600 ; défaut 1 800. Salle et jetons Daily expirent ensuite." bounds={b.roomMaxSeconds} value={value.roomMaxSeconds} onChange={(roomMaxSeconds) => patch({ roomMaxSeconds })} />
            <EnumField label="Format" hint={ratioSent ? "2x3 conseillé." : "Ce modèle n'accepte que 2x3 : non envoyé."} value={value.aspectRatio} options={LEMONSLICE_ASPECT_LABELS} onChange={(aspectRatio) => patch({ aspectRatio })} />
            <EnumField label="Recadrer l'image (edit_image)" hint={editRead ? "Défaut : réglage du compte." : "Lu seulement avec une image et le format 2x3 : non envoyé."} value={value.editImage} options={LEMONSLICE_EDIT_LABELS} onChange={(editImage) => patch({ editImage })} />
            <EnumField label="Cadrage" hint={editRead && value.editImage === "on" ? "Envoyé avec le recadrage." : "Non envoyé sans recadrage activé."} value={value.editImageVariant} options={LEMONSLICE_VARIANT_LABELS} onChange={(editImageVariant) => patch({ editImageVariant })} />
          </div>
          <SwitchField
            label="Hochement pendant que le joueur parle"
            hint={actions ? "Action CWM-1 « listen », au plus toutes les 4 s ; le micro reste chez Ava." : "Modèle CWM-1 seulement : non envoyé."}
            checked={value.listenAction}
            onChange={(listenAction) => patch({ listenAction })}
          />
        </Advanced>
      </CardContent>
    </Card>
  );
}

const LEMONSLICE_MODEL_LABELS: Record<LemonSliceModel, string> = {
  default: "Modèle phare (défaut)",
  flash: "Flash",
  pro: "Pro",
  "cwm-1": "CWM-1 (actions)",
  "cwm-1-lite": "CWM-1 Lite",
  cartoon: "Cartoon",
};

const LEMONSLICE_ASPECT_LABELS: Record<LemonSliceAspectRatio, string> = {
  "2x3": "2x3 (défaut)",
  "9x16": "9x16",
  "1x1": "1x1",
};

const LEMONSLICE_EDIT_LABELS: Record<LemonSliceEditImageMode, string> = {
  default: "Réglage du compte (défaut)",
  on: "Recadrer",
  off: "Ne pas recadrer",
};

const LEMONSLICE_VARIANT_LABELS: Record<LemonSliceEditImageVariant, string> = {
  bust: "Buste (défaut)",
  portrait: "Portrait",
  standing: "Debout",
  sitting: "Assis",
};

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
