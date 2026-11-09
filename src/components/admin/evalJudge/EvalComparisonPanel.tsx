import { AlertTriangle, CheckCircle2, GitCompare, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EVAL_SCORE_CRITERIA, type ReferenceCandidateComparison } from "@/services/evalJudgeScoring";

interface Props {
  comparison: ReferenceCandidateComparison;
}

const SHORT_LABEL = new Map(EVAL_SCORE_CRITERIA.map((criterion) => [criterion.key, criterion.label]));

function signed(value: number | null, digits = 2): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function tone(value: number | null, threshold: number): string {
  if (value === null || Math.abs(value) < threshold) return "";
  return value > 0 ? "text-emerald-400" : "text-red-400";
}

function score(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

export default function EvalComparisonPanel({ comparison }: Props) {
  const { verdict, overall } = comparison;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompare className="h-4 w-4" /> Référence contre candidat
        </CardTitle>
        <CardDescription>
          {comparison.referenceLabel} → {comparison.candidateLabel}. Δ = candidat − référence ; positif = le candidat
          joue mieux.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
            verdict.level === "good"
              ? "border-emerald-500/40 bg-emerald-500/10"
              : verdict.level === "warn"
                ? "border-amber-500/40 bg-amber-500/10"
                : "bg-muted/30"
          }`}
        >
          {verdict.level === "good" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : verdict.level === "warn" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {verdict.text}
            <span className="block text-xs text-muted-foreground">
              Note /10 : référence {score(overall.reference)} (n={overall.referenceN}) · candidat{" "}
              {score(overall.candidate)} (n={overall.candidateN}) · Δ {signed(overall.delta)} · bruit entre
              passages ± {overall.repeatSpread.toFixed(2)}
            </span>
          </span>
        </div>

        {comparison.byCharacter.length > 1 ? (
          <div className="flex flex-wrap gap-3 text-sm">
            {comparison.byCharacter.map((row) => (
              <span key={row.character} className="rounded-md border px-3 py-1">
                {row.character} : {score(row.reference)} → {score(row.candidate)}{" "}
                <span className={tone(row.delta, 0.15)}>({signed(row.delta)})</span>
              </span>
            ))}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium">Δ par critère (/5)</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Critère</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Candidat</TableHead>
                <TableHead>Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.byCriterion.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>{score(row.reference)}</TableCell>
                  <TableCell>{score(row.candidate)}</TableCell>
                  <TableCell className={tone(row.delta, 0.25)}>{signed(row.delta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Δ par question (/10), les pires d’abord</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead className="w-20">Perso.</TableHead>
                <TableHead className="w-20">Réf.</TableHead>
                <TableHead className="w-20">Cand.</TableHead>
                <TableHead className="w-16">Δ</TableHead>
                <TableHead>Critères qui bougent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.byItem.map((row) => {
                const moving = row.criteria
                  .filter((criterion) => Math.abs(criterion.delta) >= 0.5)
                  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
                return (
                  <TableRow key={row.itemId}>
                    <TableCell className="max-w-sm">{row.question}</TableCell>
                    <TableCell>{row.character}</TableCell>
                    <TableCell>{score(row.reference)}</TableCell>
                    <TableCell>{score(row.candidate)}</TableCell>
                    <TableCell className={tone(row.delta, 0.3)}>{signed(row.delta)}</TableCell>
                    <TableCell className="text-xs">
                      {moving.length
                        ? moving.map((criterion) => (
                          <span key={criterion.key} className={`mr-2 ${tone(criterion.delta, 0.5)}`}>
                            {SHORT_LABEL.get(criterion.key)} {signed(criterion.delta, 1)}
                          </span>
                        ))
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
