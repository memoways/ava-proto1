import { describe, expect, it } from "vitest";
import { getSTTProviderDefinition, STT_PROVIDER_LIST } from "./registry";

describe("STT provider registry", () => {
  it("exposes every configured STT provider", () => {
    expect(STT_PROVIDER_LIST.map((provider) => provider.id)).toEqual([
      "deepgram",
      "gamilab",
      "openai_whisper",
      "assemblyai",
      "gradium",
    ]);
  });

  it("uses Deepgram as the fallback provider definition", () => {
    expect(getSTTProviderDefinition("deepgram")?.implemented).toBe(true);
    expect(getSTTProviderDefinition("unknown" as never)?.id).toBe("deepgram");
  });
});
