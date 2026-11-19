import { Badge } from "@/components/ui/badge";
import {
  getGmSetting,
  GM_SETTING_DESTINATION_LABELS,
  type GmSettingDestination,
  type GmSettingId,
} from "@/services/gmSettingsRegistry";
import type { ExperienceDirectorConfig } from "@/types";

function effectLabel(destinations: readonly GmSettingDestination[]): string {
  const prompt = destinations.some((destination) => destination !== "code");
  const code = destinations.includes("code");
  return prompt && code ? "les deux" : code ? "code" : "prompt";
}

/**
 * Collapsible preview under a GM setting: exact fragment sent to the GM or the
 * character, or the effect applied by the code, for the current value.
 */
export function GmSettingPreview({ id, config }: { id: GmSettingId; config: ExperienceDirectorConfig }) {
  const entry = getGmSetting(id);
  const fragments = entry.fragment(config);
  return (
    <details className="group rounded border border-dashed border-border/70 px-2 py-1 text-xs" data-gm-setting={id}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-muted-foreground hover:text-foreground">
        <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
        <span>
          ➜ {[...new Set(fragments.map((fragment) => GM_SETTING_DESTINATION_LABELS[fragment.destination]))].join(" · ")}
        </span>
        <Badge variant="outline" className="ml-auto h-4 px-1.5 text-[10px] font-normal">effet : {effectLabel(entry.destinations)}</Badge>
      </summary>
      <div className="mt-1 space-y-1.5">
        {fragments.map((fragment, index) => (
          <div key={`${fragment.destination}-${index}`}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{GM_SETTING_DESTINATION_LABELS[fragment.destination]}</p>
            <pre className="whitespace-pre-wrap break-words rounded bg-muted/50 p-1.5 font-mono text-[11px] leading-snug">{fragment.text}</pre>
          </div>
        ))}
      </div>
    </details>
  );
}
