import { describe, expect, it, vi } from "vitest";
import {
  buildTavusEchoCommand,
  sendHeyGenSpeakText,
} from "./protocolCommands";

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
});
