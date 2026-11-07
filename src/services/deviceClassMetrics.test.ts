import { describe, expect, it } from "vitest";
import { compareServices, LATENCY_DIMENSIONS, toLatencySample } from "@/services/latencyAnalytics";
import { buildSessionMarkdown } from "@/services/sessionMarkdownExport";
import { sessionDeviceKey, sessionDeviceLabel } from "@/services/deviceClass";

const turn = (device: string | undefined, first: number) => toLatencySample({
  created_at: "2026-11-07T12:00:00.000Z",
  event_name: "voice_turn_completed",
  metadata_json: { first_sound_status: "measured", t_turn_voice_ready_ms: first, ...(device ? { device_class: device } : {}) },
});

describe("device class in admin metrics", () => {
  it("offers an « Appareil » latency dimension next to « Navigateur »", () => {
    const keys = LATENCY_DIMENSIONS.map((item) => item.key);
    expect(keys.indexOf("device")).toBe(keys.indexOf("browser") + 1);
    expect(LATENCY_DIMENSIONS.find((item) => item.key === "device")?.label).toBe("Appareil");
  });

  it("groups first sound by device, older turns as not provided", () => {
    const samples = [turn("smartphone", 2000), turn("smartphone", 3000), turn("desktop", 1000), turn(undefined, 1500)]
      .filter((sample): sample is NonNullable<typeof sample> => sample != null);
    const groups = compareServices(samples, "firstSound", "device");
    expect(groups.map((group) => [group.key, group.count])).toEqual([["smartphone", 2], ["desktop", 1], ["non renseigné", 1]]);
  });

  it("filters sessions by device and labels older ones as unknown", () => {
    expect(sessionDeviceKey({ device_class: "tablet" })).toBe("tablet");
    expect(sessionDeviceKey({ device_class: null })).toBe("unknown");
    expect(sessionDeviceKey({})).toBe("unknown");
    expect(sessionDeviceKey({ device_class: "watch" })).toBe("unknown");
    expect(sessionDeviceLabel({ device_class: "smartphone" })).toBe("Smartphone");
    expect(sessionDeviceLabel({})).toBe("inconnu");
  });

  it("shows the device in the session Markdown export", () => {
    const base = { session: { id: "s1", conversation_log: [] }, telemetry: {}, warnings: [] };
    expect(buildSessionMarkdown({ ...base, session: { ...base.session, device_class: "tablet" } })).toContain("- Appareil : tablet");
    expect(buildSessionMarkdown(base)).toContain("- Appareil : inconnu");
  });
});
