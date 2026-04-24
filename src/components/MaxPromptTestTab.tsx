import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { simulateMaxResponse, validateMaxResponseConstraints } from "@/agents/maxAgent";
import type { MaxTurnKnowledgeContext } from "@/types";
import { getAntiHallucinationValidatorSettings, getMaxPromptControlSettings } from "@/services/settingsService";
import { toast } from "sonner";

const DEFAULT_USER_MESSAGE = "Est-ce qu’Ava t’avait parlé de partir avant sa disparition ?";
const DEFAULT_RAG_CONTEXT = `[1] (storyworld, score: 0.88)
Ava a disparu il y a plusieurs jours. Max possède seulement des indices fragmentaires et refuse d'affirmer ce qu'il ne sait pas.

[2] (characters, score: 0.81)
Max est méfiant, protecteur, et teste la sincérité de son interlocuteur avant de révéler quoi que ce soit.

[3] (storyworld, score: 0.54)
Il existe des tensions familiales autour d'Ava, mais aucun élément ne confirme qu'elle préparait une fuite.`;

function extractKnowledgeContext(ragContext: string, forbiddenTopicsText: string, blockedAssertionsText: string): MaxTurnKnowledgeContext {
  const chunks = ragContext
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const facts = chunks.map((chunk) => chunk.replace(/^\[[^\]]+\]\s*/gm, "").trim());

  return {
    allowedFacts: facts,
    activeMemories: facts.slice(0, 2),
    hypotheses: facts.filter((fact) => /aucun|aucune|partiel|fragment|hypoth/i.test(fact)).slice(0, 2),
    forbiddenTopics: forbiddenTopicsText.split("\n").map((line) => line.trim()).filter(Boolean),
    blockedAssertions: blockedAssertionsText.split("\n").map((line) => line.trim()).filter(Boolean),
  };
}

export default function MaxPromptTestTab() {
  const control = getMaxPromptControlSettings();
  const validatorSettings = getAntiHallucinationValidatorSettings();
  const [userMessage, setUserMessage] = useState(DEFAULT_USER_MESSAGE);
  const [ragContext, setRagContext] = useState(DEFAULT_RAG_CONTEXT);
  const [forbiddenTopics, setForbiddenTopics] = useState(control.forbiddenTopics);
  const [blockedAssertions, setBlockedAssertions] = useState(`${control.forbiddenAssertions}\n${validatorSettings.blockedAssertionRules}`.trim());
  const [response, setResponse] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [validation, setValidation] = useState<{
    compliant: boolean;
    summary: string;
    violations: string[];
    safe_points: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const knowledgeContext = useMemo(
    () => extractKnowledgeContext(ragContext, forbiddenTopics, blockedAssertions),
    [ragContext, forbiddenTopics, blockedAssertions],
  );

  async function handleRunSimulation() {
    setLoading(true);
    setValidation(null);

    try {
      const simulation = await simulateMaxResponse({
        conversationHistory: [],
        userMessage,
        ragContext,
        knowledgeContext,
      });

      setResponse(simulation.response);
      setSystemPrompt(simulation.systemPrompt);

      const check = await validateMaxResponseConstraints({
        userMessage,
        response: simulation.response,
        ragContext,
        knowledgeContext,
      });

      setValidation(check);
      toast.success("Simulation Max terminée ✓");
    } catch (error) {
      console.error("[MaxPromptTest] Simulation failed", error);
      toast.error("Erreur lors de la simulation Max");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">🧪 Test de réponse Max</h2>
        <p className="text-sm text-muted-foreground">
          Simulez une réponse de Max à partir d’un exemple de contexte RAG, puis vérifiez automatiquement si les interdictions d’affirmation sont respectées.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="max-test-user-message">Message utilisateur</Label>
            <Textarea
              id="max-test-user-message"
              value={userMessage}
              onChange={(event) => setUserMessage(event.target.value)}
              className="min-h-[90px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-test-rag-context">Contexte RAG d’exemple</Label>
            <Textarea
              id="max-test-rag-context"
              value={ragContext}
              onChange={(event) => setRagContext(event.target.value)}
              className="min-h-[280px] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-test-forbidden-topics">Sujets interdits testés</Label>
            <Textarea
              id="max-test-forbidden-topics"
              value={forbiddenTopics}
              onChange={(event) => setForbiddenTopics(event.target.value)}
              className="min-h-[120px] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-test-blocked-assertions">Affirmations interdites testées</Label>
            <Textarea
              id="max-test-blocked-assertions"
              value={blockedAssertions}
              onChange={(event) => setBlockedAssertions(event.target.value)}
              className="min-h-[120px] font-mono text-sm"
            />
          </div>

          <Button onClick={handleRunSimulation} disabled={loading || !userMessage.trim() || !ragContext.trim()}>
            {loading ? "Simulation..." : "Lancer le test"}
          </Button>
        </section>

        <section className="space-y-4 rounded-lg border p-4">
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Faits autorisés détectés :</strong> {knowledgeContext.allowedFacts?.length || 0}</p>
            <p><strong className="text-foreground">Hypothèses détectées :</strong> {knowledgeContext.hypotheses?.length || 0}</p>
            <p><strong className="text-foreground">Règles globales du validateur :</strong> {validatorSettings.blockedAssertionRules.split("\n").map((line) => line.trim()).filter(Boolean).length}</p>
          </div>

          <div className="space-y-2">
            <Label>Réponse simulée de Max</Label>
            <div className="min-h-[120px] rounded-lg border bg-muted/20 p-4 text-sm whitespace-pre-wrap">
              {response || "La réponse simulée apparaîtra ici."}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Diagnostic de conformité</Label>
            <div className={`rounded-lg border p-4 text-sm ${validation ? (validation.compliant ? "bg-primary/10" : "bg-destructive/10") : "bg-muted/20"}`}>
              {validation ? (
                <div className="space-y-3">
                  <p>
                    <strong>{validation.compliant ? "Conforme" : "Non conforme"}</strong> — {validation.summary}
                  </p>

                  {!!validation.safe_points.length && (
                    <div>
                      <p className="mb-1 font-medium">Points respectés</p>
                      <ul className="list-disc space-y-1 pl-5">
                        {validation.safe_points.map((point, index) => <li key={`safe-${index}`}>{point}</li>)}
                      </ul>
                    </div>
                  )}

                  {!!validation.violations.length && (
                    <div>
                      <p className="mb-1 font-medium">Violations détectées</p>
                      <ul className="list-disc space-y-1 pl-5">
                        {validation.violations.map((violation, index) => <li key={`violation-${index}`}>{violation}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                "Le rapport de conformité apparaîtra ici après simulation."
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prompt effectif envoyé à Max</Label>
            <Textarea value={systemPrompt} readOnly className="min-h-[260px] font-mono text-xs" />
          </div>
        </section>
      </div>
    </div>
  );
}