import { defineConfig, devices } from "@playwright/test";

// E2E-Konfiguration für die /wetter-Seite. Startet die App lokal und testet im
// echten Browser (Chromium + Mobile-Viewport). Lauf:
//   npx playwright install --with-deps chromium   # einmalig
//   npm run build && npx playwright test
// CI-tauglich; für Prod-Smoke: PLAYWRIGHT_BASE_URL=https://join-the-captain.org npx playwright test
// Port konfigurierbar, damit E2E neben einer laufenden Dev-Instanz (3000) laufen kann.
const port = process.env.PW_PORT || "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    // Optional: vorinstalliertes Chromium nutzen (z. B. Sandbox/CI mit
    // PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD) statt des versionsgebundenen Downloads.
    ...(process.env.PW_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
      : {}),
  },
  // Device-Matrix (REQ-PROC-004): die gebräuchlichsten Kombinationen —
  // Desktop Chrome/Safari, Android Chrome (Pixel 7), iOS Safari (iPhone 14).
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    // WebKit: page.route() greift nicht bei Service-Worker-kontrollierten
    // Requests (Playwright-Limit) — SW hier blocken; der Offline-Test (der den
    // SW braucht) läuft nur auf den Chromium-Projekten (test.skip auf webkit).
    { name: "safari", use: { ...devices["Desktop Safari"], serviceWorkers: "block" } },
    { name: "iphone", use: { ...devices["iPhone 14"], serviceWorkers: "block" } },
  ],
  // Nur lokal die App hochfahren (nicht gegen eine externe baseURL).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        // Ready-Check auf /wetter: DB-frei, läuft auch ohne DATABASE_URL hoch.
        url: `${baseURL}/wetter`,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
