import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** One line shown next to the title, also while folded. */
  summary?: string;
  children: ReactNode;
  testId?: string;
  className?: string;
}

/** Folded block of the admin settings, closed by default; its fields stay mounted. */
export function SettingsFold({ title, summary, children, testId, className }: Props) {
  return (
    <details className={cn("group rounded-md border-2 border-foreground/20 bg-muted/20", className)} data-testid={testId}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[4px] bg-muted/70 px-2 py-2 text-xs hover:bg-muted [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/50 bg-background text-primary">
          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" strokeWidth={3} />
        </span>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold">{title}</span>
          {summary ? <span className="text-muted-foreground" data-testid={testId ? `${testId}-summary` : undefined}>{summary}</span> : null}
        </span>
      </summary>
      <div className="space-y-2 border-t-2 border-foreground/10 bg-background p-2">{children}</div>
    </details>
  );
}

interface TestSettingsProps {
  children: ReactNode;
  testId?: string;
}

/**
 * « Réglages de test (temporaires) »: one-off switches for measurements and prototypes,
 * apart from the durable settings. Folding changes no stored value.
 */
export function TestSettingsFold({ children, testId = "test-settings" }: TestSettingsProps) {
  return (
    <SettingsFold
      title="Réglages de test (temporaires)"
      summary="mesures et prototypes, à ne changer que pour un test"
      testId={testId}
      className="border-dashed border-amber-600/60"
    >
      {children}
    </SettingsFold>
  );
}

/** One-sentence state of a test setting: « en mesure », « prototype » or « adopté ». */
export function TestSettingState({ state }: { state: "en mesure" | "prototype" | "adopté" }) {
  return (
    <span className="ml-1 rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
      {state}
    </span>
  );
}
