import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildOptimizedPromptAssembly } from "@/agents/maxOptimizedPromptCompiler";
import { buildCharacterRulesInvariant, previewCharacterIdentity } from "@/agents/characterRulesInvariant";
import { loadCharacterPrompt } from "@/services/characterPromptService";
import { describeCharacterPromptLayers, type CharacterLayerRow } from "@/services/characterPromptLayers";
import { compileCharacterStateBlock, normalizeStateProfile } from "@/services/characterState";
import { buildCharacterIdentityInvariant, toCharacterExecutionContext } from "@/services/characterIdentityGuard";
import { buildLongTurnSimulation } from "@/services/characterReceivedSimulation";
import { getActiveEnvironment } from "@/services/environmentContext";
import type { RuntimeCharacter } from "@/types";

const DEFAULT_QUESTION = "Comment ce fusil est-il arrivé au chalet ?";

/**
 * « Voir ce que reçoit le personnage » (lot H): the counterpart of the GM
 * preview. Compiles the stored sheet with the character's initial state and the
 * same identity, gravity and transfer rules as the game (souvenirs lot 1: the
 * preview no longer under-counts the rules). « Simuler un tour long » adds what a
 * deep turn carries: ≈ 1 000 characters of history, a full memory, a phone
 * transfer, the typed question and the souvenirs `query-rag` really returns for
 * it. Nothing is sent to any model, nothing is written.
 */
