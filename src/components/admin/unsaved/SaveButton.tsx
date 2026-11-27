import { Loader2, Save } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

type Props = Omit<ButtonProps, "children"> & {
  /** Nothing to save: the button is disabled and discreet. */
  dirty: boolean;
  saving?: boolean;
  label?: string;
};

/** The one save button of the back-office: same word, same look, highlighted when there is something to save. */
export function SaveButton({ dirty, saving = false, label = "Enregistrer", disabled, size = "sm", ...props }: Props) {
  return (
    <Button
      type="button"
      size={size}
      variant={dirty ? "default" : "outline"}
      disabled={!dirty || saving || disabled}
      {...props}
    >
      {saving ? <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save aria-hidden className="mr-1.5 h-3.5 w-3.5" />}
      {saving ? "Enregistrement…" : label}
    </Button>
  );
}
