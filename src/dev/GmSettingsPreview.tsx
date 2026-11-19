import GameMasterSettingsTab from "@/components/GameMasterSettingsTab";
import { DEFAULT_DIRECTOR_CONFIG } from "@/services/experienceOrchestration";
import type { ExperienceOrchestrationVersion } from "@/services/experienceOrchestration";

const AT = "2026-11-19T12:00:00.000Z";

/** Offline fixtures: a draft and the builtin baseline pinned in sandbox-romed / sandbox-benoit. */
const VERSIONS: ExperienceOrchestrationVersion[] = [
  { id: "preview-draft", version_number: 14, status: "draft", name: "Brouillon d'aperçu", prompt: "builtin://experience-director/v1",
    config: DEFAULT_DIRECTOR_CONFIG, source_version_id: null, published_at: null, archived_at: null, created_at: AT, updated_at: AT,
    environment_id: "sandbox-ulrich" },
  { id: "preview-builtin", version_number: 4, status: "published", name: "Baseline PRD4 intégrée — Romed",
    prompt: "builtin://experience-director/v1",
    config: { schemaVersion: 1, directorTimeoutMs: 12000, minimumHandoffTurn: 4, maximumHandoffsPerSession: 1 } as never,
    source_version_id: null, published_at: AT, archived_at: null, created_at: AT, updated_at: AT, environment_id: "sandbox-romed" },
];

export default function GmSettingsPreview() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground lg:p-10">
      <div className="mx-auto max-w-6xl">
        <GameMasterSettingsTab previewVersions={VERSIONS} />
      </div>
    </main>
  );
}
