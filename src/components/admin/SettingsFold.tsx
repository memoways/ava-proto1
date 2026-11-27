import type { ReactNode } from "react";

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
    <details className={`group rounded border ${className ?? ""}`} data-testid={testId}>
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 px-2 py-1.5 text-xs">
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">▸</span>
        <span className="font-medium">{title}</span>
        {summary ? <span className="text-muted-foreground" data-testid={testId ? `${testId}-summary` : undefined}>{summary}</span> : null}
      </summary>
      <div className="space-y-2 border-t p-2">{children}</div>
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
      className="border-dashed border-amber-700/50"
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
