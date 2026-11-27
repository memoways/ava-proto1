import { toast } from "sonner";

/** One wording for a failed save; the draft stays on screen. */
export function toastSaveError(error: unknown): false {
  const message = error instanceof Error
    ? error.message
    : (error as { message?: string } | null)?.message ?? String(error);
  toast.error(`Rien n’a été enregistré : ${message}`);
  return false;
}
