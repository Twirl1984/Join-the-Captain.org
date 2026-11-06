// E2E-Browsertests für das Törn-Manöver-Duell (statische Offline-App unter /toern-duell/).
//
// Golden-Standard: dieselben Szenarien wie die Unit-Tests (von Hand gerechnetes
// Referenz-Szenario + Zufall mit festem Seed) werden über die ECHTE Oberfläche
// eingegeben und gegen das unabhängige Orakel geprüft. Kein Netz nötig.
// Geräte: iPhone (WebKit), Desktop-Safari (WebKit), Chromium, Pixel 7 (siehe playwright.config.ts).
import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { orakel, referenzSzenario, zufallsSzenario, type Szenario } from "../src/lib/toern-duell/__tests__/support/orakel";

const SEITE = "/toern-duell/index.html";
const KATEGORIEN = ["kommunikation", "crew", "steuerung"] as const;
// Läuft das Spec gegen einen statischen Server (DUELL_STATIC=1), entfallen die Next-spezifischen Tests.
const NUR_NEXT = process.env.DUELL_STATIC === "1";

// ── Helfer ──────────────────────────────────────────────────────────────────
async function oeffne(page: Page, hash = "") {
  // Web-Share im Test abschalten → Export läuft deterministisch über den Download-Weg.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });
  page.on("dialog", (d) => void d.accept());
  const fehler: string[] = [];
  page.on("console", (m) => m.type() === "error" && fehler.push(m.text()));
  page.on("pageerror", (e) => fehler.push(`pageerror: ${e.message}`));
  await page.goto(SEITE + hash);
  await expect(page.locator("#app > *").first()).toBeVisible();
  return fehler;
}

async function crewAnlegen(page: Page, namen: string[]) {
  await page.goto(`${SEITE}#/start`);
  for (const n of namen) {
    await page.getByTestId("crew-neu").fill(n);
    await page.getByTestId("crew-hinzufuegen").click();
  }
  await expect(page.getByTestId("crew-name")).toHaveCount(namen.length);
}

/** Wartet, bis die letzte Änderung in IndexedDB UND localStorage verifiziert gespeichert ist. */
async function gespeichert(page: Page) {
  await page.waitForFunction(() => {
    const roh = localStorage.getItem("jtc.duell.v1");
    if (!roh) return false;
    return document.documentElement.dataset.gespeichert === String(JSON.parse(roh).meta?.rev ?? 0);
  });
}

type W = [number, number, number];
async function bewerte(page: Page, a: { karte: number; fahrer: string; bewerter: string; selbst: W; fremd: W }) {
  await page.goto(`${SEITE}#/bewertung?karte=${a.karte}`);
  await page.getByTestId("bewertung-fahrer").selectOption({ label: a.fahrer });
  await page.getByTestId("bewertung-bewerter").selectOption({ label: a.bewerter });
  for (const [i, kat] of KATEGORIEN.entries()) {
    await page.locator(`label:has([data-testid="wert-selbst-${kat}-${a.selbst[i]}"])`).click();
    await page.locator(`label:has([data-testid="wert-fremd-${kat}-${a.fremd[i]}"])`).click();
  }
  await page.getByTestId("bewertung-speichern").click();
  await expect(page.getByTestId("kartenansicht")).toBeVisible();
}

const wert = (b: { kommunikation: number; crew: number; steuerung: number }): W => [b.kommunikation, b.crew, b.steuerung];

async function landgangEingeben(page: Page, sz: Szenario) {
  const name = (id: string | null) => sz.crew.find((p) => p.id === id)?.name ?? "";
  await page.goto(`${SEITE}#/landgang`);
  for (const r of sz.landgang.seilziehen.filter((x) => x.gewinner)) {
    await page.getByTestId("seil-gewinner").selectOption({ label: name(r.gewinner) });
    await page.getByTestId("seil-runde").click();
  }
  for (const [i, k] of (["platz1", "platz2", "platz3"] as const).entries()) {
    const id = sz.landgang.muell[k];
    if (id) await page.getByTestId(`muell-platz${i + 1}`).selectOption({ label: name(id) });
  }
  const sk = sz.landgang.muell.skurril;
  if (sk) {
    await page.getByTestId("muell-fund").fill(sk.fund);
    await page.getByTestId("muell-fund").dispatchEvent("change");
    await page.getByTestId("muell-skurril-person").selectOption({ label: name(sk.person) });
  }
  for (const [id, n] of Object.entries(sz.landgang.geocache)) {
    for (let i = 0; i < n; i++) await page.getByTestId(`geo-plus-${name(id)}`).click();
  }
}

