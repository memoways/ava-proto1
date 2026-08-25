import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { writeEnvironmentStorage } from "@/services/environmentContext";
import { Save, RotateCcw, CheckCircle2, HelpCircle } from "lucide-react";
import { generateSpeech, playAudioBlob, tryCreateStreamingPlayback } from "@/services/tts";
import { TTS_PROVIDER_LIST } from "@/services/tts/registry";
import type { TTSProviderId } from "@/services/tts/types";
import {
  getActiveProviderId,
  loadActiveProviderFromDB,
  setActiveProvider,
  getInworldSettings,
  loadInworldSettingsFromDB,
  saveInworldSettingsToDB,
  resetInworldSettings,
  getHumeSettings,
  loadHumeSettingsFromDB,
  saveHumeSettingsToDB,
  resetHumeSettings,
  getGradiumSettings,
  loadGradiumSettingsFromDB,
  saveGradiumSettingsToDB,
  getGradiumVoiceTuning,
  patchGradiumCharacterTuning,
  GRADIUM_VOICE_TUNING_DEFAULTS,
  INWORLD_MODELS,
  GRADIUM_OUTPUT_FORMATS,
  getCartesiaSettings,
  loadCartesiaSettingsFromDB,
  saveCartesiaSettingsToDB,
  resetCartesiaSettings,
  CARTESIA_MODELS,

  type InworldSettings,
  type HumeSettings,
  type GradiumSettings,
  type GradiumVoiceTuning,
  type CartesiaSettings,
} from "@/services/tts/providerSettings";
import {
  getTTSSettings,
  saveTTSSettingsToDB,
  loadTTSSettingsFromDB,
  resetTTSSettings,
  ELEVENLABS_MODELS,
  TTS_PRESETS,
  type TTSSettings,
} from "@/services/settingsService";
import { listCharacterRuntimeProfiles } from "@/services/experienceOrchestration";
import {
  CANONICAL_EMOTIONS,
  PROVIDER_ACTING_SUPPORT,
  intentFromManualEmotion,
  type CanonicalEmotion,
} from "@/services/tts/performanceIntent";

const TEST_PHRASE = "Écoute, je ne sais pas qui tu es... mais si tu sais quelque chose sur Ava, il faut me le dire maintenant. Je n'ai plus beaucoup de temps.";
/** Intensity 2 so Hume / Inworld acting instructions are actually audible in admin tests. */
const AUDITION_INTENSITY = 2 as const;
const GRADIUM_CHARACTER_ORDER = ["max", "emma"];
const AUDITION_EMOTION_LABELS: Record<CanonicalEmotion, string> = {
  neutral: "Neutre",
  tense: "Tendu",
  angry: "Colère",
  sad: "Tristesse",
  scared: "Peur",
  fragile: "Fragile",
  warm: "Chaleureux",
  accusatory: "Accusateur",
  sarcastic: "Sarcasme",
  urgent: "Urgent",
};

function ActingNote({
  providerId,
  detail,
}: {
  providerId: TTSProviderId;
  detail?: string;
}) {
  const support = PROVIDER_ACTING_SUPPORT[providerId];
  const tone =
    support.usability === "audible"
      ? "text-emerald-400/90"
      : support.usability === "weak"
        ? "text-amber-400/90"
        : "text-muted-foreground";
  return (
    <p className={`text-xs mt-1 ${tone}`}>
      Intention : {support.labelFr}. {detail ?? support.detailFr}
    </p>
  );
}

type GradiumCharacterOption = {
  character_key: string;
  display_name: string;
  tts_voice_id: string | null;
  tts_provider: string | null;
};

const FALLBACK_GRADIUM_CHARACTERS: GradiumCharacterOption[] = [
  { character_key: "max", display_name: "Max", tts_voice_id: null, tts_provider: null },
  { character_key: "emma", display_name: "Emma", tts_voice_id: null, tts_provider: null },
];

