import { expect, test, type Page, type Route } from "@playwright/test";

const PROJECT_ID = "iralfqlslqndgvexixis";
const SUPABASE_ORIGIN = `https://${PROJECT_ID}.supabase.co`;
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const CHARACTER_ID = "22222222-2222-4222-8222-222222222222";
const EMMA_CHARACTER_ID = "22222222-2222-4222-8222-222222222223";
const ANONYMOUS_USER_ID = "33333333-3333-4333-8333-333333333333";
const E2E_VIDEO_ASSET_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const TRANSCRIPTS = [
  "Où étais-tu la dernière fois que tu as vu Ava ?",
  "Pourquoi ne fais-tu pas confiance à la police ?",
  "Quel souvenir important gardes-tu de ta sœur ?",
];

interface NetworkFakeOptions {
  incrementalOutput?: boolean;
  p2?: boolean;
  gradiumDropAt?: number;
  failMaxAt?: number;
  gmTarget?: "max" | "emma";
  gmStance?: "accept" | "object" | "defer";
  gmHandoffAt?: number;
  failGmAt?: number;
  delayGmMs?: number;
  characterReplies?: string[];
  dropRagAt?: number;
  triggerVideoAtLabel?: number;
  ttsSuccess?: boolean;
  maxResponse?: string;
  ttsBusyOnce?: boolean;
  diagnosticAdmin?: boolean;
  blockTraceUpload?: boolean;
  characterOpenings?: boolean;
  delayCharacterResponseMs?: number;
  whisperResponse?: string;
  delayWhisperResponseMs?: number;
  handsFree?: boolean;
  skipQuestionnaire?: boolean;
  delayFirstSTTFinalMs?: number;
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
  let gmPostTurnCount = 0;
  let ragCallCount = 0;
  let summaryCallCount = 0;
  let summaryLastTurn = 0;
  let simulatedNetworkDrops = 0;
  let triggeredVideoLoads = 0;
  let ttsCallCount = 0;
  const ttsTexts: string[] = [];
  let posthogRequestCount = 0;
  let traceUploadStarted = 0;
  let traceUploadCompleted = 0;
  let whisperReplyCount = 0;
  let releaseTraceUpload: (() => void) | null = null;
  const blockedTraceUpload = new Promise<void>((resolve) => { releaseTraceUpload = resolve; });
  const maxMessageCounts: number[] = [];
  const sessionUpdates: unknown[] = [];
  let sessionInsertCount = 0;
  const experienceEvents: Array<{ event_type: string; event_key: string; payload: Record<string, unknown> }> = [];
  const voiceEvents: Array<Record<string, unknown>> = [];
  const gmFilmContexts: string[] = [];
  let sessionMemory: Record<string, unknown> = {};
  let memoryLastTurn = 0;

