import { expect, test, type Page, type Route } from "@playwright/test";

const PROJECT_ID = "iralfqlslqndgvexixis";
const SUPABASE_ORIGIN = `https://${PROJECT_ID}.supabase.co`;
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const CHARACTER_ID = "22222222-2222-4222-8222-222222222222";
const ANONYMOUS_USER_ID = "33333333-3333-4333-8333-333333333333";

const TRANSCRIPTS = [
  "Où étais-tu la dernière fois que tu as vu Ava ?",
  "Pourquoi ne fais-tu pas confiance à la police ?",
  "Quel souvenir important gardes-tu de ta sœur ?",
];

interface NetworkFakeOptions {
  failMaxAt?: number;
  dropRagAt?: number;
  triggerVideoAtLabel?: number;
  ttsSuccess?: boolean;
  maxResponse?: string;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  });
}

async function installNetworkFakes(
  page: Page,
  transcripts: string[] = TRANSCRIPTS,
  options: NetworkFakeOptions = {},
) {
  let maxTurnCount = 0;
  let labelCallCount = 0;
  let ragCallCount = 0;
  let summaryCallCount = 0;
  let summaryLastTurn = 0;
  let simulatedNetworkDrops = 0;
  let triggeredVideoLoads = 0;
  const maxMessageCounts: number[] = [];
  const sessionUpdates: unknown[] = [];

  await page.addInitScript(({ transcripts, simulateAudio }: { transcripts: string[]; simulateAudio: boolean }) => {
    let websocketIndex = 0;
    localStorage.setItem("ava_gameplay_settings", JSON.stringify({ RAG_SUMMARY_EVERY_N_TURNS: 4 }));

    if (simulateAudio) {
      type AudioTestWindow = Window & {
        __e2eLongAudio?: boolean;
        __e2eAudioState?: { ended: number; paused: number };
      };
      const testWindow = window as AudioTestWindow;
      testWindow.__e2eAudioState = { ended: 0, paused: 0 };

      class E2EAudio {
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        onplaying: (() => void) | null = null;
        ontimeupdate: (() => void) | null = null;
        private endTimer: number | null = null;
        private progressTimer: number | null = null;

        private clearTimers() {
          if (this.endTimer !== null) window.clearTimeout(this.endTimer);
          if (this.progressTimer !== null) window.clearInterval(this.progressTimer);
          this.endTimer = null;
          this.progressTimer = null;
        }

        play() {
          const durationMs = testWindow.__e2eLongAudio ? 1_200 : 10;
          this.onplaying?.();
          this.progressTimer = window.setInterval(() => this.ontimeupdate?.(), 100);
          this.endTimer = window.setTimeout(() => {
            this.clearTimers();
            if (testWindow.__e2eAudioState) testWindow.__e2eAudioState.ended += 1;
            this.onended?.();
          }, durationMs);
          return Promise.resolve();
        }

        pause() {
          this.clearTimers();
          if (testWindow.__e2eAudioState) testWindow.__e2eAudioState.paused += 1;
        }
      }

      Object.defineProperty(window, "Audio", { configurable: true, value: E2EAudio });
    }

    class E2EWebSocket {
      static readonly OPEN = 1;
      readyState = E2EWebSocket.OPEN;
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;

      constructor(url: string | URL) {
        const isDeepgram = String(url).startsWith("wss://api.deepgram.com/");
        const transcript = isDeepgram
          ? transcripts[websocketIndex++] ?? `Tour simulé ${websocketIndex}`
          : "";
        setTimeout(() => {
          this.onopen?.();
          if (!isDeepgram) return;
          setTimeout(() => this.onmessage?.(new MessageEvent("message", {
            data: JSON.stringify({
              type: "Results",
              is_final: false,
              channel: { alternatives: [{ transcript }] },
            }),
          })), 50);
        }, 0);
      }

      send() {}
      close() {
        this.readyState = 3;
        this.onclose?.();
      }
    }

    class E2EMediaRecorder {
      static isTypeSupported() { return true; }
      state: "inactive" | "recording" = "inactive";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; }
    }

    const fakeStream = {
      getTracks: () => [{ stop() {} }],
      getAudioTracks: () => [{ stop() {} }],
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => fakeStream },
    });
    Object.defineProperty(window, "WebSocket", { configurable: true, value: E2EWebSocket });
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: E2EMediaRecorder });
  }, { transcripts, simulateAudio: options.ttsSuccess === true });

  await page.route("https://play.gumlet.io/**", (route) => {
    if (route.request().url().includes("e2e-family")) triggeredVideoLoads += 1;
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><title>Gumlet fake</title><script>
        const ready = () => parent.postMessage(JSON.stringify({
          context: "player.js",
          version: "3.0",
          event: "ready",
          value: { src: location.href, events: ["ready", "play", "ended"], methods: ["play", "unmute", "setVolume"] }
        }), "*");
        ready(); setTimeout(ready, 100); setTimeout(ready, 300);
      </script>`,
    });
  });
  await page.route("https://gamilab.ch/**", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await page.route("https://eu.i.posthog.com/**", (route) => route.fulfill({ status: 200, body: "{}" }));

  await page.route(`${SUPABASE_ORIGIN}/auth/v1/signup`, (route) => json(route, {
    access_token: "e2e-anonymous-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "e2e-anonymous-refresh-token",
    user: {
      id: ANONYMOUS_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: true,
      app_metadata: { provider: "anonymous", providers: ["anonymous"] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  }));

  await page.route(`${SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();

    if (table === "video_triggers") {
      return json(route, options.triggerVideoAtLabel ? [{
        id: "44444444-4444-4444-8444-444444444444",
        notion_id: null,
        title: "Famille E2E",
        type: "interlude",
        themes: ["famille"],
        video_url: "https://play.gumlet.io/embed/e2e-family",
        context: "Max vient de revoir un souvenir familial.",
        description: "Vidéo simulée pour le test d'endurance.",
        priority: 1,
        transition_style: "fade_black",
        post_video_context: "Le souvenir familial vient d'être montré.",
        updated_at: new Date().toISOString(),
      }] : []);
    }
    if (table === "session_summaries") {
      return json(route, summaryLastTurn > 0 ? [{
        session_id: SESSION_ID,
        summary: "- Résumé E2E borné.",
        last_turn: summaryLastTurn,
        updated_at: new Date().toISOString(),
      }] : []);
    }
    if (table === "admin_settings") {
      if (url.searchParams.get("key") === "eq.ava_gameplay_settings") {
        return json(route, { value: { TIMEOUT_SECONDS: 930 } });
      }
      return json(route, null);
    }
    if (table === "character_prompts") {
      return json(route, []);
    }
    if (table === "characters") {
      return json(route, [{
        id: CHARACTER_ID,
        name: "Max Lorenzo",
        system_prompt: "Tu es Max. Tu réponds en français avec concision.",
        personality: "méfiant mais sincère",
      }]);
    }
    if (table === "sessions" && request.method() === "POST") {
      return json(route, { id: SESSION_ID }, 201);
    }
    if (table === "sessions" && request.method() === "PATCH") {
      sessionUpdates.push(request.postDataJSON());
      return json(route, []);
    }
    return json(route, [], request.method() === "POST" ? 201 : 200);
  });

  await page.route(`${SUPABASE_ORIGIN}/functions/v1/**`, async (route) => {
    const request = route.request();
    const functionName = new URL(request.url()).pathname.split("/").pop();
    expect(request.headers().authorization).toBe("Bearer e2e-anonymous-access-token");

    if (functionName === "proxy-stt") {
      return json(route, { key: "e2e-short-lived-token", expires_in: 60, model: "nova-2", language: "fr" });
    }
    if (functionName === "query-rag") {
      ragCallCount += 1;
      if (ragCallCount === options.dropRagAt) {
        simulatedNetworkDrops += 1;
        return route.abort("internetdisconnected");
      }
      return json(route, { matches: [], embedding_provider: "e2e", rerank_used: false, latency_ms: 1 });
    }
    if (functionName === "proxy-tts") {
      if (options.ttsSuccess) {
        return route.fulfill({ status: 200, contentType: "audio/mpeg", body: "e2e-audio" });
      }
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "TTS disabled in E2E" }) });
    }
    if (functionName === "proxy-llm") {
      const payload = request.postDataJSON() as { messages?: Array<{ role: string; content: string }> };
      const system = payload.messages?.[0]?.content ?? "";
      let content: string;
      if (system.includes("analyste du Game Master")) {
        labelCallCount += 1;
        content = JSON.stringify(
          labelCallCount === options.triggerVideoAtLabel
            ? { themes: ["famille"], topics: [], intentions: ["question"] }
            : { themes: [], topics: [], intentions: [] },
        );
      } else if (system.includes("Game Master") || system.includes("end_recommended")) {
        content = JSON.stringify({
          labels: { themes: [], topics: [], intentions: [] },
          engagement_delta: 0,
          confusion_detected: false,
          role_usage_quality: "medium",
          topics_covered: [],
          transition_recommended: false,
          cinematic_hint: null,
          next_turn_guidance: "Continuer l'échange.",
          end_recommended: false,
          moderation_flag: false,
          notes: "e2e",
          trigger_video_id: null,
        });
      } else {
        maxTurnCount += 1;
        maxMessageCounts.push(payload.messages?.length ?? 0);
        if (maxTurnCount === options.failMaxAt) {
          return json(route, { error: "simulated_provider_failure" }, 503);
        }
        content = options.maxResponse ?? `Réponse de Max pour le tour ${maxTurnCount}.`;
      }
      return json(route, {
        id: `generation-${maxTurnCount}`,
        model: "e2e-model",
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
      });
    }
    if (functionName === "summarize-session") {
      summaryCallCount += 1;
      const payload = request.postDataJSON() as { turn_count?: number };
      summaryLastTurn = payload.turn_count ?? summaryLastTurn;
      return json(route, {
        summary: "- Résumé E2E borné.",
        last_turn: payload.turn_count ?? 0,
        latency_ms: 1,
      });
    }
    return json(route, {});
  });

  return {
    getMaxTurnCount: () => maxTurnCount,
    getMaxMessageCounts: () => maxMessageCounts,
    getSummaryCallCount: () => summaryCallCount,
    getSimulatedNetworkDrops: () => simulatedNetworkDrops,
    getTriggeredVideoLoads: () => triggeredVideoLoads,
    getSessionUpdates: () => sessionUpdates,
  };
}

