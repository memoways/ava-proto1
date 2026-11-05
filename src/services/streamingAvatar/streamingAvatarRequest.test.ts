import { describe, expect, it } from "vitest";
import {
  ANAM_DEFAULT_IDLE_STYLE_PROMPT,
  ANAM_DEFAULT_STYLE_PROMPT,
  buildAnamSessionTokenRequest,
  buildHeyGenSessionRequest,
  buildHeyGenVoiceSettings,
  buildTavusConversationRequest,
  buildTavusFaceTrainingRequest,
  checkTavusTrainingObject,
  normalizeTavusFace,
  normalizeTavusFaceList,
  normalizeTavusLanguages,
  parseTavusTrainingStoragePath,
  redactTavusText,
  safeTavusFaceName,
  safeTavusTrainingVideoUrl,
  stripAnamCueTags,
  summarizeTavusPalVoice,
  withAnamCue,
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

const anamBase = {
  avatarId: "30FA96D0-26c4-4e55-94a0-517025942e18",
  voiceId: "6bfbe25a-979d-40f3-a92b-5394170af54b",
};

function anamBody(config: Record<string, unknown>) {
  const result = buildAnamSessionTokenRequest(config);
  if ("error" in result) throw new Error(result.error);
  return result.body as Record<string, Record<string, unknown>>;
}

describe("Anam session token request", () => {
  it("forces the client LLM, no greeting and a single short-lived session", () => {
    const body = anamBody(anamBase);
    expect(body.maxSessions).toBe(1);
    expect(body.expiresInSeconds).toBe(300);
    expect(body.personaConfig).toMatchObject({
      avatarId: "30fa96d0-26c4-4e55-94a0-517025942e18",
      voiceId: anamBase.voiceId,
      avatarModel: "cara-4.1-express",
      llmId: "CUSTOMER_CLIENT_V1",
      skipGreeting: true,
      languageCode: "fr",
      maxSessionLengthSeconds: 900,
    });
    expect(body.personaConfig.systemPrompt).toBeUndefined();
    expect(body.personaConfig.voiceGenerationOptions).toBeUndefined();
    expect(body.sessionOptions).toEqual({
      videoQuality: "high",
      dataRetention: { recording: false, transcripts: false },
    });
  });

  it("keeps a saved avatar model, including the unstable cara-4-latest", () => {
    for (const avatarModel of ["cara-4-latest", "cara-4", "cara-3"]) {
      expect(anamBody({ ...anamBase, avatarModel }).personaConfig.avatarModel).toBe(avatarModel);
    }
    expect(anamBody({ ...anamBase, avatarModel: "cara-9" }).personaConfig.avatarModel).toBe("cara-4.1-express");
  });

  it("sends the sad speaking style and the closed idling attitude by default", () => {
    const notes = anamBody(anamBase).personaConfig.directorNotes as Record<string, unknown>;
    expect(notes.customStylePrompt).toBe(ANAM_DEFAULT_STYLE_PROMPT);
    expect(notes.customIdlingStylePrompt).toBe(ANAM_DEFAULT_IDLE_STYLE_PROMPT);
    expect(notes.expressivity).toBe(0.4);
    expect(notes.presetStyle).toBeUndefined();
  });

  it("never combines a preset style with a custom prompt, and skips notes on cara-3", () => {
    const preset = anamBody({
      ...anamBase,
      directorNotes: { mode: "preset", presetStyle: "distressed", customIdlingStylePrompt: "closed" },
    }).personaConfig.directorNotes;
    expect(preset).toEqual({ presetStyle: "distressed", expressivity: 0.4 });
    expect(anamBody({ ...anamBase, avatarModel: "cara-3" }).personaConfig.directorNotes).toBeUndefined();
    expect(anamBody({ ...anamBase, directorNotes: { mode: "default" } }).personaConfig.directorNotes).toBeUndefined();
  });

  it("sends only the voice fields read by the engine and model", () => {
    const voice = (options: Record<string, unknown>) =>
      anamBody({ ...anamBase, voiceGenerationOptions: options }).personaConfig.voiceGenerationOptions;
    expect(voice({ engine: "elevenLabs", elevenLabs: { model: "eleven_v3", stability: 0.3, speed: 0.8 } }))
      .toEqual({ model: "eleven_v3", stability: 0.3 });
    expect(voice({ engine: "elevenLabs", elevenLabs: { model: "eleven_v4_turbo", stability: 0.3, similarityBoost: 0.6, style: 1 } }))
      .toEqual({ model: "eleven_v4_turbo", stability: 0.3, similarityBoost: 0.6 });
    expect(voice({ engine: "elevenLabs", elevenLabs: { model: "eleven_multilingual_v2", speed: 1.3 } }))
      .toEqual({ model: "eleven_multilingual_v2", stability: 0.75, similarityBoost: 0.75, style: 0, useSpeakerBoost: true, speed: 1 });
    expect(voice({ engine: "cartesia", cartesia: { volume: 1.5, speed: 0.7 } }))
      .toEqual({ volume: 1.5, speed: 0.7, emotion: "sad" });
    expect(voice({ engine: "fish", fish: { volume: 0.4, speed: 2 } })).toEqual({ volume: 1, speed: 2 });
  });

  it("sends a region policy only with an explicit region", () => {
    expect(anamBody({ ...anamBase, sessionOptions: { regionPolicy: "strict" } }).sessionOptions)
      .not.toHaveProperty("regionPolicy");
    expect(anamBody({ ...anamBase, sessionOptions: { region: "eu", regionPolicy: "strict", keepTranscripts: true } }).sessionOptions)
      .toEqual({ videoQuality: "high", region: "eu", regionPolicy: "strict", dataRetention: { recording: false, transcripts: true } });
  });

  it("refuses non UUID ids and ignores fields outside the whitelist", () => {
    expect(buildAnamSessionTokenRequest({ ...anamBase, avatarId: "../avatars" })).toMatchObject({ ok: false });
    expect(buildAnamSessionTokenRequest({ avatarId: anamBase.avatarId })).toMatchObject({ ok: false });
    const body = anamBody({
      ...anamBase,
      llmId: "ANAM_GPT_4O_MINI_V1",
      systemPrompt: "Say hello",
      skipGreeting: false,
      tools: [{ name: "x" }],
      enableAudioPassthrough: true,
      environment: { type: "livekit" },
    });
    expect(body.personaConfig.llmId).toBe("CUSTOMER_CLIENT_V1");
    expect(body.personaConfig.skipGreeting).toBe(true);
    for (const key of ["systemPrompt", "tools", "enableAudioPassthrough"]) {
      expect(body.personaConfig).not.toHaveProperty(key);
    }
    expect(body).not.toHaveProperty("environment");
  });

  it("puts the cue tag in front of a line and strips it from transcripts", () => {
    expect(withAnamCue("Je ne sais pas.", "sad")).toBe("[sad] Je ne sais pas.");
    expect(withAnamCue("Je ne sais pas.", "none")).toBe("Je ne sais pas.");
    expect(stripAnamCueTags("[sad] Je ne sais pas. [distressed] Aide-moi.")).toBe("Je ne sais pas. Aide-moi.");
    expect(stripAnamCueTags("[note] reste")).toBe("[note] reste");
  });
});

describe("Tavus Face training request", () => {
  const url = "https://abc.supabase.co/storage/v1/object/sign/tavus-training-videos/a/b.mp4?token=eyJ.x.y";

  function trainingBody(input: { faceName: unknown; videoUrl: unknown }) {
    const result = buildTavusFaceTrainingRequest(input);
    if ("error" in result) throw new Error(result.error);
    return result.body;
  }

  it("sends exactly face_name, model_name and train_video_url", () => {
    expect(trainingBody({ faceName: "Max - 5 nov", videoUrl: url })).toEqual({
      face_name: "Max - 5 nov",
      model_name: "phoenix-4.5",
      train_video_url: url,
    });
  });

  it("never forwards callback_url, voice, consent video or any extra client field", () => {
    const body = trainingBody({
      faceName: "Max",
      videoUrl: url,
      callback_url: "https://evil.example/hook",
      consent_video_url: "https://evil.example/c.mp4",
      default_voice_id: "v1",
      voice_name: "anna",
      model_name: "phoenix-3",
      train_image_url: "https://evil.example/i.png",
      properties: { background_green_screen: true },
    } as never);
    expect(Object.keys(body).sort()).toEqual(["face_name", "model_name", "train_video_url"]);
    expect(body.model_name).toBe("phoenix-4.5");
  });

  it("refuses a link that is not public https", () => {
    for (const bad of [
      "http://example.com/v.mp4",
      "ftp://example.com/v.mp4",
      "https://user:pass@example.com/v.mp4",
      "https://localhost/v.mp4",
      "https://intranet/v.mp4",
      "https://192.168.1.10/v.mp4",
      "https://[::1]/v.mp4",
      "javascript:alert(1)",
      "not a url",
      "",
      undefined,
      42,
      `https://example.com/${"a".repeat(4_100)}`,
    ]) {
      expect(buildTavusFaceTrainingRequest({ faceName: "Max", videoUrl: bad })).toEqual({
        ok: false,
        error: "The training video link must be a public https URL",
      });
    }
  });

  it("requires a usable name, cleans it and bounds it", () => {
    expect(buildTavusFaceTrainingRequest({ faceName: "  ", videoUrl: url }).ok).toBe(false);
    expect(buildTavusFaceTrainingRequest({ faceName: 12, videoUrl: url }).ok).toBe(false);
    expect(safeTavusFaceName("  Max \n\t — 5   nov\u0000 ")).toBe("Max — 5 nov");
    expect(safeTavusFaceName("x".repeat(500))).toHaveLength(80);
    expect(trainingBody({ faceName: "y".repeat(200), videoUrl: url }).face_name).toHaveLength(80);
  });

  it("accepts a public https link from the backup field", () => {
    expect(safeTavusTrainingVideoUrl("https://cdn.example.com/train.mp4?x=1")).toBe(
      "https://cdn.example.com/train.mp4?x=1",
    );
  });
});

describe("Tavus training storage path", () => {
  it("accepts a path inside the bucket, with or without the bucket prefix", () => {
    expect(parseTavusTrainingStoragePath("max/2026-11-05.mp4")).toBe("max/2026-11-05.mp4");
    expect(parseTavusTrainingStoragePath("tavus-training-videos/max/take_1.webm")).toBe("max/take_1.webm");
    expect(parseTavusTrainingStoragePath("clip.MP4")).toBe("clip.MP4");
  });

  it("refuses traversal, absolute paths, odd characters and other extensions", () => {
    for (const bad of [
      "../secret.mp4",
      "a/../b.mp4",
      "/abs/video.mp4",
      "a//b.mp4",
      "a\\b.mp4",
      "a/b c.mp4",
      "a/b.mov",
      "a/b.mp4.exe",
      "a/b/c/d/e.mp4",
      "other-bucket/../../x.mp4",
      ".hidden.mp4",
      "",
      null,
      7,
      `${"a".repeat(260)}.mp4`,
    ]) {
      expect(parseTavusTrainingStoragePath(bad)).toBe("");
    }
  });

  it("checks size and type against the Tavus limits", () => {
    expect(checkTavusTrainingObject({ size: 100_000_000, mimetype: "video/mp4" })).toBeNull();
    expect(checkTavusTrainingObject({ size: 750 * 1024 * 1024, mimetype: "video/webm" })).toBeNull();
    expect(checkTavusTrainingObject({})).toBeNull();
    expect(checkTavusTrainingObject({ size: 750 * 1024 * 1024 + 1 })).toMatch(/750 MB/);
    expect(checkTavusTrainingObject({ size: 0 })).toMatch(/empty/);
    expect(checkTavusTrainingObject({ size: 10, mimetype: "video/quicktime" })).toMatch(/mp4 or video\/webm/);
    expect(checkTavusTrainingObject(null)).toBeNull();
  });
});

describe("Tavus Face response", () => {
  it("reads a Face being trained", () => {
    expect(normalizeTavusFace({ face_id: "f123", face_name: "Max", status: "started", training_progress: "12/100" }))
      .toEqual({
        faceId: "f123",
        name: "Max",
        status: "started",
        trainingProgress: "12/100",
        progressPercent: 12,
        finetuneStatus: null,
        stage: "training",
        errorMessage: null,
        modelName: null,
        createdAt: null,
        updatedAt: null,
      });
  });

  it("tells the Phoenix-4.5 preview, tuned and tuning-failed stages apart", () => {
    const base = { face_id: "f1", status: "completed", training_progress: "100/100" };
    expect(normalizeTavusFace({ ...base, finetune_status: "training" })).toMatchObject({
      stage: "preview",
      finetuneStatus: "training",
      progressPercent: 100,
    });
    expect(normalizeTavusFace({ ...base, finetune_status: "completed" }).stage).toBe("ready");
    expect(normalizeTavusFace({ ...base, finetune_status: "error" }).stage).toBe("tuning_failed");
    expect(normalizeTavusFace({ ...base, finetune_status: null }).stage).toBe("ready");
  });

  it("reports an error with a short message stripped of links", () => {
    const face = normalizeTavusFace({
      face_id: "f2",
      status: "error",
      error_message: `Could not download https://bucket.example/v.mp4?token=SECRET because it timed out ${"z".repeat(500)}`,
    });
    expect(face.stage).toBe("error");
    expect(face.errorMessage).not.toContain("SECRET");
    expect(face.errorMessage).not.toContain("https://");
    expect(face.errorMessage).toContain("[link]");
    expect(face.errorMessage!.length).toBeLessThanOrEqual(300);
  });

  it("is tolerant to missing or odd fields and keeps the model name", () => {
    expect(normalizeTavusFace(null)).toMatchObject({ faceId: "", status: "unknown", stage: "training", progressPercent: null });
    expect(normalizeTavusFace({ face_id: "bad id!", status: "weird", finetune_status: "nope" })).toMatchObject({
      faceId: "",
      status: "unknown",
      finetuneStatus: null,
    });
    expect(normalizeTavusFace({ face_id: "f3", model_name: "phoenix-4.5" }).modelName).toBe("phoenix-4.5");
    expect(normalizeTavusFace({ face_id: "f3", training_progress: "45%" }).progressPercent).toBe(45);
    expect(normalizeTavusFace({ face_id: "f3", training_progress: 30 }).progressPercent).toBe(30);
    expect(normalizeTavusFace({ face_id: "f3", training_progress: "0/0" }).progressPercent).toBeNull();
    expect(normalizeTavusFace({ face_id: "f3", training_progress: "300/100" }).progressPercent).toBe(100);
  });

  it("normalizes a Faces list from the catalog probe", () => {
    const list = normalizeTavusFaceList({
      data: [
        { face_id: "a1", status: "completed", finetune_status: "training", training_progress: "100/100" },
        { face_id: "a2", status: "started", training_progress: "3/100" },
        { status: "completed" },
      ],
    });
    expect(list.map((face) => [face.faceId, face.stage])).toEqual([["a1", "preview"], ["a2", "training"]]);
    expect(normalizeTavusFaceList([{ face_id: "b1" }]).map((face) => face.faceId)).toEqual(["b1"]);
    expect(normalizeTavusFaceList("nope")).toEqual([]);
    expect(normalizeTavusFaceList({ data: Array.from({ length: 40 }, (_, i) => ({ face_id: `f${i}` })) })).toHaveLength(25);
  });

  it("removes links from any relayed Tavus text", () => {
    expect(redactTavusText("bad url http://x.io/a?token=1 end")).toBe("bad url [link] end");
    expect(redactTavusText(42)).toBe("");
  });
});
