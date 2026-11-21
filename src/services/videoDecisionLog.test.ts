import { describe, expect, it } from "vitest";
import {
  criteriaSummary,
  filterSessions,
  decisionSessionTitle,
  groupBySession,
  loadVideoDecisions,
  playCounts,
  reasonLabel,
  themeFlows,
  videoDecisionJournal,
  VIDEO_DECISION_CANDIDATE_LIMIT,
  type DecisionEventRow,
  type DecisionReader,
  type VideoCatalogEntry,
} from "./videoDecisionLog";

const catalog: VideoCatalogEntry[] = [
  { id: "v-suspendus", title: "Max, Emma et Leo suspendus, tension", themes: ["famille"], characters: ["max"] },
  { id: "v-brouillard", title: "Max pris dans le brouillard", themes: ["brouillard"], characters: ["max"] },
  { id: "v-extrait", title: "Le couteau", themes: ["preuve"], characters: ["max"] },
];

function event(partial: Partial<DecisionEventRow> & Pick<DecisionEventRow, "event_type" | "payload">): DecisionEventRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    session_id: partial.session_id ?? "session-a",
    created_at: partial.created_at ?? "2026-11-20T10:00:00.000Z",
    event_type: partial.event_type,
    turn_id: partial.turn_id ?? "turn-1",
    turn_index: partial.turn_index ?? 3,
    character_key: partial.character_key ?? "max",
    payload: partial.payload,
  };
}

const gmLogs = new Map<string, unknown>([
  ["session-a", [
    { turn_index: 3, labels: { themes: ["famille"], topics: ["Ava"], intentions: ["protéger"] } },
    { turn_index: 4, labels: { themes: ["peur"], topics: [], intentions: [] } },
  ]],
]);

describe("videoDecisionJournal", () => {
  it("bounds candidates, titles and excerpts and keeps the full count", () => {
    const many = Array.from({ length: VIDEO_DECISION_CANDIDATE_LIMIT + 3 }, (_, index) => ({
      id: `id-${index}`,
      title: "T".repeat(120),
    }));
    const fields = videoDecisionJournal({
      mechanism: "overlay",
      candidates: many,
      excluded: [
        { id: "id-0", reason: "cinematic_cooldown" },
        { id: "blocked", reason: "cinematic_cooldown" },
        { id: "other", reason: "ineligible" },
      ],
      replyText: "R".repeat(400),
      userText: "U".repeat(250),
      linkDetail: "name_only",
    });
    expect(fields.mechanism).toBe("overlay");
    expect(fields.candidates).toHaveLength(VIDEO_DECISION_CANDIDATE_LIMIT);
    expect((fields.candidates as { title: string }[])[0].title.length).toBeLessThanOrEqual(80);
    expect(fields.candidateCount).toBe(many.length);
    expect(fields.excluded).toEqual({ cinematic_cooldown: ["id-0", "blocked"], ineligible: ["other"] });
    expect(String(fields.replyExcerpt).length).toBeLessThanOrEqual(300);
    expect(String(fields.userExcerpt).length).toBeLessThanOrEqual(200);
    expect(fields.linkDetail).toBe("name_only");
  });
});

describe("reason labels", () => {
  it("translates known reasons and link details, and keeps an unknown reason as-is", () => {
    expect(reasonLabel("overlay_selection_weak_link")).toBe("lien trop faible");
    expect(reasonLabel("name_only")).toBe("prénom seul");
    expect(reasonLabel("cinematic_cooldown")).toBe("espacement trop court");
    expect(reasonLabel("extract_spacing")).toBe("espacement des extraits");
    expect(reasonLabel("zz_custom_reason")).toBe("zz_custom_reason");
    expect(reasonLabel(null)).toBe("motif non précisé");
  });
});

