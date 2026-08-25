import { useEffect, useState } from "react";
import { Clock3, RefreshCw, Save, UsersRound } from "lucide-react";
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
    || gameplay.SHOW_QUESTIONNAIRE !== savedGameplay.SHOW_QUESTIONNAIRE;
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
            <UsersRound className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Personnages actifs</h3>
              <p className="text-xs text-muted-foreground">
                Max et Emma peuvent ouvrir l’appel si leur checklist runtime est complète. Activer Emma ne suffit pas : le badge « configuré » dans Réglages personnages est aussi requis pour le sélecteur.
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
