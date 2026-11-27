import { createContext, useCallback, useContext, useId, useLayoutEffect } from "react";

export interface UnsavedSection {
  /** True while the screen holds a change that is not saved. */
  dirty: boolean;
  /** What the user recognises: « Réglages LLM », « Profil de Max ». */
  label: string;
  /** Resolve `false` (or throw) when nothing was saved: the user then stays on the page. */
  save?: () => Promise<boolean | void> | boolean | void;
  /** Restores what the screen wrote outside its own state (local cache). */
  discard?: () => void;
  /** Why saving is not possible right now, shown next to the label. */
  blocked?: string | null;
  saving?: boolean;
}

export interface UnsavedStore {
  set(id: string, section: UnsavedSection): void;
  remove(id: string): void;
  confirmLeave(action: () => void): void;
}

export const UnsavedChangesContext = createContext<UnsavedStore | null>(null);

/** Declares a draft to the back-office. Without a provider (isolated tests) it does nothing. */
export function useUnsavedChanges(section: UnsavedSection): void {
  const store = useContext(UnsavedChangesContext);
  const id = useId();
  // Order matters: when React replays effects, the removal runs before the registration.
  useLayoutEffect(() => () => store?.remove(id), [store, id]);
  useLayoutEffect(() => { store?.set(id, section); });
}

/** Runs `action` at once, or after the user answered about the unsaved changes it would lose. */
export function useConfirmLeave(): (action: () => void) => void {
  const store = useContext(UnsavedChangesContext);
  return useCallback((action: () => void) => {
    if (store) store.confirmLeave(action);
    else action();
  }, [store]);
}