describe("groupBySession", () => {
  it("joins a legacy overlay choice with its play, the quote and the GM themes", () => {
    const sessions = groupBySession([
      event({
        event_type: "cinematic_recommended",
        created_at: "2026-11-20T10:00:00.000Z",
        payload: {
          videoId: "v-suspendus",
          source: "overlay_selector",
          confidence: 0.8,
          replyCue: "depuis le chalet",
          videoCue: "devant le chalet",
          candidates: 8,
        },
      }),
      event({
        id: "play-1",
        event_type: "cinematic_played",
        created_at: "2026-11-20T10:00:02.000Z",
        payload: { videoId: "v-suspendus" },
      }),
    ], catalog, gmLogs);
    expect(sessions).toHaveLength(1);
    const turn = sessions[0].turns[0];
    expect(turn.outcome).toBe("played");
    expect(turn.mechanism).toBe("overlay");
    expect(turn.videoTitle).toBe("Max, Emma et Leo suspendus, tension");
    expect(turn.quote).toBe("« depuis le chalet » ↔ devant le chalet");
    expect(turn.themes).toEqual(["famille"]);
    expect(turn.degraded).toBe(true);
    expect(turn.candidateCount).toBe(8);
    expect(turn.candidates).toEqual([]);
  });

  it("shows a block with a plain-language reason, excluded videos and a weak-link detail", () => {
    const sessions = groupBySession([
      event({
        event_type: "cinematic_blocked",
        turn_index: 4,
        payload: {
          blockedReason: "overlay_selection_weak_link",
          mechanism: "overlay",
          detail: "name_only",
          linkDetail: "name_only",
          candidates: [{ id: "v-suspendus", title: "court" }],
          candidateCount: 1,
          excluded: { cinematic_cooldown: ["v-brouillard"] },
          replyExcerpt: "Elle parle d'Emma.",
          userExcerpt: "Où est Emma ?",
          rules: { lastVideoTurn: 2 },
        },
      }),
    ], catalog, gmLogs);
    const turn = sessions[0].turns[0];
    expect(turn.outcome).toBe("skipped");
    expect(turn.reasonLabel).toBe("lien trop faible : prénom seul");
    expect(turn.excluded).toEqual([{ reason: "cinematic_cooldown", label: "espacement trop court", videoIds: ["v-brouillard"] }]);
    expect(turn.replyExcerpt).toBe("Elle parle d'Emma.");
    expect(turn.themes).toEqual(["peur"]);
    expect(turn.degraded).toBe(false);
  });

  it("phrases a cooldown with the gap already stored on the event", () => {
    const sessions = groupBySession([
      event({
        event_type: "cinematic_blocked",
        turn_index: 4,
        payload: { blockedReason: "cinematic_cooldown", source: "game_master", rules: { lastVideoTurn: 2 } },
      }),
    ], catalog, gmLogs);
    expect(sessions[0].turns[0].reasonLabel).toBe("espacement : 2 tours depuis la dernière");
    expect(sessions[0].turns[0].mechanism).toBe("game_master");
  });

  it("keeps an unknown block reason visible", () => {
    const sessions = groupBySession([
      event({ event_type: "cinematic_blocked", payload: { blockedReason: "zz_custom_reason" } }),
    ], catalog, new Map());
    expect(sessions[0].turns[0].reasonLabel).toBe("zz_custom_reason");
    expect(sessions[0].turns[0].themes).toEqual([]);
  });

  it("does not treat a cancelled recommendation as a play", () => {
    const sessions = groupBySession([
      event({
        event_type: "cinematic_recommended",
        payload: { videoId: "v-suspendus", mechanism: "game_master", replyCue: "la neige", videoCue: "la neige" },
      }),
      event({
        created_at: "2026-11-20T10:00:05.000Z",
        event_type: "cinematic_blocked",
        payload: { blockedReason: "transition_cancelled", videoId: "v-suspendus" },
      }),
    ], catalog, gmLogs);
    expect(sessions[0].turns).toHaveLength(1);
    expect(sessions[0].turns[0].outcome).toBe("skipped");
    expect(sessions[0].turns[0].reason).toBe("transition_cancelled");
    expect(sessions[0].turns[0].quote).toContain("la neige");
  });
});

describe("playCounts", () => {
  it("counts plays, distinct sessions and the latest play", () => {
    const counts = playCounts([
      event({ id: "1", session_id: "session-a", created_at: "2026-11-19T10:00:00.000Z", event_type: "cinematic_played", payload: { videoId: "v-suspendus" } }),
      event({ id: "2", session_id: "session-b", created_at: "2026-11-21T10:00:00.000Z", event_type: "cinematic_played", payload: { videoId: "v-suspendus" } }),
      event({ id: "3", session_id: "session-a", created_at: "2026-11-20T10:00:00.000Z", event_type: "cinematic_played", turn_index: 4, payload: { videoId: "v-suspendus" } }),
      event({ id: "4", session_id: "session-a", event_type: "cinematic_played", payload: { videoId: "v-extrait" } }),
      event({ id: "5", event_type: "cinematic_blocked", payload: { blockedReason: "cinematic_cooldown" } }),
    ], catalog);
    expect(counts.map((count) => count.videoId)).toEqual(["v-suspendus", "v-extrait"]);
    expect(counts[0]).toMatchObject({ plays: 3, sessions: 2, lastPlayedAt: "2026-11-21T10:00:00.000Z", title: "Max, Emma et Leo suspendus, tension" });
    expect(counts.find((count) => count.videoId === "v-brouillard")).toBeUndefined();
  });
});

