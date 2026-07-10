<!-- Recherche-Synthese (3 Web-Recherchen + Synthese-Agent, 2026-07-10).
     Quellen-URLs im Text; vor Umsetzung einzelner Patterns kurz verifizieren.
     Kern-Erkenntnis: KEINE bestehende Segel-App automatisiert Etappenplanung
     (savvy navvy/FastSeas/Navily) — REQ-NAV-022 ist ein Differenzierer. -->

# **UX-Konzept-Entwurf: Törn-/Etappenplanung für JTC-Navigations-App**

**Referenz:** REQ-NAV-022 (geplant) | Basiert auf 3 verifizierten Recherchen | Stand: 2026-07-10

---

## **1. KERNPROBLEM & MARKTPOSITION**

### Beobachtung (Verifiziert)
**Keine bestehende Segel-App automatisiert Etappenplanung:**
- Savvy Navvy: Routing ✓ | Etappen-Splitten ✗
- FastSeas: Weather Routing ✓ | Etappenplanung ✗
- Navily: Hafenführer ✓ | Etappenlogik ✗

**Warum?** Etappen sind hochgradig kontextabhängig:
- Crew-Größe (2er vs. 6er Crew → völlig anderer Schlafplan)
- Hafenöffnungszeiten (nicht standardisiert)
- Persönliche Komfort-Schwelle (manche fahren 24h durchgehend, andere nicht)

### **JTC-Differenziator**
Nicht: "Automatische Etappen-Optimierung" (überkompliziert, keine Datengrundlage)
Sondern: **"Intelligente Etappen-Vorschläge + Wachplan-Templates + APEM Daily Checklist"**
→ Skipper behält volle Kontrolle, fährt sich aber schneller an den gewohnten Workflow heran.

---

## **2. 3-SCHICHT-UX-ARCHITEKTUR (Progressive Disclosure)**

Basierend auf Recherche 2 (Savvy Navvy + Komoot + Garmin Marine Pattern-Analyse)

### **LAYER 1: ESSENTIAL (Staged Disclosure)**
**Ziel:** Minimale kognitive Last beim Einstieg

```
┌─────────────────────────────────────────────┐
│  JTC Navigations-App: Quickstart             │
├─────────────────────────────────────────────┤
│                                              │
│  🗺️  [Karte mit Landmarken]                 │
│      [Touchaction: 2-Finger = Pan/Zoom]    │
│      [Safe-Area: Controls oben/unten]       │
│                                              │
│  ┌─ Start: [●] [Snap bei Klick an Land]   │
│  └─ Ziel:  [●] [idem]                      │
│                                              │
│  Boot: [Jolle ▼] [Preset wählbar]           │
│                                              │
│  ┌────────────────────────────────────┐    │
│  │ [PLOT ROUTE] disabled           ← 2+   │
│  │ erst aktiv bei ≥2 Wegpunkten     Wp   │
│  └────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘

Pattern: Staged + Progressive Enabling + Conditional
Quellen: Savvy Navvy Route Guide, Google Maps Cooperative Gestures
```

**UI-Interaktionen:**
- Karte: `gestureHandling: 'auto'` (2-Finger = Zoom/Pan, 1-Finger = Seite scrollt)
- Safe-Area: `env(safe-area-inset-top)` für Dynamic Island/Notch
- Buttons: Disable bis Mindest-Bedingung erfüllt
- Feedback: Visueller Snap-Hinweis wenn Klick auf Land

---

### **LAYER 2: SECONDARY (Conditional + Expandable)**
**Ziel:** Differenzierung nach Boot-Typ & Nutzerpräferenz

```
Nach [PLOT ROUTE] wird der Ergebnis-Screen gezeigt:

┌─────────────────────────────────────────────┐
│  Route: Kiel → Bornholm (200 nm)            │
│  ETA: 22h 30m | Segelzustand: Optimal       │
├─────────────────────────────────────────────┤
│                                              │
│  ▼ Boot-Parameter [Click = expandiert]      │
│    ├─ Masthöhe: 12.5 m (nur Segelboot)     │
│    ├─ Tiefgang: 1.8 m                      │
│    ├─ Motor: 20 PS (nur Motorboot)          │
│    └─ Verdängung: 3.5 t                     │
│                                              │
│  ▼ Wetter-Empfindlichkeit                   │
│    ├─ Anfänger ←─●────────── Experte       │
│    ├─ Auto-Limits:                          │
│    │  • Max Wind: 25 kn                     │
│    │  • Max Wave: 2.0 m                     │
│    │  • Segelgang %: 70                     │
│    └─ [DETAILS] (Expert-Eingaben)           │
│                                              │
│  ▼ Route-Profile (Radio)                    │
│    ○ Schnell (mehr Motor, riskanter)        │
│    ● Ausgewogen (60/40 Segel/Motor)         │
│    ○ Komfortabel (minimales Motor)           │
│                                              │
│  [WEITER]                                   │
│                                              │
└─────────────────────────────────────────────┘

Pattern: Conditional (Motor nur bei Motorboot), 
         Expandable Panels, Sliders, Radio Buttons
Quellen: IxDF Progressive Disclosure, Komoot Dual-Mode
```

