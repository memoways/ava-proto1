import { AlertTriangle, CheckCircle2, ExternalLink, Info } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EvalItem } from "@/services/evalJudgePipeline";
import { EVAL_MIN_ITEMS, type CorpusAudit } from "@/services/evalJudgeScoring";

interface Props {
  notionId: string;
  onNotionIdChange: (value: string) => void;
  onSaveNotionId: () => void;
  onSync: () => void;
  syncing: boolean;
  items: EvalItem[];
  audit: CorpusAudit;
  lastSyncAt: string | null;
}

function notionUrl(id: string): string {
  const clean = id.replace(/-/g, "");
  return clean ? `https://www.notion.so/${clean}` : "https://www.notion.so";
}

export default function EvalCorpusPanel({
  notionId,
  onNotionIdChange,
  onSaveNotionId,
  onSync,
  syncing,
  items,
  audit,
  lastSyncAt,
}: Props) {
  const issuesById = new Map(audit.issues.map((issue) => [issue.itemId, issue]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Étape 1 — Vérifier le corpus Notion</CardTitle>
        <CardDescription>
          Les questions de test se rédigent dans Notion, puis on les rapatrie ici. Cette étape dit si la base est
          exploitable avant de dépenser des appels LLM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button asChild variant="outline" size="sm">
            <a href={notionUrl(notionId)} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Ouvrir la base Notion
            </a>
          </Button>
          <span className="text-muted-foreground">
            Dernier import : {lastSyncAt ? new Date(lastSyncAt).toLocaleString("fr-CH") : "jamais"}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Questions importées</p>
            <p className="text-2xl font-semibold">{audit.total}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Actives</p>
            <p className="text-2xl font-semibold">{audit.active}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Complètes (testables)</p>
            <p className="text-2xl font-semibold">{audit.usable}</p>
          </div>
        </div>

        {audit.blockers.length > 0 ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            {audit.blockers.map((blocker) => (
              <p key={blocker} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {blocker}
              </p>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4" /> Corpus suffisant : {audit.usable} questions complètes
            (minimum {EVAL_MIN_ITEMS}).
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Répartition par catégorie</p>
          <div className="flex flex-wrap gap-2">
            {audit.byCategory.length === 0 ? (
              <span className="text-sm text-muted-foreground">Aucune question active.</span>
            ) : (
              audit.byCategory.map((row) => (
                <Badge key={row.category} variant="secondary">
                  {row.category} · {row.count}
                </Badge>
              ))
            )}
          </div>
          {audit.missingCategories.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Catégories vides : {audit.missingCategories.join(", ")}. Sans elles, le test ne dira rien sur ces
              situations (par exemple la résistance aux questions pièges).
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <Label htmlFor="eval-notion-id">ID de la base Notion</Label>
            <Input
              id="eval-notion-id"
              value={notionId}
              onChange={(event) => onNotionIdChange(event.target.value)}
              placeholder="32 caractères hex"
            />
          </div>
          <Button variant="outline" onClick={onSaveNotionId}>Enregistrer l’ID</Button>
          <Button onClick={onSync} disabled={syncing}>{syncing ? "Import…" : "Importer depuis Notion"}</Button>
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="howto">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2"><Info className="h-4 w-4" /> Comment remplir une ligne dans Notion</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p>Une ligne = une réplique du joueur, telle qu'elle serait dite à voix haute. Exemple complet :</p>
              <ul className="space-y-1">
                <li><strong>Question</strong> : « Vous saviez qu'Ava voyait quelqu'un ? »</li>
                <li><strong>Reponse visee</strong> : « Je crois, oui. Elle n'en parlait pas. Je n'ai pas voulu insister. »</li>
                <li><strong>Must include</strong> : ne nie pas ; reste dans le doute ; une phrase courte</li>
                <li><strong>Must not</strong> : ne nomme personne ; ne raconte pas la dispute ; ne pose pas deux questions</li>
                <li><strong>Ton</strong> : retenu — <strong>Longueur max</strong> : 2 — <strong>Categorie</strong> : emotion</li>
                <li><strong>Actif</strong> : coché — <strong>Personnage</strong> : Max — <strong>Ordre</strong> : 3</li>
              </ul>
              <p>
                « Must include » et « Reponse visee » sont indispensables : sans eux, la note du juge n'a aucun point de
                comparaison. Une idée par ligne dans les champs texte.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ordre</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-28">Catégorie</TableHead>
                <TableHead className="w-24">État</TableHead>
                <TableHead>Ce qui manque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const issue = issuesById.get(item.id);
                const level = item.active ? issue?.level ?? "ok" : "off";
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.sort_order}</TableCell>
                    <TableCell className="max-w-sm truncate">{item.question}</TableCell>
                    <TableCell>{item.category || "—"}</TableCell>
                    <TableCell>
                      {level === "off" ? (
                        <Badge variant="outline">inactive</Badge>
                      ) : level === "error" ? (
                        <Badge variant="destructive">incomplète</Badge>
                      ) : level === "warn" ? (
                        <Badge className="bg-amber-500/20 text-amber-300" variant="secondary">à compléter</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-300" variant="secondary">prête</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {issue && issue.messages.length > 0 ? issue.messages.join(" ") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
