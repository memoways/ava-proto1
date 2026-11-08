import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listExternalTestInvitations: vi.fn(),
  createExternalTestInvitation: vi.fn(),
  revokeExternalTestInvitation: vi.fn(),
  revealExternalTestInvitation: vi.fn(),
  renewExternalTestInvitationCode: vi.fn(),
}));
vi.mock("@/services/externalTestInvitations", () => service);
vi.mock("@/contexts/AdminEnvironmentContext", () => ({ useAdminEnvironment: () => ({ environmentId: "sandbox-ulrich" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TestInvitationsTab from "./TestInvitationsTab";

const base = {
  environment_id: "sandbox-ulrich", created_at: "2026-11-08T09:00:00Z", valid_from: "2026-11-08T09:00:00Z",
  expires_at: "2027-01-30T22:59:59Z", redeemed_at: null, revoked_at: null, multi_use: true, sessionCount: 0,
};

describe("TestInvitationsTab — recover a lost password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.listExternalTestInvitations.mockResolvedValue([
      { ...base, id: "kept", tester_label: "Ulrich iPhone new", status: "available", codeRecoverable: true },
      { ...base, id: "old", tester_label: "Ulrich mobile", status: "activated", codeRecoverable: false },
    ]);
  });

  it("shows the link and password of an invitation whose password was kept", async () => {
    service.revealExternalTestInvitation.mockResolvedValue({ link: "https://proto1.parle-a-ava.com/test/kept", code: "AVA-AAAA-BBBB-CCCC-DDDD" });
    render(<TestInvitationsTab />);
    const buttons = await screen.findAllByRole("button", { name: /Afficher le mot de passe/ });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(screen.getByDisplayValue("AVA-AAAA-BBBB-CCCC-DDDD")).toBeInTheDocument());
    expect(service.revealExternalTestInvitation).toHaveBeenCalledWith("kept");
    expect(screen.getByDisplayValue("https://proto1.parle-a-ava.com/test/kept")).toBeInTheDocument();
    expect(screen.getByText(/Ulrich iPhone new/, { selector: "h3, div" })).toBeInTheDocument();
    expect(screen.getByText(/reste consultable/)).toBeInTheDocument();
  });

  it("offers a new password for an older invitation, after confirmation", async () => {
    service.renewExternalTestInvitationCode.mockResolvedValue({ link: "https://proto1.parle-a-ava.com/test/old", code: "AVA-EEEE-FFFF-GGGG-HHHH", recoverable: true });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<TestInvitationsTab />);
    await screen.findByText("Ulrich mobile");
    const renew = screen.getAllByRole("button", { name: /Nouveau mot de passe/ })[1];
    fireEvent.click(renew);
    expect(service.renewExternalTestInvitationCode).not.toHaveBeenCalled();
    fireEvent.click(renew);
    await waitFor(() => expect(screen.getByDisplayValue("AVA-EEEE-FFFF-GGGG-HHHH")).toBeInTheDocument());
    expect(service.renewExternalTestInvitationCode).toHaveBeenCalledWith("old");
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/l’ancien ne permet plus/)).toBeInTheDocument();
    // Now kept: the reveal button appears for this invitation too.
    expect(screen.getAllByRole("button", { name: /Afficher le mot de passe/ })).toHaveLength(2);
  });
});
