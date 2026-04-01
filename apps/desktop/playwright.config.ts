import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 300_000, // 5 min per test
  retries: 0,
  workers: 1, // Serial — one Electron instance
  reporter: [["list"], ["html", { outputFolder: "e2e-report" }]],
  outputDir: "e2e-screenshots",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
});
