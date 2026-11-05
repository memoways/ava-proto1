import type { AvatarMediaDiagnostics } from "./types";

/**
 * Route actually used by a WebRTC session, from the selected ICE candidate pair. Candidate types,
 * protocols and timings only: addresses, ports and relay URLs are never read.
 */
export interface AvatarNetworkPath {
  /** host / srflx / prflx: direct; relay: our side goes through a TURN relay. */
  localCandidateType: string | null;
  remoteCandidateType: string | null;
  transportProtocol: string | null;
  /** Protocol between the browser and its TURN relay, when the local candidate is a relay. */
  relayProtocol: string | null;
  roundTripTimeMs: number | null;
  incomingBitrateKbps: number | null;
}

const CANDIDATE_TYPES = ["host", "srflx", "prflx", "relay"];
const TRANSPORT_PROTOCOLS = ["udp", "tcp"];
const RELAY_PROTOCOLS = ["udp", "tcp", "tls"];

type StatsEntry = Record<string, unknown>;

function known(value: unknown, allowed: string[]): string | null {
  return typeof value === "string" && allowed.includes(value.toLowerCase()) ? value.toLowerCase() : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Reads the selected candidate pair (`transport.selectedCandidatePairId`, else the pair flagged
 * selected or nominated and succeeded). Null when no pair is selected yet.
 */
export async function readNetworkPath(pc: RTCPeerConnection): Promise<AvatarNetworkPath | null> {
  const byId = new Map<string, StatsEntry>();
  const reports: StatsEntry[] = [];
  (await pc.getStats()).forEach((report: StatsEntry, key: string) => {
    reports.push(report);
    byId.set(typeof report.id === "string" ? report.id : key, report);
  });
  const transport = reports.find((r) => r.type === "transport" && typeof r.selectedCandidatePairId === "string");
  const pair = (transport ? byId.get(transport.selectedCandidatePairId as string) : undefined)
    ?? reports.find((r) => r.type === "candidate-pair" && r.selected === true)
    ?? reports.find((r) => r.type === "candidate-pair" && r.nominated === true && r.state === "succeeded");
  if (!pair) return null;
  const local = typeof pair.localCandidateId === "string" ? byId.get(pair.localCandidateId) : undefined;
  const remote = typeof pair.remoteCandidateId === "string" ? byId.get(pair.remoteCandidateId) : undefined;
  const localCandidateType = known(local?.candidateType, CANDIDATE_TYPES);
  const rtt = finite(pair.currentRoundTripTime);
  const incoming = finite(pair.availableIncomingBitrate);
  return {
    localCandidateType,
    remoteCandidateType: known(remote?.candidateType, CANDIDATE_TYPES),
    transportProtocol: known(local?.protocol, TRANSPORT_PROTOCOLS),
    relayProtocol: localCandidateType === "relay" ? known(local?.relayProtocol, RELAY_PROTOCOLS) : null,
    roundTripTimeMs: rtt === null ? null : Math.round(rtt * 1000),
    incomingBitrateKbps: incoming === null ? null : Math.round(incoming / 1000),
  };
}

/** One line for the admin: direct or TURN fallback, protocol, RTT and incoming estimate. */
export function describeNetworkPath(d: Partial<AvatarNetworkPath>): string {
  if (!d.localCandidateType && !d.remoteCandidateType) return "chemin inconnu";
  const protocol = d.transportProtocol?.toUpperCase() ?? "?";
  const route = d.localCandidateType === "relay"
    ? `repli TURN${d.relayProtocol ? ` ${d.relayProtocol.toUpperCase()}` : ""}`
    : `direct ${protocol}`;
  const parts = [`${route} (local ${d.localCandidateType ?? "—"}, distant ${d.remoteCandidateType ?? "—"})`];
  if (d.roundTripTimeMs != null) parts.push(`RTT ${d.roundTripTimeMs} ms`);
  if (d.incomingBitrateKbps != null) parts.push(`entrant estimé ${d.incomingBitrateKbps} kbit/s`);
  return parts.join(", ");
}

export function describeWarmUp(d: AvatarMediaDiagnostics): string {
  const stream = d.steadyStream === true ? "flux stable" : d.steadyStream === false ? "flux instable" : "flux non mesuré";
  const fps = d.videoFps != null ? ` à ${d.videoFps} i/s` : "";
  const bound = d.warmUpComplete === false ? " (borne atteinte)" : "";
  return `Préchauffage ${d.warmUpMs ?? "—"} ms${bound}, ${stream}${fps} · réseau : ${describeNetworkPath(d)} · région demandée : ${d.requestedRegion ?? "—"}`;
}
