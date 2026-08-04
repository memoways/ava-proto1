import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPassiveNetworkVerdict,
  getPassiveVoiceNetworkObservation,
  recordPassiveVoiceNetworkObservation,
} from "./networkDiagnostics";

describe("passive network verdicts", () => {
  beforeEach(() => localStorage.clear());

  it("reports the measured home connection as voice-compatible with slow trace sync", () => {
    expect(getPassiveNetworkVerdict(
      { online: true, network: { effectiveType: "4g", rttMs: 80, downlinkMbps: 11.5, saveData: false } },
      { bps: 580_000, durationMs: 4_000 },
    )).toEqual({
      voice: "compatible",
      traceSync: "degraded",
      label: "Voix compatible — synchronisation des traces lente",
    });
  });

  it("uses the critical passive thresholds without issuing any probe", () => {
    expect(getPassiveNetworkVerdict(
      { online: true, network: null },
      { bps: 249_999, durationMs: 1_000 },
    ).traceSync).toBe("critical");
    expect(getPassiveNetworkVerdict(
      { online: true, network: null },
      { bps: 2_000_000, durationMs: 10_001 },
    ).traceSync).toBe("critical");
  });

  it("separates offline voice compatibility from unknown trace throughput", () => {
    expect(getPassiveNetworkVerdict({ online: false, network: null })).toEqual({
      voice: "incompatible",
      traceSync: "unknown",
      label: "Voix hors ligne — synchronisation des traces non mesurée",
    });
  });

  it("uses real voice observations and never emits an active network probe", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    recordPassiveVoiceNetworkObservation({
      sttConnected: true,
      lastSttConnectedAt: 123,
      firstAudioMs: 9_000,
      firstAudioTimeouts: 0,
    });

    const verdict = getPassiveNetworkVerdict(
      { online: true, network: null },
      undefined,
      getPassiveVoiceNetworkObservation(),
    );

    expect(verdict.voice).toBe("degraded");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