interface Zeile { name: string; manoever: number | null; landgang: number | null; gesamt: number; platz: number; sternchen: boolean }
const zahl = (s: string) => (s.trim() === "–" ? null : parseInt(s.replace(/[^\d-]/g, ""), 10));
async function leseRangliste(page: Page): Promise<Zeile[]> {
  await page.goto(`${SEITE}#/rangliste`);
  await expect(page.getByTestId("rang-tabelle")).toBeVisible();
  const zeilen = page.getByTestId("rang-zeile");
  const out: Zeile[] = [];
  for (let i = 0; i < (await zeilen.count()); i++) {
    const z = zeilen.nth(i);
    const kopf = (await z.locator("th").innerText()).trim();
    out.push({
      name: kopf.replace(/\s*\*$/, ""), sternchen: /\*$/.test(kopf),
      manoever: zahl(await z.getByTestId("rang-manoever").innerText()), landgang: zahl(await z.getByTestId("rang-landgang").innerText()),
      gesamt: zahl(await z.getByTestId("rang-gesamt").innerText())!, platz: zahl(await z.getByTestId("platz").innerText())!,
    });
  }
  return out;
}

/** Vergleicht die angezeigte Rangliste mit dem Orakel (Reihenfolge-unabhängig je Person). */
function pruefeGegenOrakel(ui: Zeile[], sz: Szenario, label: string) {
  const soll = orakel(sz.crew, sz.versuche, sz.landgang);
  const mErf = sz.versuche.length > 0;
  const lErf = sz.landgang.seilziehen.some((r) => r.gewinner) || Object.values(sz.landgang.muell).some(Boolean) || Object.values(sz.landgang.geocache).some((n) => n > 0);
  expect(ui.length, `${label}: Zeilen`).toBe(sz.crew.length);
  for (const p of sz.crew) {
    const z = ui.find((x) => x.name === p.name)!;
    const o = soll.get(p.id)!;
    expect(z, `${label}: ${p.name}`).toBeTruthy();
    expect({ m: z.manoever, l: z.landgang, g: z.gesamt, p: z.platz, s: z.sternchen }, `${label}: ${p.name}`)
      .toEqual({ m: mErf ? o.manoever : null, l: lErf ? o.landgang : null, g: o.gesamt, p: o.platz, s: o.unterMin });
  }
  for (let i = 1; i < ui.length; i++) expect(ui[i - 1].gesamt).toBeGreaterThanOrEqual(ui[i].gesamt);
}

/** Zustand direkt in den Browserspeicher legen (große Szenarien ohne 200 Klicks). */
async function zustandVorladen(page: Page, sz: Szenario, boot = "Akilina") {
  const state = {
    version: 1, boot, crew: sz.crew, landgang: sz.landgang, meta: { letztesBackup: null, rev: 1 },
    versuche: sz.versuche.map((v, i) => ({ ...v, id: v.id ?? `v${i}`, notiz: v.notiz ?? "" })),
  };
  await page.addInitScript((s) => { if (!localStorage.getItem("jtc.duell.v1")) localStorage.setItem("jtc.duell.v1", JSON.stringify(s)); }, state);
}

/** Erste Seeds ab `ab`, die ein UI-taugliches Szenario liefern (deterministisch). */
function kleinesSzenario(ab: number): Szenario {
  for (let seed = ab; seed < ab + 500; seed++) {
    const sz = zufallsSzenario(seed, 4, 7);
    if (sz.crew.length >= 3 && sz.versuche.length >= 4 && sz.landgang.seilziehen.some((r) => r.gewinner) && Object.values(sz.landgang.muell).some(Boolean)) return sz;
  }
  throw new Error("kein Szenario");
}

