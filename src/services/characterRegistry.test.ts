import { describe, expect, it } from "vitest";
import { createCharacterRegistry, registeredCharacter } from "./characterRegistry";

describe("character registry", () => {
  it("accepts a third fictional character without a branch in the engine", () => {
    const registry = createCharacterRegistry([
      { key: "max", displayName: "Max", availability: "active" },
      { key: "emma", displayName: "Emma", availability: "active" },
      { key: "sam", displayName: "Sam", availability: "active" },
    ] as const);

    expect(registeredCharacter(registry, "sam")).toEqual({
      key: "sam",
      displayName: "Sam",
      availability: "active",
    });
  });

  it("does not silently replace an unknown identity with Max", () => {
    const registry = createCharacterRegistry([
      { key: "max", displayName: "Max", availability: "active" },
    ] as const);
    expect(registeredCharacter(registry, undefined)).toBeNull();
    expect(registeredCharacter(registry, "unknown")).toBeNull();
  });
});
