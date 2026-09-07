import { defineConfig, devices } from "@playwright/test";

const localBaseURL = "http://127.0.0.1:4173";
const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const isPreviewCommand = process.env.npm_lifecycle_event === "test:e2e:preview";

if (isPreviewCommand && !configuredBaseURL) {
  throw new Error("test:e2e:preview requires PLAYWRIGHT_BASE_URL to target an isolated Lovable preview");
}

function resolveBaseURL(): string {
  if (!configuredBaseURL) return localBaseURL;
  const url = new URL(configuredBaseURL);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("PLAYWRIGHT_BASE_URL must use HTTPS unless it targets localhost");
  }
  return url.toString().replace(/\/$/, "");
}

const baseURL = resolveBaseURL();
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [
        ["github"],
        ["html", { outputFolder: "output/playwright/report", open: "never" }],
      ]
    : "list",
  outputDir: "output/playwright/results",
  use: {
    baseURL,
    trace: isCI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  // A Lovable preview is already hosted: setting PLAYWRIGHT_BASE_URL disables
  // the local Vite server while preserving the exact same browser contracts.
  webServer: configuredBaseURL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 4173",
        url: localBaseURL,
        env: {
          VITE_GAME_SECURITY_ENABLED: "true",
          VITE_TURN_FIRST_AUDIO_DEADLINE_MS: "500",
        },
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["microphone"],
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
      },
    },
    {
      name: "firefox-media",
      grep: /teaser démarre|cinématique HLS/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-media",
      // Teaser covers Safari HLS autoplay/skip. The cinematic path needs a
      // conversation + GM trigger and is too flaky on the shared WebKit runner.
      grep: /teaser démarre/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
