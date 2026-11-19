import { defineConfig, devices } from "@playwright/test";

/*
  Browser-level checks for the real built app. The webServer runs the
  production Express process against a throwaway DB on port 3107, so
  `npm test` (API) and `npm run test:ui` (browser) are fully isolated.

  Locally, set PLAYWRIGHT_CHANNEL=msedge to use the installed Edge browser
  instead of downloading Chromium. CI uses the default bundled Chromium.
*/
const port = process.env.UI_TEST_PORT || "3107";
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: channel || "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(channel ? { channel } : {}),
      },
    },
  ],

  webServer: {
    command: "node scripts/serve-ui-test.js",
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