export default function TTSConfigTab() {
  const [activeProvider, setActiveProviderState] = useState<TTSProviderId>(getActiveProviderId());

  // ElevenLabs settings
  const [elSettings, setElSettings] = useState<TTSSettings>(getTTSSettings());
  const [elSaved, setElSaved] = useState<TTSSettings>(getTTSSettings());
  const [savingEl, setSavingEl] = useState(false);

  // Inworld settings
  const [iwSettings, setIwSettings] = useState<InworldSettings>(getInworldSettings());
  const [iwSaved, setIwSaved] = useState<InworldSettings>(getInworldSettings());
  const [savingIw, setSavingIw] = useState(false);

  // Hume settings
  const [huSettings, setHuSettings] = useState<HumeSettings>(getHumeSettings());
  const [huSaved, setHuSaved] = useState<HumeSettings>(getHumeSettings());
  const [savingHu, setSavingHu] = useState(false);

  // Gradium settings
  const [grSettings, setGrSettings] = useState<GradiumSettings>(getGradiumSettings());
  const [grSaved, setGrSaved] = useState<GradiumSettings>(getGradiumSettings());
  const [savingGr, setSavingGr] = useState(false);
  const [grCharacters, setGrCharacters] = useState<GradiumCharacterOption[]>(FALLBACK_GRADIUM_CHARACTERS);
  const [grCharacterKey, setGrCharacterKey] = useState("max");
  const grCharacterKeyRef = useRef(grCharacterKey);
  grCharacterKeyRef.current = grCharacterKey;

  // Cartesia settings
  const [caSettings, setCaSettings] = useState<CartesiaSettings>(getCartesiaSettings());
  const [caSaved, setCaSaved] = useState<CartesiaSettings>(getCartesiaSettings());
  const [savingCa, setSavingCa] = useState(false);

  // Test
  const [testing, setTesting] = useState<TTSProviderId | null>(null);
  const [testingStream, setTestingStream] = useState(false);
  const [auditionEmotion, setAuditionEmotion] = useState<CanonicalEmotion>("tense");
  const auditionEmotionRef = useRef(auditionEmotion);
  auditionEmotionRef.current = auditionEmotion;

  useEffect(() => {
    loadActiveProviderFromDB().then(setActiveProviderState);
    loadTTSSettingsFromDB().then((s) => { setElSettings(s); setElSaved(s); });
    loadInworldSettingsFromDB().then((s) => { setIwSettings(s); setIwSaved(s); });
    loadHumeSettingsFromDB().then((s) => { setHuSettings(s); setHuSaved(s); });
    loadGradiumSettingsFromDB().then((s) => { setGrSettings(s); setGrSaved(s); });
    loadCartesiaSettingsFromDB().then((s) => { setCaSettings(s); setCaSaved(s); });
    listCharacterRuntimeProfiles()
      .then((profiles) => {
        const options = profiles
          .filter((profile) => GRADIUM_CHARACTER_ORDER.includes(profile.character_key))
          .sort((a, b) => GRADIUM_CHARACTER_ORDER.indexOf(a.character_key) - GRADIUM_CHARACTER_ORDER.indexOf(b.character_key))
          .map((profile) => ({
            character_key: profile.character_key,
            display_name: profile.display_name,
            tts_voice_id: profile.tts_voice_id,
            tts_provider: profile.tts_provider,
          }));
        if (options.length > 0) setGrCharacters(options);
      })
      .catch(() => { /* keep Max / Emma fallback */ });
  }, []);

  const elHasChanges = JSON.stringify(elSettings) !== JSON.stringify(elSaved);
  const iwHasChanges = JSON.stringify(iwSettings) !== JSON.stringify(iwSaved);
  const huHasChanges = JSON.stringify(huSettings) !== JSON.stringify(huSaved);
  const grHasChanges = JSON.stringify(grSettings) !== JSON.stringify(grSaved);
  const caHasChanges = JSON.stringify(caSettings) !== JSON.stringify(caSaved);

  async function handleActivate(id: TTSProviderId) {
    setActiveProviderState(id);
    await setActiveProvider(id);
    toast.success(`Provider actif : ${TTS_PROVIDER_LIST.find((p) => p.id === id)?.label}`);
  }

  const testProvider = useCallback(async (id: TTSProviderId) => {
    setTesting(id);
    try {
      const blob = await generateSpeech(TEST_PHRASE, {
        providerId: id,
        performance: intentFromManualEmotion(auditionEmotionRef.current, AUDITION_INTENSITY),
      });
      await playAudioBlob(blob);
      toast.success(`Test ${id} · ${AUDITION_EMOTION_LABELS[auditionEmotionRef.current]}`);
    } catch (err) {
      console.error(`TTS test error (${id}):`, err);
      toast.error(`Erreur test ${id}: ${err instanceof Error ? err.message.slice(0, 120) : "inconnu"}`);
    } finally {
      setTesting(null);
    }
  }, []);

  const testGradium = useCallback(async (mode: "rest" | "stream") => {
    const character = grCharacters.find((option) => option.character_key === grCharacterKeyRef.current) ?? grCharacters[0];
    const opts = {
      providerId: "gradium" as const,
      characterKey: character?.character_key,
      voiceId: character?.tts_voice_id ?? undefined,
      performance: intentFromManualEmotion(auditionEmotionRef.current, AUDITION_INTENSITY),
    };
    if (mode === "rest") {
      setTesting("gradium");
      try {
        const blob = await generateSpeech(TEST_PHRASE, opts);
        await playAudioBlob(blob);
        toast.success(`Test REST ${character?.display_name ?? "Gradium"} terminé`);
      } catch (err) {
        console.error("TTS test error (gradium):", err);
        toast.error(`Erreur test REST: ${err instanceof Error ? err.message.slice(0, 120) : "inconnu"}`);
      } finally {
        setTesting(null);
      }
      return;
    }
    setTestingStream(true);
    try {
      const handle = tryCreateStreamingPlayback(TEST_PHRASE, opts);
      if (!handle) {
        toast.error("Streaming indisponible (désactivé ou non supporté par ce navigateur)");
        return;
      }
      const t0 = performance.now();
      handle.open();
      await handle.started;
      const firstAudioMs = Math.round(performance.now() - t0);
      await handle.finished;
      toast.success(`Test streaming ${character?.display_name ?? ""} — premier son en ${firstAudioMs}ms`);
    } catch (err) {
      console.error("TTS streaming test error (gradium):", err);
      toast.error(`Erreur test streaming: ${err instanceof Error ? err.message.slice(0, 120) : "inconnu"}`);
    } finally {
      setTestingStream(false);
    }
  }, [grCharacters]);

  // ElevenLabs helpers
  function updateEl(patch: Partial<TTSSettings>) {
    const current = { ...elSettings, ...patch };
    writeEnvironmentStorage("ava_tts_settings", JSON.stringify(current));
    setElSettings(current);
  }
  function applyElPreset(key: string) {
    const preset = TTS_PRESETS[key];
    if (!preset) return;
    const updated = { ...elSettings, ...preset.settings };
    writeEnvironmentStorage("ava_tts_settings", JSON.stringify(updated));
    setElSettings(updated);
    toast.success(`Preset "${preset.label}" appliqué — sauvegarde nécessaire`);
  }
  async function saveEl() {
    setSavingEl(true);
    await saveTTSSettingsToDB(elSettings);
    setElSaved(elSettings);
    toast.success("ElevenLabs sauvegardé ✓");
    setSavingEl(false);
  }
  function resetEl() {
    const d = resetTTSSettings();
    setElSettings(d); setElSaved(d);
    toast.success("ElevenLabs réinitialisé");
  }

  // Inworld helpers
  function updateIw(patch: Partial<InworldSettings>) {
    const current = { ...iwSettings, ...patch };
    writeEnvironmentStorage("ava_tts_settings_inworld", JSON.stringify(current));
    setIwSettings(current);
  }
  async function saveIw() {
    setSavingIw(true);
    await saveInworldSettingsToDB(iwSettings);
    setIwSaved(iwSettings);
    toast.success("Inworld sauvegardé ✓");
    setSavingIw(false);
  }
  function resetIw() {
    const d = resetInworldSettings();
    setIwSettings(d); setIwSaved(d);
    toast.success("Inworld réinitialisé");
  }

  // Hume helpers
  function updateHu(patch: Partial<HumeSettings>) {
    const current = { ...huSettings, ...patch };
    writeEnvironmentStorage("ava_tts_settings_hume", JSON.stringify(current));
    setHuSettings(current);
  }
  async function saveHu() {
    setSavingHu(true);
    await saveHumeSettingsToDB(huSettings);
    setHuSaved(huSettings);
    toast.success("Hume sauvegardé ✓");
    setSavingHu(false);
  }
  function resetHu() {
    const d = resetHumeSettings();
    setHuSettings(d); setHuSaved(d);
    toast.success("Hume réinitialisé");
  }

  // Gradium helpers
  const grCharacter = grCharacters.find((option) => option.character_key === grCharacterKey) ?? grCharacters[0];
  const grTuning = getGradiumVoiceTuning(grSettings, grCharacter?.character_key);

  function updateGr(patch: Partial<GradiumSettings>) {
    const current = { ...grSettings, ...patch };
    writeEnvironmentStorage("ava_tts_settings_gradium", JSON.stringify(current));
    setGrSettings(current);
  }
  function updateGrTuning(patch: Partial<GradiumVoiceTuning>) {
    if (!grCharacter) return;
    const current = patchGradiumCharacterTuning(grSettings, grCharacter.character_key, patch);
    writeEnvironmentStorage("ava_tts_settings_gradium", JSON.stringify(current));
    setGrSettings(current);
  }
  async function saveGr() {
    setSavingGr(true);
    await saveGradiumSettingsToDB(grSettings);
    setGrSaved(grSettings);
    toast.success("Gradium sauvegardé ✓");
    setSavingGr(false);
  }
  function resetGr() {
    if (!grCharacter) return;
    const current = patchGradiumCharacterTuning(grSettings, grCharacter.character_key, GRADIUM_VOICE_TUNING_DEFAULTS);
    writeEnvironmentStorage("ava_tts_settings_gradium", JSON.stringify(current));
    setGrSettings(current);
    toast.success(`Gradium ${grCharacter.display_name} réinitialisé`);
  }

  function updateCa(patch: Partial<CartesiaSettings>) {
    const current = { ...caSettings, ...patch };
    writeEnvironmentStorage("ava_tts_settings_cartesia", JSON.stringify(current));
    setCaSettings(current);
  }
  async function saveCa() {
    setSavingCa(true);
    await saveCartesiaSettingsToDB(caSettings);
    setCaSaved(caSettings);
    toast.success("Cartesia sauvegardé ✓");
    setSavingCa(false);
  }
  function resetCa() {
    const d = resetCartesiaSettings();
    setCaSettings(d);
    setCaSaved(d);
    toast.success("Cartesia réinitialisé");
  }


  return (
    <TooltipProvider delayDuration={150}>
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">TTS Config — Multi-providers</h2>
        <p className="text-sm text-muted-foreground">
          Compare les services TTS. Le provider <strong>actif</strong> est utilisé dans le jeu ; les autres restent disponibles pour les tests. Les puces d'intention ne jouent pas l'audio : clique <strong>Écouter Hume</strong> ou <strong>Écouter Inworld</strong> (seuls ces deux services rendent l'acting vraiment audible).
        </p>
        <p className="text-sm text-muted-foreground">
          Les <strong>Voice ID</strong> se règlent par personnage dans Expérience → Orchestration. Gradium a des réglages fins distincts par personnage dans le panneau ci-dessous.
        </p>
      </div>

      {/* ===== Active provider selector ===== */}
      <section className="border rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3">🎯 Provider actif (utilisé en jeu)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TTS_PROVIDER_LIST.map((p) => {
            const isActive = activeProvider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleActivate(p.id)}
                className={`text-left p-3 border rounded-lg transition-colors ${
                  isActive ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{p.label}</span>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-sm">Intention de jeu (audition)</h3>
        <p className="text-xs text-muted-foreground">
          Les puces <strong>sélectionnent</strong> une émotion — elles ne jouent rien. Tous les boutons Tester (et Écouter ci-dessous) envoient cette intention. En jeu, l'émotion est dérivée de la réplique (plus le personnage et la mémoire GM).
        </p>
        <div className="flex flex-wrap gap-2">
          {CANONICAL_EMOTIONS.map((emotion) => (
            <button
              key={emotion}
              type="button"
              onClick={() => {
                auditionEmotionRef.current = emotion;
                setAuditionEmotion(emotion);
              }}
              className={`px-2 py-1.5 border rounded text-xs ${
                auditionEmotion === emotion ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
              }`}
            >
              {AUDITION_EMOTION_LABELS[emotion]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => testProvider("hume")} disabled={testing !== null}>
            {testing === "hume" ? "..." : "🔊 Écouter Hume"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => testProvider("inworld")} disabled={testing !== null}>
            {testing === "inworld" ? "..." : "🔊 Écouter Inworld"}
          </Button>
        </div>
        <div className="rounded-md border bg-accent/20 p-3 space-y-1.5">
          <p className="text-xs font-medium">Où l'intention est réellement utilisée</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {TTS_PROVIDER_LIST.map((provider) => {
              const support = PROVIDER_ACTING_SUPPORT[provider.id];
              return (
                <li key={provider.id}>
                  <span className="font-medium text-foreground">{provider.label}</span>
                  {" — "}
                  {support.labelFr}. {support.detailFr}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ===== ElevenLabs panel ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">🎙️ ElevenLabs</h3>
            <p className="text-xs text-muted-foreground">Réglages voix, presets, diction</p>
            <ActingNote
              providerId="elevenlabs"
              detail={
                elSettings.modelId === "eleven_v3"
                  ? "Tags [angry] actifs (modèle eleven_v3) + sliders."
                  : PROVIDER_ACTING_SUPPORT.elevenlabs.detailFr
              }
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetEl}><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
            <Button size="sm" onClick={() => testProvider("elevenlabs")} disabled={testing === "elevenlabs"}>
              {testing === "elevenlabs" ? "..." : "🔊 Tester"}
            </Button>
            <Button size="sm" onClick={saveEl} disabled={savingEl || !elHasChanges}
              className={elHasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
              <Save className="w-3 h-3 mr-1" />{savingEl ? "..." : "Sauver"}
            </Button>
          </div>
        </div>

        {elHasChanges && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-1 text-xs text-yellow-300">
            ⚠️ Modifications ElevenLabs non sauvegardées
          </div>
        )}

        <div>
          <p className="text-xs font-medium mb-2">⚡ Presets rapides</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(TTS_PRESETS).map(([key, preset]) => (
              <button key={key} onClick={() => applyElPreset(key)}
                className="text-left p-2 border rounded hover:bg-accent/50 text-xs">
                <span className="font-medium">{preset.label}</span>
                <p className="text-muted-foreground mt-0.5">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium mb-2">Modèle</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ELEVENLABS_MODELS.map((m) => (
              <button key={m.id} onClick={() => updateEl({ modelId: m.id })}
                className={`text-left p-2 border rounded text-xs ${
                  elSettings.modelId === m.id ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
                }`}>
                <span className="font-medium">{m.label}</span>
                <p className="text-muted-foreground mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        <SliderRow label="Stabilité" value={elSettings.stability} min={0} max={1} step={0.05}
          onChange={(v) => updateEl({ stability: v })}
          tooltip="Contrôle la constance de la voix entre deux générations. À 0, la voix est plus expressive et variable ; à 1, elle devient très stable, presque monotone."
          minLabel="Expressif / variable" maxLabel="Stable / constant" />
        <SliderRow label="Similarity Boost" value={elSettings.similarityBoost} min={0} max={1} step={0.05}
          onChange={(v) => updateEl({ similarityBoost: v })}
          tooltip="Rapproche la voix générée du timbre du speaker original. À 0, la voix est plus neutre ; à 1, elle colle au maximum au clone."
          minLabel="Neutre" maxLabel="Proche du clone" />
        <SliderRow label="Style" value={elSettings.style} min={0} max={1} step={0.05}
          onChange={(v) => updateEl({ style: v })}
          tooltip="Accentue le style dramatique / théâtral de la lecture. À 0, le rendu est naturel et conversationnel ; à 1, il devient très stylisé."
          minLabel="Naturel" maxLabel="Théâtral" />
        <SliderRow label="Vitesse" value={elSettings.speed} min={0.7} max={1.2} step={0.02}
          onChange={(v) => updateEl({ speed: v })}
          tooltip="Vitesse de lecture globale. 1 = vitesse normale." minLabel="0.7 lent" maxLabel="1.2 rapide" />
        <SliderRow label="Optimize streaming latency" value={elSettings.optimizeStreamingLatency} min={0} max={4} step={1}
          onChange={(v) => updateEl({ optimizeStreamingLatency: Math.round(v) })} format={(v) => v.toString()}
          tooltip="Compromis entre qualité et latence pour le streaming. 0 = qualité maximale ; 4 = latence minimale, utile pour le dialogue temps réel."
          minLabel="Qualité max" maxLabel="Latence min" />

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-1.5">
            <label className="text-sm">Speaker Boost</label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/60 hover:text-primary transition-colors">
                  <HelpCircle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs leading-relaxed">Renforce la projection et la présence globale de la voix, comme un léger boost de volume/clarté.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Switch checked={elSettings.useSpeakerBoost} onCheckedChange={(v) => updateEl({ useSpeakerBoost: v })} />
        </div>
      </section>

      {/* ===== Inworld panel ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">🎙️ Inworld TTS</h3>
            <p className="text-xs text-muted-foreground">Modèles inworld-tts-1 / -max, voix multilingue</p>
            <ActingNote providerId="inworld" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetIw}><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
            <Button size="sm" onClick={() => testProvider("inworld")} disabled={testing === "inworld"}>
              {testing === "inworld" ? "..." : "🔊 Tester"}
            </Button>
            <Button size="sm" onClick={saveIw} disabled={savingIw || !iwHasChanges}
              className={iwHasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
              <Save className="w-3 h-3 mr-1" />{savingIw ? "..." : "Sauver"}
            </Button>
          </div>
        </div>

        {iwHasChanges && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-1 text-xs text-yellow-300">
            ⚠️ Modifications Inworld non sauvegardées
          </div>
        )}

        <div>
          <p className="text-xs font-medium mb-2">Modèle</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {INWORLD_MODELS.map((m) => (
              <button key={m.id} onClick={() => updateIw({ modelId: m.id as InworldSettings["modelId"] })}
                className={`text-left p-2 border rounded text-xs ${
                  iwSettings.modelId === m.id ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
                }`}>
                <span className="font-medium">{m.label}</span>
                <p className="text-muted-foreground mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">


          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Langue (BCP-47 ou AUTO)</span>
            <input value={iwSettings.language}
              onChange={(e) => updateIw({ language: e.target.value.trim() || "AUTO" })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="AUTO, fr-FR, en-US..." />
            <span className="block text-xs text-muted-foreground/60">tts-2 uniquement. Legacy : ignoré.</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-xs font-medium">Delivery mode (tts-2)</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/60 hover:text-primary transition-colors">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs leading-relaxed">Contrôle la variabilité expressive de l'intonation : STABLE = très régulier, BALANCED = compromis, CREATIVE = plus emphatique et variable.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex gap-2">
              {(["STABLE", "BALANCED", "CREATIVE"] as const).map((m) => {
                const deliveryTooltip: Record<string, string> = {
                  STABLE: "Intonation très régulière et prévisible — clarté maximale.",
                  BALANCED: "Compromis entre expressivité et stabilité.",
                  CREATIVE: "Intonation plus variée, emphatique et imprévisible.",
                };
                return (
                  <Tooltip key={m}>
                    <TooltipTrigger asChild>
                      <button onClick={() => updateIw({ deliveryMode: m })}
                        className={`flex-1 px-2 py-1.5 border rounded text-xs ${
                          iwSettings.deliveryMode === m ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
                        }`}>
                        {m}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs leading-relaxed">{deliveryTooltip[m]}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          <SliderRow label="Speaking rate" value={iwSettings.speakingRate} min={0.5} max={2} step={0.05}
            onChange={(v) => updateIw({ speakingRate: v })}
            tooltip="Vitesse de parole. 0.5 = deux fois plus lent ; 2 = deux fois plus rapide." minLabel="0.5 lent" maxLabel="2 rapide" />
        </div>

        <SliderRow label="Temperature (legacy tts-1 uniquement)" value={iwSettings.temperature} min={0} max={2} step={0.05}
          onChange={(v) => updateIw({ temperature: v })}
          tooltip="Variabilité de l'intonation (uniquement pour les modèles tts-1 legacy). À 0, le rendu est très déterministe ; à 2, très expressif et imprévisible."
          minLabel="Déterministe" maxLabel="Très expressif" />
      </section>

      {/* ===== Hume Octave panel ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">🎙️ Hume AI Octave</h3>
            <p className="text-xs text-muted-foreground">Très expressif, contrôle via description prosodique</p>
            <ActingNote providerId="hume" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetHu}><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
            <Button size="sm" onClick={() => testProvider("hume")} disabled={testing === "hume"}>
              {testing === "hume" ? "..." : "🔊 Tester"}
            </Button>
            <Button size="sm" onClick={saveHu} disabled={savingHu || !huHasChanges}
              className={huHasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
              <Save className="w-3 h-3 mr-1" />{savingHu ? "..." : "Sauver"}
            </Button>
          </div>
        </div>

        {huHasChanges && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-1 text-xs text-yellow-300">
            ⚠️ Modifications Hume non sauvegardées
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">


          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Provider de voix</span>
            <select value={huSettings.voiceProvider}
              onChange={(e) => updateHu({ voiceProvider: e.target.value as HumeSettings["voiceProvider"] })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="HUME_AI">HUME_AI (catalogue public)</option>
              <option value="CUSTOM_VOICE">CUSTOM_VOICE (voix clonée)</option>
            </select>
          </label>
        </div>

        <label className="space-y-1 text-sm block">
          <span className="font-medium text-muted-foreground">Description prosodique (optionnel)</span>
          <textarea value={huSettings.description}
            onChange={(e) => updateHu({ description: e.target.value })}
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="ex: voix grave, posée, légèrement inquiète, rythme lent" />
          <span className="block text-xs text-muted-foreground/60">Octave utilise cette description pour moduler la prosodie.</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Format audio</span>
            <select value={huSettings.format}
              onChange={(e) => updateHu({ format: e.target.value as HumeSettings["format"] })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="pcm">PCM</option>
            </select>
            <span className="block text-xs text-muted-foreground/60">MP3 = compact, WAV = non compressé, PCM = brut.</span>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Langue</span>
            <input value={huSettings.languageCode}
              onChange={(e) => updateHu({ languageCode: e.target.value.trim().toLowerCase() || "fr" })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="fr" />
            <span className="block text-xs text-muted-foreground/60">Code ISO 639-1 (fr, en, es…) pour guider la prononciation.</span>
          </label>
        </div>
      </section>

      {/* ===== Gradium panel ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">🎙️ Gradium TTS</h3>
            <p className="text-xs text-muted-foreground">Streaming WebSocket (fallback REST) — réglages fins par personnage</p>
            <ActingNote providerId="gradium" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetGr}><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
            <Button size="sm" onClick={() => void testGradium("rest")} disabled={testing === "gradium"}>
              {testing === "gradium" ? "..." : "🔊 Tester REST"}
            </Button>
            <Button size="sm" onClick={() => void testGradium("stream")} disabled={testingStream}>
              {testingStream ? "..." : "🔊 Tester streaming"}
            </Button>
            <Button size="sm" onClick={saveGr} disabled={savingGr || !grHasChanges}
              className={grHasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
              <Save className="w-3 h-3 mr-1" />{savingGr ? "..." : "Sauver"}
            </Button>
          </div>
        </div>

        {grHasChanges && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-1 text-xs text-yellow-300">
            ⚠️ Modifications Gradium non sauvegardées
          </div>
        )}

        <div>
          <p className="text-xs font-medium mb-2">Personnage</p>
          <div className="grid grid-cols-2 gap-2">
            {grCharacters.map((character) => {
              const selected = character.character_key === grCharacter?.character_key;
              return (
                <button
                  key={character.character_key}
                  type="button"
                  aria-label={`Réglages Gradium ${character.display_name}`}
                  aria-pressed={selected}
                  onClick={() => {
                    grCharacterKeyRef.current = character.character_key;
                    setGrCharacterKey(character.character_key);
                  }}
                  className={`text-left p-3 border rounded-lg transition-colors ${
                    selected ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{character.display_name}</span>
                    {selected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {character.tts_provider ? `${character.tts_provider}` : "Provider non renseigné"}
                    {character.tts_voice_id ? ` · ${character.tts_voice_id}` : " · Voice ID manquant"}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Les tests REST et streaming utilisent la Voice ID Orchestration de {grCharacter?.display_name ?? "ce personnage"} et les réglages affichés ici.
          </p>
        </div>

        <div className="rounded-md border p-3 space-y-4">
          <p className="text-xs font-medium">Réglages fins — {grCharacter?.display_name ?? "personnage"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SliderRow label="Temperature (temp)" value={grTuning.temp} min={0} max={1.4} step={0.05}
              onChange={(v) => updateGrTuning({ temp: v })}
              tooltip="Variabilité créative de la génération. 0 = déterministe (même texte → même audio) ; 1.4 = très expressif et variable."
              minLabel="Déterministe" maxLabel="Très créatif" />
            <SliderRow label="Voice similarity (cfg_coef)" value={grTuning.cfgCoef} min={1} max={4} step={0.05}
              onChange={(v) => updateGrTuning({ cfgCoef: v })}
              tooltip="Rapprochement avec la voix cible. 1 = voix générique, moins ressemblante ; 4 = reproduction très fidèle du timbre cible."
              minLabel="Générique" maxLabel="Très fidèle" />
          </div>

          <SliderRow label="Vitesse (padding_bonus)" value={grTuning.paddingBonus} min={-4} max={4} step={0.1}
            onChange={(v) => updateGrTuning({ paddingBonus: v })}
            tooltip="Ajuste la vitesse de lecture en ajoutant ou retirant du silence. Négatif = plus rapide, positif = plus lent."
            minLabel="-4 rapide" maxLabel="+4 lent" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-muted-foreground">Rewrite rules</span>
              <input value={grTuning.rewriteRules}
                onChange={(e) => updateGrTuning({ rewriteRules: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="fr" />
              <span className="block text-xs text-muted-foreground/60">Code langue (fr, en, de, es, pt) ou règles custom. Vide = désactivé.</span>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-muted-foreground">Pronunciation ID</span>
              <input value={grTuning.pronunciationId}
                onChange={(e) => updateGrTuning({ pronunciationId: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="(optionnel)" />
              <span className="block text-xs text-muted-foreground/60">Dictionnaire de prononciations Gradium, appliqué par requête.</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Format audio (commun)</span>
            <select value={grSettings.outputFormat}
              onChange={(e) => updateGr({ outputFormat: e.target.value as GradiumSettings["outputFormat"] })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              {GRADIUM_OUTPUT_FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <span className="block text-xs text-muted-foreground/60">Format du chemin REST (fallback). Opus recommandé (~6x plus léger que WAV) ; bascule auto sur WAV si le navigateur ne lit pas l'Ogg/Opus (Safari &lt; 18.4). MP3 non supporté par Gradium.</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-md p-3 bg-accent/20">
          <label className="flex items-center justify-between gap-3 text-sm sm:col-span-1">
            <div>
              <span className="font-medium">Streaming WebSocket</span>
              <span className="block text-xs text-muted-foreground/60">Lecture progressive : la voix démarre dès les premiers chunks audio. Fallback REST automatique en cas d'échec. Commun à tous les personnages.</span>
            </div>
            <Switch checked={grSettings.streamingEnabled}
              onCheckedChange={(v) => updateGr({ streamingEnabled: v })} />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Format streaming</span>
            <select value={grSettings.streamingFormat}
              onChange={(e) => updateGr({ streamingFormat: e.target.value as GradiumSettings["streamingFormat"] })}
              disabled={!grSettings.streamingEnabled}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50">
              <option value="pcm_24000">pcm_24000 (léger, recommandé)</option>
              <option value="pcm_48000">pcm_48000 (natif Gradium)</option>
            </select>
            <span className="block text-xs text-muted-foreground/60">PCM brut envoyé sur le WebSocket. 24 kHz = moitié moins de données ; 48 kHz = qualité native.</span>
          </label>
        </div>

      </section>

      {/* ===== Cartesia panel ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">🎙️ Cartesia Sonic</h3>
            <p className="text-xs text-muted-foreground">
              Volume et vitesse par tour. Les tags d'émotion Cartesia ne s'appliquent qu'en anglais — en FR ils sont omis.
            </p>
            <ActingNote
              providerId="cartesia"
              detail={
                caSettings.language.trim().toLowerCase() === "en"
                || caSettings.language.trim().toLowerCase().startsWith("en-")
                  ? "Langue = en : speed, volume et émotion nommée sont envoyés."
                  : PROVIDER_ACTING_SUPPORT.cartesia.detailFr
              }
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetCa}><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
            <Button size="sm" onClick={() => testProvider("cartesia")} disabled={testing === "cartesia"}>
              {testing === "cartesia" ? "..." : "🔊 Tester"}
            </Button>
            <Button size="sm" onClick={saveCa} disabled={savingCa || !caHasChanges}
              className={caHasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
              <Save className="w-3 h-3 mr-1" />{savingCa ? "..." : "Sauver"}
            </Button>
          </div>
        </div>

        {caHasChanges && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-1 text-xs text-yellow-300">
            ⚠️ Modifications Cartesia non sauvegardées
          </div>
        )}

        <div>
          <p className="text-xs font-medium mb-2">Modèle</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CARTESIA_MODELS.map((m) => (
              <button key={m.id} onClick={() => updateCa({ modelId: m.id })}
                className={`text-left p-2 border rounded text-xs ${
                  caSettings.modelId === m.id ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
                }`}>
                <span className="font-medium">{m.label}</span>
                <p className="text-muted-foreground mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Voice ID (défaut admin)</span>
            <input value={caSettings.voiceId}
              onChange={(e) => updateCa({ voiceId: e.target.value.trim() })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <span className="block text-xs text-muted-foreground/60">Surchargé par le Voice ID Orchestration du personnage en jeu.</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Langue</span>
            <input value={caSettings.language}
              onChange={(e) => updateCa({ language: e.target.value.trim().toLowerCase() || "fr" })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="fr" />
            <span className="block text-xs text-muted-foreground/60">Mettre `en` pour tester les tags émotion. Secret Lovable : CARTESIA_API_KEY.</span>
          </label>
        </div>
      </section>
    </div>
  </TooltipProvider>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, format, tooltip, minLabel, maxLabel,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
  tooltip?: string; minLabel?: string; maxLabel?: string;
}) {
  const fmt = format ?? ((v) => v.toFixed(2));
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-medium text-muted-foreground">{label}</label>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/60 hover:text-primary transition-colors">
                  <HelpCircle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs leading-relaxed">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className="text-sm font-mono">{fmt(value)}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
      {(minLabel || maxLabel) && (
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground/60">
          <span>{minLabel ?? fmt(min)}</span>
          <span>{maxLabel ?? fmt(max)}</span>
        </div>
      )}
    </div>
  );
}