  await page.addInitScript(({ transcripts, simulateAudio, batchAudio, handsFree, skipQuestionnaire, delayFirstSTTFinalMs, incrementalOutput, gradiumDropAt, p2 }: { transcripts: string[]; simulateAudio: boolean; batchAudio: boolean; handsFree: boolean; skipQuestionnaire: boolean; delayFirstSTTFinalMs: number; incrementalOutput: boolean; gradiumDropAt: number; p2: boolean }) => {
    let websocketIndex = 0;
    let gradiumIndex = 0;
    type E2ETestWindow = Window & {
      __e2eLongAudio?: boolean;
      __e2eAudioState?: { ended: number; paused: number };
      __e2eNativeVideoState?: { playing: boolean; playCount: number; pauseCount: number };
      __e2eSTTFinals?: number;
      __e2eGradiumTexts?: string[];
      __e2eGradiumSetups?: number;
      __e2eGradiumEos?: number;
      __e2eSpeech?: (voiced: boolean) => void;
      __e2eRecognize?: (text: string) => void;
      __e2eLoseMicrophone?: () => void;
    };
    const testWindow = window as E2ETestWindow;
    // These scenarios exercise the PRD4 flow after a successful public gate.
    // Keep the production gate enabled while reproducing its tab-scoped unlock.
    sessionStorage.setItem("ava:public-access:unlocked", "1");
    testWindow.__e2eNativeVideoState = { playing: false, playCount: 0, pauseCount: 0 };
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value() {
        if (this instanceof HTMLVideoElement && testWindow.__e2eNativeVideoState) {
          testWindow.__e2eNativeVideoState.playing = true;
          testWindow.__e2eNativeVideoState.playCount += 1;
        }
        return Promise.resolve();
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value() {
        if (this instanceof HTMLVideoElement && testWindow.__e2eNativeVideoState) {
          testWindow.__e2eNativeVideoState.playing = false;
          testWindow.__e2eNativeVideoState.pauseCount += 1;
        }
      },
    });
    localStorage.setItem("ava:prod:ava_gameplay_settings", JSON.stringify({ RAG_SUMMARY_EVERY_N_TURNS: 4,
      ...(incrementalOutput ? { VOICE_INCREMENTAL_OUTPUT: true } : {}),
      ...(handsFree ? { VOICE_HANDS_FREE: { enabled: true, ...(p2 ? { interruptionStrategy: "acoustic_confirmed" } : {}) } } : {}),
      ...(p2 ? { VOICE_ONLY_UI: true } : {}),
      ...(skipQuestionnaire ? { SHOW_QUESTIONNAIRE: false } : {}),
    }));
    if (batchAudio) localStorage.setItem("ava:prod:ava_stt_settings", JSON.stringify({ activeProvider: "openai_whisper" }));
    // PostHog intentionally filters HeadlessChrome as a bot. Use a regular
    // browser UA so this E2E can attest that real-user telemetry reaches the
    // network without weakening the production bot filter.
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
    });
    Object.defineProperty(navigator, "webdriver", { configurable: true, value: false });
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      value: { brands: [{ brand: "Chromium", version: "149" }, { brand: "Google Chrome", version: "149" }] },
    });

    if (simulateAudio) {
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
      private transcript = "";
      private isGradium = false;
      private gradiumIndex = 0;

      constructor(url: string | URL) {
        this.isGradium = String(url).startsWith("wss://api.gradium.com/") || String(url).startsWith("wss://api.gradium.ai/");
        if (this.isGradium) this.gradiumIndex = ++gradiumIndex;
        const isDeepgram = String(url).startsWith("wss://api.deepgram.com/");
        const transcript = isDeepgram
          ? transcripts[websocketIndex++] ?? `Tour simulé ${websocketIndex}`
          : "";
        this.transcript = transcript;
        if (isDeepgram && p2) testWindow.__e2eRecognize = text => {
          this.transcript = text;
          this.onmessage?.(new MessageEvent("message", { data: JSON.stringify({ type: "Results", is_final: false, channel: { alternatives: [{ transcript: text }] } }) }));
        };
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

      send(data: string | Blob | ArrayBuffer) {
        if (typeof data !== "string") return;
        try {
          const command = JSON.parse(data) as { type?: string; text?: string };
          if (this.isGradium) {
            if (command.type === 'setup') testWindow.__e2eGradiumSetups = (testWindow.__e2eGradiumSetups ?? 0) + 1;
            if (command.type === 'text') {
              if (this.gradiumIndex === gradiumDropAt && command.text === 'Bonjour.') {
                setTimeout(() => this.onmessage?.(new MessageEvent('message',{data:JSON.stringify({type:'text',text:'Bonjour.',start_s:0,stop_s:0.01})})),10);
              }
              testWindow.__e2eGradiumTexts = [...(testWindow.__e2eGradiumTexts ?? []), command.text ?? ''];
              setTimeout(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'audio', audio: btoa('\0'.repeat(p2 ? 230400 : 38400)) }) })), 5);
            }
            if (command.type === 'end_of_stream') {
              testWindow.__e2eGradiumEos = (testWindow.__e2eGradiumEos ?? 0) + 1;
              if (this.gradiumIndex === gradiumDropAt) setTimeout(() => this.onmessage?.(new MessageEvent('message',{data:JSON.stringify({type:'error',message:'simulated_mid_audio_failure'})})),250);
              else setTimeout(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'end_of_stream' }) })), 20);
            }
            return;
          }
          if (command.type !== "Finalize") return;
          testWindow.__e2eSTTFinals = (testWindow.__e2eSTTFinals ?? 0) + 1;
          setTimeout(() => this.onmessage?.(new MessageEvent("message", {
            data: JSON.stringify({
              type: "Results",
              is_final: true,
              from_finalize: true,
              channel: { alternatives: [{ transcript: this.transcript }] },
            }),
          })), testWindow.__e2eSTTFinals === 1 ? delayFirstSTTFinalMs : 0);
        } catch { /* binary audio and unrelated commands are ignored */ }
      }
      close() {
        this.readyState = 3;
        this.onclose?.();
      }
    }

    class E2EMediaRecorder {
      static isTypeSupported() { return true; }
      state: "inactive" | "recording" | "paused" = "inactive";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      private dataAvailableListeners: EventListenerOrEventListenerObject[] = [];
      start() { this.state = "recording"; }
      pause() { this.state = "paused"; }
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === "dataavailable") this.dataAvailableListeners.push(listener);
      }
      requestData() {
        const event = { data: new Blob([batchAudio ? "audio".repeat(300) : "audio"]) } as BlobEvent;
        this.ondataavailable?.(event);
        const listeners = this.dataAvailableListeners.splice(0);
        listeners.forEach((listener) => {
          if (typeof listener === "function") listener(event);
          else listener.handleEvent(event);
        });
      }
      stop() { this.state = "inactive"; }
    }

    if (p2) {
      // The application player and detector run unchanged; only the device/clock
      // are simulated. Linux headless runners have no reliable audio device.
      class CaptureAudioContext {
        state = "running"; sampleRate = 48000; outputLatency = 0; baseLatency = 0;
        destination = {}; audioWorklet = { addModule: async () => {} };
        private origin = performance.now();
        get currentTime() { return (performance.now() - this.origin) / 1000; }
        async resume() { this.state = "running"; }
        async close() { this.state = "closed"; }
        createBuffer(_channels: number, length: number, rate: number) {
          const data = new Float32Array(length);
          return { duration: length / rate, length, sampleRate: rate, getChannelData: () => data };
        }
        createGain() { return { connect() {}, disconnect() {}, gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} } }; }
        createOscillator() { return { frequency: { value: 0, setValueAtTime() {} }, type: "sine", connect(target: unknown) { return target; }, disconnect() {}, start() {}, stop() {} }; }
        createBufferSource() {
          const currentTime = () => this.currentTime;
          let timer: ReturnType<typeof setTimeout> | undefined;
          return { buffer: null as null | { duration: number }, onended: null as null | (() => void), connect() {}, disconnect() {},
            start(at = 0) { timer = setTimeout(() => this.onended?.(), Math.max(0, at - currentTime() + (this.buffer?.duration ?? 0)) * 1000); },
            stop() { clearTimeout(timer); },
          };
        }
        createMediaStreamSource(_stream: MediaStream) { return { connect() {}, disconnect() {} } as unknown as MediaStreamAudioSourceNode; }
      }
      const ports: { onmessage: ((event: { data: unknown }) => void) | null }[] = [];
      class CaptureWorklet {
        port = { onmessage: null as null | ((event: { data: unknown }) => void), close() {}, postMessage() {} };
        constructor() { ports.push(this.port); }
        connect() {} disconnect() {}
      }
      Object.defineProperty(window, "AudioContext", { configurable: true, value: CaptureAudioContext });
      Object.defineProperty(window, "AudioWorkletNode", { configurable: true, value: CaptureWorklet });
      let voiced = false;
      testWindow.__e2eSpeech = value => { voiced = value; };
      setInterval(() => {
        const samples = Float32Array.from({ length: 320 }, (_, i) => voiced ? Math.sin(i * 2 * Math.PI * 200 / 16000) * 0.06 : 0);
        for (const port of ports) port.onmessage?.({ data: { type: "frame", samples } });
      }, 20);
    }
    const fakeStream = {
      getTracks: () => [{ stop() {} }],
      getAudioTracks: () => [{ stop() {}, getSettings: () => ({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 }), addEventListener(type: string, callback: () => void) { if (type === "ended") testWindow.__e2eLoseMicrophone = callback; } }],
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => fakeStream },
    });
    Object.defineProperty(window, "WebSocket", { configurable: true, value: E2EWebSocket });
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: E2EMediaRecorder });
  }, { transcripts, simulateAudio: options.ttsSuccess === true, batchAudio: options.whisperResponse !== undefined,
    handsFree: options.handsFree === true, skipQuestionnaire: options.skipQuestionnaire === true,
    delayFirstSTTFinalMs: options.delayFirstSTTFinalMs ?? 0,
    incrementalOutput: options.incrementalOutput === true, p2: options.p2 === true,
    gradiumDropAt: options.gradiumDropAt ?? -1,
  });

  await page.route("https://video.gumlet.io/**", (route) => {
    if (route.request().url().includes(E2E_VIDEO_ASSET_ID)) triggeredVideoLoads += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/vnd.apple.mpegurl",
      body: "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n",
    });
  });
  await page.route("https://gamilab.ch/**", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await page.route("https://eu.i.posthog.com/**", (route) => {
    posthogRequestCount += 1;
    return route.fulfill({ status: 200, body: "{}" });
  });

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
      email: options.diagnosticAdmin ? "info@memoways.com" : undefined,
      is_anonymous: options.diagnosticAdmin !== true,
      app_metadata: options.diagnosticAdmin
        ? { provider: "email", providers: ["email"] }
        : { provider: "anonymous", providers: ["anonymous"] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  }));

  await page.route(`${SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();

    if (table === 'persist_conversation_memory_v4') {
      const payload=request.postDataJSON();sessionMemory=payload.p_next_memory;memoryLastTurn=payload.p_next_last_turn??memoryLastTurn;
      sessionUpdates.push({conversation_memory:sessionMemory});
      return json(route,{conversation_memory:sessionMemory,memory_last_turn:memoryLastTurn});
    }
    if (table === "get_character_runtime_readiness_for_environment") {
      const input = request.postDataJSON() as { p_character_key: string };
      const character = input.p_character_key;
      return json(route, [{ character_key: character, display_name: character === "emma" ? "Emma" : "Max", enabled: true, ready: true,
        character_id: character === "emma" ? EMMA_CHARACTER_ID : CHARACTER_ID, notion_page_id: "77777777-7777-4777-8777-777777777777", environment_id: "prod", prompt_updated_at: "2026-10-12T00:00:00Z",
        tts_provider: options.incrementalOutput ? "gradium" : "elevenlabs", tts_voice_id: options.characterOpenings ? (character === "emma" ? "e2e-emma-voice" : "e2e-max-voice") : null, opening_line: options.characterOpenings ? `Allô, ici ${character === "emma" ? "Emma" : "Max"}.` : null, portrait_url: null, situation_summary: "Fiche E2E" }]);
    }
    if (table === "pin_current_orchestration_version") {
      return json(route, "66666666-6666-4666-8666-666666666666");
    }
    if (table === "get_pinned_orchestration_runtime") {
      return json(route, [{
        version_id: "66666666-6666-4666-8666-666666666666",
        version_number: 1,
        prompt: "builtin://experience-director-v1",
        config: {
          schemaVersion: 1,
          minimumHandoffTurn: 4,
          maximumHandoffsPerSession: 8,
          minimumTurnsBetweenHandoffs: 2,
          handoffTarget: "either",
          directorTimeoutMs: 12_000,
          editor: {
            tone: "balanced",
            guidanceLength: "balanced",
            priorities: ["narrative_continuity", "player_engagement", "safety", "pace"],
            allowHandoffs: true,
            allowCinematics: true,
            customInstructions: "",
            handoffRules: [],
          },
        },
      }]);
    }
    if (table === "video_triggers") {
      return json(route, options.triggerVideoAtLabel ? [{
        id: "44444444-4444-4444-8444-444444444444",
        notion_id: null,
        title: "Famille E2E",
        type: "interlude",
        themes: ["famille"],
        video_url: `https://play.gumlet.io/embed/${E2E_VIDEO_ASSET_ID}`,
        context: "Max vient de revoir un souvenir familial.",
        description: "Vidéo simulée pour le test d'endurance.",
        priority: 1,
        transition_style: "fade_black",
        post_video_context: "Le souvenir familial vient d'être montré.",
        updated_at: new Date().toISOString(),
      }] : []);
    }
    if (table === "admin_users") {
      return json(route, options.diagnosticAdmin ? {
        user_id: ANONYMOUS_USER_ID,
        display_name: "Production",
        default_environment_id: "prod",
      } : null);
    }
    if (table === "conversation_turn_traces" && request.method() === "POST") {
      traceUploadStarted += 1;
      if (options.blockTraceUpload) await blockedTraceUpload;
      traceUploadCompleted += 1;
      return json(route, { id: "55555555-5555-4555-8555-555555555555" }, 201);
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
        return json(route, [{ environment_id: "prod", value: { TIMEOUT_SECONDS: 930,
          ...(options.incrementalOutput ? { VOICE_INCREMENTAL_OUTPUT: true } : {}),
          ...(options.handsFree ? { VOICE_HANDS_FREE: { enabled: true, ...(options.p2 ? { interruptionStrategy: "acoustic_confirmed" } : {}) } } : {}),
          ...(options.p2 ? { VOICE_ONLY_UI: true } : {}),
          ...(options.skipQuestionnaire ? { SHOW_QUESTIONNAIRE: false } : {}),
        } }]);
      }
      return json(route, []);
    }
    if (table === "character_prompts") {
      const emma = url.searchParams.get("character_id") === `eq.${EMMA_CHARACTER_ID}`;
      const name = emma ? "Emma" : "Max";
      return json(route, [{ character_id: emma ? EMMA_CHARACTER_ID : CHARACTER_ID, environment_id: "prod", characters: { name }, identite_fondamentale: `Tu es ${name}.`, qui_tu_es: "Tu réponds en français.", situation_summary: emma ? "Emma est la mère d’Ava." : "Max est le père d’Ava.", dynamique_conversation: "Écouter et répondre.", ce_que_tu_ne_fais_jamais: "Ne jamais changer d’identité.", timeline: "Avant et après la disparition d’Ava.", updated_at: "2026-10-12T00:00:00Z" }]);
    }
    if (table === "characters") {
      const emma = url.searchParams.get("id") === `eq.${EMMA_CHARACTER_ID}`;
      return json(route, [{
        id: emma ? EMMA_CHARACTER_ID : CHARACTER_ID,
        name: emma ? "Emma Lorenzo" : "Max Lorenzo",
        system_prompt: `Tu es ${emma ? "Emma" : "Max"}. Tu réponds en français avec concision.`,
        personality: "méfiant mais sincère",
      }]);
    }
    if (table === "voice_turn_events" && request.method() === "POST") {
      voiceEvents.push(request.postDataJSON().metadata_json as Record<string, unknown>);
      return json(route, [], 201);
    }
    if (table === "sessions" && request.method() === "POST") {
      sessionMemory = request.postDataJSON()?.conversation_memory ?? {};
      sessionInsertCount += 1;
      return json(route, { id: SESSION_ID }, 201);
    }
    if (table === "experience_events" && request.method() === "POST") {
      experienceEvents.push(request.postDataJSON());
      return json(route, [], 201);
    }
    if (table === "sessions" && request.method() === "PATCH") {
      const patch = request.postDataJSON();
      sessionUpdates.push(patch);
      if (options.incrementalOutput) {
        sessionMemory = patch.conversation_memory ?? sessionMemory;
        memoryLastTurn = patch.memory_last_turn ?? memoryLastTurn;
        return json(route, { conversation_memory: sessionMemory, memory_last_turn: memoryLastTurn });
      }
      return json(route, []);
    }
    if (table === "sessions" && options.incrementalOutput && request.method() === "GET"
      && !url.searchParams.has('ended_at')) {
      return json(route, { conversation_memory: sessionMemory, memory_last_turn: memoryLastTurn, gm_post_turn_log: [] });
    }
    return json(route, [], request.method() === "POST" ? 201 : 200);
  });

  await page.route(`${SUPABASE_ORIGIN}/functions/v1/**`, async (route) => {
    const request = route.request();
    const functionName = new URL(request.url()).pathname.split("/").pop();
    expect(request.headers().authorization).toBe("Bearer e2e-anonymous-access-token");

    if (functionName === "proxy-stt") {
      return json(route, { key: "e2e-short-lived-token", expires_in: 60, model: "nova-3", language: "fr" });
    }
    if (functionName === "proxy-stt-config" && options.whisperResponse !== undefined) {
      return json(route, { configured: { deepgram: true, openai_whisper: true } });
    }
    if (functionName === "proxy-stt-whisper") {
      await new Promise(resolve => setTimeout(resolve, options.delayWhisperResponseMs ?? 0));
      await json(route, { text: options.whisperResponse });
      whisperReplyCount += 1;
      return;
    }
    if (functionName === "query-rag") {
      ragCallCount += 1;
      if (ragCallCount === options.dropRagAt) {
        simulatedNetworkDrops += 1;
        return route.abort("internetdisconnected");
      }
      return json(route, { matches: [], embedding_provider: "e2e", rerank_used: false, latency_ms: 1 });
    }
    if (functionName === "proxy-tts-gradium") {
      if (request.method() === 'GET') return json(route, { token: 'e2e-short-lived-token' });
      return route.fulfill({status:200,contentType:'audio/wav',body:'e2e-audio'});
    }
    if (functionName === "proxy-tts") {
      ttsTexts.push((request.postDataJSON() as { text: string }).text);
      ttsCallCount += 1;
      if (options.ttsBusyOnce && ttsCallCount === 1) {
        return json(route, {
          error: "ElevenLabs error: 429",
          details: JSON.stringify({
            detail: { type: "rate_limit_error", code: "system_busy", status: "system_busy" },
          }),
        }, 429);
      }
      if (options.ttsSuccess) {
        return route.fulfill({ status: 200, contentType: "audio/mpeg", body: "e2e-audio" });
      }
      // Permanent test disablement is deliberately non-retryable. Transient
      // recovery is covered separately by the explicit 429 system_busy case.
      return route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "TTS disabled in E2E" }) });
    }
    if (functionName === "proxy-llm") {
      const payload = request.postDataJSON() as { stream?: boolean; messages?: Array<{ role: string; content: string }> };
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
        gmFilmContexts.push(payload.messages?.map((message) => message.content).join("\n") ?? system);
        gmPostTurnCount += 1;
        if (options.delayGmMs) await new Promise(resolve => setTimeout(resolve, options.delayGmMs));
        if (gmPostTurnCount === options.failGmAt) return json(route, { error: "simulated_gm_failure" }, 503);
        const triggerVideo = gmPostTurnCount === options.triggerVideoAtLabel;
        content = JSON.stringify({
          labels: triggerVideo
            ? { themes: ["famille"], topics: [], intentions: ["question"] }
            : { themes: [], topics: [], intentions: [] },
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
          trigger_video_id: triggerVideo ? "44444444-4444-4444-8444-444444444444" : null,
          player_switch_request: options.gmStance
            ? { targetCharacter: options.gmTarget ?? "max", stance: options.gmStance } : null,
          memory_delta: null,
          action: gmPostTurnCount === options.gmHandoffAt
            ? { type: "handoff", targetCharacter: options.gmTarget ?? "max", reason: "Le GM recommande ce transfert.", proposalGuidance: "Propose le transfert si tu es d'accord." }
            : triggerVideo
            ? {
                type: "cinematic",
                videoId: "44444444-4444-4444-8444-444444444444",
                reason: "souvenir familial",
                confidence: 0.95,
              }
            : { type: "none" },
        });
      } else {
        maxTurnCount += 1;
        maxMessageCounts.push(payload.messages?.length ?? 0);
        if (options.delayCharacterResponseMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayCharacterResponseMs));
        }
        if (maxTurnCount === options.failMaxAt) {
          return json(route, { error: "simulated_provider_failure" }, 503);
        }
        content = options.characterReplies?.[maxTurnCount - 1] ?? options.maxResponse ?? `Réponse de Max pour le tour ${maxTurnCount}.`;
      }
      if (payload.stream) {
        const response = JSON.stringify({goal:'PRIVATE_INTENT_CANARY',points:['Point privé']}) + '\n<speech>\n' + content;
        const chunks = [response.slice(0, 12),response.slice(12, 45),response.slice(45)];
        return route.fulfill({ status:200,contentType:'text/event-stream',body:chunks.map(text =>
          `data: ${JSON.stringify({id:`generation-${maxTurnCount}`,model:'e2e-model',choices:[{delta:{content:text}}]})}\n\n`).join('') + 'data: [DONE]\n\n' });
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
    getGmPostTurnCount: () => gmPostTurnCount,
    getMaxMessageCounts: () => maxMessageCounts,
    getSummaryCallCount: () => summaryCallCount,
    getSimulatedNetworkDrops: () => simulatedNetworkDrops,
    getTriggeredVideoLoads: () => triggeredVideoLoads,
    getSessionUpdates: () => sessionUpdates,
    getSessionInsertCount: () => sessionInsertCount,
    getExperienceEvents: () => experienceEvents,
    getVoiceEvents: () => voiceEvents,
    getGmFilmContexts: () => gmFilmContexts,
    getTtsCallCount: () => ttsCallCount,
    getTtsText: () => ttsTexts.join(" "),
    getPosthogRequestCount: () => posthogRequestCount,
    getTraceUploadStarted: () => traceUploadStarted,
    getTraceUploadCompleted: () => traceUploadCompleted,
    getWhisperReplyCount: () => whisperReplyCount,
    releaseTraceUpload: () => releaseTraceUpload?.(),
  };
}

