import { describe, expect, it, vi } from "vitest";
import {
  buildTavusEchoAudioCommand,
  buildTavusEchoCommand,
  buildTavusInterruptCommand,
  buildTavusSetEmotionCommand,
  sendHeyGenListening,
  stripTavusEmotionTags,
  sendHeyGenSpeakText,
  TAVUS_ECHO_AUDIO_CHUNK_MS,
  TAVUS_ECHO_AUDIO_SAMPLE_RATE,
  TAVUS_ECHO_EMOTION_TAGS,
} from "./protocolCommands";
import { TAVUS_ECHO_EMOTIONS, type TavusEchoEmotion } from "./types";

describe("streaming avatar direct text protocols", () => {
  it("passes HeyGen the exact Ava text through avatar.speak_text", () => {
    const repeat = vi.fn(() => "command-1");
    const text = "Bonjour…  espaces, ponctuation !\nEt deuxième ligne.";

    expect(sendHeyGenSpeakText({ repeat }, text)).toBe("command-1");
    expect(repeat).toHaveBeenCalledOnce();
    expect(repeat).toHaveBeenCalledWith(text);
  });

  it("builds only a Tavus conversation.echo text command", () => {
    const text = "Texte exact : ne rien résumer, ni reformuler.";
    const command = buildTavusEchoCommand("conversation-1", text);

    expect(command).toEqual({
      message_type: "conversation",
      event_type: "conversation.echo",
      conversation_id: "conversation-1",
      properties: { modality: "text", text, done: true },
    });
    expect(JSON.stringify(command)).not.toContain("conversation.respond");
  });

  it("builds the Tavus conversation.set_emotion command with the documented shape", () => {
    expect(buildTavusSetEmotionCommand("conversation-1", "sadness")).toEqual({
      message_type: "conversation",
      event_type: "conversation.set_emotion",
      conversation_id: "conversation-1",
      properties: { emotion: "sadness" },
    });
  });

  it("prefixes every Tavus echo with the Echo-mode emotion tag", () => {
    const command = buildTavusEchoCommand("conversation-1", "Je n'en peux plus.", "dejected");
    expect(command.properties.text).toBe('<emotion value="dejected"/> Je n\'en peux plus.');
    expect(stripTavusEmotionTags(command.properties.text)).toBe("Je n'en peux plus.");
  });

  it("accepts each of the 11 Echo values directly, decoupled from set_emotion", () => {
    for (const value of TAVUS_ECHO_EMOTIONS) {
      expect(buildTavusEchoCommand("c", "Oui.", value).properties.text).toBe(`<emotion value="${value}"/> Oui.`);
    }
    expect(TAVUS_ECHO_EMOTIONS).toHaveLength(11);
  });

  it("never writes a tag for a value outside the Echo list", () => {
    const injected = 'dejected"/><x' as unknown as TavusEchoEmotion;
    expect(buildTavusEchoCommand("c", "Oui.", injected).properties.text).toBe("Oui.");
    expect(buildTavusEchoCommand("c", "Oui.", "sadness" as unknown as TavusEchoEmotion).properties.text).toBe("Oui.");
  });

  it("keeps the legacy set_emotion → Echo table for settings saved before", () => {
    expect(TAVUS_ECHO_EMOTION_TAGS.sadness).toBe("dejected");
    expect(TAVUS_ECHO_EMOTION_TAGS.happiness).toBe("content");
    expect(Object.values(TAVUS_ECHO_EMOTION_TAGS).every((tag) => TAVUS_ECHO_EMOTIONS.includes(tag))).toBe(true);
  });

  it("strips Echo tags written with other quotes, case or spacing", () => {
    expect(stripTavusEmotionTags("<emotion value='sad'/>Bon.")).toBe("Bon.");
    expect(stripTavusEmotionTags('<Emotion  value = "Dejected" />  Bon. <emotion value="neutral">Fin.')).toBe("Bon. Fin.");
    expect(stripTavusEmotionTags("Sans balise <émotion>.")).toBe("Sans balise <émotion>.");
  });

  it("interrupts Tavus with conversation.interrupt on the bound conversation", () => {
    expect(buildTavusInterruptCommand("conversation-1")).toEqual({
      message_type: "conversation",
      event_type: "conversation.interrupt",
      conversation_id: "conversation-1",
    });
  });

  it("maps the HeyGen listening posture to start/stop_listening", () => {
    const session = { startListening: vi.fn(() => "start"), stopListening: vi.fn(() => "stop") };
    expect(sendHeyGenListening(session, true)).toBe("start");
    expect(sendHeyGenListening(session, false)).toBe("stop");
    expect(session.startListening).toHaveBeenCalledOnce();
    expect(session.stopListening).toHaveBeenCalledOnce();
  });
});

describe("Tavus Echo audio command", () => {
  it("matches the format verified on a real conversation", () => {
    expect(buildTavusEchoAudioCommand("c1", "AAA=", TAVUS_ECHO_AUDIO_SAMPLE_RATE, "ava-t1-1", true)).toEqual({
      message_type: "conversation",
      event_type: "conversation.echo",
      conversation_id: "c1",
      properties: { modality: "audio", audio: "AAA=", sample_rate: 24_000, inference_id: "ava-t1-1", done: true },
    });
    expect(TAVUS_ECHO_AUDIO_CHUNK_MS).toBe(250);
  });
});
