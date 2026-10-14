import { describe, expect, it, vi } from "vitest";
import { createAcousticInterruptionController, recognizedWordsChanged, withoutRejectedPrefix } from "./handsFreeVoice";

function setup() {
  const output = { attenuate: vi.fn(() => true), pause: vi.fn(() => true), resume: vi.fn(() => true), playedText: () => "Je ne sais pas où est Ava." };
  const observe = vi.fn(), confirm = vi.fn(), recover = vi.fn();
  return { output, observe, confirm, recover, controller: createAcousticInterruptionController({ observe, confirm, recover }) };
}
describe("acoustic candidates at the output/recognition seam", () => {
  it("retires rejected echo without losing the following utterance or a punctuation revision", () => {
    const s = setup(); let rejected = "";
    const controller = createAcousticInterruptionController({ observe: s.observe, confirm: s.confirm, recover: s.recover, discard: text => { rejected = text; } });
    controller.signal(true, 0, s.output, "");
    expect(controller.transcript("où est Ava", 20)).toBe(false);
    expect(withoutRejectedPrefix("Où est Ava. Bonjour Max", rejected)).toBe("Bonjour Max");
    expect(withoutRejectedPrefix("bonjour Max", rejected)).toBe("bonjour Max");
    expect(withoutRejectedPrefix("Où est Ava?", rejected)).toBe("");
    expect(s.confirm).not.toHaveBeenCalled();
  });
  it("attenuates immediately, suspends persistent voice, and confirms one word", () => {
    const s = setup(); s.controller.signal(true, 0, s.output, "");
    expect(s.output.attenuate).toHaveBeenCalledOnce(); expect(s.confirm).not.toHaveBeenCalled();
    s.controller.signal(true, 150, s.output, ""); expect(s.output.pause).toHaveBeenCalledOnce();
    expect(s.controller.transcript("non", 170)).toBe(true); expect(s.confirm).toHaveBeenCalledWith("non");
    expect(s.output.resume).not.toHaveBeenCalled();
    expect(new Set(s.observe.mock.calls.map(([event]) => event.interruption_id)).size).toBe(1);
  });
  it("resumes cough/noise without confirming or changing the turn", () => {
    const s = setup(); s.controller.signal(true, 0, s.output, ""); s.controller.signal(false, 1500, s.output, "");
    expect(s.output.resume).toHaveBeenCalledOnce(); expect(s.confirm).not.toHaveBeenCalled(); expect(s.controller.pending).toBe(false);
  });
  it("reversibly releases a suspended candidate when the microphone is switched off", () => {
    const s = setup();s.controller.signal(true, 0, s.output, "");s.controller.signal(true, 180, s.output, "");
    s.controller.reset();expect(s.output.resume).toHaveBeenCalledOnce();expect(s.confirm).not.toHaveBeenCalled();expect(s.controller.pending).toBe(false);
  });
  it("never resumes on expiration during voice; recovers at the bound", () => {
    const s = setup(); s.controller.signal(true, 0, s.output, "");
    s.controller.signal(true, 1600, s.output, ""); expect(s.output.resume).not.toHaveBeenCalled();
    s.controller.signal(true, 8001, s.output, ""); expect(s.recover).toHaveBeenCalledOnce(); expect(s.confirm).not.toHaveBeenCalled();
  });
  it("rejects only a contiguous played phrase, preserving corrections", () => {
    const s = setup(); s.controller.signal(true, 0, s.output, "");
    expect(s.controller.transcript("où est Ava", 20)).toBe(false); expect(s.output.resume).toHaveBeenCalledOnce();
    s.controller.signal(true, 100, s.output, ""); expect(s.controller.transcript("Ava sait où je suis", 120)).toBe(true);
  });
  it("correlates new words and ignores duplicate callbacks", () => {
    const s = setup(); s.controller.signal(true, 100, s.output, "Ancien écho");
    expect(s.controller.transcript("Ancien écho", 110)).toBe(false);
    expect(s.controller.transcript("Ancien écho attends", 120)).toBe(true); expect(s.confirm).toHaveBeenCalledWith("attends");
    expect(s.controller.transcript("attends", 130)).toBe(false);
    expect(recognizedWordsChanged("Oui.", "oui")).toBe(false); expect(recognizedWordsChanged("oui", "oui oui")).toBe(true);
  });
  it("rejects a quiet STT failure and recovers during active voice", () => {
    const s = setup(); s.controller.signal(true, 0, s.output, ""); s.controller.signal(false, 400, s.output, "");
    s.controller.sttFailed(800); expect(s.output.resume).toHaveBeenCalledOnce();
    s.controller.signal(true, 900, s.output, ""); s.controller.sttFailed(1000); expect(s.recover).toHaveBeenCalledOnce(); expect(s.confirm).not.toHaveBeenCalled();
  });
});
