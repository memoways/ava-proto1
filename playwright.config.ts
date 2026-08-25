import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    env: {
      VITE_GAME_SECURITY_ENABLED: "true",
      VITE_TURN_FIRST_AUDIO_DEADLINE_MS: "500",
    },
    reuseExistingServer: !process.env.CI,
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