describe("themeFlows and criteria", () => {
  const sessions = groupBySession([
    event({
      event_type: "cinematic_recommended",
      payload: { videoId: "v-suspendus", mechanism: "overlay", confidence: 0.8, replyCue: "famille", videoCue: "Leo" },
    }),
    event({ event_type: "cinematic_played", payload: { videoId: "v-suspendus" } }),
    event({
      turn_index: 4,
      turn_id: "turn-2",
      event_type: "cinematic_blocked",
      payload: { blockedReason: "overlay_selection_timeout", mechanism: "overlay", confidence: 0.4 },
    }),
  ], catalog, gmLogs);

  it("follows themes from one played video to the next, and stops when the session does", () => {
    const played = (sessionId: string, turnIndex: number, videoId: string) => [
      event({ session_id: sessionId, turn_index: turnIndex, turn_id: `${sessionId}-${turnIndex}`, event_type: "cinematic_recommended", payload: { videoId, mechanism: "overlay" } }),
      event({ session_id: sessionId, turn_index: turnIndex, turn_id: `${sessionId}-${turnIndex}`, event_type: "cinematic_played", payload: { videoId } }),
    ];
    const logs = new Map<string, unknown>([
      ["session-long", [
        { turn_index: 1, labels: { themes: ["famille"] } },
        { turn_index: 2, labels: { themes: ["secrets"] } },
        { turn_index: 3, labels: { themes: ["deuil"] } },
      ]],
      ["session-short", [
        { turn_index: 1, labels: { themes: ["famille"] } },
        { turn_index: 2, labels: { themes: ["secrets"] } },
      ]],
    ]);
    const chain = groupBySession([
      ...played("session-long", 1, "v-suspendus"),
      ...played("session-long", 2, "v-brouillard"),
      ...played("session-long", 3, "v-extrait"),
      ...played("session-short", 1, "v-suspendus"),
      ...played("session-short", 2, "v-brouillard"),
    ], catalog, logs);
    const evolution = themeFlows(chain).evolution;
    expect(evolution.columns.map((column) => column.label)).toEqual(["Vidéo 1", "Vidéo 2", "Vidéo 3"]);
    expect(evolution.steps[0]).toEqual([expect.objectContaining({ source: "famille", target: "secrets", count: 2 })]);
    expect(evolution.steps[1]).toEqual([expect.objectContaining({ source: "secrets", target: "deuil", count: 1 })]);
    expect(evolution.columns[1].nodes.find((node) => node.name === "secrets")?.count).toBe(2);
    expect(evolution.columns[2].nodes).toEqual([{ name: "deuil", count: 1 }]);
  });

  it("links a GM theme to the video or to the skip, and keeps a skipped turn out of the played-video steps", () => {
    const flows = themeFlows(sessions);
    expect(flows.toVideos).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "famille", target: "Max, Emma et Leo suspendus, tension", count: 1 }),
      expect.objectContaining({ source: "peur", target: expect.stringContaining("aucune vidéo"), count: 1 }),
    ]));
    expect(flows.evolution.columns.map((column) => column.label)).toEqual(["Vidéo 1"]);
    expect(flows.evolution.columns[0].nodes).toEqual([{ name: "famille", count: 1 }]);
    expect(flows.evolution.steps).toEqual([]);
  });

  it("switches dimension and marks a label outside the exported list", () => {
    const withFeelings = groupBySession([
      event({
        event_type: "cinematic_played",
        payload: { videoId: "v-suspendus", mechanism: "overlay" },
      }),
    ], catalog, new Map([["session-a", [{ turn_index: 3, labels: { themes: ["famille"], emotions: ["angoisse"], stakes: ["protéger"] } }]]]));
    const vocabulary = { themes: ["famille"], emotions: ["peur"], stakes: ["protéger"], on_screen: ["Léo"] };
    const flows = themeFlows(withFeelings, { dimension: "emotions", vocabulary });
    expect(flows.toVideos).toEqual([expect.objectContaining({ source: "angoisse (hors liste)" })]);
    expect(themeFlows(withFeelings, { dimension: "stakes", vocabulary }).toVideos[0].source).toBe("protéger");
    expect(withFeelings[0].turns[0].emotions).toEqual(["angoisse"]);
  });

  it("summarises played share, reasons and confidence", () => {
    const summary = criteriaSummary(sessions[0].turns);
    expect(summary.played).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.byReason.map((entry) => entry.reason)).toEqual(["overlay_selection_timeout"]);
    expect(summary.confidence.find((bucket) => bucket.label === "0,8 – 0,9")?.count).toBe(1);
    expect(summary.confidence.find((bucket) => bucket.label === "< 0,5")?.count).toBe(1);
    expect(summary.linkDetails.find((entry) => entry.detail === "quoted_link")?.count).toBe(1);
  });

  it("filters by mechanism and session without dropping the other session's rows from the source", () => {
    expect(filterSessions(sessions, { mechanism: "extract" })).toEqual([]);
    expect(filterSessions(sessions, { mechanism: "cinematic" })[0].turns).toHaveLength(2);
    expect(filterSessions(sessions, { sessionId: "missing" })).toEqual([]);
  });

  it("keeps an interrupt cinematic with the cinematics and ranks confidence by share", () => {
    const mixed = groupBySession([
      event({ turn_id: "a", turn_index: 1, event_type: "cinematic_blocked", payload: { mechanism: "game_master", blockedReason: "cinematic_cooldown", confidence: 0.95 } }),
      event({ turn_id: "b", turn_index: 2, event_type: "cinematic_blocked", payload: { mechanism: "extract", blockedReason: "extract_spacing", confidence: 0.2 } }),
      event({ turn_id: "c", turn_index: 3, event_type: "cinematic_blocked", payload: { mechanism: "overlay", blockedReason: "overlay_selection_timeout", confidence: 0.2 } }),
      event({ turn_id: "d", turn_index: 4, event_type: "cinematic_blocked", payload: { mechanism: "overlay", blockedReason: "overlay_reply_too_short", confidence: 0.2 } }),
    ], catalog, new Map());
    expect(filterSessions(mixed, { mechanism: "cinematic" })[0].turns.map((turn) => turn.mechanism).sort()).toEqual(["game_master", "overlay", "overlay"]);
    expect(filterSessions(mixed, { mechanism: "extract" })[0].turns).toHaveLength(1);
    expect(criteriaSummary(mixed[0].turns).confidence[0]).toMatchObject({ label: "< 0,5", count: 3 });
  });
});

