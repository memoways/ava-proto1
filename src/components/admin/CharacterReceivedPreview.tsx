import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildOptimizedPromptAssembly } from "@/agents/maxOptimizedPromptCompiler";
import { loadCharacterPrompt } from "@/services/characterPromptService";
import { describeCharacterPromptLayers, type CharacterLayerRow } from "@/services/characterPromptLayers";
import { compileCharacterStateBlock, normalizeStateProfile } from "@/services/characterState";

/**
 * « Voir ce que reçoit le personnage » (lot H): the counterpart of the GM
 * preview. Compiles the stored sheet with the character's initial state and
 * lists each layer with its provenance and its place in the written hierarchy.
 * Per-turn layers (frame, GM directive, memory, souvenirs) are listed as added
 * at each turn; nothing is sent to any model.
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

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (!characterId) { setError("Aucune fiche synchronisée pour ce personnage."); return; }
    try {
      const sheet = await loadCharacterPrompt(characterId);
      if (!sheet) { setError("Fiche introuvable."); return; }
      const profile = normalizeStateProfile(stateProfile);
      const trace = buildOptimizedPromptAssembly({
        character: sheet,
        characterName,
        userMessage: "(message du joueur)",
        historyChars: 0,
        characterState: profile ? compileCharacterStateBlock(profile.initial, profile) : undefined,
      });
      setRows(describeCharacterPromptLayers(trace));
      setPrompt(trace.finalSystemPrompt);
      setWarnings(trace.budget?.warnings ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aperçu indisponible.");
    }
  };

  return (
    <div className="space-y-2" data-testid="character-received">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">Ce que reçoit {characterName}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void toggle()} aria-expanded={open}>
          <Eye className="mr-1 h-3.5 w-3.5" />{open ? "Masquer" : "Voir ce que reçoit le personnage"}
        </Button>
      </div>
      {open && error && <p className="text-xs text-amber-300/90">{error}</p>}
      {open && rows && (
        <>
          {warnings.map((warning) => (
            <p key={warning.code} role="alert" className="rounded border border-destructive/60 px-2 py-1 text-xs text-destructive">⚠ {warning.message}</p>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Ordre de priorité écrit en tête du prompt : 1 faits de la fiche › 2 cadre › 3 état de l'application › 4 parole du tour. Cadre, directive GM,
            mémoire et souvenirs s'ajoutent à chaque tour ; ici l'état initial du radar et aucun historique.
          </p>
          <table className="w-full text-[11px]">
            <thead><tr className="text-left text-muted-foreground"><th>Niveau</th><th>Couche</th><th>Provenance</th><th className="text-right">Car.</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={row.included ? "" : "text-muted-foreground"}>
                  <td>{row.rank === 0 ? "contrat" : row.rank === 5 ? "contexte" : row.rank}</td>
                  <td>{row.label}</td>
                  <td>{row.source}</td>
                  <td className="text-right">{row.included ? `${row.chars}${row.truncated ? " (coupé)" : ""}` : `absent${row.omissionReason ? ` (${row.omissionReason})` : ""}`}</td>
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
