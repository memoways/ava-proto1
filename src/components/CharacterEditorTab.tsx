import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type CharacterListEntry,
  listCharactersWithPrompts,
} from "@/services/characterPromptService";
import CharacterPromptEditorPanel from "@/components/CharacterPromptEditorPanel";

const HIDDEN_NAMES = new Set([
  "identité & présentation",
  "identite & presentation",
  // Game Master is edited in the "Game Master" tab (Mécanique)
  "game master",
]);

export default function CharacterEditorTab() {
  const [list, setList] = useState<CharacterListEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => { void refreshList(); }, []);

  async function refreshList() {
    const entries = await listCharactersWithPrompts();
    const cleaned = entries
      .filter((e) => !HIDDEN_NAMES.has(e.name.trim().toLowerCase()))
      .sort((a, b) => {
        const aMax = a.name.toLowerCase().startsWith("max");
        const bMax = b.name.toLowerCase().startsWith("max");
        if (aMax && !bMax) return -1;
        if (!aMax && bMax) return 1;
        return a.name.localeCompare(b.name);
      });
    setList(cleaned);
    if (!activeId && cleaned.length > 0) {
      const max = cleaned.find((e) => e.name.toLowerCase().startsWith("max")) || cleaned[0];
      setActiveId(max.character_id);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Sélecteur personnage */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Personnages</h3>
          <Button size="sm" variant="outline" onClick={() => void refreshList()}>↻</Button>
        </div>
        {list.map((c) => (
          <button
            key={c.character_id}
            onClick={() => setActiveId(c.character_id)}
            className={`w-full text-left p-3 border rounded-lg hover:bg-accent/50 transition-colors ${
              activeId === c.character_id ? "bg-accent border-primary" : ""
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{c.name}</span>
              <span className={`text-xs ${c.has_prompt ? "text-green-400" : "text-muted-foreground"}`}>
                {c.has_prompt ? "✓" : "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.prompt_chars} chars éditoriaux</p>
          </button>
        ))}
        {list.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucun personnage. Lance une sync Notion.</p>
        )}
      </div>

      {/* Éditeur */}
      <div>
        {!activeId ? (
          <p className="text-sm text-muted-foreground">Sélectionne un personnage…</p>
        ) : (
          <CharacterPromptEditorPanel characterId={activeId} />
        )}
      </div>
    </div>
  );
}
