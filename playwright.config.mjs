import { defineConfig } from '@playwright/test';

// Browser tests. Each test file sets its own fake-microphone audio.
// Locally, set CHROME_PATH to use an installed Chrome instead of Playwright's Chromium.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: {
    command: 'python3 -m http.server 8787',
    url: 'http://localhost:8787/',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'ignore',
  },
  use: {
    baseURL: 'http://localhost:8787/',
    viewport: { width: 390, height: 844 },
    permissions: ['microphone'],
    // help lines follow the time zone; pin it so tests do not depend on where they run
    timezoneId: 'Asia/Taipei',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {} },
    },
    {
      // Safari's engine, for everything that does not need Chrome's fake microphone. Runs in CI.
      name: 'webkit',
      use: { browserName: 'webkit', permissions: [] },
      testIgnore: ['**/record.spec.mjs', '**/noise.spec.mjs'],
    },
  ],
});
