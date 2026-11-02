import { describe, expect, it } from "vitest";
import {
  buildHeyGenSessionRequest,
  buildHeyGenVoiceSettings,
  buildTavusConversationRequest,
  normalizeTavusLanguages,
  summarizeTavusPalVoice,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";

const heygenBase = { avatarId: "avatar-1", voiceId: "voice-1", language: "fr" };
const tavusTarget = { avaSessionId: "12345678-aaaa", palId: "p123", faceId: "f456", legacyPersona: false };

function heygenBody(config: Record<string, unknown>) {
  const result = buildHeyGenSessionRequest(config);
  if ("error" in result) throw new Error(result.error);
  return result.body as Record<string, Record<string, unknown> & unknown>;
}

describe("HeyGen LiveAvatar session request", () => {
  it("keeps the previous body for older settings (no voice settings, no duration)", () => {
    expect(heygenBody({ ...heygenBase, quality: "high", sandbox: true })).toEqual({
      mode: "FULL",
      avatar_id: "avatar-1",
      avatar_persona: { voice_id: "voice-1", language: "fr" },
      video_settings: { quality: "high", encoding: "H264" },
      is_sandbox: true,
      interactivity_type: "PUSH_TO_TALK",
    });
  });

  it("accepts very_high and VP8, refuses unknown values", () => {
    expect(heygenBody({ ...heygenBase, quality: "very_high", encoding: "VP8" }).video_settings)
      .toEqual({ quality: "very_high", encoding: "VP8" });
    expect(heygenBody({ ...heygenBase, quality: "ultra", encoding: "AV1" }).video_settings)
      .toEqual({ quality: "high", encoding: "H264" });
  });

  it("sends max_session_duration only inside its bounds", () => {
    expect(heygenBody({ ...heygenBase, maxSessionDurationSeconds: 0 })).not.toHaveProperty("max_session_duration");
    expect(heygenBody({ ...heygenBase, maxSessionDurationSeconds: 600 }).max_session_duration).toBe(600);
    expect(heygenBody({ ...heygenBase, maxSessionDurationSeconds: 99_999 })).not.toHaveProperty("max_session_duration");
    expect(heygenBody({ ...heygenBase, maxSessionDurationSeconds: 30 })).not.toHaveProperty("max_session_duration");
  });

  it("never forwards client fields outside the whitelist", () => {
    const body = heygenBody({
      ...heygenBase,
      interactivity_type: "CONVERSATIONAL",
      llm_configuration_id: "llm",
      is_sandbox: false,
      mode: "LITE",
      voice_agent: { id: "x" },
    });
    expect(body.interactivity_type).toBe("PUSH_TO_TALK");
    expect(body.mode).toBe("FULL");
    expect(body.is_sandbox).toBe(true);
    expect(body).not.toHaveProperty("llm_configuration_id");
    expect(body).not.toHaveProperty("voice_agent");
  });

  it("requires valid avatar and voice ids", () => {
    expect(buildHeyGenSessionRequest({ avatarId: "a b", voiceId: "v" })).toEqual({
      ok: false,
      error: "HeyGen avatarId and voiceId are required",
    });
  });

  it("sends no voice_settings with the default engine", () => {
    expect(buildHeyGenVoiceSettings({ engine: "default" })).toBeNull();
    expect(buildHeyGenVoiceSettings({ engine: "openai" })).toBeNull();
    expect(heygenBody({ ...heygenBase, voiceSettings: { engine: "default" } }).avatar_persona)
      .not.toHaveProperty("voice_settings");
  });

  it("sends every ElevenLabs field for Flash and Multilingual", () => {
    expect(buildHeyGenVoiceSettings({
      engine: "elevenLabs",
      elevenLabs: { model: "eleven_multilingual_v2", speed: 1.1, stability: 0.4, similarityBoost: 0.9, style: 0.3, useSpeakerBoost: false },
    })).toEqual({
      provider: "elevenLabs",
      model: "eleven_multilingual_v2",
      speed: 1.1,
      stability: 0.4,
      similarity_boost: 0.9,
      style: 0.3,
      use_speaker_boost: false,
    });
  });

  it("sends only stability to v3, v3 conversational and v4 Turbo", () => {
    for (const model of ["eleven_v3", "eleven_v3_conversational", "eleven_v4_turbo"]) {
      expect(buildHeyGenVoiceSettings({
        engine: "elevenLabs",
        elevenLabs: { model, speed: 1.1, stability: 0.3, similarityBoost: 0.9, style: 0.5 },
      })).toEqual({ provider: "elevenLabs", model, stability: 0.3 });
    }
  });

  it("returns out of bounds voice values to their default", () => {
    expect(buildHeyGenVoiceSettings({
      engine: "elevenLabs",
      elevenLabs: { model: "eleven_turbo_v2", speed: 3, stability: -1, similarityBoost: "x", style: 2 },
    })).toEqual({
      provider: "elevenLabs",
      model: "eleven_flash_v2_5",
      speed: 1,
      stability: 0.75,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true,
    });
  });

  it("sends Fish and Cartesia fields of their own engine only", () => {
    const shared = {
      elevenLabs: { model: "eleven_v3", stability: 0.2 },
      fish: { model: "s2-pro", speed: 0.9, latencyMode: "low" },
      cartesia: { model: "sonic-3", speed: 1.4 },
    };
    expect(buildHeyGenVoiceSettings({ engine: "fish", ...shared }))
      .toEqual({ provider: "fish", model: "s2-pro", speed: 0.9, latency_mode: "low" });
    expect(buildHeyGenVoiceSettings({ engine: "cartesia", ...shared }))
      .toEqual({ provider: "cartesia", model: "sonic-3", speed: 1.4 });
    expect(buildHeyGenVoiceSettings({ engine: "cartesia", cartesia: { speed: 1.4, model: "sonic-9" } }))
      .toEqual({ provider: "cartesia", model: "sonic-3.6", speed: 1.4 });
  });
});

describe("Tavus conversation request", () => {
  it("replaces the deprecated language name with languages codes", () => {
    const body = buildTavusConversationRequest({ language: "French", maxDurationSeconds: 900 }, tavusTarget);
    const properties = body.properties as Record<string, unknown>;
    expect(properties.languages).toEqual(["fr"]);
    expect(properties).not.toHaveProperty("language");
  });

  it("keeps the previous timeouts by default and bounds them", () => {
    expect(buildTavusConversationRequest({}, tavusTarget)).toEqual({
      audio_only: false,
      require_auth: true,
      max_participants: 2,
      conversation_name: "Ava 12345678",
      properties: {
        languages: ["fr"],
        max_call_duration: 900,
        participant_absent_timeout: 120,
        participant_left_timeout: 30,
      },
      pal_id: "p123",
      face_id: "f456",
    });
    const properties = buildTavusConversationRequest({
      participantAbsentTimeoutSeconds: 60,
      participantLeftTimeoutSeconds: 0,
      maxDurationSeconds: 99_999,
    }, tavusTarget).properties as Record<string, unknown>;
    expect(properties.participant_absent_timeout).toBe(60);
    expect(properties.participant_left_timeout).toBe(0);
    expect(properties.max_call_duration).toBe(900);
  });

  it("sends captions, greenscreen, EU policy and test mode only when asked", () => {
    const body = buildTavusConversationRequest(
      { enableClosedCaptions: true, applyGreenscreen: true, euPolicy: true },
      { ...tavusTarget, testMode: true },
    );
    expect(body.policy).toBe("eu");
    expect(body.test_mode).toBe(true);
    expect(body.properties).toMatchObject({ enable_closed_captions: true, apply_greenscreen: true });
    const plain = buildTavusConversationRequest({ enableClosedCaptions: "yes", euPolicy: "eu" }, tavusTarget);
    expect(plain).not.toHaveProperty("policy");
    expect(plain).not.toHaveProperty("test_mode");
    expect(plain.properties).not.toHaveProperty("enable_closed_captions");
  });

  it("never forwards client fields outside the whitelist", () => {
    const body = buildTavusConversationRequest({
      callback_url: "https://evil.invalid",
      custom_greeting: "Hello",
      properties: { enable_recording: true },
      enable_recording: true,
    }, tavusTarget);
    expect(body).not.toHaveProperty("callback_url");
    expect(body).not.toHaveProperty("custom_greeting");
    expect(body.properties).not.toHaveProperty("enable_recording");
  });

  it("uses persona_id and replica_id for legacy accounts", () => {
    const body = buildTavusConversationRequest({}, { ...tavusTarget, legacyPersona: true });
    expect(body).toMatchObject({ persona_id: "p123", replica_id: "f456" });
    expect(body).not.toHaveProperty("pal_id");
  });

  it("normalizes languages: codes kept, invalid dropped, French by default", () => {
    expect(normalizeTavusLanguages(["FR", "en", "fr", "not a code", 4])).toEqual(["fr", "en"]);
    expect(normalizeTavusLanguages([], "Spanish")).toEqual(["es"]);
    expect(normalizeTavusLanguages(undefined, "Klingon language")).toEqual(["fr"]);
    expect(normalizeTavusLanguages(Array.from({ length: 50 }, (_, index) => `l${String.fromCharCode(97 + (index % 26))}${index < 26 ? "" : "a"}`)).length)
      .toBeLessThanOrEqual(42);
  });

  it("summarizes the PAL voice without anything but voice fields", () => {
    expect(summarizeTavusPalVoice({
      pipeline_mode: "echo",
      layers: {
        llm: { api_key: "secret" },
        tts: {
          tts_engine: "elevenlabs",
          external_voice_id: "voice",
          api_key: "secret",
          voice_settings: { speed: 1, stability: 0.5, nested: { x: 1 } },
        },
      },
    })).toEqual({
      tts_engine: "elevenlabs",
      external_voice_id: "voice",
      voice_settings: { speed: 1, stability: 0.5 },
    });
  });
});