/** Choix film après l'introduction ; l'ancien briefing est masqué. */
async function answerFilmQuestion(page: Page) {
  await page.getByRole("button", { name: "Je n'ai pas vu le film", exact: true }).click();
}

const HANDOFF_TURNS = [
  "Bonjour, comment te sens-tu ?",
  "Je comprends que cette situation soit difficile.",
  "Je suis là pour écouter sans te juger.",
];

async function startCharacterConversation(page: Page, character: "Max" | "Emma") {
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: `Appeler ${character}`, exact: true }).click();
  await expect(page.getByRole("img", { name: `Portrait d’${character}` })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
}

async function sendHandoffTurn(page: Page, text: string) {
  await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled();
  const before = await page.evaluate(() =>
    (window as Window & { __e2eAudioState?: { ended: number } }).__e2eAudioState?.ended ?? 0);
  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await expect(page.getByText(text, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Arrêter l'enregistrement" }).press("Enter");
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __e2eAudioState?: { ended: number } }).__e2eAudioState?.ended ?? 0)).toBeGreaterThan(before);
}

for (const [character, target] of [["Emma", "Max"], ["Max", "Emma"]] as const) {
  test(`appel GM : aucun bouton par défaut chez ${character}, accord au quatrième tour puis sonneries vers ${target}`, async ({ page }) => {
    test.setTimeout(50_000);
    const turns = [...HANDOFF_TURNS, `J'aimerais parler à ${target}, s'il te plaît.`];
    const fakes = await installNetworkFakes(page, turns, { ttsSuccess: true, characterOpenings: true,
      gmTarget: target.toLowerCase() as "max" | "emma", gmStance: "accept", gmHandoffAt: 4, maxResponse: "D'accord, je te la passe." });
    await startCharacterConversation(page, character);
    for (const text of turns.slice(0, 3)) {
      await sendHandoffTurn(page, text);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
    }
    await sendHandoffTurn(page, turns[3]);
    await expect(page.getByRole("button", { name: `Appeler ${target}`, exact: true })).toBeVisible();
    expect(fakes.getExperienceEvents().filter(e => e.event_type === "handoff_executed")).toHaveLength(0);
    await page.getByRole("button", { name: `Appeler ${target}`, exact: true }).evaluate(button => {
      (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click();
    });
    await expect(page.getByText("Appel en cours…", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: target, exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: `Portrait d’${target}` })).toBeVisible({ timeout: 10_000 });
    await expect.poll(fakes.getTtsText).toContain(`Allô, ici ${target}.`);
    await expect(page.getByText(`Allô, ici ${target}.`, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
    await expect.poll(() => fakes.getExperienceEvents().filter(e => e.event_type === "handoff_executed").length).toBe(1);
    const executed = fakes.getExperienceEvents().find(e => e.event_type === "handoff_executed");
    expect(executed?.payload).toMatchObject({ source: "gm", sessionPreserved: true, timerPreserved: true });
    expect(fakes.getSessionInsertCount()).toBe(1);
  });
}

for (const stance of ["object", "defer"] as const) {
  test(`appel GM : ${stance} ne débloque aucun bouton malgré une réplique affirmative`, async ({ page }) => {
    const turns = [...HANDOFF_TURNS, "J'aimerais parler à Max, s'il te plaît."];
    const fakes = await installNetworkFakes(page, turns, { ttsSuccess: true, characterOpenings: true,
      gmTarget: "max", gmStance: stance, gmHandoffAt: 4, maxResponse: "D'accord, je te le passe." });
    await startCharacterConversation(page, "Emma");
    for (const text of turns) { await sendHandoffTurn(page, text); await page.waitForLoadState("networkidle"); }
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("img", { name: "Portrait d’Emma" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
    expect(fakes.getExperienceEvents().filter(e => e.event_type === "handoff_executed")).toHaveLength(0);
  });
}

for (const fail of [false, true]) {
  test(`appel GM : ${fail ? "échec" : "retard"} du GM ne vaut pas permission`, async ({ page }) => {
    test.setTimeout(40_000);
    const turns = [...HANDOFF_TURNS, "J'aimerais parler à Max, s'il te plaît."];
    const fakes = await installNetworkFakes(page, turns, { ttsSuccess: true, characterOpenings: true,
      gmTarget: "max", gmStance: "accept", gmHandoffAt: 4, delayGmMs: 2_000, failGmAt: fail ? 4 : undefined,
      maxResponse: "D'accord, je te le passe." });
    await startCharacterConversation(page, "Emma");
    for (const text of turns.slice(0, 3)) { await sendHandoffTurn(page, text); await page.waitForLoadState("networkidle"); }
    await sendHandoffTurn(page, turns[3]);
    await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(fail ? 0 : 1);
    expect(fakes.getExperienceEvents().filter(e => e.event_type === "handoff_executed")).toHaveLength(0);
  });
}

test("appel GM : classifier un accord sans recommander le transfert ne suffit pas", async ({ page }) => {
  const turns = [...HANDOFF_TURNS, "J'aimerais parler à Max, s'il te plaît."];
  const fakes = await installNetworkFakes(page, turns, { ttsSuccess: true, characterOpenings: true,
    gmTarget: "max", gmStance: "accept", maxResponse: "D'accord, je te le passe." });
  await startCharacterConversation(page, "Emma");
  for (const text of turns) { await sendHandoffTurn(page, text); await page.waitForLoadState("networkidle"); }
  await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
  expect(fakes.getExperienceEvents().filter(e => e.event_type === "handoff_proposed")).toHaveLength(0);
});

for (const refusal of ["Je te le passe pas.", "Appelle-le pas.", "Non, je préfère que tu restes avec moi."]) {
  test(`appel GM : un accord GM contradictoire ne gomme pas le refus « ${refusal} »`, async ({ page }) => {
    const turns = [...HANDOFF_TURNS, "J'aimerais parler à Max, s'il te plaît."];
    const fakes = await installNetworkFakes(page, turns, { ttsSuccess: true, characterOpenings: true,
      gmTarget: "max", gmStance: "accept", gmHandoffAt: 4, maxResponse: refusal });
    await startCharacterConversation(page, "Emma");
    for (const text of turns) { await sendHandoffTurn(page, text); await page.waitForLoadState("networkidle"); }
    await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Portrait d’Emma" })).toBeVisible();
    expect(fakes.getExperienceEvents().filter(e => e.event_type === "handoff_proposed")).toHaveLength(0);
  });
}

test("appel GM : un accord recommandé avant le seuil narratif reste bloqué", async ({ page }) => {
  const text = "J'aimerais parler à Max, s'il te plaît.";
  const fakes = await installNetworkFakes(page, [text], { ttsSuccess: true, characterOpenings: true,
    gmTarget: "max", gmStance: "accept", gmHandoffAt: 1, maxResponse: "D'accord, je te le passe." });
  await startCharacterConversation(page, "Emma");
  await sendHandoffTurn(page, text);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
  await expect.poll(() => fakes.getExperienceEvents().find(e => e.event_type === "handoff_blocked")?.payload.blockedReason)
    .toBe("handoff_before_minimum_turn");
});

for (const consent of [false, true]) {
  test(`appel GM : la recommandation attend la proposition ${consent ? "consentie" : "refusée"} du personnage`, async ({ page }) => {
    test.setTimeout(40_000);
    const turns = [...HANDOFF_TURNS, "Comment vois-tu la suite ?", "Je t'écoute."];
    const fakes = await installNetworkFakes(page, turns, { ttsSuccess: true, characterOpenings: true,
      gmTarget: "max", gmHandoffAt: 4, characterReplies: ["Je t'écoute.", "Je t'écoute.", "Je t'écoute.", "Je t'écoute.",
        consent ? "Tu peux appeler Max si tu veux." : "D'accord, mais je ne vais pas te passer Max comme ça."] });
    await startCharacterConversation(page, "Emma");
    for (const text of turns.slice(0, 4)) { await sendHandoffTurn(page, text); await page.waitForLoadState("networkidle"); }
    await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
    await sendHandoffTurn(page, turns[4]);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(consent ? 1 : 0);
    if (consent) {
      await page.getByRole("button", { name: "Rester avec Emma", exact: true }).click();
      await expect(page.getByRole("button", { name: /^Appeler / })).toHaveCount(0);
      await expect.poll(() => fakes.getExperienceEvents().filter(e => e.event_type === "handoff_refused").length).toBe(1);
    }
    expect(fakes.getExperienceEvents().filter(e => e.event_type === "handoff_executed")).toHaveLength(0);
  });
}

test("appel GM : un PATCH refusé conserve Emma, son offre autorisée et le compteur pour réessayer", async ({ page }) => {
  test.setTimeout(50_000);
  const turns = [...HANDOFF_TURNS, "J'aimerais parler à Max, s'il te plaît."];
  const fakes = await installNetworkFakes(page, turns, { ttsSuccess: true, characterOpenings: true,
    gmTarget: "max", gmStance: "accept", gmHandoffAt: 4, maxResponse: "D'accord, je te le passe." });
  let rejected = false;
  await page.route(`${SUPABASE_ORIGIN}/rest/v1/sessions**`, async route => {
    const request = route.request();
    if (request.method() === "PATCH" && request.postDataJSON().active_character && !rejected) {
      rejected = true;
      return json(route, { code: "23514", message: 'new row violates check constraint "sessions_handoff_count_check"' }, 400);
    }
    return route.fallback();
  });
  await startCharacterConversation(page, "Emma");
  for (const text of turns) { await sendHandoffTurn(page, text); await page.waitForLoadState("networkidle"); }
  await page.getByRole("button", { name: "Appeler Max", exact: true }).click();
  await expect(page.getByText("Max n’est pas disponible", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("img", { name: "Portrait d’Emma" })).toBeVisible();
  expect(fakes.getExperienceEvents().filter(e => e.event_type === "handoff_executed")).toHaveLength(0);
  await page.getByRole("button", { name: "Appeler Max", exact: true }).click();
  await expect(page.getByRole("img", { name: "Portrait d’Max" })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => fakes.getExperienceEvents().filter(e => e.event_type === "handoff_executed").length).toBe(1);
  const persisted = fakes.getSessionUpdates().filter((v): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && "active_character" in v);
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({ active_character: "max", handoff_count: 1 });
  expect(fakes.getSessionInsertCount()).toBe(1);
});

test("capture remplacée : un démarrage rejeté après recommencement laisse le nouveau micro actif", async ({ page }) => {
  test.setTimeout(45_000);
  await installNetworkFakes(page, TRANSCRIPTS, { ttsSuccess: true, characterOpenings: true, skipQuestionnaire: true });
  await page.addInitScript(() => {
    const previous = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let calls = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: () => {
      if (++calls > 1) return previous({ audio: true });
      return new Promise<MediaStream>((_resolve, reject) => {
        (window as Window & { __e2eRejectFirstCapture?: () => void }).__e2eRejectFirstCapture = () => reject(new Error("Old microphone startup rejected"));
      });
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: "Appeler Emma" }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __e2eAudioState?: { ended: number } }).__e2eAudioState?.ended ?? 0), { timeout: 10_000 }).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await expect(page.getByText("Micro en cours d'ouverture…", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Terminer", exact: true }).click();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByRole("button", { name: /Recommencer/ }).click();
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: "Appeler Max" }).click();
  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await expect(page.getByRole("button", { name: "Arrêter l'enregistrement" })).toBeEnabled();
  await page.evaluate(() => (window as Window & { __e2eRejectFirstCapture?: () => void }).__e2eRejectFirstCapture?.());
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Arrêter l'enregistrement" })).toBeEnabled();
  await expect(page.getByText("Micro indisponible", { exact: true })).toHaveCount(0);
});

test("capture remplacée : couper puis réactiver le micro pendant un flush mains libres laisse le nouveau tour aboutir", async ({ page }) => {
  const fakes = await installNetworkFakes(page, ["Première question interrompue avant la réponse.", "Une nouvelle question après réactivation du micro."], {
    ttsSuccess: true, characterOpenings: true, handsFree: true, delayFirstSTTFinalMs: 7_000,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: "Appeler Max" }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __e2eAudioState?: { ended: number } }).__e2eAudioState?.ended ?? 0), { timeout: 10_000 }).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Activer le micro" }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __e2eSTTFinals?: number }).__e2eSTTFinals ?? 0)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Couper le micro" }).click();
  await page.getByRole("button", { name: "Activer le micro" }).click();
  await expect.poll(fakes.getMaxTurnCount, { timeout: 10_000 }).toBe(1);
  await expect.poll(fakes.getTtsText).toContain("Réponse de Max pour le tour 1.");
  await expect(page.getByText("Réponse de Max pour le tour 1.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Couper le micro" }).click();
});

