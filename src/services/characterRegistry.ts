export type CharacterAvailability = "active" | "unavailable";

export interface CharacterRegistryEntry<Key extends string = string> {
  key: Key;
  displayName: string;
  availability: CharacterAvailability;
}

export interface CharacterRegistry<Key extends string = string> {
  entries: readonly CharacterRegistryEntry<Key>[];
  byKey: ReadonlyMap<Key, CharacterRegistryEntry<Key>>;
}

export function createCharacterRegistry<Key extends string>(
  entries: readonly CharacterRegistryEntry<Key>[],
): CharacterRegistry<Key> {
  const byKey = new Map<Key, CharacterRegistryEntry<Key>>();
  for (const entry of entries) {
    if (!entry.key.trim()) throw new Error("Character registry key is required");
    if (!entry.displayName.trim()) throw new Error(`Character ${entry.key} has no display name`);
    if (byKey.has(entry.key)) throw new Error(`Duplicate character registry key: ${entry.key}`);
    byKey.set(entry.key, entry);
  }
  return { entries, byKey };
}

export const AVA_CHARACTER_REGISTRY = createCharacterRegistry([
  { key: "max", displayName: "Max", availability: "active" },
  { key: "emma", displayName: "Emma", availability: "active" },
  { key: "ava", displayName: "Ava", availability: "unavailable" },
  { key: "leo", displayName: "Léo", availability: "unavailable" },
] as const);

export function registeredCharacter<Key extends string>(
  registry: CharacterRegistry<Key>,
  rawKey: unknown,
): CharacterRegistryEntry<Key> | null {
  if (typeof rawKey !== "string") return null;
  return registry.byKey.get(rawKey.trim().toLocaleLowerCase("fr") as Key) ?? null;
}

export function displayNameForCharacter(characterKey: string): string {
  const registered = registeredCharacter(AVA_CHARACTER_REGISTRY, characterKey);
  if (registered) return registered.displayName;
  const clean = characterKey.replace(/[-_]+/g, " ").trim();
  return clean ? clean.charAt(0).toLocaleUpperCase("fr") + clean.slice(1) : "Personnage";
}
