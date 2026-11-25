import { afterEach, describe, expect, it, vi } from "vitest";
import { NUANCE_SPEAK_PREFIX } from "../../../../supabase/functions/_shared/streamingAvatarRequest";
import { streamingAvatarDefaults } from "../settings";

const fake = vi.hoisted(() => {
  const sent: Record<string, unknown>[] = [];
  let onInterface: ((event: Record<string, unknown>) => void) | null = null;
  const emit = (event: Record<string, unknown>) => onInterface?.(event);
  const conversation = {
    state: "connected" as const,
    avatar: {
      videoTrack: { mediaStreamTrack: { kind: "video" }, attach: vi.fn() },
      audioTrack: { mediaStreamTrack: { kind: "audio" }, attach: vi.fn() },
    },
    connect: vi.fn(async () => {
      emit({ type: "session.started" });
    }),
    disconnect: vi.fn(async () => {}),
    sendInterfaceEvent: vi.fn(async (event: Record<string, unknown>) => {
      sent.push(event);
      if (event.type === "response.create") {
        emit({ type: "session.output_transcript.delta", delta: "Bonjour Max." });
        emit({ type: "session.output_audio.done", reason: "completed" });
      }
    }),
    onChange: vi.fn(() => () => {}),
    onInterfaceEvent: vi.fn((cb: (event: Record<string, unknown>) => void) => {
      onInterface = cb;
      return () => {};
    }),
  };
  return {
    sent,
    emit,
    conversation,
    createNuanceConversation: vi.fn(() => conversation),
    start: vi.fn(async () => ({
      provider: "nuance" as const,
      externalSessionId: "binding-1",
      sessionToken: "st_testtoken",
    })),
    end: vi.fn(async () => {}),
  };
});

vi.mock("@nuancelabs/js-sdk", () => ({
  createNuanceConversation: fake.createNuanceConversation,
}));
vi.mock("../api", () => ({
  startAvatarSession: fake.start,
  endAvatarSession: fake.end,
}));

import { NuanceStreamingAvatarOutput } from "./nuance";

const settings = streamingAvatarDefaults.nuance;
const sessionId = "12345678-aaaa-bbbb-cccc-1234567890ab";

function defaultSend(event: Record<string, unknown>): Promise<void> {
  fake.sent.push(event);
  if (event.type === "response.create") {
    fake.emit({ type: "session.output_transcript.delta", delta: "Bonjour Max." });
    fake.emit({ type: "session.output_audio.done", reason: "completed" });
  }
  return Promise.resolve();
}

describe("Nuance Live output", () => {
  afterEach(() => {
    fake.sent.length = 0;
    fake.conversation.sendInterfaceEvent.mockImplementation(defaultSend);
  });

  it("sends Ava's line as an instruction and mutes what the persona hears", async () => {
    const output = new NuanceStreamingAvatarOutput(settings, {}, 1_000, 1_000);
    await output.prepare({ sessionId });
    const result = await output.renderText("Bonjour Max.");
    expect(fake.sent.map((event) => event.type)).toEqual([
      "session.input_audio.mute",
      "response.create",
    ]);
    const spoken = fake.sent[1].response as { instructions: string; tool_choice: string };
    expect(spoken.instructions.startsWith(NUANCE_SPEAK_PREFIX)).toBe(true);
    expect(spoken.instructions).toContain("Bonjour Max.");
    expect(spoken.tool_choice).toBe("none");
    expect(result.status).toBe("played");
    expect(fake.createNuanceConversation).toHaveBeenCalledWith({
      token: expect.any(Function),
      mediaDevices: { cameraEnabled: false },
    });
    await output.dispose();
    expect(fake.end).toHaveBeenCalledWith({
      provider: "nuance",
      sessionId,
      externalSessionId: "binding-1",
    });
  });

  it("does not send Ava's line when the persona answers by itself", async () => {
    const output = new NuanceStreamingAvatarOutput(
      { ...settings, drive: "native" },
      {},
      1_000,
      1_000,
    );
    await output.prepare({ sessionId });
    const result = await output.renderText("Cette réplique reste à Ava.");
    expect(result.status).toBe("skipped");
    expect(fake.sent).toEqual([]);
  });

  it("reports a refused line so the call can fall back to Ava's voice", async () => {
    fake.conversation.sendInterfaceEvent.mockImplementation(async (event: Record<string, unknown>) => {
      fake.sent.push(event);
      if (event.type === "response.create") {
        fake.emit({
          type: "error",
          client_event_id: event.event_id,
          error: { code: "instructions_refused" },
        });
      }
    });
    const output = new NuanceStreamingAvatarOutput(settings, {}, 1_000, 1_000);
    await output.prepare({ sessionId });
    await expect(output.renderText("Bonjour.")).rejects.toThrow(/instructions_refused/);
  });

  it("cuts an improvised reply so Ava's voice can say the line", async () => {
    fake.conversation.sendInterfaceEvent.mockImplementation(async (event: Record<string, unknown>) => {
      fake.sent.push(event);
      if (event.type === "response.create") {
        fake.emit({ type: "session.output_transcript.delta", delta: "What got you calling " });
      }
    });
    const onSpeakStart = vi.fn();
    const output = new NuanceStreamingAvatarOutput(settings, { onSpeakStart }, 1_000, 1_000);
    await output.prepare({ sessionId });
    await expect(output.renderText("Allô… c’est Emma. À qui je parle ?"))
      .rejects.toMatchObject({ name: "AvatarRenderError", started: false });
    expect(fake.sent.at(-1)?.type).toBe("session.output_audio.interrupt");
    expect(onSpeakStart).not.toHaveBeenCalled();
  });

  it("does not count another short reply as Ava's line", async () => {
    fake.conversation.sendInterfaceEvent.mockImplementation(async (event: Record<string, unknown>) => {
      fake.sent.push(event);
      if (event.type === "response.create") {
        fake.emit({ type: "session.output_transcript.delta", delta: "Hey there!" });
        fake.emit({ type: "session.output_audio.done", reason: "completed" });
      }
    });
    const output = new NuanceStreamingAvatarOutput(settings, {}, 1_000, 1_000);
    await output.prepare({ sessionId });
    await expect(output.renderText("Bonjour.")).rejects.toMatchObject({ started: false });
  });
});