for (const answer of ["vu", "pas_vu"] as const) {
  test(`choix film ${answer} conservé après relecture et transmis au GM`, async ({ page }) => {
    const fakes = await installNetworkFakes(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Commencer" }).click();
    await page.getByRole("button", { name: /Passer/ }).click();
    await page.getByRole("button", { name: answer === "vu" ? "J'ai vu le film" : "Je n'ai pas vu le film", exact: true }).click();
    await page.getByRole("button", { name: "Revoir la vidéo d’introduction" }).click();
    await page.getByRole("button", { name: /Passer/ }).click();
    await page.getByRole("button", { name: "Appeler Max" }).click();
    await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
    await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();
    await expect.poll(() => fakes.getGmFilmContexts().some((prompt) => prompt.includes(`film : ${answer}.`))).toBe(true);
    await expect.poll(() => fakes.getSessionUpdates().some((update) =>
      typeof update === "object" && update !== null && "has_seen_film" in update && update.has_seen_film === answer,
    )).toBe(true);
  });
}

test("le teaser démarre automatiquement avec le son puis Passer coupe tout", async ({ page }, testInfo) => {
  await installNetworkFakes(page);

  await page.goto("/");
  const playerBeforeStart = await page.locator("video[title='Video player']").elementHandle();
  expect(playerBeforeStart).not.toBeNull();
  await expect(page.locator("iframe[title='Video player']")).toHaveCount(0);
  await page.getByRole("button", { name: "Commencer" }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = (window as Window & {
      __e2eNativeVideoState?: { playing: boolean; playCount: number };
    }).__e2eNativeVideoState;
    const video = document.querySelector("video[title='Video player']") as HTMLVideoElement | null;
    return Boolean(
      state?.playing &&
      state.playCount > 0 &&
      video?.autoplay &&
      !video.controls &&
      !video.muted &&
      video.volume === 1,
    );
  }), { timeout: 5_000 }).toBe(true);

  const playbackPath = await page.locator("video[title='Video player']").evaluate((video) => ({
    currentSrc: (video as HTMLVideoElement).currentSrc,
    engine: (video as HTMLVideoElement).dataset.playbackEngine,
  }));
  if (testInfo.project.name !== "webkit-media") {
    expect(playbackPath.engine).toBe("hls.js");
    expect(playbackPath.currentSrc).toMatch(/^blob:/);
  } else {
    expect(["hls.js", "native-hls"]).toContain(playbackPath.engine);
  }

  const pauseCountBeforeSkip = await page.evaluate(() =>
    (window as Window & { __e2eNativeVideoState?: { pauseCount: number } }).__e2eNativeVideoState?.pauseCount ?? 0,
  );
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await expect(page.getByRole("heading", { name: "A qui veux-tu parler ?" })).toBeVisible();
  await expect.poll(() => page.evaluate((previousPauseCount) => {
    const state = (window as Window & {
      __e2eNativeVideoState?: { playing: boolean; pauseCount: number };
    }).__e2eNativeVideoState;
    const video = document.querySelector("video[title='Video player']") as HTMLVideoElement | null;
    return Boolean(state && !state.playing && state.pauseCount > previousPauseCount && video?.muted);
  }, pauseCountBeforeSkip), { timeout: 5_000 }).toBe(true);
});

