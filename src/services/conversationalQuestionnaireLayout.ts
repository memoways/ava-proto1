/**
 * Conversational questionnaire — screen layout per device (lot 4).
 *
 * phone: one question per screen, microphone and validation docked at the
 * bottom, compact radar, review cards folded. tablet: touch-first (44 px
 * targets). desktop: question and transcript side by side.
 */
import type { ConversationalSessionContext } from "@/types";

export type QuestionnaireLayout = "phone" | "tablet" | "desktop";

export function questionnaireLayoutFor(device: ConversationalSessionContext["device_class"] | null | undefined): QuestionnaireLayout {
  if (device === "smartphone") return "phone";
  if (device === "tablet") return "tablet";
  return "desktop";
}

export const isTouchLayout = (layout: QuestionnaireLayout) => layout !== "desktop";
