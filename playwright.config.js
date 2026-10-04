// Dev-only Playwright config. Loads index.html over file:// (no HTTP server).
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Perf is measured as absolute fps, so it must not share the machine with
      // parallel workers; it runs in the isolated 'perf' project below.
      testIgnore: /perf\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'perf',
      testMatch: /perf\.spec\.js/,
      fullyParallel: false,
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