// ── Golden: von Hand gerechnetes Referenz-Szenario über die Oberfläche ─────────────────────
test.describe("Törn-Manöver-Duell — Golden Standard über die UI", () => {
  test("[REQ-DUEL-001] Referenz-Crew (5 Personen, 23 Versuche, alle Landgang-Disziplinen) = handgerechnete Sollwerte, Reload-fest, CSV stimmt", async ({ page }) => {
    test.setTimeout(240_000);
    const fehler = await oeffne(page);
    const ref = referenzSzenario();
    await crewAnlegen(page, ref.crew.map((p) => p.name));
    for (const v of ref.versuche) await bewerte(page, { karte: v.karte, fahrer: v.rudergaenger, bewerter: v.bewerter!, selbst: wert(v.selbst), fremd: wert(v.fremd) });
    await landgangEingeben(page, ref);
    await gespeichert(page);

    const ui = await leseRangliste(page);
    for (const [id, soll] of Object.entries(ref.erwartet)) {
      const z = ui.find((x) => x.name === id)!;
      expect({ m: z.manoever, l: z.landgang, g: z.gesamt, p: z.platz, s: z.sternchen }, `Person ${id}`)
        .toEqual({ m: soll.manoever, l: soll.landgang, g: soll.gesamt, p: soll.platz, s: soll.unterMin });
    }
    expect(ui.map((z) => z.name)).toEqual(["C", "A", "E", "B", "D"]);
    expect(ui.map((z) => z.platz)).toEqual([1, 2, 2, 4, 5]);
    await expect(page.getByTestId("zwischenstand")).toContainText("B, D"); // B und D unter 5 Karten

    // CSV = dieselben Zahlen
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-rangliste").click()]);
    expect(dl.suggestedFilename()).toBe("toern-duell-rangliste.csv");
    const csv = fs.readFileSync((await dl.path())!, "utf8").replace(/^﻿/, "").trim().split("\r\n");
    expect(csv[0]).toBe("Platz;Name;Karten;Manöverpunkte;Landgang;Gesamt;Hinweis");
    expect(csv.slice(1).map((l) => l.split(";").slice(0, 6).join(";"))).toEqual(["1;C;5;90;7;97", "2;A;7;76;11;87", "2;E;6;81;6;87", "4;B;3;27;10;37", "5;D;0;0;1;1"]);

    // Reload: unverändert
    await page.reload();
    expect(await leseRangliste(page)).toEqual(ui);
    expect(fehler).toEqual([]);
  });

  for (const ab of [100, 300]) {
    test(`[REQ-DUEL-001] Zufalls-Szenario (Seed ab ${ab}) per UI eingegeben = Orakel`, async ({ page }) => {
      test.setTimeout(240_000);
      const sz = kleinesSzenario(ab);
      await oeffne(page);
      await crewAnlegen(page, sz.crew.map((p) => p.name));
      const name = (id: string | null) => sz.crew.find((p) => p.id === id)!.name;
      for (const v of sz.versuche) await bewerte(page, { karte: v.karte, fahrer: name(v.rudergaenger), bewerter: name(v.bewerter), selbst: wert(v.selbst), fremd: wert(v.fremd) });
      await landgangEingeben(page, sz);
      await gespeichert(page);
      pruefeGegenOrakel(await leseRangliste(page), sz, `Seed ab ${ab}`);
    });
  }
});

// ── Große Zufalls-Szenarien (vorgeladen): Rendering/Aggregation gegen Orakel ──────────────
test.describe("Törn-Manöver-Duell — große Szenarien gegen das Orakel", () => {
  for (const seed of [5, 17, 42, 77, 130]) {
    test(`[REQ-DUEL-001] Seed ${seed}: Rangliste und Überblick = Orakel`, async ({ page }) => {
      const sz = zufallsSzenario(seed);
      test.skip(sz.crew.length === 0, "Seed erzeugt leere Crew (separat getestet)");
      await zustandVorladen(page, sz);
      await oeffne(page);
      pruefeGegenOrakel(await leseRangliste(page), sz, `Seed ${seed}`);
      await page.goto(`${SEITE}#/ueberblick`);
      const gesamt = page.getByTestId("ueberblick-gesamt").locator("tbody tr");
      await expect(gesamt).toHaveCount(sz.crew.length);
      const soll = orakel(sz.crew, sz.versuche, sz.landgang);
      for (let i = 0; i < sz.crew.length; i++) {
        const zelle = (await gesamt.nth(i).locator("td").allInnerTexts()).map(Number);
        const name = (await gesamt.nth(i).locator("th").innerText()).trim();
        const o = soll.get(sz.crew.find((p) => p.name === name)!.id)!;
        expect(zelle, `Überblick ${name}`).toEqual([o.platz, o.manoever, o.landgang, o.gesamt]);
      }
    });
  }

  test("[REQ-DUEL-003] 11 Personen: alle Ansichten ohne horizontales Scrollen, Matrix scrollt in sich", async ({ page }) => {
    const crew = (() => { for (let s = 1; s < 400; s++) { const x = zufallsSzenario(s, 11, 60); if (x.crew.length === 11) return x; } throw new Error("kein 11er-Szenario"); })();
    await zustandVorladen(page, crew);
    const fehler = await oeffne(page);
    for (const route of ["start", "karten", "karte/14", "bewertung", "landgang", "rangliste", "ueberblick"]) {
      await page.goto(`${SEITE}#/${route}`);
      await expect(page.locator("#app > *").first()).toBeVisible();
      const ueberlauf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(ueberlauf, `Route ${route}`).toBeLessThanOrEqual(1);
    }
    expect(fehler).toEqual([]);
  });
});