describe("decisionSessionTitle", () => {
  it("uses the custom name, otherwise the same human title as session data, never the id", () => {
    expect(decisionSessionTitle({ id: "session-secret", gm_post_turn_log: null, name: "Lecture avec Ulrich" }, "2026-11-20T10:00:00.000Z")).toBe("Lecture avec Ulrich");
    const titled = decisionSessionTitle({
      id: "session-secret",
      gm_post_turn_log: null,
      environment_id: "sandbox-ulrich",
      started_at: "2026-11-20T10:00:00.000Z",
      ended_at: "2026-11-20T10:20:00.000Z",
      conversation_log: [
        { role: "user", spokenWith: "max", content: "bonjour" },
        { role: "max", content: "salut" },
      ],
    }, "2026-11-20T10:00:00.000Z");
    expect(titled.startsWith("Ulrich ·")).toBe(true);
    expect(titled).toContain("Max");
    expect(titled).not.toContain("session-secret");
    expect(decisionSessionTitle(undefined, "2026-11-20T10:00:00.000Z")).toMatch(/^Session · /);
  });
});

describe("loadVideoDecisions", () => {
  function reader(pages: { events?: DecisionEventRow[]; eventError?: string; videos?: VideoCatalogEntry[]; videoError?: string; logs?: { id: string; gm_post_turn_log: unknown }[]; logError?: string }): DecisionReader {
    return {
      async events() {
        return { data: pages.eventError ? null : pages.events ?? [], error: pages.eventError ? { message: pages.eventError } : null };
      },
      async videos() {
        return { data: pages.videoError ? null : pages.videos ?? [], error: pages.videoError ? { message: pages.videoError } : null };
      },
      async sessionLogs() {
        return { data: pages.logError ? null : pages.logs ?? [], error: pages.logError ? { message: pages.logError } : null };
      },
    };
  }

  it("reports a successful empty read instead of a confirmed absence", async () => {
    const report = await loadVideoDecisions({ sinceDays: 7, now: new Date("2026-11-21T12:00:00.000Z"), reader: reader({}) });
    expect(report.zeroRows).toBe(true);
    expect(report.error).toBeNull();
    expect(report.turns).toEqual([]);
  });

  it("surfaces a read error and an unreadable catalogue", async () => {
    const failed = await loadVideoDecisions({ sinceDays: 30, reader: reader({ eventError: "permission denied" }) });
    expect(failed.error).toBe("permission denied");
    expect(failed.zeroRows).toBe(false);
    const hidden = await loadVideoDecisions({
      sinceDays: 30,
      reader: reader({
        events: [event({ event_type: "cinematic_played", payload: { videoId: "v-suspendus" } })],
        videoError: "rls",
      }),
    });
    expect(hidden.catalogUnreadable).toBe(true);
    expect(hidden.playCounts[0].title).toBe("v-suspendus");
    expect(hidden.themesUnreadable).toBe(false);
  });
});
