import { describe, expect, it } from "vitest";
import {
  buildDailyMeetingTokenRequest,
  buildDailyRoomRequest,
  buildLemonSliceControlRequest,
  buildLemonSliceSessionRequest,
  LEMONSLICE_DEFAULT_AGENT_PROMPT,
  LEMONSLICE_DEFAULT_IDLE_PROMPT,
  lemonSliceRoomName,
  safeDailyRoomUrl,
  safeLemonSliceWebSocketAddress,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";

const daily = { dailyUrl: "https://ava.daily.co/ava-ls-123", dailyToken: "publish-token" };

function body(config: Record<string, unknown>) {
  const result = buildLemonSliceSessionRequest(config, daily);
  if ("error" in result) throw new Error(result.error);
  return result.body;
}

describe("LemonSlice session request", () => {
  it("forces websocket-daily with the publishing token and sends the dejected prompts by default", () => {
    expect(body({ agentImageUrl: "https://cdn.example.com/max.jpg" })).toEqual({
      transport_type: "websocket-daily",
      daily_properties: { daily_url: "https://ava.daily.co/ava-ls-123", daily_token: "publish-token" },
      agent_image_url: "https://cdn.example.com/max.jpg",
      audio_sample_rate: 16_000,
      idle_timeout: 300,
      agent_prompt: LEMONSLICE_DEFAULT_AGENT_PROMPT,
      agent_idle_prompt: LEMONSLICE_DEFAULT_IDLE_PROMPT,
      aspect_ratio: "2x3",
    });
  });

  it("prefers the agent id and never sends the image nor edit_image with it", () => {
    const sent = body({ agentId: "agent_42", agentImageUrl: "https://cdn.example.com/max.jpg", editImage: "on" });
    expect(sent.agent_id).toBe("agent_42");
    expect(sent).not.toHaveProperty("agent_image_url");
    expect(sent).not.toHaveProperty("edit_image");
    expect(sent).not.toHaveProperty("edit_image_variant");
  });

  it("requires an avatar and a Daily room, and refuses non-https images", () => {
    expect(buildLemonSliceSessionRequest({}, daily)).toMatchObject({ ok: false });
    expect(buildLemonSliceSessionRequest({ agentImageUrl: "http://cdn.example.com/a.jpg" }, daily)).toMatchObject({ ok: false });
    expect(buildLemonSliceSessionRequest({ agentImageUrl: "javascript:alert(1)" }, daily)).toMatchObject({ ok: false });
    expect(buildLemonSliceSessionRequest({ agentId: "a" }, { dailyUrl: "https://evil.example.com/x", dailyToken: "t" })).toMatchObject({ ok: false });
    expect(buildLemonSliceSessionRequest({ agentId: "a" }, { ...daily, dailyToken: "" })).toMatchObject({ ok: false });
  });

  it("sends only the fields read by the chosen model", () => {
    const cartoon = body({ agentImageUrl: "https://cdn.example.com/a.jpg", model: "cartoon", aspectRatio: "9x16", editImage: "on" });
    expect(cartoon.model).toBe("cartoon");
    expect(cartoon).not.toHaveProperty("aspect_ratio");
    // Lite and cartoon are 2x3 only: the reframing is still read.
    expect(cartoon).toMatchObject({ edit_image: true, edit_image_variant: "bust" });
    const square = body({ agentImageUrl: "https://cdn.example.com/a.jpg", aspectRatio: "1x1", editImage: "on" });
    expect(square.aspect_ratio).toBe("1x1");
    expect(square).not.toHaveProperty("edit_image");
    const off = body({ agentImageUrl: "https://cdn.example.com/a.jpg", editImage: "off", editImageVariant: "sitting" });
    expect(off.edit_image).toBe(false);
    expect(off).not.toHaveProperty("edit_image_variant");
    expect(body({ agentId: "a" })).not.toHaveProperty("model");
  });

  it("bounds every value and ignores fields Ava does not whitelist", () => {
    const sent = body({
      agentId: "a", audioSampleRate: 44_100, idleTimeoutSeconds: -1, responseDoneTimeoutSeconds: 2.5,
      transport_type: "websocket-livekit", livekit_properties: { livekit_url: "wss://x" }, action_engine: "natural",
      agentPrompt: "   ",
    });
    expect(sent).toMatchObject({ transport_type: "websocket-daily", audio_sample_rate: 16_000, idle_timeout: 300, response_done_timeout: 2.5 });
    expect(sent).not.toHaveProperty("livekit_properties");
    expect(sent).not.toHaveProperty("action_engine");
    expect(sent).not.toHaveProperty("agent_prompt");
    expect(body({ agentId: "a", responseDoneTimeoutSeconds: 0 })).not.toHaveProperty("response_done_timeout");
    expect(body({ agentId: "a", audioSampleRate: 24_000 }).audio_sample_rate).toBe(24_000);
  });
});

describe("LemonSlice control events", () => {
  it("allows the nod only on CWM-1, and only the nod", () => {
    expect(buildLemonSliceControlRequest({ model: "cwm-1" }, "action", "listen")).toEqual({ ok: true, body: { event: "action", action: "listen" } });
    expect(buildLemonSliceControlRequest({ model: "cwm-1" }, "action", "smile")).toMatchObject({ ok: false });
    expect(buildLemonSliceControlRequest({ model: "flash" }, "action", "listen")).toMatchObject({ ok: false });
  });

  it("maps prompts to the documented field names and refuses unknown events", () => {
    expect(buildLemonSliceControlRequest({}, "update-agent-prompt", " a sad man ")).toEqual({ ok: true, body: { event: "update-agent-prompt", agent_prompt: "a sad man" } });
    expect(buildLemonSliceControlRequest({}, "update-idle-prompt", "still")).toEqual({ ok: true, body: { event: "update-idle-prompt", idle_prompt: "still" } });
    expect(buildLemonSliceControlRequest({}, "update-idle-prompt", "x".repeat(1_001))).toMatchObject({ ok: false });
    expect(buildLemonSliceControlRequest({}, "reset-idle-timeout")).toEqual({ ok: true, body: { event: "reset-idle-timeout" } });
    expect(buildLemonSliceControlRequest({}, "terminate")).toMatchObject({ ok: false });
    expect(buildLemonSliceControlRequest({}, "update-image", "https://x")).toMatchObject({ ok: false });
  });
});

describe("Daily room for LemonSlice (D1a)", () => {
  it("derives a private room per Ava session that expires with its tokens", () => {
    const name = lemonSliceRoomName("0f2c3a4b-1111-4222-8333-444455556666");
    expect(name).toBe("ava-ls-0f2c3a4b-1111-4222-8333-444455556666");
    expect(lemonSliceRoomName("a/../b?x")).toBe("ava-ls-abx");
    const room = buildDailyRoomRequest(name, { roomMaxSeconds: 600 }, 1_000);
    expect(room).toMatchObject({ name, privacy: "private", properties: { exp: 1_600, eject_at_room_exp: true, max_participants: 2 } });
  });

  it("lets LemonSlice publish and keeps the browser receive-only", () => {
    const avatar = buildDailyMeetingTokenRequest("room", "avatar", {}, 0).properties as Record<string, unknown>;
    const viewer = buildDailyMeetingTokenRequest("room", "viewer", {}, 0).properties as Record<string, unknown>;
    expect(avatar).toMatchObject({ room_name: "room", is_owner: false, permissions: { canSend: ["video", "audio"] }, exp: 1_800 });
    expect(viewer).toMatchObject({ room_name: "room", is_owner: false, permissions: { canSend: false }, start_audio_off: true, start_video_off: true });
  });

  it("accepts only Daily room URLs and wss bridge addresses", () => {
    expect(safeDailyRoomUrl("https://ava.daily.co/ava-ls-1")).toBe("https://ava.daily.co/ava-ls-1");
    expect(safeDailyRoomUrl("https://ava.daily.co.evil.com/x")).toBe("");
    expect(safeDailyRoomUrl("https://ava.daily.co/x?t=1")).toBe("");
    expect(safeLemonSliceWebSocketAddress("wss://ws.lemonslice.com/s/abc")).toBe("wss://ws.lemonslice.com/s/abc");
    expect(safeLemonSliceWebSocketAddress("ws://ws.lemonslice.com/s/abc")).toBe("");
  });
});