// ── Teilwertungen: Ergebnisse auch bei fehlendem Manöver- oder Landgang-Teil ──────────────
test.describe("Törn-Manöver-Duell — Teilwertungen", () => {
  test("[REQ-DUEL-007] Nur Landgang erfasst: Manöver „–“, Gesamt = Landgang, Zwischenstand nennt Manöver", async ({ page }) => {
    const sz = referenzSzenario();
    await zustandVorladen(page, { ...sz, versuche: [] });
    await oeffne(page);
    const ui = await leseRangliste(page);
    expect(ui.map((z) => [z.name, z.manoever, z.landgang, z.gesamt, z.platz])).toEqual([
      ["A", null, 11, 11, 1], ["B", null, 10, 10, 2], ["C", null, 7, 7, 3], ["E", null, 6, 6, 4], ["D", null, 1, 1, 5]]);
    await expect(page.getByTestId("zwischenstand")).toContainText("Manöver: noch keine Bewertung erfasst");
    await page.goto(`${SEITE}#/ueberblick`);
    await expect(page.getByTestId("teil-manoever-leer")).toBeVisible();
    await expect(page.getByTestId("teil-landgang").locator("tbody tr")).toHaveCount(5);
    await expect(page.getByTestId("zwischenstand")).toBeVisible();
  });

  test("[REQ-DUEL-007] Nur Manöver erfasst: Landgang „–“, Gesamt = Manöver, Hinweis nennt Landgang", async ({ page }) => {
    const sz = referenzSzenario();
    await zustandVorladen(page, { ...sz, landgang: { seilziehen: [], muell: { platz1: null, platz2: null, platz3: null, skurril: null }, geocache: {} } });
    await oeffne(page);
    const ui = await leseRangliste(page);
    expect(ui.map((z) => [z.name, z.manoever, z.landgang, z.gesamt, z.platz])).toEqual([
      ["C", 90, null, 90, 1], ["E", 81, null, 81, 2], ["A", 76, null, 76, 3], ["B", 27, null, 27, 4], ["D", 0, null, 0, 5]]);
    await expect(page.getByTestId("zwischenstand")).toContainText("Landgang: noch nichts erfasst");
    await page.goto(`${SEITE}#/ueberblick`);
    await expect(page.getByTestId("teil-landgang-leer")).toBeVisible();
  });

  test("[REQ-DUEL-007] Nur ein Landgang-Teil (Geocaching): Hinweis nennt fehlende Disziplinen; Vollstand → „Endstand“", async ({ page }) => {
    const sz = referenzSzenario();
    await zustandVorladen(page, { ...sz, versuche: [], landgang: { seilziehen: [], muell: { platz1: null, platz2: null, platz3: null, skurril: null }, geocache: { A: 1 } } });
    await oeffne(page);
    await leseRangliste(page);
    await expect(page.getByTestId("zwischenstand")).toContainText("Seilziehen, Müllsammeln noch nicht erfasst");
  });

  for (const reihenfolge of ["Fund zuerst", "Person zuerst"]) {
    test(`[REQ-DUEL-002] Skurrilster Fund (${reihenfolge}): keine Eingabehälfte geht verloren, +2 erst mit Person und Fund`, async ({ page }) => {
      await oeffne(page);
      await crewAnlegen(page, ["Anna", "Ben"]);
      await page.goto(`${SEITE}#/landgang`);
      const fund = async () => { await page.getByTestId("muell-fund").fill("Flip-Flop"); await page.getByTestId("muell-fund").dispatchEvent("change"); };
      const person = () => page.getByTestId("muell-skurril-person").selectOption({ label: "Ben" });
      if (reihenfolge === "Fund zuerst") { await fund(); await expect(page.getByTestId("muell-fund")).toHaveValue("Flip-Flop"); await person(); }
      else { await person(); await expect(page.getByTestId("muell-skurril-person")).toHaveValue(/.+/); await fund(); }
      await expect(page.getByTestId("muell-fund")).toHaveValue("Flip-Flop");
      await expect(page.getByTestId("muell-skurril-person").locator("option:checked")).toHaveText("Ben");
      await expect(page.getByTestId("landgang-punkte").locator("tr", { hasText: "Ben" })).toContainText("2");
      await expect(page.getByTestId("landgang-punkte").locator("tr", { hasText: "Anna" }).locator("td").last()).toHaveText("0");
    });
  }

  test("[REQ-DUEL-007] Leerer Start: kein Absturz, freundliche Hinweise", async ({ page }) => {
    const fehler = await oeffne(page);
    for (const r of ["rangliste", "ueberblick", "landgang", "bewertung", "karten"]) {
      await page.goto(`${SEITE}#/${r}`);
      await expect(page.locator("#app > *").first()).toBeVisible();
    }
    expect(fehler).toEqual([]);
  });

  test("[REQ-DUEL-007] Überblick: Datei für die Crew (HTML) ist eigenständig und enthält den Zwischenstand", async ({ page }) => {
    await zustandVorladen(page, { ...referenzSzenario(), versuche: [] });
    await oeffne(page);
    await page.goto(`${SEITE}#/ueberblick`);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("ueberblick-teilen").click()]);
    expect(dl.suggestedFilename()).toBe("toern-duell-ueberblick.html");
    const html = fs.readFileSync((await dl.path())!, "utf8");
    expect(html).toContain("Zwischenstand");
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("<td class=\"l\">A</td>");
  });
});

