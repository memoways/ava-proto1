/**
 * Action row of the conversational questionnaire. On a phone it is docked at
 * the bottom of the screen (thumb reach, safe area); elsewhere it sits under
 * the content, right-aligned.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function QuestionnaireActionBar({ docked, children, className }: { docked: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      data-docked={docked ? "true" : undefined}
      className={cn(
        docked
          ? "fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&>*]:flex-1"
          : "flex flex-wrap items-center justify-end gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
