import { useEffect, useState } from "react";
import { AudioLines, Clock3, RefreshCw, Save, UsersRound } from "lucide-react";
import {
  BARGE_IN_MIN_WORDS_MAX,
  BARGE_IN_MIN_WORDS_MIN,
  END_OF_SPEECH_MAX_MS,
  END_OF_SPEECH_MIN_MS,
  HESITATION_EXTRA_MAX_MS,
  type HandsFreeVoiceSettings,
} from "@/services/handsFreeVoice";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  getGameplaySettings,
  loadGameplaySettingsFromDB,
  saveGameplaySettings,
  saveGameplaySettingsToDB,
  type GameplaySettings,
} from "@/services/settingsService";
import {
  listCharacterRuntimeProfiles,
  updateCharacterRuntimeActivation,
  type CharacterRuntimeProfile,
} from "@/services/experienceOrchestration";
import {
  MAX_SESSION_DURATION_SECONDS,
  MIN_SESSION_DURATION_SECONDS,
} from "@/config/experienceRuntime";

const CHARACTER_ORDER = ["max", "emma"];

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function GameMasterConfigTab() {
  const [gameplay, setGameplay] = useState<GameplaySettings>(getGameplaySettings());
  const [savedGameplay, setSavedGameplay] = useState(gameplay);
  const [profiles, setProfiles] = useState<CharacterRuntimeProfile[]>([]);
  const [savedActivation, setSavedActivation] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [nextGameplay, nextProfiles] = await Promise.all([
        loadGameplaySettingsFromDB(),
        listCharacterRuntimeProfiles(),
      ]);
      const supportedProfiles = nextProfiles.filter(
        (profile) => profile.character_key === "max" || profile.character_key === "emma",
      );
      const sortedProfiles = supportedProfiles.sort(
        (a, b) => CHARACTER_ORDER.indexOf(a.character_key) - CHARACTER_ORDER.indexOf(b.character_key),
      );
      setGameplay(nextGameplay);
      setSavedGameplay(nextGameplay);
      setProfiles(sortedProfiles);
      setSavedActivation(Object.fromEntries(supportedProfiles.map((profile) => [profile.id, profile.enabled])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement de l’orchestration impossible");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveGlobalSettings = async () => {
    setSaving(true);
    try {
      const updated = saveGameplaySettings({
        TIMEOUT_SECONDS: gameplay.TIMEOUT_SECONDS,
        SHOW_QUESTIONNAIRE: gameplay.SHOW_QUESTIONNAIRE,
        VOICE_HANDS_FREE: gameplay.VOICE_HANDS_FREE,
        VOICE_INCREMENTAL_OUTPUT: gameplay.VOICE_INCREMENTAL_OUTPUT,
        VOICE_ONLY_UI: gameplay.VOICE_ONLY_UI,
      });
      await saveGameplaySettingsToDB(updated);
      setGameplay(updated);
      setSavedGameplay(updated);
      toast.success("Réglages globaux sauvegardés");
    } finally {
      setSaving(false);
    }
  };

  const saveCharacters = async () => {
    const changed = profiles.filter((profile) => savedActivation[profile.id] !== profile.enabled);
    if (!changed.length) return;
    setSaving(true);
    try {
      await Promise.all(changed.map((profile) => updateCharacterRuntimeActivation(profile.id, profile.enabled)));
      setSavedActivation(Object.fromEntries(profiles.map((profile) => [profile.id, profile.enabled])));
      toast.success("Personnages actifs sauvegardés");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation des personnages impossible");
    } finally {
      setSaving(false);
    }
  };

  const globalChanged = gameplay.TIMEOUT_SECONDS !== savedGameplay.TIMEOUT_SECONDS
    || gameplay.SHOW_QUESTIONNAIRE !== savedGameplay.SHOW_QUESTIONNAIRE
    || gameplay.VOICE_INCREMENTAL_OUTPUT !== savedGameplay.VOICE_INCREMENTAL_OUTPUT
    || gameplay.VOICE_ONLY_UI !== savedGameplay.VOICE_ONLY_UI
    || JSON.stringify(gameplay.VOICE_HANDS_FREE) !== JSON.stringify(savedGameplay.VOICE_HANDS_FREE);
  const voice = gameplay.VOICE_HANDS_FREE;
  const setVoice = (patch: Partial<HandsFreeVoiceSettings>) =>
    setGameplay((current) => ({ ...current, VOICE_HANDS_FREE: { ...current.VOICE_HANDS_FREE, ...patch } }));
  const activationChanged = profiles.some((profile) => savedActivation[profile.id] !== profile.enabled);

  if (loading) return <p className="text-sm text-muted-foreground">Chargement de l’orchestration…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">🧭 Orchestration de l’expérience</h2>
          <p className="text-sm text-muted-foreground">
            Étapes, durée et personnages disponibles pour toute nouvelle session. Les sessions déjà ouvertes conservent leur état.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />Actualiser
        </Button>
      </div>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Déroulement global</h3>
              <p className="text-xs text-muted-foreground">
                La durée borne la conversation. Le questionnaire est une étape de fin indépendante et peut être désactivé pour les démonstrations.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => void saveGlobalSettings()} disabled={saving || !globalChanged}>
            <Save className="mr-1 h-3.5 w-3.5" />Enregistrer
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Durée maximale de session</span>
            <span className="font-mono">{formatDuration(gameplay.TIMEOUT_SECONDS)} min:sec ({gameplay.TIMEOUT_SECONDS}s)</span>
          </div>
          <Slider
            value={[gameplay.TIMEOUT_SECONDS]}
            min={MIN_SESSION_DURATION_SECONDS}
            max={MAX_SESSION_DURATION_SECONDS}
            step={30}
            onValueChange={([value]) => setGameplay((current) => ({ ...current, TIMEOUT_SECONDS: value }))}
            aria-label="Durée maximale de session"
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
          <div>
            <p className="text-sm font-medium">Questionnaire en fin d’expérience</p>
            <p className="text-xs text-muted-foreground">
              Désactivé, le bouton de l’écran de fin conduit directement aux remerciements et aucune réponse n’est demandée.
            </p>
          </div>
          <Switch
            checked={gameplay.SHOW_QUESTIONNAIRE}
            onCheckedChange={(checked) => setGameplay((current) => ({ ...current, SHOW_QUESTIONNAIRE: checked }))}
            aria-label="Afficher le questionnaire final"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AudioLines className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Conversation vocale mains libres</h3>
              <p className="text-xs text-muted-foreground">
                Le joueur active le micro une seule fois, puis parle librement : le personnage répond après un court silence et peut être interrompu. Désactivé, l’appel reste en « appuyer pour parler ».
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => void saveGlobalSettings()} disabled={saving || !globalChanged}>
            <Save className="mr-1 h-3.5 w-3.5" />Enregistrer
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
          <div>
            <p className="text-sm font-medium">Micro toujours à l’écoute</p>
            <p className="text-xs text-muted-foreground">Plus besoin d’appuyer pour parler ni pour finir sa phrase.</p>
          </div>
          <Switch checked={voice.enabled} onCheckedChange={(checked) => setVoice({ enabled: checked })} aria-label="Conversation mains libres" />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
          <div>
            <p className="text-sm font-medium">Sortie vocale progressive</p>
            <p className="text-xs text-muted-foreground">Avec Gradium, la voix commence pendant la génération. La mémoire distingue ce qui a été entendu après une interruption.</p>
          </div>
          <Switch checked={gameplay.VOICE_INCREMENTAL_OUTPUT} onCheckedChange={checked => setGameplay(current => ({ ...current, VOICE_INCREMENTAL_OUTPUT: checked }))} aria-label="Sortie vocale progressive" />
        </div>

        <div className={voice.enabled ? "space-y-4" : "pointer-events-none space-y-4 opacity-50"}>
          <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
            <div><p className="text-sm font-medium">Conversation voix seule</p><p className="text-xs text-muted-foreground">Masquer les sous-titres dans l'appel ; contrôles et statuts accessibles conservés.</p></div>
            <Switch checked={gameplay.VOICE_ONLY_UI} onCheckedChange={checked => setGameplay(current => ({ ...current, VOICE_ONLY_UI: checked }))} aria-label="Conversation voix seule" />
          </div>
          <div className="space-y-2">
            <label htmlFor="interruption-strategy" className="text-sm">Détection d'interruption</label>
            <select id="interruption-strategy" className="block rounded-md border bg-background p-2 text-sm" value={voice.interruptionStrategy ?? "text"}
              onChange={event => setVoice({ interruptionStrategy: event.target.value === "acoustic_confirmed" ? "acoustic_confirmed" : "text" })}>
              <option value="text">Paroles reconnues</option><option value="acoustic_confirmed">Voix candidate puis parole confirmée</option>
            </select>
            <p className="text-xs text-muted-foreground">Canary avec sortie progressive Gradium et annulation d'écho effective ; sinon compatibilité par paroles reconnues.</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Silence avant la réponse</span>
              <span className="font-mono">{voice.endOfSpeechMs} ms</span>
            </div>
            <Slider value={[voice.endOfSpeechMs]} min={END_OF_SPEECH_MIN_MS} max={END_OF_SPEECH_MAX_MS} step={50}
              onValueChange={([value]) => setVoice({ endOfSpeechMs: value })} aria-label="Silence avant la réponse" />
            <p className="text-xs text-muted-foreground">Compté après le dernier mot reconnu. Conseillé : 700–1000 ms. Sous 500 ms, le personnage coupe souvent les gens qui respirent entre deux phrases.</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Attente en plus si le joueur hésite</span>
              <span className="font-mono">+{voice.hesitationExtraMs} ms</span>
            </div>
            <Slider value={[voice.hesitationExtraMs]} min={0} max={HESITATION_EXTRA_MAX_MS} step={50}
              onValueChange={([value]) => setVoice({ hesitationExtraMs: value })} aria-label="Attente en plus si hésitation" />
            <p className="text-xs text-muted-foreground">Ajoutée quand la phrase semble inachevée (« euh », « et », « parce que », virgule…). Évite que le personnage réponde pendant une hésitation.</p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
            <div>
              <p className="text-sm font-medium">Le joueur peut couper la parole</p>
              <p className="text-xs text-muted-foreground">Quand le joueur parle pendant que le personnage répond, la voix s’arrête et le joueur reprend la main.</p>
            </div>
            <Switch checked={voice.bargeInEnabled} onCheckedChange={(checked) => setVoice({ bargeInEnabled: checked })} aria-label="Interruption du personnage" />
          </div>

          <div className={voice.bargeInEnabled ? "space-y-2" : "pointer-events-none space-y-2 opacity-50"}>
            <div className="flex justify-between text-sm">
              <span>Mots nécessaires pour interrompre</span>
              <span className="font-mono">{voice.bargeInMinWords}</span>
            </div>
            <Slider value={[voice.bargeInMinWords]} min={BARGE_IN_MIN_WORDS_MIN} max={BARGE_IN_MIN_WORDS_MAX} step={1}
              onValueChange={([value]) => setVoice({ bargeInMinWords: value })} aria-label="Mots nécessaires pour interrompre" />
            <p className="text-xs text-muted-foreground">Conseillé : 2. À 1, une toux ou un « oui » suffit à couper. Avec haut-parleurs sans casque, monter à 3 si le personnage se coupe tout seul.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <UsersRound className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Personnages actifs</h3>
              <p className="text-xs text-muted-foreground">
                Max et Emma ouvrent l’appel dès qu’ils sont activés ici. La checklist de Réglages personnages affine voix et ouverture, elle ne verrouille plus le sélecteur.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => void saveCharacters()} disabled={saving || !activationChanged}>
            <Save className="mr-1 h-3.5 w-3.5" />Enregistrer
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{profile.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.character_key === "max"
                      ? "Disponible à l’entrée et comme retour de conversation"
                      : "Disponible à l’entrée et comme destination de passage"}
                  </p>
                </div>
                <Switch
                  checked={profile.enabled}
                  onCheckedChange={(checked) => setProfiles((current) => current.map((candidate) =>
                    candidate.id === profile.id ? { ...candidate, enabled: checked } : candidate
                  ))}
                  aria-label={`${profile.display_name} actif dans l’expérience`}
                />
              </div>
            ))}
        </div>
      </section>

      <section className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
        Prochaines variables utiles : personnage ou écran d’entrée, reprise de session, mode de clôture, variantes d’onboarding et limite globale de cinématiques. Elles seront ajoutées ici lorsqu’elles seront câblées au runtime.
      </section>
    </div>
  );
}
