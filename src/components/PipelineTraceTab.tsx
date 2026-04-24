import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type PipelineSnapshot = {
  updatedAt?: string;
  userMessage?: string;
  ragContext?: string;
  preTurnBrief?: {
    response_mode?: string;
    openness_level?: number;
    emotional_state?: string;
    conversation_goal?: string;
    reveal_budget?: number;
    allowed_knowledge?: string[];
    forbidden_topics?: string[];
    blocked_assertions?: string[];
    style_instructions?: string[];
    trigger_hint?: string | null;
    notes?: string;
  };
};

const STORAGE_KEY = "ava_pipeline_last_trace";

function readTrace(): PipelineSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function PipelineTraceTab() {
  const trace = useMemo(() => readTrace(), []);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">🧭 Pipeline conversationnel</h2>
        <p className="text-sm text-muted-foreground">
          Cette vue suit le plan en montrant le brief pré-tour du Game Master avant la réponse de Max.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">État du pipeline cible</CardTitle>
            <CardDescription>Suivi visuel de l’implémentation par rapport au plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <PipelineStep title="1. Message utilisateur" status="done" description="Entrée conversationnelle capturée." />
            <PipelineStep title="2. RAG" status="done" description="Contexte narratif structuré en faits, souvenirs, hypothèses." />
            <PipelineStep title="3. GM pre-turn planner" status="done" description="Brief de tour généré avant Max avec mode, ouverture, budget de révélation et interdits." />
            <PipelineStep title="4. Réponse de Max sous contraintes" status="done" description="Le brief pilote désormais les facts/interdits injectés au tour." />
            <PipelineStep title="5. Validation pré-TTS" status="todo" description="Le validateur existe en test admin, pas encore branché dans le runtime réel." />
            <PipelineStep title="6. GM post-turn scorer" status="done" description="Scoring trust / trigger / fin de partie toujours actif après réponse." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dernière trace disponible</CardTitle>
            <CardDescription>
              {trace?.updatedAt ? `Mise à jour ${new Date(trace.updatedAt).toLocaleString("fr-FR")}` : "Aucune simulation runtime encore enregistrée."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <section>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Message utilisateur</p>
              <div className="rounded-md border bg-muted/20 p-3 whitespace-pre-wrap">{trace?.userMessage || "—"}</div>
            </section>
            <section>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Contexte RAG</p>
              <div className="max-h-40 overflow-auto rounded-md border bg-muted/20 p-3 whitespace-pre-wrap">{trace?.ragContext || "—"}</div>
            </section>
            <Separator />
            <section className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">mode: {trace?.preTurnBrief?.response_mode || "—"}</Badge>
                <Badge variant="outline">ouverture: {trace?.preTurnBrief?.openness_level ?? "—"}</Badge>
                <Badge variant="outline">révélation: {trace?.preTurnBrief?.reveal_budget ?? "—"}</Badge>
              </div>
              <p><strong>État émotionnel:</strong> {trace?.preTurnBrief?.emotional_state || "—"}</p>
              <p><strong>Objectif:</strong> {trace?.preTurnBrief?.conversation_goal || "—"}</p>
              <p><strong>Notes:</strong> {trace?.preTurnBrief?.notes || "—"}</p>
              <List title="Savoir autorisé" items={trace?.preTurnBrief?.allowed_knowledge} />
              <List title="Sujets interdits" items={trace?.preTurnBrief?.forbidden_topics} />
              <List title="Assertions bloquées" items={trace?.preTurnBrief?.blocked_assertions} />
              <List title="Instructions de style" items={trace?.preTurnBrief?.style_instructions} />
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PipelineStep({ title, description, status }: { title: string; description: string; status: "done" | "todo" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        <Badge variant={status === "done" ? "secondary" : "outline"}>{status === "done" ? "implémenté" : "à faire"}</Badge>
      </div>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-1 pl-5">
        {(items?.length ? items : ["—"]).map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}