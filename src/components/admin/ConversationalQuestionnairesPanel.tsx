/**
 * Admin — conversational questionnaire (lot 3): aggregated radar (means over
 * the given scores only), « non évalué » counts, verbatims per dimension and a
 * device filter. PRD4 and legacy answers keep their own rendering.
 */
import { useMemo, useState } from "react";
import type { ConversationalDimensionKey, QuestionnaireConversationalData } from "@/types";
import { CONVERSATIONAL_DIMENSIONS } from "@/services/conversationalQuestionnaire";
import { DIMENSION_LABELS } from "@/services/conversationalQuestionnaireFlow";
import {
  aggregateConversational,
  DEVICE_LABELS,
  filterByDevice,
  type ConversationalRow,
  type DeviceFilter,
} from "@/services/conversationalQuestionnaireAggregate";
import ConversationalRadar from "@/components/questionnaire/ConversationalRadar";

const CALL_MODE_LABELS = { streaming_avatar: "Avatar vidéo", tts: "Voix seule" } as const;

const FILTERS: Array<{ value: DeviceFilter; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "smartphone", label: DEVICE_LABELS.smartphone },
  { value: "tablet", label: DEVICE_LABELS.tablet },
  { value: "desktop", label: DEVICE_LABELS.desktop },
];

export function ConversationalQuestionnairesPanel({ rows }: { rows: ConversationalRow[] }) {
  const [device, setDevice] = useState<DeviceFilter>("all");
  const filtered = useMemo(() => filterByDevice(rows, device), [rows, device]);
  const aggregate = useMemo(() => aggregateConversational(filtered), [filtered]);
  const means = useMemo(() => {
    const values: Partial<Record<ConversationalDimensionKey, number | null>> = {};
    for (const key of CONVERSATIONAL_DIMENSIONS) values[key] = aggregate.dimensions[key].mean;
    return values;
  }, [aggregate]);

  return (
    <section className="mb-6 space-y-4 rounded-lg border p-4" aria-label="Questionnaire conversationnel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">
          Questionnaire conversationnel <span className="text-sm font-normal text-muted-foreground">({aggregate.total} réponse{aggregate.total > 1 ? "s" : ""})</span>
        </h3>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrer par appareil">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={device === filter.value}
              onClick={() => setDevice(filter.value)}
              className={`rounded-md border px-3 py-1 text-xs ${device === filter.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {aggregate.total === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune réponse conversationnelle pour ce filtre.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
          <ConversationalRadar
            values={means}
            title="Moyenne par dimension"
            notRatedLabel="Aucune note"
            describe={(key, value) => `${value.toFixed(1)}/5 (moyenne de ${aggregate.dimensions[key].rated} note${aggregate.dimensions[key].rated > 1 ? "s" : ""})`}
          />
          <table className="w-full self-start text-sm" aria-label="Moyennes par dimension">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 font-medium">Dimension</th>
                <th className="p-2 text-right font-medium">Moyenne</th>
                <th className="p-2 text-right font-medium">Notes</th>
                <th className="p-2 text-right font-medium">Non évalué</th>
              </tr>
            </thead>
            <tbody>
              {CONVERSATIONAL_DIMENSIONS.map((key) => {
                const d = aggregate.dimensions[key];
                return (
                  <tr key={key} className="border-b" data-testid={`aggregate-${key}`}>
                    <td className="p-2">{DIMENSION_LABELS[key]}</td>
                    <td className="p-2 text-right tabular-nums">{d.mean === null ? "—" : `${d.mean.toFixed(1)}/5`}</td>
                    <td className="p-2 text-right tabular-nums">{d.rated}</td>
                    <td className="p-2 text-right tabular-nums">{d.notRated}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aggregate.total > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Verbatims</h4>
          {CONVERSATIONAL_DIMENSIONS.map((key) => (
            <details key={key} className="rounded-md border p-2">
              <summary className="cursor-pointer text-sm">
                {DIMENSION_LABELS[key]} <span className="text-muted-foreground">({aggregate.verbatims[key].length})</span>
              </summary>
              <ul className="mt-2 space-y-2">
                {aggregate.verbatims[key].map((v) => (
                  <li key={v.sessionId} className="rounded bg-muted/20 p-2 text-sm">
                    <p className="text-xs text-muted-foreground">
                      {v.label} · {v.device ? DEVICE_LABELS[v.device] : "appareil inconnu"} · {v.score === null ? "non évalué" : `${v.score}/5`}
                    </p>
                    {v.answer && <p className="italic">{v.answer}</p>}
                    {v.followUp?.answer && (
                      <p className="mt-1"><span className="text-xs text-muted-foreground">{v.followUp.question} </span><span className="italic">{v.followUp.answer}</span></p>
                    )}
                    {v.comment && <p className="mt-1 text-xs">Note : <span className="italic">{v.comment}</span></p>}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

export function ConversationalQuestionnaireDetail({ data }: { data: QuestionnaireConversationalData }) {
  const context = data.session_context;
  const values: Partial<Record<ConversationalDimensionKey, number | null>> = {};
  for (const key of CONVERSATIONAL_DIMENSIONS) values[key] = data.dimensions[key]?.score ?? null;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Conversationnel · {context?.device_class ? DEVICE_LABELS[context.device_class] : "appareil inconnu"}
        {context?.call_mode ? ` · ${CALL_MODE_LABELS[context.call_mode]}${context.avatar_fallback ? " (repli voix)" : ""}` : ""}
        {" · "}synthèse {data.summary?.edited_by_user ? "corrigée par la personne" : "non modifiée"}
      </p>
      <ConversationalRadar values={values} title="Notes par dimension" />
      {CONVERSATIONAL_DIMENSIONS.map((key) => {
        const d = data.dimensions[key];
        if (!d) return null;
        return (
          <div key={key} className="border-t pt-2">
            <p className="text-sm font-medium">{DIMENSION_LABELS[key]} — {d.score === null ? "non évalué" : `${d.score}/5`}</p>
            <p className="text-xs text-muted-foreground">{d.question}</p>
            {d.answer && <p className="text-sm italic">{d.answer}</p>}
            {d.follow_up && (
              <p className="mt-1 text-sm"><span className="text-xs text-muted-foreground">{d.follow_up.question} </span><span className="italic">{d.follow_up.answer || "—"}</span></p>
            )}
            {d.score_comment && <p className="mt-1 text-xs">Commentaire : <span className="italic">{d.score_comment}</span></p>}
          </div>
        );
      })}
      {data.consent?.contact_email && (
        <p className="border-t pt-2 text-xs">
          Contact : {data.consent.contact_email}
          {data.consent.opt_in_updates ? " · actualités" : ""}
          {data.consent.opt_in_feedback ? " · feedback détaillé" : ""}
        </p>
      )}
    </div>
  );
}
