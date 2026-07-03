// reviere.ts — Reviere-HIERARCHIE für die Navigations-App (/navigation).
//
// Statt des flachen /wetter-Dropdowns: Gruppen (Nordsee, Ostsee, Mittelmeer,
// Binnen) mit je mehreren Revieren. Jedes Revier trägt zusätzlich eine bbox
// [Süd, West, Nord, Ost] — sie definiert den Kartenausschnitt UND das Gitter
// der Wassermaske fürs Land-Vermeidungs-Routing (searoute.ts).
//
// Die vier bewährten /wetter-Reviere (Rügen, Istrien, Dalmatien, Brombachsee)
// leben hier weiter; /wetter selbst bleibt unverändert (Test-Tab).

export interface NavHafen {
  name: string;
  lat: number;
  lon: number;
}

/** bbox = [Süd, West, Nord, Ost] in Grad. */
export type Bbox = [number, number, number, number];

export interface NavRevier {
  id: string;
  label: string;
  center: [number, number];
  zoom: number;
  bbox: Bbox;
  haefen: NavHafen[];
  /**
   * Prominenter Sicherheitshinweis fürs Revier (z. B. Gezeiten im Wattenmeer —
   * die Wassermasken kennen kein Trockenfallen). Die UI zeigt ihn als Warnband.
   */
  warnhinweis?: string;
}

export interface RevierGruppe {
  id: string;
  label: string;
  reviere: NavRevier[];
}

export const REVIER_GRUPPEN: RevierGruppe[] = [
  {
    id: "nordsee",
    label: "Nordsee",
    reviere: [
      {
        id: "deutsche-bucht",
        label: "Deutsche Bucht (Elbe / Helgoland)",
        center: [54.0, 8.1],
        zoom: 9,
        bbox: [53.3, 6.6, 54.6, 9.2],
        warnhinweis:
          "Tidenrevier: Die Karte kennt weder Tidenhub noch trockenfallende " +
          "Watten — Routen und Tiefen gelten nur mit aktuellem Gezeitenkalender " +
          "und amtlicher Seekarte.",
        haefen: [
          { name: "Cuxhaven", lat: 53.867, lon: 8.717 },
          { name: "Helgoland", lat: 54.179, lon: 7.889 },
          { name: "Norderney", lat: 53.697, lon: 7.158 },
          { name: "Bremerhaven", lat: 53.55, lon: 8.575 },
          { name: "Wilhelmshaven", lat: 53.514, lon: 8.146 },
        ],
      },
      {
        id: "nordfriesland",
        label: "Nordfriesland (Sylt / Föhr / Amrum)",
        center: [54.6, 8.5],
        zoom: 9,
        bbox: [54.2, 8.0, 55.1, 9.2],
        warnhinweis:
          "Wattenmeer: Große Flächen fallen bei Ebbe trocken — die Wassermaske " +
          "und die Tiefen kennen die Tide NICHT. Nur mit Gezeitenkalender und " +
          "amtlicher Seekarte fahren.",
        haefen: [
          { name: "Hörnum (Sylt)", lat: 54.758, lon: 8.295 },
          { name: "Wyk auf Föhr", lat: 54.692, lon: 8.573 },
          { name: "Wittdün (Amrum)", lat: 54.629, lon: 8.389 },
          { name: "Husum", lat: 54.467, lon: 9.033 },
        ],
      },
    ],
  },
  {
    id: "ostsee",
    label: "Ostsee",
    reviere: [
      {
        id: "ruegen",
        label: "Rügen & Vorpommern",
        center: [54.5, 13.2],
        zoom: 9,
        bbox: [53.9, 12.0, 55.4, 14.5],
        haefen: [
          { name: "Greifswald", lat: 54.096, lon: 13.408 },
          { name: "Stralsund", lat: 54.315, lon: 13.09 },
          { name: "Sassnitz", lat: 54.512, lon: 13.643 },
          { name: "Kap Arkona", lat: 54.679, lon: 13.432 },
          { name: "Klintholm Havn", lat: 54.952, lon: 12.464 },
        ],
      },
      {
        id: "daenische-suedsee",
        label: "Dänische Südsee (Fünen / Ærø)",
        center: [55.0, 10.4],
        zoom: 9,
        bbox: [54.6, 9.6, 55.6, 11.3],
        haefen: [
          { name: "Sønderborg", lat: 54.909, lon: 9.789 },
          { name: "Faaborg", lat: 55.095, lon: 10.24 },
          { name: "Svendborg", lat: 55.06, lon: 10.61 },
          { name: "Marstal", lat: 54.856, lon: 10.518 },
          { name: "Ærøskøbing", lat: 54.889, lon: 10.411 },
        ],
      },
      {
        id: "kieler-bucht",
        label: "Kieler Bucht & Flensburger Förde",
        center: [54.6, 10.0],
        zoom: 9,
        bbox: [54.2, 9.3, 55.0, 10.7],
        haefen: [
          { name: "Kiel (Düsternbrook)", lat: 54.36, lon: 10.15 },
          { name: "Laboe", lat: 54.41, lon: 10.22 },
          { name: "Eckernförde", lat: 54.47, lon: 9.84 },
          // Schleimünde statt Kappeln: die enge Schlei ist in der 1-km-
          // Wassermaske zugelaufen — der Routing-Einstieg liegt an der Mündung.
          { name: "Schleimünde", lat: 54.673, lon: 10.036 },
          { name: "Flensburg", lat: 54.795, lon: 9.43 },
        ],
      },
    ],
  },
  {
    id: "mittelmeer",
    label: "Mittelmeer",
    reviere: [
      {
        id: "kroatien-istrien",
        label: "Kroatien — Istrien (Pula)",
        center: [44.85, 13.8],
        zoom: 10,
        bbox: [44.4, 13.2, 45.4, 14.6],
        haefen: [
          { name: "Pula", lat: 44.873, lon: 13.842 },
          { name: "Rovinj", lat: 45.081, lon: 13.638 },
          { name: "Leuchtturm Porer", lat: 44.752, lon: 13.892 },
          { name: "Unije", lat: 44.638, lon: 14.258 },
        ],
      },
      {
        id: "kroatien-dalmatien",
        label: "Kroatien — Dalmatien (Split)",
        center: [43.3, 16.3],
        zoom: 9,
        bbox: [42.6, 15.4, 43.8, 17.3],
        haefen: [
          { name: "Split (ACI Marina)", lat: 43.503, lon: 16.43 },
          { name: "Milna (Brač)", lat: 43.327, lon: 16.452 },
          { name: "Vis", lat: 43.061, lon: 16.19 },
          { name: "Hvar", lat: 43.172, lon: 16.443 },
          { name: "Leuchtturm Stončica", lat: 43.062, lon: 16.265 },
        ],
      },
      {
        id: "balearen",
        label: "Balearen (Mallorca / Menorca / Ibiza)",
        center: [39.5, 2.9],
        zoom: 9,
        bbox: [38.6, 1.1, 40.2, 4.4],
        haefen: [
          { name: "Palma de Mallorca", lat: 39.567, lon: 2.633 },
          { name: "Port de Sóller", lat: 39.797, lon: 2.69 },
          { name: "Maó (Menorca)", lat: 39.888, lon: 4.31 },
          { name: "Eivissa (Ibiza)", lat: 38.909, lon: 1.435 },
        ],
      },
      {
        id: "saronischer-golf",
        label: "Griechenland — Saronischer Golf",
        center: [37.7, 23.4],
        zoom: 9,
        bbox: [37.2, 22.8, 38.1, 24.1],
        haefen: [
          { name: "Athen (Alimos)", lat: 37.91, lon: 23.7 },
          { name: "Ägina", lat: 37.746, lon: 23.428 },
          { name: "Poros", lat: 37.5, lon: 23.455 },
          { name: "Hydra", lat: 37.35, lon: 23.465 },
        ],
      },
    ],
  },
  {
    id: "binnen",
    label: "Binnenreviere",
    reviere: [
      {
        id: "brombachsee",
        label: "Brombachsee (Fränkisches Seenland)",
        center: [49.138, 10.925],
        zoom: 13,
        bbox: [49.1, 10.85, 49.17, 11.0],
        haefen: [
          { name: "Ramsberg (Segelhafen)", lat: 49.147, lon: 10.945 },
          { name: "Enderndorf", lat: 49.128, lon: 10.895 },
          { name: "Absberg / Seespitz", lat: 49.123, lon: 10.915 },
          { name: "Pleinfeld (Staudamm)", lat: 49.141, lon: 10.962 },
        ],
      },
      {
        id: "ijsselmeer",
        label: "IJsselmeer (Niederlande)",
        center: [52.8, 5.3],
        zoom: 9,
        bbox: [52.3, 4.8, 53.3, 5.9],
        haefen: [
          { name: "Enkhuizen", lat: 52.704, lon: 5.291 },
          { name: "Medemblik", lat: 52.774, lon: 5.106 },
          { name: "Stavoren", lat: 52.881, lon: 5.36 },
          { name: "Lelystad", lat: 52.518, lon: 5.435 },
          { name: "Urk", lat: 52.661, lon: 5.599 },
        ],
      },
    ],
  },
];

