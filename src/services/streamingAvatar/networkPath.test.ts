import { describe, expect, it } from "vitest";
import { describeNetworkPath, describeWarmUp, readNetworkPath } from "./networkPath";

const pc = (entries: [string, Record<string, unknown>][]) =>
  ({ getStats: async () => new Map(entries) }) as unknown as RTCPeerConnection;
const candidate = (id: string, type: string, extra: Record<string, unknown> = {}) =>
  [id, { id, type: type === "local" ? "local-candidate" : "remote-candidate", ...extra }] as [string, Record<string, unknown>];

describe("WebRTC network path", () => {
  it("reads a direct UDP path from the transport's selected pair", async () => {
    const path = await readNetworkPath(pc([
      ["T", { type: "transport", selectedCandidatePairId: "P1" }],
      ["P0", { id: "P0", type: "candidate-pair", localCandidateId: "L0", remoteCandidateId: "R", currentRoundTripTime: 0.5 }],
      ["P1", { id: "P1", type: "candidate-pair", localCandidateId: "L1", remoteCandidateId: "R", currentRoundTripTime: 0.0314 }],
      candidate("L0", "local", { candidateType: "host", protocol: "tcp" }),
      candidate("L1", "local", { candidateType: "srflx", protocol: "udp", address: "203.0.113.5", port: 6000 }),
      candidate("R", "remote", { candidateType: "relay", protocol: "udp", address: "198.51.100.1", port: 3478 }),
    ]));
    expect(path).toEqual({
      localCandidateType: "srflx",
      remoteCandidateType: "relay",
      transportProtocol: "udp",
      relayProtocol: null,
      roundTripTimeMs: 31,
      incomingBitrateKbps: null,
    });
  });

  it("reads a TURN fallback over TLS from the pair flagged selected (no transport stats)", async () => {
    const path = await readNetworkPath(pc([
      ["P", { id: "P", type: "candidate-pair", selected: true, localCandidateId: "L", remoteCandidateId: "R", availableIncomingBitrate: 1_250_000 }],
      candidate("L", "local", { candidateType: "relay", protocol: "tcp", relayProtocol: "tls" }),
      candidate("R", "remote", { candidateType: "host", protocol: "tcp" }),
    ]));
    expect(path).toMatchObject({ localCandidateType: "relay", transportProtocol: "tcp", relayProtocol: "tls", incomingBitrateKbps: 1250, roundTripTimeMs: null });
    expect(describeNetworkPath(path!)).toBe("repli TURN TLS (local relay, distant host), entrant estimé 1250 kbit/s");
  });

  it("falls back to the nominated succeeded pair, and is null without any pair", async () => {
    const nominated = await readNetworkPath(pc([
      ["P", { id: "P", type: "candidate-pair", nominated: true, state: "succeeded", localCandidateId: "L", remoteCandidateId: "R" }],
      candidate("L", "local", { candidateType: "host", protocol: "udp" }),
      candidate("R", "remote", { candidateType: "host" }),
    ]));
    expect(nominated?.localCandidateType).toBe("host");
    expect(await readNetworkPath(pc([["P", { id: "P", type: "candidate-pair", state: "in-progress" }]]))).toBeNull();
  });

  it("drops unexpected values instead of passing them on", async () => {
    const path = await readNetworkPath(pc([
      ["T", { type: "transport", selectedCandidatePairId: "P" }],
      ["P", { id: "P", type: "candidate-pair", localCandidateId: "L", remoteCandidateId: "R", currentRoundTripTime: -1, availableIncomingBitrate: Number.NaN }],
      candidate("L", "local", { candidateType: "10.0.0.1", protocol: "quic", relayProtocol: "tls" }),
    ]));
    expect(path).toEqual({
      localCandidateType: null, remoteCandidateType: null, transportProtocol: null, relayProtocol: null,
      roundTripTimeMs: null, incomingBitrateKbps: null,
    });
    expect(describeNetworkPath(path!)).toBe("chemin inconnu");
  });

  it("describes the warm-up for the admin test panel", () => {
    expect(describeWarmUp({
      event: "warm_up", warmUpMs: 2340, warmUpComplete: true, steadyStream: true, videoFps: 25,
      localCandidateType: "host", remoteCandidateType: "relay", transportProtocol: "udp", roundTripTimeMs: 42, requestedRegion: "auto",
    })).toBe("Préchauffage 2340 ms, flux stable à 25 i/s · réseau : direct UDP (local host, distant relay), RTT 42 ms · région demandée : auto");
    expect(describeWarmUp({ event: "warm_up", warmUpMs: 10000, warmUpComplete: false, steadyStream: null }))
      .toBe("Préchauffage 10000 ms (borne atteinte), flux non mesuré · réseau : chemin inconnu · région demandée : —");
  });
});