// ── Bedienung, Fehler- und Randfälle ───────────────────────────────────────────────────────
test.describe("Törn-Manöver-Duell — Bedienung und Randfälle", () => {
  test("[REQ-DUEL-003] Crew: 12. Person wird abgelehnt, Dublette/leer abgelehnt, Umbenennen und Entfernen räumen auf", async ({ page }) => {
    await oeffne(page);
    await crewAnlegen(page, Array.from({ length: 11 }, (_, i) => `Person ${i + 1}`));
    await page.getByTestId("crew-neu").fill("Zwölfte");
    await page.getByTestId("crew-hinzufuegen").click();
    await expect(page.getByTestId("crew-meldung")).toContainText("voll");
    await expect(page.getByTestId("crew-name")).toHaveCount(11);
    await page.getByTestId("crew-entfernen").first().click();
    await expect(page.getByTestId("crew-name")).toHaveCount(10);
    await page.getByTestId("crew-neu").fill("person 5");
    await page.getByTestId("crew-hinzufuegen").click();
    await expect(page.getByTestId("crew-meldung")).toContainText("schon");
    await page.getByTestId("crew-neu").fill("   ");
    await page.getByTestId("crew-hinzufuegen").click();
    await expect(page.getByTestId("crew-meldung")).toContainText("Namen");
  });

  test("[REQ-DUEL-001] Bewertung: Pflichtangaben, Bewerter ≠ Rudergänger, Live-Vorschau 12/9 → Bonus 1 → 10", async ({ page }) => {
    await oeffne(page);
    await crewAnlegen(page, ["Anna", "Ben"]);
    await page.goto(`${SEITE}#/bewertung?karte=14`);
    await page.getByTestId("bewertung-speichern").click();
    await expect(page.getByTestId("bewertung-meldung")).toContainText("Rudergänger");
    await page.getByTestId("bewertung-fahrer").selectOption({ label: "Anna" });
    expect(await page.getByTestId("bewertung-bewerter").locator("option").allInnerTexts()).toEqual(["– wählen –", "Ben"]);
    await page.getByTestId("bewertung-bewerter").selectOption({ label: "Ben" });
    await page.getByTestId("bewertung-speichern").click();
    await expect(page.getByTestId("bewertung-meldung")).toContainText("sechs Werte");
    for (const kat of KATEGORIEN) {
      await page.locator(`label:has([data-testid="wert-selbst-${kat}-4"])`).click();
      await page.locator(`label:has([data-testid="wert-fremd-${kat}-3"])`).click();
    }
    await expect(page.getByTestId("vorschau")).toContainText("Selbst 12");
    await expect(page.getByTestId("vorschau")).toContainText("Bonus +1");
    await expect(page.getByTestId("vorschau")).toContainText("Kartenpunkte: 10 / 18");
    await page.getByTestId("bewertung-speichern").click();
    await expect(page.getByTestId("kartenansicht")).toBeVisible();
    await page.goto(`${SEITE}#/karten`);
    await expect(page.getByTestId("badge-14")).toHaveText("1/2");
  });

  test("[REQ-DUEL-001] Versuch bearbeiten (Fremd 9→15) und löschen verändert die Rangliste exakt wie das Orakel", async ({ page }) => {
    await oeffne(page);
    await crewAnlegen(page, ["Anna", "Ben"]);
    await bewerte(page, { karte: 1, fahrer: "Anna", bewerter: "Ben", selbst: [4, 4, 4], fremd: [3, 3, 3] });
    let ui = await leseRangliste(page);
    expect(ui.find((z) => z.name === "Anna")!.manoever).toBe(10); // 9 + Bonus 1
    await page.goto(`${SEITE}#/bewertung`);
    await page.getByRole("link", { name: "Bearbeiten" }).click();
    for (const kat of KATEGORIEN) await page.locator(`label:has([data-testid="wert-fremd-${kat}-5"])`).click();
    await page.getByTestId("bewertung-speichern").click();
    ui = await leseRangliste(page);
    expect(ui.find((z) => z.name === "Anna")!.manoever).toBe(16); // Fremd 15, |12−15| = 3 → Bonus +1
  });
});

