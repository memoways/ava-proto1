import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker, type Location } from "react-router-dom";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminTabPath } from "@/services/adminNavigation";
import { UnsavedChangesContext, type UnsavedSection, type UnsavedStore } from "./context";

interface PendingLeave {
  proceed: () => void;
  cancel: () => void;
}

/** Sub-pages of one admin screen (a session in the history) keep their drafts mounted. */
function leavesScreen(current: Location, next: Location): boolean {
  if (current.pathname === next.pathname) return false;
  const sessions = adminTabPath("sessions");
  return !(current.pathname.startsWith(sessions) && next.pathname.startsWith(sessions));
}

const nextRender = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
/** A reload fires `beforeunload` a little after the action that asked for it. */
const EXIT_GRACE_MS = 1000;

/**
 * Single place for « nothing is lost silently » in the back-office: every screen
 * with a draft registers it (`useUnsavedChanges`), a bar stays on screen until it
 * is saved, and leaving (other page, reload, environment, logout) asks first.
 * Needs a data router (`useBlocker`).
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const sections = useRef(new Map<string, UnsavedSection>());
  const signatures = useRef(new Map<string, string>());
  const [, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingLeave | null>(null);
  /** True once the user chose to leave: the exit that follows must not ask again. */
  const leaving = useRef(false);

  const dirtyEntries = useCallback(
    () => [...sections.current.entries()].filter(([, section]) => section.dirty),
    [],
  );

  const saveSections = useCallback(async (ids: string[]): Promise<boolean> => {
    setSaving(true);
    try {
      for (const id of ids) {
        // Read at call time: the previous save re-rendered the screens.
        const section = sections.current.get(id);
        if (!section?.dirty) continue;
        if (!section.save || section.blocked) return false;
        try {
          if ((await section.save()) === false) return false;
        } catch (error) {
          console.error(`[UnsavedChanges] save failed: ${section.label}`, error);
          return false;
        }
        await nextRender();
      }
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  const store = useMemo<UnsavedStore>(() => ({
    set(id, section) {
      sections.current.set(id, section);
      const signature = JSON.stringify([section.dirty, section.label, section.blocked ?? "", section.saving ?? false, Boolean(section.save)]);
      if (signatures.current.get(id) !== signature) {
        signatures.current.set(id, signature);
        if (section.dirty) leaving.current = false;
        setVersion((version) => version + 1);
      }
    },
    remove(id) {
      sections.current.delete(id);
      signatures.current.delete(id);
      setVersion((version) => version + 1);
    },
    confirmLeave(action) {
      if (!dirtyEntries().length) {
        action();
        return;
      }
      setPending({ proceed: action, cancel: () => {} });
    },
  }), [dirtyEntries]);

  const blocker = useBlocker(useCallback(
    ({ currentLocation, nextLocation }: { currentLocation: Location; nextLocation: Location }) =>
      !leaving.current && dirtyEntries().length > 0 && leavesScreen(currentLocation, nextLocation),
    [dirtyEntries],
  ));

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    setPending({ proceed: () => blocker.proceed(), cancel: () => blocker.reset() });
  }, [blocker]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (leaving.current || !dirtyEntries().length) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyEntries]);

  const dirty = dirtyEntries();
  const busy = saving || dirty.some(([, section]) => section.saving);
  const canSaveAll = dirty.every(([, section]) => section.save && !section.blocked);

  const stay = () => {
    pending?.cancel();
    setPending(null);
  };
  const discardAndLeave = () => {
    const current = pending;
    setPending(null);
    leaving.current = true;
    for (const [, section] of dirtyEntries()) section.discard?.();
    current?.proceed();
    // In-page changes (other version, other character) stay here: ask again next time.
    setTimeout(() => { leaving.current = false; }, EXIT_GRACE_MS);
  };
  const saveAndLeave = async () => {
    const current = pending;
    if (!current) return;
    if (!(await saveSections(dirtyEntries().map(([id]) => id)))) {
      current.cancel();
      setPending(null);
      return;
    }
    setPending(null);
    leaving.current = true;
    current.proceed();
    setTimeout(() => { leaving.current = false; }, EXIT_GRACE_MS);
  };

  return (
    <UnsavedChangesContext.Provider value={store}>
      {children}

      {dirty.length > 0 && (
        <>
          {/* Keeps the end of the page reachable under the bar. */}
          <div aria-hidden style={{ height: `${7 + dirty.length * 2.5}rem` }} />
          <div
            role="region"
            aria-label="Modifications non enregistrées"
            data-testid="unsaved-bar"
            className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-lg border-2 border-amber-500 bg-background p-3 text-foreground shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Modifications non enregistrées</p>
                  <p className="text-xs text-muted-foreground">
                    {dirty.length === 1 ? dirty[0][1].label : `${dirty.length} blocs modifiés`} — sans enregistrement, rien n’est pris en compte.
                  </p>
                </div>
              </div>
              <Button disabled={busy || !canSaveAll} onClick={() => void saveSections(dirty.map(([id]) => id))}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {busy ? "Enregistrement…" : dirty.length === 1 ? "Enregistrer" : "Tout enregistrer"}
              </Button>
            </div>
            {(dirty.length > 1 || dirty[0][1].blocked) && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto border-t pt-2">
                {dirty.map(([id, section]) => (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="min-w-0">
                      <span className="font-medium">{section.label}</span>
                      {section.blocked && <span className="ml-2 text-destructive">{section.blocked}</span>}
                    </span>
                    {dirty.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={busy || !section.save || Boolean(section.blocked)}
                        aria-label={`Enregistrer : ${section.label}`}
                        onClick={() => void saveSections([id])}
                      >
                        Enregistrer
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !saving) stay(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
            <AlertDialogDescription>
              En continuant sans enregistrer, ces changements sont perdus :
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {dirty.map(([id, section]) => (
              <li key={id}>
                {section.label}
                {section.blocked && <span className="ml-2 text-xs text-destructive">{section.blocked}</span>}
              </li>
            ))}
          </ul>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:space-x-0">
            <Button variant="ghost" onClick={stay} disabled={saving}>Rester ici</Button>
            <Button variant="outline" className="text-destructive" onClick={discardAndLeave} disabled={saving}>
              Continuer sans enregistrer
            </Button>
            <Button onClick={() => void saveAndLeave()} disabled={busy || !canSaveAll}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer et continuer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}
