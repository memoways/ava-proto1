import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { UnsavedChangesProvider } from "./UnsavedChanges";
import { useConfirmLeave, useUnsavedChanges } from "./context";

function Draft({ label, save, discard, blocked }: { label: string; save: () => Promise<boolean>; discard?: () => void; blocked?: string }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  useUnsavedChanges({
    dirty: value !== saved,
    label,
    blocked,
    discard,
    save: async () => {
      const ok = await save();
      if (ok) setSaved(value);
      return ok;
    },
  });
  return <input aria-label={label} value={value} onChange={(event) => setValue(event.target.value)} />;
}

function InPage({ action }: { action: () => void }) {
  const confirmLeave = useConfirmLeave();
  return <button type="button" onClick={() => confirmLeave(action)}>Autre version</button>;
}

function setup(drafts: React.ReactNode, action = vi.fn()) {
  const router = createMemoryRouter([
    {
      path: "*",
      element: (
        <UnsavedChangesProvider>
          <Link to="/admin/other">Autre page</Link>
          <InPage action={action} />
          {drafts}
        </UnsavedChangesProvider>
      ),
    },
  ], { initialEntries: ["/admin/settings"] });
  render(<RouterProvider router={router} />);
  return { router, action };
}

const type = (label: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: "x" } });
const bar = () => screen.queryByTestId("unsaved-bar");
const leave = async () => { await act(async () => { fireEvent.click(screen.getByText("Autre page")); }); };
const dialog = () => screen.getByRole("alertdialog");

describe("unsaved changes", () => {
  it("shows the bar only while something is unsaved, and saves from it", async () => {
    const save = vi.fn().mockResolvedValue(true);
    setup(<Draft label="Réglages LLM" save={save} />);
    expect(bar()).toBeNull();
    type("Réglages LLM");
    expect(bar()).toHaveTextContent("Réglages LLM");
    fireEvent.click(within(bar()!).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(bar()).toBeNull());
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves every dirty block at once", async () => {
    const first = vi.fn().mockResolvedValue(true);
    const second = vi.fn().mockResolvedValue(true);
    setup(<><Draft label="Profil de Max" save={first} /><Draft label="Profil de Emma" save={second} /></>);
    type("Profil de Max");
    type("Profil de Emma");
    fireEvent.click(screen.getByRole("button", { name: "Tout enregistrer" }));
    await waitFor(() => expect(bar()).toBeNull());
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("holds a page change until the user answers", async () => {
    const discard = vi.fn();
    const { router } = setup(<Draft label="Réglages LLM" save={vi.fn()} discard={discard} />);
    type("Réglages LLM");
    await leave();
    expect(dialog()).toHaveTextContent("Réglages LLM");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Rester ici" }));
    expect(router.state.location.pathname).toBe("/admin/settings");
    await leave();
    await act(async () => { fireEvent.click(within(dialog()).getByRole("button", { name: "Continuer sans enregistrer" })); });
    expect(discard).toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/admin/other");
  });

  it("saves then leaves, and stays when the save fails", async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { router } = setup(<Draft label="Réglages LLM" save={save} />);
    type("Réglages LLM");
    await leave();
    await act(async () => { fireEvent.click(within(dialog()).getByRole("button", { name: "Enregistrer et continuer" })); });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(router.state.location.pathname).toBe("/admin/settings");
    expect(bar()).not.toBeNull();
    await leave();
    await act(async () => { fireEvent.click(within(dialog()).getByRole("button", { name: "Enregistrer et continuer" })); });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/other"));
  });

  it("asks before an in-page change and runs it only after the answer", async () => {
    const { action } = setup(<Draft label="Brouillon" save={vi.fn().mockResolvedValue(true)} />);
    fireEvent.click(screen.getByText("Autre version"));
    expect(action).toHaveBeenCalledTimes(1);
    type("Brouillon");
    fireEvent.click(screen.getByText("Autre version"));
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(within(dialog()).getByRole("button", { name: "Enregistrer et continuer" })); });
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });

  it("says why a block cannot be saved", async () => {
    setup(<Draft label="Mot de passe" save={vi.fn()} blocked="8 caractères au minimum." />);
    type("Mot de passe");
    expect(bar()).toHaveTextContent("8 caractères au minimum.");
    expect(within(bar()!).getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    await leave();
    expect(within(dialog()).getByRole("button", { name: "Enregistrer et continuer" })).toBeDisabled();
  });

  it("warns before the tab is closed or reloaded", () => {
    setup(<Draft label="Réglages LLM" save={vi.fn()} />);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    type("Réglages LLM");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