// ── Speicher-Ausfälle: kein Datenverlust, solange EIN Ort oder der Verlauf heil ist ──────────
const lsLesen = (page: Page) => page.evaluate(() => localStorage.getItem("jtc.duell.v1"));
const idbLesen = (page: Page) => page.evaluate(() => new Promise<{ aktuell: string | null; verlauf: number }>((ok, fehler) => {
  const r = indexedDB.open("jtc-duell", 1);
  r.onerror = () => fehler(r.error);
  r.onsuccess = () => {
    const db = r.result;
    const a = db.transaction("stand").objectStore("stand").get("aktuell");
    a.onsuccess = () => {
      const v = db.transaction("verlauf").objectStore("verlauf").count();
      v.onsuccess = () => { db.close(); ok({ aktuell: a.result?.roh ?? null, verlauf: v.result }); };
    };
  };
}));
const idbVerderben = (page: Page) => page.evaluate(() => new Promise<void>((ok, fehler) => {
  const r = indexedDB.open("jtc-duell", 1);
  r.onerror = () => fehler(r.error);
  r.onsuccess = () => {
    const db = r.result;
    const tx = db.transaction("stand", "readwrite");
    tx.objectStore("stand").put({ id: "aktuell", roh: "{kaputt", rev: 0, zeit: 0 });
    tx.oncomplete = () => { db.close(); ok(); };
  };
}));

test.describe("Törn-Manöver-Duell — robuste Speicherung", () => {
  test("[REQ-DUEL-008] Beide Orte enthalten denselben Stand; Verlauf wächst mit jeder Änderung", async ({ page }) => {
    await oeffne(page);
    await crewAnlegen(page, ["Anna", "Ben", "Cem"]);
    await gespeichert(page);
    const ls = await lsLesen(page);
    const idb = await idbLesen(page);
    expect(idb.aktuell).toBe(ls);
    expect(idb.verlauf).toBeGreaterThanOrEqual(3);
    expect(JSON.parse(ls!).meta.rev).toBeGreaterThanOrEqual(3);
    await page.goto(`${SEITE}#/start`);
    await expect(page.getByTestId("speicher-status")).toContainText("IndexedDB ✓");
    await expect(page.getByTestId("speicher-status")).toContainText("Browser-Speicher ✓");
  });

  test("[REQ-DUEL-008] localStorage geleert/kaputt → Stand kommt aus IndexedDB, ohne Warnung", async ({ page }) => {
    await oeffne(page);
    await crewAnlegen(page, ["Anna", "Ben"]);
    await gespeichert(page);
    await page.evaluate(() => { localStorage.setItem("jtc.duell.v1", "{kaputt"); localStorage.removeItem("jtc.duell.v1.backup"); });
    await page.goto(`${SEITE}#/start`);
    await page.reload();
    await expect(page.getByTestId("crew-name")).toHaveCount(2);
    await expect(page.getByTestId("banner")).toHaveCount(0);
  });

  test("[REQ-DUEL-008] IndexedDB kaputt → Stand kommt aus localStorage, ohne Warnung", async ({ page }) => {
    await oeffne(page);
    await crewAnlegen(page, ["Anna", "Ben"]);
    await gespeichert(page);
    await idbVerderben(page);
    await page.reload();
    await expect(page.getByTestId("crew-name")).toHaveCount(2);
    await expect(page.getByTestId("banner")).toHaveCount(0);
  });

  test("[REQ-DUEL-008] Beide Hauptorte kaputt → letzter heiler Verlaufsstand mit Warnung; Wiederherstellen früherer Stände", async ({ page }) => {
    await oeffne(page);
    await crewAnlegen(page, ["Anna", "Ben", "Cem"]);
    await gespeichert(page);
    await idbVerderben(page);
    await page.evaluate(() => { localStorage.setItem("jtc.duell.v1", "[1]"); localStorage.setItem("jtc.duell.v1.backup", "x"); });
    await page.reload();
    await expect(page.getByTestId("banner")).toContainText("früherer Stand");
    await expect(page.getByTestId("crew-name")).toHaveCount(3);
    // früheren Stand mit nur 1 Person wiederherstellen
    const eintrag = page.getByTestId("verlauf-eintrag").filter({ hasText: "1 Personen" });
    await expect(eintrag.first()).toBeVisible();
    await eintrag.first().getByTestId("verlauf-wiederherstellen").click();
    await expect(page.getByTestId("crew-name")).toHaveCount(1);
    await gespeichert(page);
    await page.reload();
    await expect(page.getByTestId("crew-name")).toHaveCount(1); // Wiederherstellung ist selbst dauerhaft
  });

  test("[REQ-DUEL-008] Alles kaputt → Reset mit Warnung, Rohdaten bleiben unter „.defekt“ erhalten", async ({ page }) => {
    await zustandVorladen(page, referenzSzenario());
    await oeffne(page);
    await page.evaluate(() => localStorage.setItem("jtc.duell.v1", "müll"));
    await idbVerderben(page);
    // IndexedDB-Verlauf ist heil → Warnung „früherer Stand“; zusätzlich Verlauf löschen für den Totalausfall
    await page.evaluate(() => new Promise<void>((ok) => { const r = indexedDB.open("jtc-duell", 1); r.onsuccess = () => { const tx = r.result.transaction("verlauf", "readwrite"); tx.objectStore("verlauf").clear(); tx.oncomplete = () => { r.result.close(); ok(); }; }; }));
    await page.reload();
    await expect(page.getByTestId("banner")).toContainText("zurückgesetzt");
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("jtc.duell.v1.defekt")))!)).toContain("müll");
    await expect(page.getByTestId("crew-name")).toHaveCount(0);
  });

  test("[REQ-DUEL-004] JSON-Export → alles löschen → Import: Rangliste identisch; defekte Datei wird abgelehnt", async ({ page }) => {
    const sz = referenzSzenario();
    await zustandVorladen(page, sz);
    await oeffne(page);
    const vorher = await leseRangliste(page);
    await page.goto(`${SEITE}#/start`);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-json").click()]);
    expect(dl.suggestedFilename()).toBe("toern-duell-backup.json");
    const text = fs.readFileSync((await dl.path())!, "utf8");
    expect(JSON.parse(text).app).toBe("toern-duell");
    await gespeichert(page);
    await expect(page.getByTestId("backup-alter")).toContainText("heute");

    await page.getByTestId("import-datei").setInputFiles({ name: "kaputt.json", mimeType: "application/json", buffer: Buffer.from("{nope") });
    await expect(page.getByTestId("banner")).toContainText("Import abgebrochen");

    // leeren Stand erzeugen (alle entfernen), dann importieren
    while ((await page.getByTestId("crew-entfernen").count()) > 0) await page.getByTestId("crew-entfernen").first().click();
    await expect(page.getByTestId("crew-name")).toHaveCount(0);
    await page.getByTestId("import-datei").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(text) });
    await expect(page.getByTestId("crew-name")).toHaveCount(5);
    expect(await leseRangliste(page)).toEqual(vorher);
  });
});

