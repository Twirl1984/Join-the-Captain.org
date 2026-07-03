# Analyse: Timeout-Schutz in buildSampler (open-meteo.ts)

## Sachverhalt aus dem Code:

### route.ts Zeile 80:
```typescript
const sampleForecast = await buildSampler(midpointsOf(expanded.points), {
  sensitivity,
  window,
  model,
});
```

### open-meteo.ts fetchJson (Zeilen 347-357):
```typescript
async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "JTC-Weather/1.0 (join-the-captain.org)" },
    next: { revalidate: REVALIDATE_S },
  } as NextFetchInit);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Open-Meteo ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}
```

## Fehlende Timeout-Schutzmaßnahmen:

1. **Kein AbortController** in fetchJson oder buildSampler
2. **Kein Timeout-Parameter** im fetch() call (RequestInit)
3. **Kein Promise.race() mit setTimeout** zum Enforc timeout
4. **Kein maxDuration** in der API-Route (route.ts) — Next.js Feature zur Funktion-Timeout
5. **Kein globales Timeout** für Open-Meteo-Anfragen konfiguriert

## Kritischer Codepfad:

route.ts:80 → buildSampler() → fetchSeries() → Promise.all([fetchJson(atmoUrl), fetchJson(marineUrl)])
→ fetchJson() → fetch(url, {...}) — HIER KEIN TIMEOUT

## Worst-Case-Szenario (aus dem Finding):

- Client sendet Route mit 10 Waypoints + 6-Tage-Fenster
- Open-Meteo wird langsam oder schickt sehr große Responses
- fetchJson() wartet unbegrenzt
- POST /api/navigation/route hängt auf Client-Seite
- Stack baut sich auf → Ressourcen-Erschöpfung

## Verifikation:

- Kein Timeout in fetchJson() erkannt
- Kein AbortController/AbortSignal konfiguriert
- Kein Promise-Timeout-Wrapper
- Keine maxDuration in route.ts POST-Handler
- package.json: KEINE axios/got mit Timeout-Defaults

## Fazit:

Die Behauptung ist NICHT WIDERLEGT — das Szenario KANN eintreten!
