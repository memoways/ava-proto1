import { useState, useEffect } from "react";
import VideoTriggersEditor from "@/components/VideoTriggersEditor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";
import { SPEECH_MODES } from "@/services/speechModes";
import {
  getGMPromptSettings,
  saveGMPromptSettings,
  saveGMPromptSettingsToDB,
  loadGMPromptSettingsFromDB,
  resetGMPromptSettings,
  getGameplaySettings,
  saveGameplaySettings,
  saveGameplaySettingsToDB,
  loadGameplaySettingsFromDB,
  resetGameplaySettings,
  type GameMasterPromptSettings,
  type GameplaySettings,
} from "@/services/settingsService";

export default function GameMasterConfigTab() {
  const [gmPrompt, setGmPrompt] = useState<GameMasterPromptSettings>(getGMPromptSettings());
  const [gameplay, setGameplay] = useState<GameplaySettings>(getGameplaySettings());
  const [savedGameplay, setSavedGameplay] = useState<GameplaySettings>(getGameplaySettings());
  const [editPrompt, setEditPrompt] = useState(gmPrompt.systemPrompt);
  const [editPreTurnPrompt, setEditPreTurnPrompt] = useState(gmPrompt.preTurnPlannerPrompt);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([loadGMPromptSettingsFromDB(), loadGameplaySettingsFromDB()]).then(([gm, gp]) => {
      setGmPrompt(gm);
      setGameplay(gp);
      setSavedGameplay(gp);
      setEditPrompt(gm.systemPrompt);
      setEditPreTurnPrompt(gm.preTurnPlannerPrompt);
    });
  }, []);

  const hasGameplayChanges = JSON.stringify(gameplay) !== JSON.stringify(savedGameplay);

  function updateGameplay(patch: Partial<GameplaySettings>) {
    const updated = saveGameplaySettings(patch);
    setGameplay(updated);
  }

  async function handleSaveGameplay() {
    setSaving(true);
    await saveGameplaySettingsToDB(gameplay);
    setSavedGameplay(gameplay);
    toast.success("Réglages de jeu sauvegardés ✓");
    setSaving(false);
  }

  async function savePrompt() {
    const updated = saveGMPromptSettings({ systemPrompt: editPrompt, preTurnPlannerPrompt: editPreTurnPrompt });
    setGmPrompt(updated);
    await saveGMPromptSettingsToDB(updated);
    toast.success("Prompt Game Master sauvegardé ✓");
  }

  function handleResetAll() {
    const gm = resetGMPromptSettings();
    const gp = resetGameplaySettings();
    setGmPrompt(gm);
    setGameplay(gp);
    setSavedGameplay(gp);
    setEditPrompt(gm.systemPrompt);
    setEditPreTurnPrompt(gm.preTurnPlannerPrompt);
    toast.success("Mécanique réinitialisée aux valeurs par défaut");
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">🎮 Mécanique de l'expérience</h2>
          <p className="text-sm text-muted-foreground">
            Règles du jeu, seuils, prompt du Game Master — tout ce qui pilote la progression de l'expérience.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleResetAll}>
          Tout réinitialiser
        </Button>
      </div>

      {/* ===== SPEECH MODES CATALOG ===== */}
      <section className="border rounded-lg p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-base mb-1">🎭 Catalogue des modes de parole</h3>
          <p className="text-xs text-muted-foreground">
            Le Game Master sélectionne un de ces modes dans le champ <code>response_mode</code> du brief de tour. Max l'exécute via les indices de style.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {SPEECH_MODES.map((mode) => (
            <div key={mode.id} className="rounded border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{mode.label}</p>
                <Badge variant="outline" className="font-mono text-[10px]">{mode.id}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{mode.description}</p>
              <ul className="list-disc pl-4 text-xs">
                {mode.styleHints.map((hint) => <li key={hint}>{hint}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ===== GAMEPLAY SETTINGS ===== */}
      <section className="border rounded-lg p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base mb-1">⚙️ Réglages de jeu</h3>
            <p className="text-xs text-muted-foreground">
              Ces paramètres contrôlent la progression et les conditions de victoire/défaite.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSaveGameplay}
            disabled={saving || !hasGameplayChanges}
            className={hasGameplayChanges ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Save className="w-3 h-3 mr-1" /> {saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>

        {hasGameplayChanges && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-2 text-sm text-yellow-300">
            ⚠️ Modifications non sauvegardées — clique "Sauvegarder" pour persister en base de données.
          </div>
        )}

        {/* Trust Threshold */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">
              Seuil de confiance (Trust Threshold)
            </label>
            <span className="text-sm font-mono">{gameplay.TRUST_THRESHOLD}</span>
          </div>
          <Slider
            value={[gameplay.TRUST_THRESHOLD]}
            onValueChange={([v]) => updateGameplay({ TRUST_THRESHOLD: v })}
            min={3}
            max={20}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>3 — Facile (gate rapide)</span>
            <span>20 — Très exigeant</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">
            💡 Le joueur atteint la "gate" quand trust_level ≥ ce seuil. Chaque réponse sincère donne +1, évasive -1.
          </p>
        </div>

        {/* Timeout */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">
              Durée max de la session (secondes)
            </label>
            <span className="text-sm font-mono">{gameplay.TIMEOUT_SECONDS}s ({Math.floor(gameplay.TIMEOUT_SECONDS / 60)}min)</span>
          </div>
          <Slider
            value={[gameplay.TIMEOUT_SECONDS]}
            onValueChange={([v]) => updateGameplay({ TIMEOUT_SECONDS: v })}
            min={120}
            max={1800}
            step={30}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>2 min — Ultra court</span>
            <span>30 min — Session longue</span>
          </div>
        </div>

        {/* Insult Tolerance */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">
              Tolérance aux insultes
            </label>
            <span className="text-sm font-mono">{gameplay.MAX_INSULT_TOLERANCE}</span>
          </div>
          <Slider
            value={[gameplay.MAX_INSULT_TOLERANCE]}
            onValueChange={([v]) => updateGameplay({ MAX_INSULT_TOLERANCE: v })}
            min={0}
            max={5}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 — Aucune tolérance</span>
            <span>5 — Très tolérant</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">
            💡 Nombre d'échanges inappropriés avant game_over. Le Game Master détecte les insultes et flags.
          </p>
        </div>

        {/* Min Questions Before Gate */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">
              Min. échanges avant gate
            </label>
            <span className="text-sm font-mono">{gameplay.MIN_QUESTIONS_BEFORE_GATE}</span>
          </div>
          <Slider
            value={[gameplay.MIN_QUESTIONS_BEFORE_GATE]}
            onValueChange={([v]) => updateGameplay({ MIN_QUESTIONS_BEFORE_GATE: v })}
            min={3}
            max={25}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>3 — Passage rapide</span>
            <span>25 — Conversation longue requise</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">
            💡 Même si le trust est suffisant, la gate ne s'ouvre pas avant ce nombre d'échanges minimum.
          </p>
        </div>

        {/* RAG Top K */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">
              RAG — Nombre de résultats (Top K)
            </label>
            <span className="text-sm font-mono">{gameplay.RAG_TOP_K}</span>
          </div>
          <Slider
            value={[gameplay.RAG_TOP_K]}
            onValueChange={([v]) => updateGameplay({ RAG_TOP_K: v })}
            min={1}
            max={15}
            step={1}
          />
          <p className="text-xs text-muted-foreground/60 mt-1">
            💡 Plus de résultats = plus de contexte narratif pour Max, mais tokens plus élevés.
          </p>
        </div>

        {/* Video Placeholder Duration */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">
              Durée placeholder vidéo (secondes)
            </label>
            <span className="text-sm font-mono">{gameplay.VIDEO_PLACEHOLDER_DURATION}s</span>
          </div>
          <Slider
            value={[gameplay.VIDEO_PLACEHOLDER_DURATION]}
            onValueChange={([v]) => updateGameplay({ VIDEO_PLACEHOLDER_DURATION: v })}
            min={3}
            max={30}
            step={1}
          />
        </div>
      </section>

      {/* ===== GAME MASTER PROMPT ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-base mb-1">🧠 Prompt du Game Master</h3>
          <p className="text-xs text-muted-foreground">
            Ce prompt est envoyé au LLM du Game Master à chaque échange. Il analyse la conversation et retourne un JSON
            avec trust_delta, triggers vidéo, game_over, etc.
          </p>
        </div>

        <div className="bg-muted/20 border rounded-lg p-3 text-xs space-y-2">
          <p className="font-semibold text-muted-foreground">📖 Comment ça marche :</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>trust_delta</strong> : +1 (sincère), 0 (neutre), -1 (évasif) → ajouté au trust_level global</li>
            <li><strong>trigger_video_id</strong> : ID d'un trigger vidéo si un thème clé est abordé</li>
            <li><strong>game_over</strong> : true si insultes répétées ou abandon détecté</li>
            <li><strong>gate_reached</strong> : true si trust ≥ seuil → passage à la phase suivante</li>
            <li><strong>moderation_flag</strong> : true si contenu inapproprié détecté</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Le Game Master reçoit aussi l'historique récent (6 derniers messages), le trust actuel, les triggers déjà activés et le temps écoulé.
          </p>
        </div>

        <Textarea
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          className="min-h-[40vh] font-mono text-sm"
          placeholder="System prompt du Game Master..."
        />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Pré-turn planner du Game Master</p>
          <p className="text-xs text-muted-foreground">
            Nouveau: ce prompt prépare le tour avant Max et génère le brief de réponse utilisé par le pipeline.
          </p>
          <Textarea
            value={editPreTurnPrompt}
            onChange={(e) => setEditPreTurnPrompt(e.target.value)}
            className="min-h-[28vh] font-mono text-sm"
            placeholder="Prompt de planification pré-tour..."
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{editPrompt.length + editPreTurnPrompt.length} caractères cumulés</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditPrompt(gmPrompt.systemPrompt);
                setEditPreTurnPrompt(gmPrompt.preTurnPlannerPrompt);
              }}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={savePrompt}
              disabled={editPrompt === gmPrompt.systemPrompt}
            >
              Sauvegarder
            </Button>
          </div>
        </div>
      </section>

      {/* ===== TRIGGERS ===== */}
      <VideoTriggersEditor />

      {/* Config Summary */}
      <section className="border rounded-lg p-4 bg-muted/20">
        <h3 className="font-semibold text-sm mb-2">📋 Config mécanique active</h3>
        <pre className="text-xs font-mono whitespace-pre-wrap">
{JSON.stringify({ gameplay, gmPromptLength: gmPrompt.systemPrompt.length, triggers: Object.keys(gmPrompt.triggers) }, null, 2)}
        </pre>
      </section>
    </div>
  );
}
