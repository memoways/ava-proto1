import { describe, expect, it } from "vitest";
import { describeUnreadableGmOutput, extractGmJson } from "./gmJsonOutput";

describe("extractGmJson", () => {
  it("reads a plain, fenced or surrounded object", () => {
    expect(extractGmJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractGmJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractGmJson('Voici "la" décision : {"a":1} — fin.')).toEqual({ a: 1 });
  });

  it("ignores braces inside strings", () => {
    expect(extractGmJson('note {"a":"x } y { z"}')).toEqual({ a: "x } y { z" });
  });

  it("returns undefined when nothing can be read", () => {
    expect(extractGmJson("")).toBeUndefined();
    expect(extractGmJson("pas de JSON")).toBeUndefined();
    expect(extractGmJson('{"a":1,"b":')).toBeUndefined();
  });
});

describe("describeUnreadableGmOutput", () => {
  it("classifies the shape without keeping any text", () => {
    expect(describeUnreadableGmOutput("", "stop", 0)).toEqual({ output_shape: "empty", finish_reason: "stop", output_chars: 0, completion_tokens: 0 });
    expect(describeUnreadableGmOutput('{"labels":{"themes":["deuil"', "length", 950).output_shape).toBe("truncated");
    expect(describeUnreadableGmOutput('{"labels":{"themes":["deuil"', null, null).output_shape).toBe("truncated");
    expect(describeUnreadableGmOutput("Je ne peux pas évaluer ce tour.", "stop", 9).output_shape).toBe("no_object");
    expect(describeUnreadableGmOutput('{"a":1,}', "stop", 4).output_shape).toBe("syntax");
    const diagnostic = describeUnreadableGmOutput('{"notes":"secret du joueur"', "length", 12);
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
  });
});
