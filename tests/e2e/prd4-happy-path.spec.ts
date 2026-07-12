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

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  });
}

async function installNetworkFakes(page: Page) {
  let maxTurnCount = 0;
  const sessionUpdates: unknown[] = [];

  await page.addInitScript((transcripts: string[]) => {
    let websocketIndex = 0;

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
  }, TRANSCRIPTS);

  await page.route("https://play.gumlet.io/**", (route) =>
    route.fulfill({
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
    }),
  );
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

    if (table === "admin_settings" || table === "video_triggers" || table === "character_prompts" || table === "session_summaries") {
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
      return json(route, [{ id: SESSION_ID }], 201);
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
      return json(route, { matches: [], embedding_provider: "e2e", rerank_used: false, latency_ms: 1 });
    }
    if (functionName === "proxy-tts") {
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "TTS disabled in E2E" }) });
    }
    if (functionName === "proxy-llm") {
      const payload = request.postDataJSON() as { messages?: Array<{ role: string; content: string }> };
      const system = payload.messages?.[0]?.content ?? "";
      let content: string;
      if (system.includes("extrait uniquement") || system.includes("labels")) {
        content = JSON.stringify({ themes: [], topics: [], intentions: [] });
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
        content = `Réponse de Max pour le tour ${maxTurnCount}.`;
      }
      return json(route, {
        id: `generation-${maxTurnCount}`,
        model: "e2e-model",
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
      });
    }
    return json(route, {});
  });

  return {
    getMaxTurnCount: () => maxTurnCount,
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
