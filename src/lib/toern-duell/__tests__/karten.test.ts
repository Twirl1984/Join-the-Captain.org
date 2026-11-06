// Unit-Tests: Router und reine Kartenlogik (Filter, Badge, Nachbarn, Alt-Text).
import { test } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import * as R from "../../../../public/toern-duell/router.js";
import * as K from "../../../../public/toern-duell/karten.js";

const karten = JSON.parse(fs.readFileSync("public/toern-duell/cards.json", "utf8"));

test("[REQ-DUEL-006] parseHash: bekannte Routen, Karte mit ID, Query", () => {
  assert.equal(R.parseHash("").name, "start");
  assert.equal(R.parseHash("#/karten").name, "karten");
  assert.deepEqual(R.parseHash("#/karte/10"), { name: "karte", id: 10, query: {} });
  assert.deepEqual(R.parseHash("#/bewertung?karte=3&x=a%20b").query, { karte: "3", x: "a b" });
});

test("[REQ-DUEL-006] parseHash: unbekannt → start; kaputte Karten-ID → Kartenliste", () => {
  assert.equal(R.parseHash("#/gibtsnicht").name, "start");
  assert.equal(R.parseHash("#/karte/abc").name, "karten");
  assert.equal(R.parseHash("#/karte/0").name, "karten");
  assert.equal(R.parseHash("#/karte").name, "karten");
  assert.equal(R.parseHash("#/karte/1.5").name, "karten");
});

test("[REQ-DUEL-006] hashFuer ist die Umkehrung von parseHash", () => {
  assert.equal(R.hashFuer("karte", 14), "#/karte/14");
  const h = R.hashFuer("bewertung", null, { karte: "14" });
  assert.deepEqual(R.parseHash(h), { name: "bewertung", id: null, query: { karte: "14" } });
});

test("[REQ-DUEL-006] Kartenfilter: Tag, Suche (ohne Groß/Klein), Kombination, leer", () => {
  assert.equal(K.filterKarten(karten).length, 15);
  assert.deepEqual(K.tagsVon(karten), ["HAFEN", "HAFEN & DECK", "AUFSTOPPEN", "SEGELN"]);
  assert.equal(K.filterKarten(karten, { tag: "SEGELN" }).length, 6);
  assert.deepEqual(K.filterKarten(karten, { q: "QUICKSTOPP" }).map((k: { id: number }) => k.id), [14, 15]);
  assert.deepEqual(K.filterKarten(karten, { tag: "HAFEN", q: "wende" }), []);
  assert.equal(K.filterKarten(karten, { q: "   " }).length, 15);
});

test("[REQ-DUEL-006] Badge: zählt verschiedene Crewmitglieder, nicht Versuche; Fremde ignoriert", () => {
  const crew = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  const v = (karte: number, r: string) => ({ karte, rudergaenger: r });
  const vs = [v(14, "a"), v(14, "a"), v(14, "b"), v(3, "a"), v(14, "weg")];
  assert.equal(K.gefahrenAnzahl(14, vs, crew), 2);
  assert.equal(K.gefahrenAnzahl(3, vs, crew), 1);
  assert.equal(K.gefahrenAnzahl(9, vs, crew), 0);
});

test("[REQ-DUEL-006] Nachbarn: Enden sind null", () => {
  assert.deepEqual(K.nachbarn(karten, 1), { zurueck: null, weiter: 2 });
  assert.deepEqual(K.nachbarn(karten, 15), { zurueck: 14, weiter: null });
  assert.deepEqual(K.nachbarn(karten, 99), { zurueck: null, weiter: null });
});

test("[REQ-DUEL-006] Alt-Text: Schritt-Nummer bei 6 Bildern, Bildunterschrift bei Karte 14", () => {
  assert.equal(K.bildAlt(karten[0], 2), "Schritt 3: 30–40° auf die Pier zielen");
  assert.match(K.bildAlt(karten[13], 0), /^1 Ruf/);
  assert.ok(karten.every((k: { images: string[]; stepCaptions: string[] }) => k.images.every((_, i) => K.bildAlt(k, i).length > 0)));
});
