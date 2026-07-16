import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, ChevronDown, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_STT_SETTINGS,
  STT_PROVIDER_LIST,
  getSTTProviderRuntimeStatuses,
  getSTTSettings,
  loadSTTSettingsFromDB,
  resetSTTSettings,
  resetSTTRuntimeConfigCache,
  saveSTTSettingsLocal,
  saveSTTSettingsToDB,
  type STTProviderId,
  type STTProviderStatus,
  type STTSettings,
} from "@/services/stt";
import type { STTProviderRuntimeStatus } from "@/services/stt/types";
import {
  DEFAULT_STT_DICTIONARY_TERMS,
  STT_DICTIONARY_MAX_TERMS,
  loadDictionaryFromDB,
  saveDictionaryToDB,
  termsToText,
  textToTerms,
} from "@/services/stt/dictionary";
import { loadSTTProviderSettingsFromDB } from "@/services/stt/providerSettings";
import STTProviderSettingsPanel from "@/components/stt/ProviderSettingsPanel";


const STATUS_LABELS: Record<STTProviderStatus, string> = {
  ready: "Configuré",
  missing_config: "Non configuré",
  error: "Erreur",
  disabled: "Préparé",
};

const STATUS_VARIANTS: Record<STTProviderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  missing_config: "outline",
  error: "destructive",
  disabled: "secondary",
};