export function CharacterReceivedPreview({ characterId, characterName, stateProfile }: {
  characterId: string | null | undefined;
  characterName: string;
  stateProfile: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CharacterLayerRow[] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<Array<{ code: string; message: string }>>([]);
  const [longTurn, setLongTurn] = useState(false);
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const compile = async (simulate: boolean) => {
    if (!characterId) { setError("Aucune fiche synchronisée pour ce personnage."); return; }
    setBusy(true);
    try {
      const sheet = await loadCharacterPrompt(characterId);
      if (!sheet) { setError("Fiche introuvable."); return; }
      const characterKey = (characterName.trim().split(/\s+/)[0] ?? "").toLocaleLowerCase("fr") as RuntimeCharacter;
      const { getCharacterRuntimeReadiness } = await import("@/services/experienceOrchestration");
      const runtime = characterKey === "max" || characterKey === "emma"
        ? await getCharacterRuntimeReadiness(characterKey).catch(() => null)
        : null;
      const context = toCharacterExecutionContext(runtime);
      // The exact live identity block when the runtime is ready, else the same wording.
      const identity = context
        ? buildCharacterIdentityInvariant(context)
        : previewCharacterIdentity({
          displayName: sheet.name ?? characterName, characterKey, characterId: sheet.character_id,
          environmentId: getActiveEnvironment(), promptUpdatedAt: sheet.updated_at ?? null,
        });
      const profile = normalizeStateProfile(stateProfile);
      let turn: Partial<ReturnType<typeof buildLongTurnSimulation>> = {};
      let found = "";
      if (simulate) {
        if (!context) { setError("Personnage non prêt dans cet environnement : souvenirs réels indisponibles."); return; }
        const [{ queryRAGDetailed }, { getGameplaySettings }, { characterRagTopKForVariant }, { RAG_DEFAULT_RETRIEVE_K }] = await Promise.all([
          import("@/services/ragService"),
          import("@/services/settingsService"),
          import("@/services/characterRagTopK"),
          import("@/config/experienceRuntime"),
        ]);
        const gameplay = getGameplaySettings();
        const topK = characterRagTopKForVariant("optimized_v3", gameplay.RAG_TOP_K);
        const rag = await queryRAGDetailed(question, undefined, topK, gameplay.RAG_MATCH_THRESHOLD, {
          characterId: context.characterId,
          characterContext: context,
          rerank: gameplay.RAG_RERANK_ENABLED,
          retrieveK: Math.max(gameplay.RAG_RETRIEVE_K ?? RAG_DEFAULT_RETRIEVE_K, topK),
          rerankModel: gameplay.RAG_RERANK_MODEL,
          rerankTruncation: gameplay.RAG_RERANK_TRUNCATION,
        });
        if (rag.error) { setError(`Recherche des souvenirs en erreur : ${rag.error}`); return; }
        turn = buildLongTurnSimulation({
          sheet, characterKey, question,
          ragCandidates: rag.matches.map((match, index) => ({ id: match.id, content: match.content, rank: index + 1 })),
        });
        found = `${rag.matches.length} souvenir(s) retrouvé(s)`;
      }
      const trace = buildOptimizedPromptAssembly({
        character: sheet,
        characterName,
        identityInvariant: buildCharacterRulesInvariant(identity),
        userMessage: "(message du joueur)",
        historyChars: 0,
        characterState: profile ? compileCharacterStateBlock(profile.initial, profile) : undefined,
        ...turn,
      });
      const budget = trace.budget;
      setRows(describeCharacterPromptLayers(trace));
      setPrompt(trace.finalSystemPrompt);
      setWarnings(budget?.warnings ?? []);
      setSummary(`${budget?.totalSystemChars ?? trace.finalSystemPrompt.length} car. sur ${budget?.limitChars ?? "?"} (historique ${budget?.historyChars ?? 0})${simulate ? ` · ${found}, ${budget?.sentRagIds?.length ?? 0} envoyé(s)` : ""}`);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aperçu indisponible.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    await compile(longTurn);
  };

  return (
    <div className="space-y-2" data-testid="character-received">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">Ce que reçoit {characterName}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void toggle()} aria-expanded={open}>
          <Eye className="mr-1 h-3.5 w-3.5" />{open ? "Masquer" : "Voir ce que reçoit le personnage"}
        </Button>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5">
            <Checkbox checked={longTurn} onCheckedChange={(checked) => setLongTurn(checked === true)} aria-label="Simuler un tour long" />
            Simuler un tour long
          </label>
          {longTurn && (
            <Input value={question} onChange={(event) => setQuestion(event.target.value)} className="h-7 min-w-[16rem] flex-1 text-xs" aria-label="Question du joueur simulée" />
          )}
          <Button type="button" size="sm" variant="secondary" disabled={busy || (longTurn && !question.trim())} onClick={() => void compile(longTurn)}>
            {busy ? "Calcul…" : "Recalculer"}
          </Button>
        </div>
      )}
      {open && error && <p className="text-xs text-amber-300/90">{error}</p>}
      {open && rows && (
        <>
          {warnings.map((warning) => (
            <p key={warning.code} role="alert" className="rounded border border-destructive/60 px-2 py-1 text-xs text-destructive">⚠ {warning.message}</p>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Ordre de priorité écrit en tête du prompt : 1 faits de la fiche › 2 cadre › 3 état de l'application › 4 parole du tour.
            {longTurn
              ? " Tour long simulé : historique ≈ 1 000 car., mémoire pleine, retour de transfert, question saisie, vrais souvenirs."
              : " Ici l'état initial du radar et aucun historique : « absent (section_vide) » veut dire « non simulé », cochez « Simuler un tour long » pour voir la place qui reste en jeu."}
          </p>
          {summary && <p className="text-[11px]" data-testid="character-received-summary">Prompt système : {summary}</p>}
          <table className="w-full text-[11px]">
            <thead><tr className="text-left text-muted-foreground"><th>Niveau</th><th>Couche</th><th>Provenance</th><th className="text-right">Car.</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={row.included ? "" : "text-muted-foreground"}>
                  <td>{row.rank === 0 ? "contrat" : row.rank === 5 ? "contexte" : row.rank}</td>
                  <td>{row.label}</td>
                  <td>{row.source}</td>
                  <td className="text-right">{row.included ? `${row.chars}${row.truncated ? " (coupé)" : ""}` : `absent${row.omissionReason ? ` (${row.omissionReason === "budget_contexte_epuise" ? "manque de place" : row.omissionReason})` : ""}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Textarea value={prompt} readOnly className="min-h-[240px] font-mono text-xs" aria-label={`Prompt reçu par ${characterName}`} />
        </>
      )}
    </div>
  );
}
