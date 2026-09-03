import { AlertTriangle, CheckCircle2, Download, Info, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EvalItem, EvalResult } from "@/services/evalJudgePipeline";
import type { EvalAnalysis } from "@/services/evalJudgeScoring";

interface Props {
  analysis: EvalAnalysis;
  results: EvalResult[];
  items: EvalItem[];
  onExport: () => void;
  canExport: boolean;
  drillLabel: string | null;
  onDrill: (label: string | null) => void;
}

export default function EvalResultsPanel({
  analysis,
  results,
  items,
  onExport,
  canExport,
  drillLabel,
  onDrill,
}: Props) {
  const drillRows = drillLabel ? results.filter((row) => row.config_label === drillLabel) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
          <div>
            <CardTitle className="text-base">Étape 4 — Résultats et recommandations</CardTitle>
            <CardDescription>
              Chaque configuration est comparée à ta configuration actuelle. Δ positif = la variante fait mieux.
              Une variante instable entre les 3 passages est marquée non concluante.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onExport} disabled={!canExport}>
            <Download className="mr-2 h-4 w-4" /> Export JSON
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {analysis.ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pas encore de résultats. Lance un test à l'étape 2 pour remplir cette section.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Recommandations</p>
                {analysis.recommendations.map((recommendation) => (
                  <div
                    key={recommendation.text}
                    className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                      recommendation.level === "good"
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : recommendation.level === "warn"
                          ? "border-amber-500/40 bg-amber-500/10"
                          : "bg-muted/30"
                    }`}
                  >
                    {recommendation.level === "good" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : recommendation.level === "warn" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {recommendation.text}
                      {recommendation.where ? (
                        <span className="block text-xs text-muted-foreground">
                          Où appliquer : {recommendation.where}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Classement des configurations</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Configuration</TableHead>
                      <TableHead>Levier</TableHead>
                      <TableHead>Note /10</TableHead>
                      <TableHead>Écart entre passages</TableHead>
                      <TableHead>Δ vs actuel</TableHead>
                      <TableHead>Latence méd.</TableHead>
                      <TableHead>Coût $/M</TableHead>
                      <TableHead>n</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.ranked.map((row) => (
                      <TableRow
                        key={row.label}
                        className="cursor-pointer"
                        onClick={() => onDrill(row.label)}
                      >
                        <TableCell>
                          {row.label}
                          {!row.reliable ? (
                            <Badge variant="outline" className="ml-2 text-amber-300">instable</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>{row.factor}</TableCell>
                        <TableCell>{row.mean.toFixed(2)}</TableCell>
                        <TableCell>± {row.stddev.toFixed(2)}</TableCell>
                        <TableCell className={row.delta > 0 ? "text-emerald-400" : row.delta < 0 ? "text-red-400" : ""}>
                          {row.delta > 0 ? "+" : ""}{row.delta.toFixed(2)}
                        </TableCell>
                        <TableCell>{row.medianLatencyMs == null ? "—" : `${Math.round(row.medianLatencyMs)} ms`}</TableCell>
                        <TableCell>{row.costPerMillion == null ? "—" : `$${row.costPerMillion.toFixed(2)}`}</TableCell>
                        <TableCell>{row.n}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Points faibles par critère (/5)</p>
                  <ul className="space-y-1 text-sm">
                    {analysis.byCriterion
                      .slice()
                      .sort((a, b) => a.mean - b.mean)
                      .map((row) => (
                        <li key={row.key} className="flex justify-between gap-3">
                          <span>{row.label}</span>
                          <span className={row.mean < 3.5 ? "text-amber-300" : "text-muted-foreground"}>
                            {row.mean.toFixed(2)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Points faibles par catégorie (/10)</p>
                  <ul className="space-y-1 text-sm">
                    {analysis.byCategory.map((row) => (
                      <li key={row.category} className="flex justify-between gap-3">
                        <span>{row.category} <span className="text-xs text-muted-foreground">({row.n})</span></span>
                        <span className={row.mean < 6 ? "text-amber-300" : "text-muted-foreground"}>
                          {row.mean.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {drillLabel ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" /> {drillLabel}
            </CardTitle>
            <CardDescription>Détail par question, trois passages chacune.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {drillRows.map((row) => {
              const item = items.find((candidate) => candidate.id === row.item_id);
              const judge = row.judge_json as { rationale?: string } | null;
              return (
                <div key={row.id} className="border-b pb-3 text-sm">
                  <p className="font-medium">{item?.question ?? row.item_id} · passage {row.repeat_index}</p>
                  <p className="mt-1 whitespace-pre-wrap">{row.max_response || "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {judge?.rationale || row.error_message || ""}
                  </p>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" onClick={() => onDrill(null)}>Fermer</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