/** Alle Reviere flach, in Gruppen-Reihenfolge. */
export function alleReviere(): NavRevier[] {
  return REVIER_GRUPPEN.flatMap((g) => g.reviere);
}

export function getNavRevier(id: string): NavRevier | undefined {
  return alleReviere().find((r) => r.id === id);
}

export function gruppeVon(revierId: string): RevierGruppe | undefined {
  return REVIER_GRUPPEN.find((g) => g.reviere.some((r) => r.id === revierId));
}

/** true, wenn (lat, lon) in der bbox liegt (Ränder inklusive). */
export function inBbox(lat: number, lon: number, bbox: Bbox): boolean {
  const [s, w, n, e] = bbox;
  return lat >= s && lat <= n && lon >= w && lon <= e;
}

/**
 * Volltextsuche über Revier-Label, Gruppen-Label und Hafennamen
 * (case-insensitiv, ohne Duplikate, leere Suche -> leeres Ergebnis).
 */
export function sucheReviere(query: string): NavRevier[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: NavRevier[] = [];
  for (const g of REVIER_GRUPPEN) {
    const gruppeMatch = g.label.toLowerCase().includes(q) || g.id.includes(q);
    for (const r of g.reviere) {
      const match =
        gruppeMatch ||
        r.label.toLowerCase().includes(q) ||
        r.id.includes(q) ||
        r.haefen.some((h) => h.name.toLowerCase().includes(q));
      if (match) hits.push(r);
    }
  }
  return hits;
}