export default function STTConfigTab() {
  const [settings, setSettings] = useState<STTSettings>(getSTTSettings());
  const [saved, setSaved] = useState<STTSettings>(getSTTSettings());
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<Record<STTProviderId, STTProviderRuntimeStatus> | null>(null);

  const [dictText, setDictText] = useState<string>(termsToText(DEFAULT_STT_DICTIONARY_TERMS));
  const [dictSaved, setDictSaved] = useState<string>(termsToText(DEFAULT_STT_DICTIONARY_TERMS));
  const [dictSaving, setDictSaving] = useState(false);

  const [expandedProvider, setExpandedProvider] = useState<STTProviderId | null>(null);

  useEffect(() => {
    loadSTTSettingsFromDB().then((loaded) => {
      setSettings(loaded);
      setSaved(loaded);
    });
    loadDictionaryFromDB().then(({ terms }) => {
      const text = termsToText(terms);
      setDictText(text);
      setDictSaved(text);
    });
    loadSTTProviderSettingsFromDB().catch(() => { /* fallback to defaults */ });
    refreshStatuses();
  }, []);


  const hasChanges = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);
  const dictTerms = useMemo(() => textToTerms(dictText), [dictText]);
  const dictHasChanges = dictText !== dictSaved;
  const dictOverLimit = dictTerms.length >= STT_DICTIONARY_MAX_TERMS;

  async function saveDictionary() {
    setDictSaving(true);
    try {
      const savedDict = await saveDictionaryToDB({ terms: dictTerms });
      const text = termsToText(savedDict.terms);
      setDictText(text);
      setDictSaved(text);
      toast.success(`Dictionnaire sauvegardé (${savedDict.terms.length} termes)`);
    } finally {
      setDictSaving(false);
    }
  }

  function resetDictionary() {
    const text = termsToText(DEFAULT_STT_DICTIONARY_TERMS);
    setDictText(text);
    toast.info("Dictionnaire réinitialisé — sauvegarde nécessaire");
  }


  function refreshStatuses() {
    resetSTTRuntimeConfigCache();
    getSTTProviderRuntimeStatuses()
      .then(setStatuses)
      .catch((err) => {
        console.warn("[STT Config] status refresh failed:", err);
        toast.error("Impossible de vérifier les statuts STT");
      });
  }

  function activate(provider: STTProviderId) {
    const next = saveSTTSettingsLocal({ activeProvider: provider });
    setSettings(next);
    toast.info("Provider STT sélectionné — sauvegarde nécessaire");
  }

  async function save() {
    setSaving(true);
    try {
      await saveSTTSettingsToDB(settings);
      setSaved(settings);
      toast.success("Configuration STT sauvegardée");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    const next = resetSTTSettings();
    setSettings(next);
    setSaved(next);
    toast.success("Configuration STT réinitialisée sur Deepgram");
  }

  const providersWithDict = STT_PROVIDER_LIST.filter((p) => p.supportsDictionary).map((p) => p.label).join(", ");
  const providersWithoutDict = STT_PROVIDER_LIST.filter((p) => !p.supportsDictionary).map((p) => p.label).join(", ");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">STT Config — Input vocal</h2>
        <p className="text-sm text-muted-foreground">
          Choisis le provider global utilisé pour transcrire le micro avant le pipeline LLM/TTS.
          Dictionnaire custom en haut, réglages API par provider sur chaque carte.
        </p>
      </div>

      {/* ===== Dictionnaire (en tête, plus visible) ===== */}
      <section id="dictionnaire" className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold">Dictionnaire custom (mots-clés partagés)</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Noms propres et jargon à privilégier — <strong>un terme par ligne</strong>. Injecté
              automatiquement à l'ouverture de chaque session pour les providers compatibles.
            </p>
            <p className="mt-2 text-xs">
              <span className="text-primary">✓ Utilise le dictionnaire :</span>{" "}
              <span className="font-mono text-muted-foreground">{providersWithDict}</span>
            </p>
            <p className="mt-1 text-xs">
              <span className="text-amber-400">✗ Ne l'utilise pas :</span>{" "}
              <span className="font-mono text-muted-foreground">{providersWithoutDict}</span>
            </p>
          </div>
          <Badge variant={dictOverLimit ? "destructive" : "secondary"}>
            {dictTerms.length} / {STT_DICTIONARY_MAX_TERMS}
          </Badge>
        </div>

        <Textarea
          value={dictText}
          onChange={(e) => setDictText(e.target.value)}
          rows={7}
          spellCheck={false}
          className="font-mono text-sm"
          placeholder={"Max\nAva\nEmma\nLéo\nProtogyny\nMemoWays"}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={saveDictionary}
            disabled={dictSaving || !dictHasChanges}
            className={dictHasChanges ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Save className="mr-2 h-4 w-4" />
            {dictSaving ? "Sauvegarde..." : "Sauver le dictionnaire"}
          </Button>
          <Button size="sm" variant="ghost" onClick={resetDictionary}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Réinitialiser aux valeurs par défaut
          </Button>
          {dictHasChanges && (
            <span className="text-xs text-amber-400">Modifications non sauvegardées</span>
          )}
        </div>
      </section>

      {hasChanges && (
        <div className="rounded-md border border-yellow-700/50 bg-yellow-900/30 px-3 py-2 text-xs text-yellow-300">
          Modifications STT non sauvegardées. Le runtime local les voit déjà, mais Lovable/Supabase utilisera la valeur sauvegardée.
        </div>
      )}

      {/* ===== Providers ===== */}
      <section className="space-y-3">
        {STT_PROVIDER_LIST.map((provider) => {
          const isActive = settings.activeProvider === provider.id;
          const status = statuses?.[provider.id]?.status ?? "missing_config";
          const message = statuses?.[provider.id]?.message;
          const secrets = provider.expectedSecrets.join(", ");
          const isExpanded = expandedProvider === provider.id;

          return (
            <div
              key={provider.id}
              className={`rounded-lg border p-4 transition-colors ${
                isActive ? "border-primary bg-primary/10" : "border-border bg-card/40"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{provider.label}</h3>
                    {isActive && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    <Badge
                      variant={provider.supportsDictionary ? "default" : "outline"}
                      title={provider.dictionaryMethod}
                      className={provider.supportsDictionary ? "" : "opacity-60"}
                    >
                      {provider.supportsDictionary ? "📖 Dictionnaire ✓" : "📖 Dictionnaire ✗"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{provider.description}</p>
                  {provider.dictionaryMethod && (
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      Dictionnaire : <span className="font-mono">{provider.dictionaryMethod}</span>
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Mode : {provider.mode}</p>
                <p>Secrets attendus : <span className="font-mono">{secrets}</span></p>
                {message && (
                  <p className={status === "ready" ? "text-primary" : "text-amber-400"}>
                    {status !== "ready" && <AlertCircle className="mr-1 inline h-3 w-3" />}
                    {message}
                  </p>
                )}
                {!provider.implemented && (
                  <p>Provider préparé dans l'admin. Le runtime retombe sur Deepgram tant que l'intégration n'est pas finalisée.</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                  className="text-xs"
                >
                  <ChevronDown className={`mr-1 h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  {isExpanded ? "Masquer les réglages API" : "Réglages API"}
                </Button>
                <Button
                  size="sm"
                  variant={isActive ? "secondary" : "outline"}
                  onClick={() => activate(provider.id)}
                  disabled={isActive}
                >
                  {isActive ? "Actif" : "Activer"}
                </Button>
              </div>

              {isExpanded && (
                <div className="mt-4 border-t border-border/50 pt-4">
                  <STTProviderSettingsPanel providerId={provider.id} />
                </div>
              )}
            </div>
          );
        })}
      </section>


      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving || !hasChanges} className={hasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder le provider actif"}
        </Button>
        <Button variant="outline" onClick={refreshStatuses}>
          Vérifier les statuts
        </Button>
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Deepgram
        </Button>
        <p className="text-xs text-muted-foreground">
          Défaut sans config : {DEFAULT_STT_SETTINGS.activeProvider}.
        </p>
      </div>
    </div>
  );
}