test("parcours PRD4 heureux avec trois tours de conversation", async ({ page }) => {
  const fakes = await installNetworkFakes(page);

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Commencer" })).toBeEnabled();
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await expect(page.getByRole("heading", { name: "À qui veux-tu parler ?" })).toBeVisible();
  await expect(page.getByText(/poser une question, exprimer une émotion/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Appeler Max" }).click();
  await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeVisible({ timeout: 10_000 });

  for (let turn = 1; turn <= 3; turn += 1) {
    await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
    await expect(page.getByText(new RegExp(TRANSCRIPTS[turn - 1].slice(0, 24)))).toBeVisible();
    await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();
    await expect(page.getByText(`Réponse de Max pour le tour ${turn}.`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled();
  }

  expect(fakes.getMaxTurnCount()).toBe(3);
  expect(fakes.getSessionUpdates().length).toBeGreaterThanOrEqual(1);
});

test("une réponse vocale plus longue que le watchdog est lue jusqu'au bout", async ({ page }) => {
  const longResponse = "D'accord, je vais reprendre calmement. La tension à la maison est palpable. Emma et moi ne nous parlons presque plus, et Léo comme Ava restent profondément affectés. J'essaie de les protéger sans toujours savoir si je fais les bons choix.";
  await installNetworkFakes(page, ["Raconte-moi toute la suite sans couper."], {
    ttsSuccess: true,
    maxResponse: longResponse,
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await page.getByRole("button", { name: "Appeler Max" }).click();
  await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled({ timeout: 10_000 });

  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await page.evaluate(() => {
    (window as Window & { __e2eLongAudio?: boolean }).__e2eLongAudio = true;
  });
  await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();

  await expect(page.getByText(longResponse)).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => page.evaluate(() =>
    (window as Window & { __e2eAudioState?: { ended: number } }).__e2eAudioState?.ended ?? 0,
  )).toBeGreaterThanOrEqual(2);
  const audioState = await page.evaluate(() =>
    (window as Window & { __e2eAudioState?: { ended: number; paused: number } }).__e2eAudioState,
  );
  expect(audioState?.paused).toBe(0);
  await expect(page.getByText("Le tour a pris trop de temps")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled();
});

test("endurance accélérée de 35 tours avec mémoire bornée et pannes récupérables", async ({ page }) => {
  test.setTimeout(180_000);
  const transcripts = Array.from({ length: 35 }, (_, index) =>
    `Question d'endurance numéro ${index + 1} à propos de Max et Ava.`,
  );
  const fakes = await installNetworkFakes(page, transcripts, {
    triggerVideoAtLabel: 3,
    dropRagAt: 12,
    failMaxAt: 18,
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await page.getByRole("button", { name: "Appeler Max" }).click();
  await expect(page.getByLabel("Temps restant")).toHaveText(/15:30|15:29/, { timeout: 10_000 });

  for (let turn = 1; turn <= 35; turn += 1) {
    await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
    await expect(page.getByText(transcripts[turn - 1], { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();

    const skipVideo = page.getByRole("button", { name: /Passer/ });
    if (turn === 3) {
      await expect(skipVideo).toBeVisible({ timeout: 10_000 });
      await skipVideo.click();
    }

    const expected = turn === 18
      ? /la ligne accroche/i
      : new RegExp(`Réponse de Max pour le tour ${turn}`);
    await expect(page.getByText(expected)).toBeVisible({ timeout: 10_000 });

    if (turn !== 3 && await skipVideo.isVisible().catch(() => false)) {
      await skipVideo.click();
    }
    await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled();
  }

  expect(fakes.getMaxTurnCount()).toBe(35);
  expect(Math.max(...fakes.getMaxMessageCounts())).toBeLessThanOrEqual(12);
  await expect.poll(fakes.getSummaryCallCount, { timeout: 5_000 }).toBeGreaterThanOrEqual(8);
  expect(fakes.getSimulatedNetworkDrops()).toBe(1);
  expect(fakes.getTriggeredVideoLoads()).toBeGreaterThanOrEqual(1);
  expect(fakes.getSessionUpdates().length).toBeGreaterThanOrEqual(35);
});
