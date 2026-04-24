import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Pencil, MessageSquare, Check, X } from "lucide-react";

export interface SessionRow {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  trust_level: number | null;
  game_over_reason: string | null;
  duration_seconds: number | null;
  branch: string | null;
  triggers_activated: string[] | null;
  conversation_log: any;
  questionnaire_responses: any;
  name: string | null;
  admin_note: string | null;
}

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

export default function SessionsTab({ sessions, onRefresh }: Props) {
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function deleteSession(id: string) {
    if (!confirm("Supprimer cette session définitivement ?")) return;
    setDeleting(id);
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) {
      toast.error("Erreur suppression: " + error.message);
    } else {
      toast.success("Session supprimée");
      if (selected?.id === id) setSelected(null);
      onRefresh();
    }
    setDeleting(null);
  }

  async function saveName(id: string) {
    const { error } = await supabase.from("sessions").update({ name: nameInput || null }).eq("id", id);
    if (error) {
      toast.error("Erreur: " + error.message);
    } else {
      toast.success("Nom mis à jour");
      if (selected?.id === id) setSelected({ ...selected!, name: nameInput || null });
      onRefresh();
    }
    setEditingName(null);
  }

  async function saveNote(id: string) {
    const { error } = await supabase.from("sessions").update({ admin_note: noteInput || null }).eq("id", id);
    if (error) {
      toast.error("Erreur: " + error.message);
    } else {
      toast.success("Note mise à jour");
      if (selected?.id === id) setSelected({ ...selected!, admin_note: noteInput || null });
      onRefresh();
    }
    setEditingNote(null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Sessions récentes</h2>
          <Button size="sm" variant="outline" onClick={onRefresh}>Rafraîchir</Button>
        </div>
        <ScrollArea className="h-[70vh] border rounded-lg">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`relative group w-full text-left p-3 border-b hover:bg-accent/50 transition-colors cursor-pointer ${
                selected?.id === s.id ? "bg-accent" : ""
              }`}
              onClick={() => setSelected(s)}
            >
              <div className="flex justify-between items-start">
                <div>
                  {s.name ? (
                    <span className="text-sm font-semibold">{s.name}</span>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">{s.id.slice(0, 8)}</span>
                  )}
                  <p className="text-xs text-muted-foreground">{fmt(s.started_at)}</p>
                </div>
                <div className="text-right text-xs flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full ${
                    s.ended_at ? "bg-green-900/40 text-green-300" : "bg-yellow-900/40 text-yellow-300"
                  }`}>
                    {s.ended_at ? "Terminée" : "En cours"}
                  </span>
                  <p className="mt-1">Trust: {s.trust_level ?? 0} | {s.duration_seconds ?? "—"}s</p>
                </div>
              </div>
              {s.admin_note && (
                <p className="text-xs text-muted-foreground mt-1 italic">💬 {s.admin_note}</p>
              )}
              {s.game_over_reason && (
                <p className="text-xs text-red-400 mt-1">Fin: {s.game_over_reason}</p>
              )}
              {/* Action buttons on hover */}
              <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingName(s.id); setNameInput(s.name || ""); }}
                  className="p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground"
                  title="Renommer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingNote(s.id); setNoteInput(s.admin_note || ""); }}
                  className="p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground"
                  title="Note"
                >
                  <MessageSquare className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="p-1 rounded bg-destructive/20 hover:bg-destructive/40 text-destructive"
                  title="Supprimer"
                  disabled={deleting === s.id}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Inline edit: name */}
              {editingName === s.id && (
                <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Nom de la session..."
                    className="h-7 text-xs"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && saveName(s.id)}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveName(s.id)}><Check className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingName(null)}><X className="w-3 h-3" /></Button>
                </div>
              )}

              {/* Inline edit: note */}
              {editingNote === s.id && (
                <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                  <Textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Note / commentaire..."
                    className="text-xs min-h-[60px]"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => saveNote(s.id)}>Enregistrer</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingNote(null)}>Annuler</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="p-4 text-muted-foreground text-sm">Aucune session</p>
          )}
        </ScrollArea>
      </div>

      <div>
        {selected ? (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">
                {selected.name || `Session ${selected.id.slice(0, 8)}`}
              </h2>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteSession(selected.id)}
                disabled={deleting === selected.id}
              >
                <Trash2 className="w-3 h-3 mr-1" /> Supprimer
              </Button>
            </div>

            {selected.admin_note && (
              <p className="text-sm italic text-muted-foreground mb-3 bg-muted/20 rounded p-2">💬 {selected.admin_note}</p>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <Stat label="Début" value={fmt(selected.started_at)} />
              <Stat label="Fin" value={fmt(selected.ended_at)} />
              <Stat label="Trust" value={String(selected.trust_level ?? 0)} />
              <Stat label="Durée" value={`${selected.duration_seconds ?? "—"}s`} />
              <Stat label="Branch" value={selected.branch || "—"} />
              <Stat label="Raison fin" value={selected.game_over_reason || "—"} />
            </div>

            {selected.triggers_activated?.length ? (
              <div className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Triggers activés</p>
                <div className="flex flex-wrap gap-1">
                  {selected.triggers_activated.map((t) => (
                    <span key={t} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mb-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Conversation ({Array.isArray(selected.conversation_log) ? selected.conversation_log.length : 0} messages)
              </p>
              <ScrollArea className="h-60 border rounded p-2">
                {Array.isArray(selected.conversation_log) &&
                  selected.conversation_log.map((msg: any, i: number) => {
                    const fb = msg.gmFallback;
                    const blocker = msg.pipeline?.blocker;
                    return (
                      <div key={i} className={`mb-2 text-sm ${msg.role === "max" ? "text-blue-300" : "text-green-300"}`}>
                        <span className="font-bold">{msg.role === "max" ? "Max" : "User"}:</span> {msg.content}
                        {msg.role === "max" && (fb || blocker) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {fb && (
                              <span
                                className="text-[10px] uppercase tracking-wide bg-destructive/20 text-destructive border border-destructive/40 px-1.5 py-0.5 rounded"
                                title={fb.reason}
                              >
                                GM fallback · {fb.kind}
                                {typeof fb.elapsed_ms === "number" ? ` · ${fb.elapsed_ms}ms` : ""}
                              </span>
                            )}
                            {blocker && (
                              <span className="text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                                blocker · {blocker}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </ScrollArea>
            </div>

            {selected.questionnaire_responses && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Questionnaire</p>
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 rounded p-3">
                  <Stat label="Note expérience" value={`${selected.questionnaire_responses.experience_rating}/10`} />
                  <Stat label="NPS" value={`${selected.questionnaire_responses.nps}/10`} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            Sélectionne une session pour voir les détails
          </div>
        )}
      </div>
    </div>
  );
}
