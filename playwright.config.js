/**
 * Playwright configuration for the end-to-end journeys, run against a running stack (API with demonstration data,
 * worker and Vite on port 5190).
 *
 * Tests run one at a time because they share the demonstration database. They use the locally installed Google
 * Chrome (set PW_CHANNEL=chromium where Playwright's bundled browser is supported), and screenshots and traces are
 * kept only for failures.
 *
 * @author Kwasi Adabo Boakye
 */

import { defineConfig } from '@playwright/test';

// End-to-end journeys against a running stack (API on :4200 with demo seed, Vite on :5190).
// Uses the locally installed Chrome; set PW_CHANNEL=chromium where Playwright's bundled browser is supported.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5190',
    channel: process.env.PW_CHANNEL || 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
