import { defineConfig, devices } from "@playwright/test";

// E2E-Konfiguration für die /wetter-Seite. Startet die App lokal und testet im
// echten Browser (Chromium + Mobile-Viewport). Lauf:
//   npx playwright install --with-deps chromium   # einmalig
//   npm run build && npx playwright test
// CI-tauglich; für Prod-Smoke: PLAYWRIGHT_BASE_URL=https://join-the-captain.org npx playwright test
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Nur lokal die App hochfahren (nicht gegen eine externe baseURL).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
