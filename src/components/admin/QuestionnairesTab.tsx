import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Trash2, Eye } from "lucide-react";
import type { SessionRow } from "./SessionsTab";

const fmt = (d: string | null) => d ? new Date(d).toLocaleString("fr-CH") : "—";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

interface Props {
  sessions: SessionRow[];
  onRefresh: () => void;
}

export default function QuestionnairesTab({ sessions, onRefresh }: Props) {
  const [viewSession, setViewSession] = useState<SessionRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const withQ = sessions.filter((s) => s.questionnaire_responses);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === withQ.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(withQ.map((s) => s.id)));
    }
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer les réponses questionnaire de ${selectedIds.size} session(s) ? (La session reste, seules les réponses sont effacées)`)) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("sessions")
      .update({ questionnaire_responses: null })
      .in("id", ids);
    if (error) {
      toast.error("Erreur: " + error.message);
    } else {
      toast.success(`${ids.length} questionnaire(s) effacé(s)`);
      setSelectedIds(new Set());
      onRefresh();
    }
    setDeleting(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Réponses au questionnaire</h2>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" onClick={deleteSelected} disabled={deleting}>
              <Trash2 className="w-3 h-3 mr-1" /> Supprimer ({selectedIds.size})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onRefresh}>Rafraîchir</Button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="p-2 w-8">
                <Checkbox
                  checked={withQ.length > 0 && selectedIds.size === withQ.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">Session</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
              <th className="text-center p-2 font-medium text-muted-foreground">Note</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Mot</th>
              <th className="text-center p-2 font-medium text-muted-foreground">NPS</th>
              <th className="text-center p-2 font-medium text-muted-foreground">Immersion</th>
              <th className="text-center p-2 font-medium text-muted-foreground">Trust</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Feedback</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {withQ.map((s) => {
              const q = s.questionnaire_responses;
              return (
                <tr key={s.id} className="border-b hover:bg-accent/30">
                  <td className="p-2">
                    <Checkbox
                      checked={selectedIds.has(s.id)}
                      onCheckedChange={() => toggleSelect(s.id)}
                    />
                  </td>
                  <td className="p-2 font-mono text-xs">{s.name || s.id.slice(0, 8)}</td>
                  <td className="p-2 text-xs">{fmt(s.started_at)}</td>
                  <td className="p-2 text-center">{q.experience_rating}/10</td>
                  <td className="p-2 text-xs">{q.experience_word || "—"}</td>
                  <td className="p-2 text-center">{q.nps}/10</td>
                  <td className="p-2 text-center">{q.immersion_story}/5</td>
                  <td className="p-2 text-center">{s.trust_level ?? 0}</td>
                  <td className="p-2 text-xs max-w-[200px] truncate">{q.open_feedback || "—"}</td>
                  <td className="p-2">
                    <button
                      onClick={() => setViewSession(s)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground"
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {withQ.length === 0 && (
          <p className="p-4 text-muted-foreground text-sm text-center">Aucune réponse au questionnaire</p>
        )}
      </div>

      {/* Detail popup */}
      <Dialog open={!!viewSession} onOpenChange={(open) => !open && setViewSession(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              📋 Questionnaire — {viewSession?.name || viewSession?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {viewSession?.questionnaire_responses && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Note expérience" value={`${viewSession.questionnaire_responses.experience_rating}/10`} />
                <Stat label="Mot clé" value={viewSession.questionnaire_responses.experience_word || "—"} />
                <Stat label="NPS" value={`${viewSession.questionnaire_responses.nps}/10`} />
                <Stat label="Immersion histoire" value={`${viewSession.questionnaire_responses.immersion_story}/5`} />
                <Stat label="Immersion naturel" value={`${viewSession.questionnaire_responses.immersion_natural}/5`} />
                <Stat label="Écoute Max" value={`${viewSession.questionnaire_responses.mechanic_listening}/5`} />
                <Stat label="Latence gênante" value={viewSession.questionnaire_responses.mechanic_latency || "—"} />
                <Stat label="Compris objectif" value={viewSession.questionnaire_responses.narration_understood || "—"} />
                <Stat label="Envie continuer" value={`${viewSession.questionnaire_responses.narration_continue}/5`} />
                <Stat label="Prêt à payer" value={viewSession.questionnaire_responses.value_pay || "—"} />
                <Stat label="Fourchette prix" value={viewSession.questionnaire_responses.value_price || "—"} />
                <Stat label="Format préféré" value={viewSession.questionnaire_responses.value_format || "—"} />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <Stat label="Trust final" value={String(viewSession.trust_level ?? 0)} />
                <Stat label="Durée" value={`${viewSession.duration_seconds ?? "—"}s`} />
                <Stat label="Raison fin" value={viewSession.game_over_reason || "—"} />
                <Stat label="Branch" value={viewSession.branch || "—"} />
              </div>

              {viewSession.questionnaire_responses.open_feedback && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Feedback ouvert</p>
                  <p className="text-sm italic bg-muted/20 rounded p-3">{viewSession.questionnaire_responses.open_feedback}</p>
                </div>
              )}

              {viewSession.questionnaire_responses.suggestions && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Suggestions</p>
                  <p className="text-sm italic bg-muted/20 rounded p-3">{viewSession.questionnaire_responses.suggestions}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