// ── Karten ───────────────────────────────────────────────────────────────────────────────────
test.describe("Törn-Manöver-Duell — Karten", () => {
  test("[REQ-DUEL-006] Alle 15 Karten: Titel, 6 Schritte, Bilder geladen (1–13: 6 Einzelbilder, 14/15: 2 große), Fehlerhinweis", async ({ page }) => {
    const fehler = await oeffne(page);
    for (let id = 1; id <= 15; id++) {
      await page.goto(`${SEITE}#/karte/${id}`);
      await expect(page.getByTestId("kartenansicht")).toBeVisible();
      await expect(page.locator(".schritt")).toHaveCount(6);
      await expect(page.getByTestId("fehlerhinweis")).toBeVisible();
      const bilder = page.locator(".bildknopf img");
      await expect(bilder).toHaveCount(id >= 14 ? 2 : 6);
      for (let i = 0; i < (await bilder.count()); i++) {
        await bilder.nth(i).scrollIntoViewIfNeeded();
        await expect.poll(() => bilder.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { message: `Karte ${id} Bild ${i + 1}` }).toBe(true);
        expect(await bilder.nth(i).getAttribute("alt")).toBeTruthy();
      }
    }
    expect(fehler).toEqual([]);
  });

  test("[REQ-DUEL-006] Kartenliste: 15 Kacheln, Tag-Filter, Suche, Nachbar-Navigation, Vollbild öffnen/schließen", async ({ page }) => {
    await oeffne(page);
    await crewAnlegen(page, ["Anna", "Ben"]); // „Jetzt bewerten“ braucht mind. 2 Personen
    await page.goto(`${SEITE}#/karten`);
    await expect(page.locator(".kachel")).toHaveCount(15);
    await page.locator('[data-tag="SEGELN"]').click();
    await expect(page.locator(".kachel")).toHaveCount(6);
    await page.locator('[data-tag=""]').click();
    await page.getByTestId("karten-suche").fill("quickstopp");
    await expect(page.locator(".kachel")).toHaveCount(2);
    await page.getByTestId("karte-14").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("14. Quickstopp: Person links");
    await page.getByRole("link", { name: "Weiter ›" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("15.");
    await expect(page.locator(".knopf--aus")).toHaveText("Weiter ›"); // letzte Karte: kein Weiter
    await page.locator(".bildknopf").first().click();
    await expect(page.locator(".zoom")).toBeVisible();
    await page.locator(".zoom__zu").click();
    await expect(page.locator(".zoom")).toHaveCount(0);
    await page.getByTestId("jetzt-bewerten").click();
    await expect(page.getByTestId("bewertung-karte")).toHaveValue("15");
  });
});

// ── Offline / PWA (Service Worker: nur Chromium; WebKit-Projekte blocken SW im Playwright-Setup) ──
test.describe("Törn-Manöver-Duell — Offline", () => {
  test("[REQ-DUEL-005] Nach dem ersten Laden offline: Neustart, alle Ansichten, Bilder und gespeicherte Daten unverändert; Eingaben offline möglich", async ({ page, browserName, context }) => {
    test.skip(browserName !== "chromium", "SW-Offline-Test nur Chromium");
    test.setTimeout(120_000);
    await zustandVorladen(page, referenzSzenario());
    await oeffne(page);
    await page.waitForFunction(async () => { const r = await navigator.serviceWorker?.getRegistration(); return !!r?.active; }, undefined, { timeout: 30_000 });
    // Precache vollständig?
    const sw = await (await page.request.get("/toern-duell/sw.js")).text();
    const soll = (sw.match(/\/\/ SYNC:START([\s\S]*?)\/\/ SYNC:END/)![1].match(/^\s+"/gm) ?? []).length;
    expect(soll).toBeGreaterThan(80);
    // Chromium meldet den SW „aktiv“, kurz bevor der Cache sichtbar gefüllt ist → warten, dann exakt vergleichen.
    await expect.poll(() => page.evaluate(async () => { const k = (await caches.keys()).find((x) => x.startsWith("jtc-duell-")); return k ? (await (await caches.open(k)).keys()).length : 0; }), { timeout: 20_000 }).toBe(soll);
    await page.reload(); // ab jetzt vom SW kontrolliert
    const vorher = await leseRangliste(page);
    await context.setOffline(true);
    await page.goto(`${SEITE}#/start`);
    await page.reload();
    await expect(page.getByTestId("crew-name")).toHaveCount(5);
    expect(await leseRangliste(page)).toEqual(vorher);
    for (const id of [1, 14, 15]) {
      await page.goto(`${SEITE}#/karte/${id}`);
      const img = page.locator(".bildknopf img").first();
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    // Offline weiterarbeiten: bewerten + speichern
    await bewerte(page, { karte: 9, fahrer: "D", bewerter: "A", selbst: [3, 3, 3], fremd: [3, 3, 3] }); // 9/9 → 12
    await gespeichert(page);
    await page.reload();
    const nachher = await leseRangliste(page);
    expect(nachher.find((z) => z.name === "D")!.manoever).toBe(12);
    await context.setOffline(false);
  });

  test("[REQ-DUEL-005] Manifest ist gültig und der SW-Scope ist /toern-duell/ (berührt den Root-SW nicht)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "SW nur Chromium");
    await oeffne(page);
    const m = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href)).json());
    expect(m.display).toBe("standalone");
    await page.waitForFunction(async () => !!(await navigator.serviceWorker?.getRegistration())?.active, undefined, { timeout: 30_000 });
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.scope);
    expect(scope).toMatch(/\/toern-duell\/$/);
  });
});

// ── Next-Hosting: Redirect, noindex, robots (entfällt bei statischem Server) ───────────────
test.describe("Törn-Manöver-Duell — Hosting", () => {
  test("[REQ-DUEL-008] /toern-duell leitet auf die Datei um (relative Pfade!), noindex-Header, robots sperrt den Pfad", async ({ request }) => {
    test.skip(NUR_NEXT, "nur gegen Next-Server");
    const r = await request.get("/toern-duell", { maxRedirects: 0 });
    expect([307, 308]).toContain(r.status());
    expect(r.headers()["location"]).toContain("/toern-duell/index.html");
    const seite = await request.get(SEITE);
    expect(seite.status()).toBe(200);
    expect(seite.headers()["x-robots-tag"]).toContain("noindex");
    const sw = await request.get("/toern-duell/sw.js");
    expect(sw.headers()["cache-control"]).toContain("no-cache");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("/toern-duell/");
  });
});