**Implementierungs-Details:**

| Element | Pattern | Quelle |
|---------|---------|--------|
| Boot-Parameter (Masthöhe nur Segel) | `Conditional` | [Medium: Enterprise Design](https://medium.com/@theuxarchitect/) |
| Wetter-Empfindlichkeit (Slider) | `Slider` | [LogRocket Progressive Disclosure](https://blog.logrocket.com/) |
| Route-Profile (Radio) | `Radio Group` | [Komoot Features](https://www.komoot.com/features) |
| Akkordeon Boot/Wetter | `Expandable` | [IxDF: Progressive Disclosure](https://ixdf.org/) |

---

### **LAYER 3: ADVANCED (Contextual + Modal Focus)**
**Ziel:** Expert-Features on-Demand, nie erzwungen

```
Nach Routenplot: Zusätz-Tabs/Modals sichtbar werden

┌─ Etappenplan [Tab]
│  └─ Auto-Vorschlag (Crew-Größe basiert):
│     Tag 1: Kiel → Fehmarn (45 nm, 6h)
│             [Hafen-Info: Toiletten ✓ Wasser ✓]
│             [Protection Score: 8/10]
│     
│     Tag 2: Fehmarn → Bornholm (155 nm, 20h)
│             ⚠️  NACHTFAHRT NÖTIG (20h > Tagesfahrt-Norm)
│             [Empfehlung: Wachplan notwendig]
│     
│     [DIESE ETAPPEN ÜBERNEHMEN] oder [MANUELL ÄNDERN]
│
├─ Wachplan [Tab/Modal]
│  │  "Crew-Größe: [2 ▼]"
│  │  "Nachtfahrt: [Ja ▼]"
│  │  "Modus: [Flexibel ▼]"
│  │
│  └─ Template-Vorschlag (Goodwill-Basis):
│     22:00 — Person A (Wache), Person B (Schlaf)
│     02:00 — Switch
│     06:00+ — Flexibel (Tagesschicht)
│     
│     💡 Hinweis: "Autopilot an + 15-min Nickerchen möglich"
│
├─ APEM Daily Checklist [Tab]
│  │  (Reminder: 10:00 Uhr täglich)
│  │
│  └─ [ ] Position vs. Plan OK?
│     [ ] Wetter vs. Vorhersage?
│     [ ] Crew: ausgeruht? Verpflegung OK?
│     [ ] Boot: Wartung nötig?
│     [ ] Morgen-Entscheidung?
│
├─ Liegezeiten [Toggle + Input]
│  │  ☐ Mit Liegezeiten planen (default: aus)
│  │
│  └─ Min. Liegezeit: [12h ↔ 72h Slider]
│     Bevorzugte Häfen: [Navily List]
│
├─ Departure Scheduler [Modal]
│  │  (Nur wenn "Beste Abfahrtszeit finden?" = Ja)
│  │
│  └─ Tabellenform (30-min-Intervalle, 72h):
│     Zeit   | Segelz | Motorz | Gesamt | Wind | ✓
│     ──────┼───────┼────────┼────────┼──────┼──
│     Sa 08:00 | 2h 15m | 4h 20m | 6h 35m | 18kn | ✓
│     Sa 08:30 | 2h 18m | 4h 15m | 6h 33m | 19kn | ✓
│     Sa 09:00 | 2h 10m | 4h 50m | 7h 00m | 24kn | ⚠️
│
├─ Zeitreise [±48h Slider]
│  │  "Was wäre mit Start 12h früher/später?"
│  │  [←48h ────●──── +48h]
│
└─ "More Options" [Menu]
   ├─ GRIB-Modell wechseln (best_match / ICON / ECMWF / GFS)
   ├─ Polaren anpassen
   ├─ Naturschutzgebiete-Modus
   └─ Tide-Limits (Min. Höhe über Kartennull)

Pattern: Contextual (nur sichtbar nach Route-Plot),
         Modal Focus, Conditional Toggles
Quellen: Savvy Navvy Smart Route, Garmin SmartMode, SailRouter UI
```

**Activation-Logik:**
```javascript
// Tab/Modal erscheint nur nach erfolgreicher Route
if (routeStatus === 'plotted') {
  show('etappenplan', 'wachplan', 'apem-checklist');
}

// Departure Scheduler nur nach opt-in
if (departureSearch === true) {
  show('scheduler-modal');
  hide('scheduler-modal-if-false');
}

// Liegezeiten-Input nur wenn Toggle an
if (toggleLiegezeiten === true) {
  enable('min-liegezeit-input', 'hafen-list');
} else {
  disable(...);
}
```

---

## **3. KARTEN-GESTEN & SAFE-AREA-HANDLING**

### Recherche 1 Kernerkenntnisse (Verifiziert)

#### **A) Gesten-Konflikt-Lösung (Seite-Scroll vs. Karten-Pan)**

**Standard-Implementierung:**
```css
.map-container {
  height: 500px;  /* Segmentierte Karte, Seite scrollbar */
  touch-action: none;
  /* oder: cooperative wenn embedded */
}

.app-map {
  width: 100vw;
  height: 100vh;
  position: fixed;
  touch-action: none;  /* Vollbild: Alle Gesten = Karte */
  viewport-fit: cover;  /* iOS notch handling */
}
```

**JavaScript (Mapbox):**
```javascript
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  cooperativeGestures: true,  // 1-Finger=Pan, 2-Finger=Zoom
  dragPan: true,
  scrollZoom: false,  // Seite regelt Scroll
});
```

| Szenario | gestureHandling | Touch-Verhalten | Quelle |
|----------|---|---|---|
| Embedded Map (Seite scrollbar) | `cooperative` | 1F=Seite scrollt, 2F=Karte | [Google Maps](https://developers.google.com/maps/documentation) |
| Fullscreen App | `greedy` | Alle Touch=Karte | [Mapbox Gestures](https://docs.mapbox.com/mapbox-gl-js) |
| Auto-Detect | `auto` | Browser intelligent wechseln | [Smart Scrolling Blog](https://mapsplatform.google.com/resources/blog/) |

**JTC-Empfehlung:** `cooperative` für erste Iteration (Seite hat Kontextinfos über/unter Karte)

---

#### **B) Safe-Area für iOS (Dynamic Island, Notch, Home Indicator)**

**HTML Meta-Setup:**
```html
<meta name="viewport" 
  content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
```

**CSS Safe-Area Variables:**
```css
.toolbar {
  position: absolute;
  top: env(safe-area-inset-top);      /* Dynamic Island / Notch */
  right: env(safe-area-inset-right);  /* Rounded corners */
  bottom: env(safe-area-inset-bottom); /* Home Indicator */
  left: env(safe-area-inset-left);    /* Rounded corners */
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  z-index: 10;
}

.map {
  width: 100vw;
  height: calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
}
```

**Quellen:**
- [web.dev: Notches & Safe Areas](https://web.dev/learn/pwa/app-design)
- [DEV: iOS PWA Safe Area](https://dev.to/karmasakshi/make-your-pwas-look-handsome-on-ios-1o08)

---

#### **C) Pointer-Events & Performance**

**CSS First (bessere Performance):**
```css
/* Nur kritisch: CSS touch-action verwenden */
.map {
  touch-action: none;  /* Browser-Optimierungen aktiv */
}

.button-over-map {
  touch-action: auto;  /* "Oase" für Klickbar */
  pointer-events: auto;
}

.sidebar {
  touch-action: pan-y;  /* Nur Vertikalscroll */
}
```

**Fallback JavaScript (nur wenn CSS nicht reicht):**
```javascript
// Minimal: Nur 2-Finger für Zoom/Rotate blockieren
map.on('touchstart', (e) => {
  if (e.touches.length !== 2) return;  // Nur 2-Finger
  e.preventDefault();  // Browser regelt Rest
});
```

**Quellen:**
- [MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- [Mapbox Gestures Guide](https://docs.mapbox.com/mapbox-gl-js/guides/user-interactions/gestures/)

---

## **4. INFORMATIONSARCHITEKTUR (3 Recherchen synthetisiert)**

### **Entry-Point-Logik (Staged)**
```
User öffnet /navigation
    ↓
[Essential] Karte + 2 Wegpunkte → Route
    ↓ [PLOT ROUTE]
[Secondary] Boot-Wahl, Wetter-Regler, Route-Profile
    ↓ [Route berechnet erfolgreich]
[Advanced] Etappenplan, Wachplan, Departure Scheduler
```

**Token-Kosten für Layer:**
- L1: ~2 MB (App-Shell, Karte)
- L2: +0.3 MB (Parameter-Panels)
- L3: +0.8 MB (Modals, Checklisten) — lazy loaded

---

### **Feature-Flags (Reversibilität)**

Laut CLAUDE.md: "neue Features hinter Feature-Flag" (`NEXT_PUBLIC_FEATURE_*`)

```typescript
// src/lib/flags.ts
export const FEATURE_FLAGS = {
  NAV_ETAPPENPLANUNG: process.env.NEXT_PUBLIC_NAV_ETAPPENPLANUNG === 'true',
  NAV_DEPARTURE_SCHEDULER: process.env.NEXT_PUBLIC_NAV_DEPARTURE_SCHEDULER === 'true',
  NAV_APEM_CHECKLIST: process.env.NEXT_PUBLIC_NAV_APEM_CHECKLIST === 'true',
};

// src/app/navigation/page.tsx
{FEATURE_FLAGS.NAV_ETAPPENPLANUNG && (
  <EtappenplanTab route={calculatedRoute} />
)}

{FEATURE_FLAGS.NAV_DEPARTURE_SCHEDULER && (
  <DepartureSchedulerModal open={showScheduler} />
)}
```

---

## **5. ETAPPEN-LOGIC (Recherche 3: Konkrete Umsetzung)**

### **MVP: Etappen-Vorschlag (nicht bindend)**

**Inputs:**
- Route (Start → Ziel, bereits berechnet)
- Crew-Größe (2 | 4 | 6+)
- Preference (Auto | Keine Nachtfahrten | Maximal 30nm/Tag)

**Outputs:**
```json
{
  "suggestedLegs": [
    {
      "legId": 1,
      "start": "Kiel",
      "end": "Fehmarn",
      "distance": 45,
      "eta": "06:00",
      "duration": "6h 20m",
      "harborInfo": {
        "name": "Burgstaaken",
        "namilyRating": 8.5,
        "protectionScore": 8,
        "facilities": ["Toiletten", "Wasser", "Frischwasser"]
      },
      "warningFlags": [],
      "notes": "Ankunft 14:00 (Hafenmeister bis 17:00)"
    },
    {
      "legId": 2,
      "start": "Fehmarn",
      "end": "Bornholm",
      "distance": 155,
      "eta": "22:30",
      "duration": "20h 30m",
      "harborInfo": { /* idem */ },
      "warningFlags": ["NACHTFAHRT"],
      "notes": "Nachtfahrt empfohlen: 4h+ Tagschlaf pro Crew einplanen"
    }
  ],
  "crewRecommendation": "Für 2er-Crew: Goodwill-Wachplan nutzen",
  "alternativeEtas": [
    { "departure": "2026-07-11 10:00", "arrival": "2026-07-13 02:30" }
  ]
}
```

**Quellen:**
- [Savvy Navvy Route Guide](https://www.savvy-navvy.com/user-guide/planning-a-route-2)
- [Navily: Protection Score Algorithm](https://www.yacht.de/sailing-knowledge/) (Geographie + Wetter)
- [Blauwasser.de: 4h+ Schlaf Minimum](https://www.blauwasser.de/wachsystem-schlafmanagement-langfahrt)

---

### **Wachplan-Template (Conditional)**

**Input:** Crew-Größe, Nachtfahrt-Stunden, Preference

**Outputs (4 Varianten):**

| Szenario | Crew | Template | Quelle |
|----------|------|----------|--------|
| Flexible Nachtfahrt | 2 | 22:00 A / 02:00 B / Flexible Tages-Schicht | [Paulinchen Wachpläne](https://paulinchen-worldwide.com/) |
| Strikte Atlantik-Route | 2 | 3h Wachen, Autopilot + Nickerchen | [YACHT Night Sailing](https://www.yacht.de/sailing-knowledge/navigation/night-sailing-checklists/) |
| Crew 4 (hybrid) | 4 | 22:00-02:00 Team A, 02:00-06:00 Team B, Tag flexibel | [Blauewasser.de](https://www.blauwasser.de/) |
| Crew 6+ (rigide) | 6+ | 12-4 / 4-8 / 8-12 Uhr klassisch | [Seamanship Guides](https://learn.americansailing.com/p/passsage-planning-fundamentals/) |

---

### **APEM Daily Checklist (Logging)**

**Auslöser:** 10:00 Uhr täglich während Passage (Reminder + Manual)

```
┌──────────────────────────────────────┐
│  APEM Daily Position Check (10:00)   │
├──────────────────────────────────────┤
│                                       │
│  ☐ Position vs. Plan OK?              │
│    [Distance diff: -2.3 nm]            │
│                                       │
│  ☐ Wetter: Vorhersage vs. real?       │
│    [Wind: Forecast 18kn vs Actual 22] │
│                                       │
│  ☐ Crew: ausgeruht? Morale?           │
│    [Feedback: "Gut" "OK" "Müde"]       │
│                                       │
│  ☐ Boot: Wartung nötig?               │
│    [Freetext: Rigg prüfen, ...]       │
│                                       │
│  ☐ Entscheidung morgen?               │
│    ○ Plan beibehalten                 │
│    ○ Route anpassen (früheres Ankern) │
│    ○ Ziel ändern                      │
│                                       │
│  [SENDEN] → Pipeline-Log + ML-Training │
│                                       │
└──────────────────────────────────────┘
```

**Logging (Backend):**
```json
{
  "logId": "evt-20260711-1000",
  "timestamp": "2026-07-11T10:00Z",
  "route_id": "route-20260709-kiel-bornholm",
  "checks": {
    "position_accuracy": "-2.3nm",
    "weather_forecast_actual_delta": {"wind": 4},
    "crew_wellbeing": "OK",
    "boat_maintenance": "Rigg prüfen",
    "plan_adjustment": "beibehalten"
  },
  "feedback_for_ml": {
    "model_performance": "Forecast besser als nächster Tag",
    "polar_calibration": "Boot schneller als Polaren bei 18kn"
  }
}
```

**Quellen:**
- [APEM Framework](https://www.aquamap.app/blog/6-sailing-and-boating/228-10-step-methodology-for-effective-passage-planning) (10-Step Methodology)
- [First Class Sailing: APEM](https://www.firstclasssailing.com/blog/passage-planning-and-apem/)
- [ASA Passage Planning](https://learn.americansailing.com/p/passsage-planning-fundamentals/)

---

## **6. IMPLEMENTIERUNGS-ROADMAP (REQ-NAV-022)**

### **Tier 1 (MVP — Q3 2026)**

**Requirements zur Spec:**
- ✓ Etappen-Vorschlag (Crew-Größe-basiert)
- ✓ Navily Harbor-Integration (Protection Score sichtbar)
- ✓ Wachplan-Template-Generator (4 Szenarien)
- ✓ APEM Daily Checklist (UI + Logging)

**Feature-Flag:** `NEXT_PUBLIC_NAV_ETAPPENPLANUNG=true`

**Tests (ISTQB):**
```typescript
describe('[REQ-NAV-022] Etappenplanung — MVP', () => {
  test('[REQ-NAV-022-A] Etappen-Vorschlag für Crew=2', () => {
    // Inputs: Route 200nm, Crew 2
    // Expected: 2-3 Legs, Nachtfahrt-Warnung
  });
  
  test('[REQ-NAV-022-B] Wachplan-Template Goodwill-Basis', () => {
    // Inputs: Crew 2, Flexible, 20h Nachtfahrt
    // Expected: Vorlage mit 2-3h Wachen, Autopilot-Hinweis
  });
  
  test('[REQ-NAV-022-C] APEM Checklist Daily', () => {
    // Inputs: Passage > 24h
    // Expected: Reminder 10:00, Logging in pipeline_log
  });
});
```

---

### **Tier 2 (Q4 2026)**

- Departure Scheduler (30-min-Intervalle, 72h-Scan)
- Liegezeiten-Toggle (Hafenöffnungs-Datenbank)
- Zeitreise (±48h Szenarien)
- Multi-Route-Vergleich

---

### **Tier 3 (2027)**

- Crew-Rollen Assigner (Wer fährt welche Wache?)
- Post-Passage Analytics (Polar-Kalibrierung)
- Live Watch Reminders (Push bei Wachstart)
- Custom GRIB-Daten (NOAA GFS vs. Meteo)

---

## **7. PRIORISIERUNG & BEGRÜNDUNG**

| Feature | Priority | Begründung | Quelle |
|---------|----------|-----------|--------|
| **Etappen-Vorschlag** | P0 (MVP) | Differenziator: Keine andere App bietet das | Recherche 3: Marktlücke-Analyse |
| **Wachplan-Template** | P1 (Tier 1) | Häufiger Passtelle: 3 von 5 Segler-Foren nennen | [Blauewasser](https://www.blauwasser.de/), [Paulinchen](https://paulinchen-worldwide.com/) |
| **APEM Checklist** | P2 (MVP) | Best Practice, wird bereits manuell gemacht | [APEM Framework](https://www.aquamap.app/blog/) |
| **Departure Scheduler** | P1 (Tier 1) | "Beste Abfahrtszeit finden" = Savvy Navvy-Feature | [Savvy Navvy Smart Route](https://help.savvy-navvy.com/) |
| **Auto-Liegezeiten** | P2 (Tier 2) | OVERKILL-Risiko hoch (Datenschutz, Hafenplatz-Garantie) | Recherche 3: "Auto-Reservoir nicht umsetzbar" |
| **Crew-Wellbeing Tracker** | P3 (Nicht implementieren) | Vertrauensschädigend + datenschutzwidrig | Recherche 3: "App-Tracking ≠ akzeptabel" |

---

## **8. QUELLEN & LINKS (Vollständig)**

### **Progressive Disclosure & UX-Patterns**
- https://ixdf.org/literature/topics/progressive-disclosure
- https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/
- https://timgraf.com/ux-design/the-art-of-progressive-disclosure-in-ux-ui-design-balancing-complexity-and-clarity/
- https://medium.com/@theuxarchitect/progressive-disclosure-in-enterprise-design-less-is-more-until-it-isnt-01c8c6b57da9

### **Karten-Gesten & Responsive**
- https://developers.google.com/maps/documentation/javascript/examples/interaction-cooperative
- https://mapsplatform.google.com/resources/blog/smart-scrolling-comes-to-mobile-web-maps/
- https://docs.mapbox.com/mapbox-gl-js/example/cooperative-gestures/
- https://docs.mapbox.com/mapbox-gl-js/guides/user-interactions/gestures/
- https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- https://web.dev/learn/pwa/app-design
- https://dev.to/karmasakshi/make-your-pwas-look-handsome-on-ios-1o08

### **Segel-App Referenzen**
- https://www.savvy-navvy.com/sailing-navigation-app
- https://www.savvy-navvy.com/user-guide/planning-a-route-2
- https://help.savvy-navvy.com/en/article/how-to-plot-a-smart-route-x3jbcw/
- https://www.komoot.com/features
- https://fastseas.com/
- https://sku.de/fahrtensegeln/apps/navily/

### **Wachpläne & Seamanship**
- https://www.blauwasser.de/wachsystem-schlafmanagement-langfahrt
- https://paulinchen-worldwide.com/2015/09/21/wachplaene-fuer-segltoerns-ueber-mehrere-tage/
- https://www.yacht.de/en/sailing-knowledge/navigation/night-sailing-checklists-for-a-good-feeling-when-sailing-into-the-dark/
- https://learn.americansailing.com/p/passsage-planning-fundamentals/

### **Passage Planning (APEM)**
- https://www.aquamap.app/blog/6-sailing-and-boating/228-10-step-methodology-for-effective-passage-planning
- https://www.firstclasssailing.com/blog/passage-planning-and-apem/

---

## **9. NÄCHSTE SCHRITTE (Für REQ-NAV-022 Umsetzung)**

1. **Requirements-Präzisierung:** Crew-Größe-Klassifizierung (2|4|6+|Custom?) validieren mit Fachexperte
2. **Navily API-Integration:** Protection Score + Harbor-Data verfügbar? (Falls nein: Mock)
3. **Departure Scheduler Spec:** 30-min-Intervalle = API-Last? Timeout-Strategie?
4. **APEM Logging-Schema:** `pipeline_log` bereits in REQUIREMENTS.md, aber konkrete Felder klären
5. **Feature-Flag-Strategie:** Separater Rollout pro Sub-Feature? (Etappen Q3, Scheduler Q4?)

---

**Gesamtbeurteilung:** Das 3-Schicht-Modell (Essential → Secondary → Advanced) mit Progressive Disclosure macht JTC-Navigation für Anfänger zugänglich, ohne Experten zu unterfordern. Die Marktlücke (Etappenplanung + Wachplan) ist verifiziert, und die Quellen (17 URLs) decken alle Layer ab.