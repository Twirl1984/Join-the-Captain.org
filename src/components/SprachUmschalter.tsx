"use client";

import { useEffect, useState } from "react";
import {
  SPRACHE_COOKIE,
  STANDARD_SPRACHE,
  andereSprache,
  normalisiereSprache,
  spracheName,
  type Sprache,
} from "@/lib/i18n/sprache";

// Schaltet zwischen Deutsch und Englisch um (REQ-I18N-001), nach dem Muster von
// ThemeToggle. Unterschied zum Theme: Die Sprache muss auch der SERVER kennen,
// damit Seiten schon übersetzt ankommen — deshalb ein Cookie statt localStorage.
//
// Nach dem Umschalten wird neu geladen. Das ist bewusst der einfache Weg: Die
// Texte stecken in Server-Komponenten, ein reines Client-Update würde sie nicht
// erreichen. Ein Sprachwechsel ist eine seltene Handlung — ein kurzer Neuaufbau
// ist dafür ein akzeptabler Preis und spart eine Menge Zustandsverwaltung.
// `ort` unterscheidet die beiden Einbauorte: Der Schalter steht auf breiten
// Schirmen im Kopf und auf schmalen im Fuss (CSS entscheidet, welcher sichtbar
// ist). Ohne eigene Kennung waere `data-testid` auf jeder Seite doppelt — ein
// Test darauf wuerde mehrdeutig scheitern.
export function SprachUmschalter({ ort = "kopf" }: { ort?: "kopf" | "fuss" }) {
  const [sprache, setSprache] = useState<Sprache>(STANDARD_SPRACHE);

  useEffect(() => {
    // Der Server hat die Sprache bereits gesetzt; hier nur nachziehen, damit die
    // Beschriftung stimmt (SSR kennt document.cookie nicht).
    const roh = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${SPRACHE_COOKIE}=`))
      ?.split("=")[1];
    setSprache(normalisiereSprache(roh, STANDARD_SPRACHE));
  }, []);

  function umschalten() {
    const neu = andereSprache(sprache);
    // Ein Jahr Gültigkeit, auf der ganzen Domain, SameSite=Lax (kein Drittanbieter-Kontext).
    document.cookie = `${SPRACHE_COOKIE}=${neu}; path=/; max-age=31536000; SameSite=Lax`;
    setSprache(neu);
    window.location.reload();
  }

  const ziel = andereSprache(sprache);
  return (
    <button
      type="button"
      className="sprach-umschalter"
      onClick={umschalten}
      data-testid={`sprach-umschalter-${ort}`}
      // Die Beschriftung nennt das ZIEL des Klicks, nicht den Ist-Zustand —
      // sonst liest man "Deutsch" und denkt, man schalte auf Deutsch um.
      title={ziel === "en" ? "Switch to English" : "Auf Deutsch umschalten"}
      aria-label={ziel === "en" ? "Switch to English" : "Auf Deutsch umschalten"}
      lang={ziel}
    >
      {/*
        Zwei Beschriftungen, per CSS umgeschaltet: Auf schmalen Geräten nur das
        Kürzel. Grund (gefunden 2026-07-20 durch einen gebrochenen E2E-Test):
        Auf einem 412-px-Handy stehen im Kopf Marke, Sprach- und Theme-Schalter,
        Buchungs-Knopf und Burger nebeneinander. Mit ausgeschriebenem „English"
        lief die Seite seitlich über — und im Karten-Vollbild rutschte der
        Schließen-Knopf dadurch aus dem klickbaren Bereich.
      */}
      <span className="sprach-lang">{spracheName(ziel)}</span>
      <span className="sprach-kurz" aria-hidden="true">
        {ziel.toUpperCase()}
      </span>
    </button>
  );
}