test("une cinématique HLS démarre automatiquement puis Passer coupe son média", async ({ page }) => {
  // WebKit on the shared CI runner can spend most of the default 30 s budget
  // bootstrapping HLS; keep actionability checks enabled with a realistic cap.
  test.setTimeout(60_000);
  const transcripts = [
    "Parle-moi de Max.",
    "Que sais-tu au sujet d'Ava ?",
    "Montre-moi le souvenir familial.",
  ];
  await installNetworkFakes(page, transcripts, { triggerVideoAtLabel: 3 });

  await page.goto("/");
  const persistentPlayer = await page.locator("video[title='Video player']").elementHandle();
  expect(persistentPlayer).not.toBeNull();
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: "Appeler Max" }).click();
  for (let turn = 1; turn <= 3; turn += 1) {
    await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
    await expect(page.getByText(transcripts[turn - 1], { exact: false })).toBeVisible();
    const stopRecording = page.getByRole("button", { name: "Arrêter l'enregistrement" });
    await expect(stopRecording).toBeEnabled();
    await stopRecording.press("Enter");
    if (turn < 3) {
      await expect.poll(fakes.getTtsText).toContain(`Réponse de Max pour le tour ${turn}.`);
    await expect(page.getByText(`Réponse de Max pour le tour ${turn}.`)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled();
    }
  }

  const skipVideo = page.getByRole("button", { name: /Passer/ });
  await expect(skipVideo).toBeVisible({ timeout: 10_000 });
  expect(await page.locator("video[title='Video player']").evaluate((video, initialPlayer) =>
    video === initialPlayer,
  persistentPlayer)).toBe(true);
  await expect(page.locator("iframe[title='Video player']")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const state = (window as Window & {
      __e2eNativeVideoState?: { playing: boolean; playCount: number };
    }).__e2eNativeVideoState;
    const video = document.querySelector("video");
    return Boolean(state?.playing && state.playCount > 0 && video && !video.muted && video.autoplay);
  }), { timeout: 5_000 }).toBe(true);

  const pauseCountBeforeSkip = await page.evaluate(() =>
    (window as Window & { __e2eNativeVideoState?: { pauseCount: number } }).__e2eNativeVideoState?.pauseCount ?? 0,
  );
  await skipVideo.click();
  await expect.poll(() => page.evaluate((previousPauseCount) => {
    const state = (window as Window & {
      __e2eNativeVideoState?: { playing: boolean; pauseCount: number };
    }).__e2eNativeVideoState;
    return Boolean(state && !state.playing && state.pauseCount > previousPauseCount);
  }, pauseCountBeforeSkip), { timeout: 5_000 }).toBe(true);
});

