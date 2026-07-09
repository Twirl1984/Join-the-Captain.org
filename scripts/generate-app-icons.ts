// generate-app-icons.ts — rendert public/assets/app-icon.svg als PNG
// (192/512 fürs PWA-Manifest, 1024 für die App-Stores).
//
// Nutzt das Playwright-Chromium als Renderer (kein zusätzliches Tooling nötig).
// Vorinstalliertes Chromium via env PW_CHROMIUM_PATH nutzbar (wie playwright.config).
//
// Lauf: npm run nav:icons

import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const SIZES = [192, 512, 1024];

async function main(): Promise<void> {
  const assets = path.join(process.cwd(), "public/assets");
  const svg = readFileSync(path.join(assets, "app-icon.svg"), "utf8");
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  });
  try {
    for (const size of SIZES) {
      const page = await browser.newPage({
        viewport: { width: size, height: size },
        deviceScaleFactor: 1,
      });
      // SVG randlos in exakt size x size rendern; transparent außerhalb der
      // abgerundeten Icon-Ecken (omitBackground).
      await page.setContent(
        `<!doctype html><style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
      );
      const file = path.join(assets, `app-icon-${size}.png`);
      await page.screenshot({ path: file, omitBackground: true });
      console.log(`- ${path.relative(process.cwd(), file)}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
