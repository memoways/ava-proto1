import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TTS_PROVIDER_LIST } from "@/services/tts/registry";
import {
  fetchCharacterAutoReadiness,
  listCharacterRuntimeProfiles,
  updateCharacterRuntimeProfile,
  uploadCharacterPortrait,
  type CharacterAutoReadiness,
  type CharacterRuntimeProfile,
} from "@/services/experienceOrchestration";

const KEY_ORDER = ["max", "emma", "ava", "leo"];

function readiness(
  profile: CharacterRuntimeProfile,
  auto: CharacterAutoReadiness | undefined,
): Array<{ label: string; ok: boolean; hint: string }> {
  const chunks = auto?.ragChunks ?? 0;
  return [
    {
      label: "Fiche Notion",
      ok: Boolean(auto?.characterId),
      hint: auto?.characterId
        ? `Fiche « ${auto.characterName} » synchronisée`
        : "Aucune fiche « En cours » trouvée dans Contenu Notion → Sync Notion",
    },
    {
      label: "Prompt compilé",
      ok: Boolean(auto?.hasPrompt),
      hint: auto?.hasPrompt
        ? "Prompt présent dans Personnages"
        : "Lancer une synchronisation Notion pour générer le prompt du personnage",
    },
    {
      label: "Corpus RAG isolé",
      ok: chunks > 0,
      hint: chunks > 0 ? `${chunks} chunk(s) indexé(s)` : "Aucun chunk indexé pour ce personnage (onglet Embeddings)",
    },
    {
      label: "Portrait",
      ok: Boolean(profile.portrait_url),
      hint: profile.portrait_url ? "Portrait défini" : "Téléverser un portrait ci-dessous",
    },
    {
      label: "Phrase d’ouverture",
      ok: Boolean(profile.opening_line),
      hint: profile.opening_line ? "Phrase définie" : "Saisir la première réplique du personnage",
    },
    {
      label: "Provider et voix TTS",
      ok: Boolean(profile.tts_provider && profile.tts_voice_id),
      hint: profile.tts_provider && profile.tts_voice_id
        ? `${profile.tts_provider} · ${profile.tts_voice_id}`
        : "Renseigner le provider et le Voice ID (voir TTS Config)",
    },
  ];
}

export default function CharacterRuntimeSettingsTab() {
  const [profiles, setProfiles] = useState<CharacterRuntimeProfile[]>([]);
  const [autoReadiness, setAutoReadiness] = useState<Record<string, CharacterAutoReadiness>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadingPortrait, setUploadingPortrait] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const nextProfiles = (await listCharacterRuntimeProfiles()).slice().sort(
        (a, b) => KEY_ORDER.indexOf(a.character_key) - KEY_ORDER.indexOf(b.character_key),
      );
      setProfiles(nextProfiles);
      try {
        setAutoReadiness(await fetchCharacterAutoReadiness(nextProfiles.map((profile) => profile.display_name)));
      } catch {
        setAutoReadiness({});
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patchProfile = (id: string, patch: Partial<CharacterRuntimeProfile>) => {
    setProfiles((current) => current.map((profile) => profile.id === id ? { ...profile, ...patch } : profile));
  };

  const uploadPortrait = async (profile: CharacterRuntimeProfile, file: File) => {
    setUploadingPortrait(profile.id);
    try {
      const url = await uploadCharacterPortrait(profile.character_key, file);
      patchProfile(profile.id, { portrait_url: url });
      toast.success("Portrait téléversé, pensez à sauvegarder le profil");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléversement du portrait impossible");
    } finally {
      setUploadingPortrait(null);
    }
  };

  const saveProfile = async (profile: CharacterRuntimeProfile) => {
    setSaving(true);
    try {
      const auto = autoReadiness[profile.display_name];
      await updateCharacterRuntimeProfile(profile.id, {
        enabled: profile.enabled,
        notion_character_id: auto?.characterId ?? profile.notion_character_id,
        opening_line: profile.opening_line,
        portrait_url: profile.portrait_url,
        tts_provider: profile.tts_provider,
        tts_voice_id: profile.tts_voice_id,
        prompt_validated: Boolean(auto?.hasPrompt),
        rag_validated: (auto?.ragChunks ?? 0) > 0,
        qualitative_tests_validated: profile.qualitative_tests_validated,
        knowledge_isolation_validated: profile.knowledge_isolation_validated,
      });
      toast.success(`Profil runtime ${profile.display_name} sauvegardé`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sauvegarde du profil impossible");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement des personnages…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">🧑‍🤝‍🧑 Réglages personnages</h2>
          <p className="text-sm text-muted-foreground">
            Les prérequis Fiche Notion, Prompt et Corpus RAG sont détectés automatiquement dans la base. Un personnage n’est
            proposé au runtime que lorsque tout est vert.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Actualiser</Button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-100">
          Profils runtime non disponibles : {loadError}.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {profiles.map((profile) => {
          const auto = autoReadiness[profile.display_name];
          const checks = readiness(profile, auto);
          const blockers = checks.filter((check) => !check.ok);
          const ready = profile.enabled && blockers.length === 0;
          return (
            <div key={profile.id} className="rounded border p-3">
              <div className="flex items-center justify-between"><strong>{profile.display_name}</strong><Badge variant={ready ? "default" : "outline"}>{ready ? "prêt" : "incomplet"}</Badge></div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                {checks.map((check) => (
                  <span key={check.label} title={check.hint} className={check.ok ? "text-emerald-500" : "text-muted-foreground"}>
                    {check.ok ? "✓" : "○"} {check.label}
                  </span>
                ))}
              </div>
              {blockers.length > 0 && (
                <ul className="mt-2 space-y-1 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                  {blockers.map((blocker) => (
                    <li key={blocker.label}><span className="font-medium text-foreground">{blocker.label} :</span> {blocker.hint}</li>
                  ))}
                </ul>
              )}
              <div className="mt-4 space-y-2 border-t pt-3">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Checkbox checked={profile.enabled} onCheckedChange={(checked) => patchProfile(profile.id, { enabled: checked === true })} />
                  Personnage activable par le runtime
                </label>
                <Textarea value={profile.opening_line ?? ""} onChange={(event) => patchProfile(profile.id, { opening_line: event.target.value || null })} placeholder="Phrase d’ouverture" className="min-h-20" />
                <div className="flex items-center gap-2">
                  {profile.portrait_url && (
                    <img src={profile.portrait_url} alt={`Portrait de ${profile.display_name}`} className="h-12 w-12 rounded object-cover" />
                  )}
                  <label className="inline-flex cursor-pointer items-center rounded border border-border bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80">
                    {uploadingPortrait === profile.id ? "Téléversement…" : "Sélectionner portrait"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingPortrait === profile.id}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void uploadPortrait(profile, file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={profile.tts_provider ?? ""}
                    onValueChange={(value) => patchProfile(profile.id, { tts_provider: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Provider TTS" />
                    </SelectTrigger>
                    <SelectContent>
                      {TTS_PROVIDER_LIST.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>{provider.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input value={profile.tts_voice_id ?? ""} onChange={(event) => patchProfile(profile.id, { tts_voice_id: event.target.value || null })} placeholder="Voice ID du personnage" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Les autres réglages de voix (modèle, format, vitesse…) restent ceux de l’onglet TTS Config ; seul le Voice ID se définit par personnage.
                </p>

                <Button size="sm" variant="outline" disabled={saving || uploadingPortrait === profile.id} onClick={() => void saveProfile(profile)}>
                  <Save className="mr-1 h-3.5 w-3.5" />{uploadingPortrait === profile.id ? "Téléversement…" : "Sauvegarder le profil"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