test("parcours PRD4 heureux avec trois tours de conversation", async ({ page }) => {
  const fakes = await installNetworkFakes(page);

  await page.goto("/");
  await expect(page.getByLabel(/J’ai compris que ma voix/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Commencer" })).toBeEnabled();
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await expect(page.getByRole("heading", { name: "A qui veux-tu parler ?" })).toBeVisible();
  await expect(page.getByText(/poser une question, exprimer une émotion/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Appeler Max" }).click();
  await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeVisible({ timeout: 10_000 });

  for (let turn = 1; turn <= 3; turn += 1) {
    await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
    await expect(page.getByText(new RegExp(TRANSCRIPTS[turn - 1].slice(0, 24)))).toBeVisible();
    await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();
    await expect.poll(fakes.getTtsText).toContain(`Réponse de Max pour le tour ${turn}.`);
    await expect(page.getByText(`Réponse de Max pour le tour ${turn}.`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled();
  }

  expect(fakes.getMaxTurnCount()).toBe(3);
  expect(fakes.getSessionUpdates().length).toBeGreaterThanOrEqual(1);
  await expect.poll(fakes.getPosthogRequestCount, { timeout: 10_000 }).toBeGreaterThan(0);
});

test("une réponse vocale plus longue que le watchdog est lue jusqu'au bout", async ({ page }) => {
  const longResponse = "D'accord, je vais reprendre calmement. La tension à la maison est palpable. Emma et moi ne nous parlons presque plus, et Léo comme Ava restent profondément affectés. J'essaie de les protéger sans toujours savoir si je fais les bons choix.";
  const fakes = await installNetworkFakes(page, ["Raconte-moi toute la suite sans couper."], {
    ttsSuccess: true,
    maxResponse: longResponse,
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: "Appeler Max" }).click();
  await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled({ timeout: 10_000 });

  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await page.evaluate(() => {
    (window as Window & { __e2eLongAudio?: boolean }).__e2eLongAudio = true;
  });
  await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();

  await expect.poll(fakes.getTtsText).toContain(longResponse);
  await expect(page.getByText(longResponse)).toHaveCount(0);
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

test("diagnostic full garde la voix réactive pendant un upload de trace bloqué", async ({ page }) => {
  const fakes = await installNetworkFakes(page, ["Pourquoi Ava est-elle partie ?"], {
    diagnosticAdmin: true,
    blockTraceUpload: true,
    ttsSuccess: true,
  });

  await page.goto("/?diagnostic=full");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: "Appeler Max" }).click();
  await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled({ timeout: 10_000 });

  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();

  await expect.poll(fakes.getTtsText).toContain("Réponse de Max pour le tour 1.");
  await expect(page.getByText("Réponse de Max pour le tour 1.")).toHaveCount(0);
  await expect.poll(fakes.getTraceUploadStarted, { timeout: 5_000 }).toBe(1);
  expect(fakes.getTraceUploadCompleted()).toBe(0);
  await expect.poll(async () => page.evaluate(() =>
    (window as Window & { __e2eAudioState?: { ended: number } }).__e2eAudioState?.ended ?? 0,
  )).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("Le tour a pris trop de temps")).toHaveCount(0);

  const localCount = await page.evaluate(async () => {
    const request = indexedDB.open("ava-diagnostic-traces", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<number>((resolve, reject) => {
      const count = database.transaction("trace-outbox", "readonly").objectStore("trace-outbox").count();
      count.onsuccess = () => resolve(count.result);
      count.onerror = () => reject(count.error);
    });
  });
  expect(localCount).toBe(1);

  fakes.releaseTraceUpload();
  await expect.poll(fakes.getTraceUploadCompleted, { timeout: 5_000 }).toBe(1);
});

test("un 429 system_busy ElevenLabs est rejoué une fois puis la voix démarre", async ({ page }) => {
  const fakes = await installNetworkFakes(page, ["Peux-tu me répondre malgré la saturation ?"], {
    ttsSuccess: true,
    ttsBusyOnce: true,
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: "Appeler Max" }).click();
  await expect(page.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeEnabled({ timeout: 10_000 });

  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();

  await expect.poll(fakes.getTtsText).toContain("Réponse de Max pour le tour 1.");
  await expect(page.getByText("Réponse de Max pour le tour 1.")).toHaveCount(0);
  await expect.poll(fakes.getTtsCallCount).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("Voix temporairement indisponible")).toHaveCount(0);
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
  await answerFilmQuestion(page);
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
    await expect.poll(fakes.getTtsText).toMatch(expected);
    await expect(page.getByText(expected)).toHaveCount(0);

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


test("V2 conserve deux échecs micro sans transcript comme tentatives distinctes", async ({ page }) => {
  const fakes = await installNetworkFakes(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => { throw new DOMException("Micro refusé", "NotAllowedError"); } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: "Appeler Max" }).click();
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
    await expect.poll(() => fakes.getVoiceEvents().filter((event) => event.status === "failed").length).toBe(attempt);
  }
  const failures = fakes.getVoiceEvents().filter((event) => event.status === "failed");
  expect(failures[0].turn_id).toBe(failures[1].turn_id);
  expect(failures[0].attempt_id).not.toBe(failures[1].attempt_id);
  expect(fakes.getMaxTurnCount()).toBe(0);
});

test("V2 garde un flush vide sans requête LLM dans les effectifs", async ({ page }) => {
  const fakes = await installNetworkFakes(page, [""]);
  await page.goto("/");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: /Passer/ }).click();
  await answerFilmQuestion(page);
  await page.getByRole("button", { name: "Appeler Max" }).click();
  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();
  await expect.poll(() => fakes.getVoiceEvents().filter((event) => event.status === "no_audio").length).toBe(1);
  expect(fakes.getMaxTurnCount()).toBe(0);
});

for (const character of ['Max','Emma'] as const) {
  test(`P1 ${character}: one private generation and one Gradium context, persisted delivery`, async ({page}) => {
    const fakes=await installNetworkFakes(page,['Bonjour, je suis ici pour écouter.'],{incrementalOutput:true,maxResponse:'Bonjour. Je vous écoute.',ttsSuccess:true});
    await startCharacterConversation(page,character);
    await expect(page.getByRole('button',{name:"Démarrer l'enregistrement"})).toBeEnabled();
    await page.evaluate(()=>{const w=window as Window & {__e2eGradiumTexts?:string[];__e2eGradiumSetups?:number;__e2eGradiumEos?:number};w.__e2eGradiumTexts=[];w.__e2eGradiumSetups=0;w.__e2eGradiumEos=0;});
    await page.getByRole('button',{name:"Démarrer l'enregistrement"}).click();
    await expect(page.getByText('Bonjour, je suis ici pour écouter.',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:"Arrêter l'enregistrement"}).press('Enter');
    await expect.poll(()=>fakes.getGmPostTurnCount()).toBe(1);
    const transport=await page.evaluate(()=>{
      const w=window as Window & {__e2eGradiumTexts?:string[];__e2eGradiumSetups?:number;__e2eGradiumEos?:number};
      return {text:w.__e2eGradiumTexts,setups:w.__e2eGradiumSetups,eos:w.__e2eGradiumEos};
    });
    expect(fakes.getMaxTurnCount()).toBe(1);expect(transport).toEqual({text:['Bonjour.','Je vous écoute.'],setups:1,eos:1});
    expect(transport.text?.join(' ')).not.toContain('PRIVATE_INTENT_CANARY');
    await expect.poll(()=>JSON.stringify(fakes.getSessionUpdates())).toContain('deliveryByCharacter');
    const updates=JSON.stringify(fakes.getSessionUpdates());expect(updates).toContain('"status":"completed"');expect(updates).toContain(`"character":"${character.toLowerCase()}"`);
    expect(fakes.getGmFilmContexts().join(' ')).not.toContain('PRIVATE_INTENT_CANARY');
    await expect(page.getByRole('button',{name:/^Appeler /})).toHaveCount(0);
  });
}

test('P1 : un accord généré après le préfixe entendu ne donne pas la permission de transférer',async({page})=>{
  const turns=[...HANDOFF_TURNS,"J'aimerais parler à Max, s'il te plaît."];
  const fakes=await installNetworkFakes(page,turns,{incrementalOutput:true,ttsSuccess:true,gradiumDropAt:5,
    characterReplies:['Bonjour.','Je vous écoute.','Merci.','Bonjour. D’accord, je te le passe.'],gmTarget:'max',gmStance:'accept',gmHandoffAt:4});
  await startCharacterConversation(page,'Emma');
  for (let i=0;i<turns.length;i++) {
    await expect(page.getByRole('button',{name:"Démarrer l'enregistrement"})).toBeEnabled();
    await page.getByRole('button',{name:"Démarrer l'enregistrement"}).click();
    await expect(page.getByText(turns[i],{exact:false})).toBeVisible();
    await page.getByRole('button',{name:"Arrêter l'enregistrement"}).press('Enter');
    await expect.poll(()=>fakes.getGmPostTurnCount()).toBe(i+1);
  }
  await expect(page.getByRole('button',{name:/^Appeler /})).toHaveCount(0);
  expect(fakes.getGmFilmContexts().at(-1)).not.toContain('D’accord, je te le passe.');
  expect(fakes.getGmFilmContexts().at(-1)).toContain('Bonjour.');
  expect(JSON.stringify(fakes.getSessionUpdates())).toContain('"status":"failed"');
});


test("P2 : candidat rejeté réversible puis correction sur un mot, UI voix seule et nouveau tour", async ({ page }) => {
  const fakes = await installNetworkFakes(page, ["Bonjour Max, je suis là pour écouter."], {
    p2: true, handsFree: true, incrementalOutput: true, ttsSuccess: true, maxResponse: "Bonjour. Je vous écoute.",
  });
  await startCharacterConversation(page, "Max");
  await page.getByRole("button", { name: "Activer le micro" }).click();
  await expect.poll(fakes.getMaxTurnCount).toBe(1);
  await expect(page.getByRole("status")).toHaveText(/Max répond/);
  await expect(page.getByText("Bonjour Max, je suis là pour écouter.", { exact: false })).toBeVisible();
  await expect(page.getByText("Bonjour. Je vous écoute.", { exact: true })).toHaveCount(0);
  const speech = async (value: boolean) => page.evaluate(value => (window as Window & { __e2eSpeech?: (value: boolean) => void }).__e2eSpeech?.(value), value);
  await speech(true); await page.waitForTimeout(90); await speech(false);
  await page.waitForTimeout(1650);
  expect(fakes.getMaxTurnCount()).toBe(1); expect(fakes.getGmPostTurnCount()).toBe(0);
  await speech(true); await page.waitForTimeout(210);
  await page.evaluate(() => (window as Window & { __e2eRecognize?: (text: string) => void }).__e2eRecognize?.("non"));
  await speech(false);
  await expect.poll(() => fakes.getVoiceEvents().some(event => Array.isArray(event.interruptions) && event.interruptions.some((entry: { event: string }) => entry.event === "interruption_confirmed"))).toBe(true);
  await expect.poll(fakes.getMaxTurnCount).toBe(2);
  // Two 4.8-second chunks must actually reach their simulated render cursor.
  await expect.poll(() => fakes.getVoiceEvents().some(event => event.status === "completed"), { timeout: 15000 }).toBe(true);
  const events = fakes.getVoiceEvents().flatMap(event => Array.isArray(event.interruptions) ? event.interruptions : []);
  expect(events.some(event => event.event === "interruption_rejected")).toBe(true);
  expect(events.some(event => event.event === "audio_resumed")).toBe(true);
  expect(events.some(event => event.event === "audio_suspended")).toBe(true);
  expect(JSON.stringify(fakes.getSessionUpdates())).toContain('"interruptionStrategy":"acoustic_confirmed"');
  await expect(page.getByRole("button", { name: "Terminer" })).toBeVisible();
  await page.getByRole("button", { name: "Terminer" }).click();
  expect(JSON.stringify(fakes.getSessionUpdates())).not.toContain('"delivered":"PRIVATE_INTENT_CANARY');
});


test("P2 : couper le micro pendant un candidat suspendu reprend la même réponse", async ({ page }) => {
  const fakes = await installNetworkFakes(page, ["Bonjour Max, je suis là."], { p2: true, handsFree: true, incrementalOutput: true, ttsSuccess: true, maxResponse: "Bonjour. Je vous écoute." });
  await startCharacterConversation(page, "Max");await page.getByRole("button", { name: "Activer le micro" }).click();
  await expect(page.getByRole("status")).toHaveText(/Max répond/);
  await page.evaluate(() => (window as Window & { __e2eSpeech?: (value: boolean) => void }).__e2eSpeech?.(true));
  await page.waitForTimeout(220);await page.getByRole("button", { name: "Couper le micro" }).click();
  await expect.poll(() => fakes.getVoiceEvents().some(event => event.status === "completed"), { timeout: 15000 }).toBe(true);
  expect(fakes.getMaxTurnCount()).toBe(1);
  const events = fakes.getVoiceEvents().flatMap(event => Array.isArray(event.interruptions) ? event.interruptions : []);
  expect(events.some(event => event.event === "audio_suspended")).toBe(true);expect(events.some(event => event.event === "audio_resumed")).toBe(true);
  expect(events.some(event => event.event === "interruption_confirmed")).toBe(false);
  await expect(page.getByRole("button", { name: "Activer le micro" })).toBeVisible();await page.getByRole("button", { name: "Terminer" }).click();
});

test("P2 : perte du micro sans candidat arrête sortie et génération", async ({ page }) => {
  const fakes = await installNetworkFakes(page, ["Bonjour Max, je suis là."], { p2: true, handsFree: true, incrementalOutput: true, ttsSuccess: true, maxResponse: "Bonjour. Je vous écoute." });
  await startCharacterConversation(page, "Max");await page.getByRole("button", { name: "Activer le micro" }).click();
  await expect(page.getByRole("status")).toHaveText(/Max répond/);
  await page.evaluate(() => (window as Window & { __e2eLoseMicrophone?: () => void }).__e2eLoseMicrophone?.());
  await expect.poll(() => fakes.getVoiceEvents().some(event => event.status === "cancelled")).toBe(true);
  await expect(page.getByRole("button", { name: "Activer le micro" })).toBeVisible();
  expect(fakes.getMaxTurnCount()).toBe(1);expect(fakes.getGmPostTurnCount()).toBe(0);
  await page.getByRole("button", { name: "Terminer" }).click();
});
