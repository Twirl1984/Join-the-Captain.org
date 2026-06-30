# Design-Quellen — join-the-captain.org

Das `.org`-Design ist ein **umschaltbares Dark/Light-System** (ein gemeinsames
Design-System, zwei Skins). Umgesetzt in `src/app/globals.css` über
`[data-theme]`-Tokens; Default = **dunkel** (neues Startdesign). Toggle im Header
(`src/components/ThemeToggle.tsx`), Persistenz via `localStorage`.

## Gestaltete Screens (Claude-Design-Canvas)

| Screen | Theme | Status | Quelle |
|---|---|---|---|
| **Startseite** | Dark/Gold/Playfair | ✅ in Code umgesetzt (`src/app/page.tsx`) | `quellen/Join the Captain Startseite.zip` (lokal, nicht versioniert — 12 MB) |
| **Feature-Board** (`/community`) | noch Hell/Teal/Poppins | 🔜 Dark-Redesign offen | [quellen/Join the Captain Feature-Board.zip](quellen/) (versioniert) |

> Die große Startseite-ZIP ist via `.gitignore` aus dem Repo gehalten (v. a.
> Foto-Ballast). Die genutzten Hero-/Sektion-Fotos liegen in
> `public/assets/photos/`. Die kleine Feature-Board-ZIP bleibt als Referenz drin.

## Design-Tokens (beide Skins)

- **Akzent (konstant):** Gold `#c8a84b` (Primär-CTA, Eyebrows, Italics) · Teal
  `#2f9ec0` (Sekundär-Icons). Scharfe Ecken (kein Border-Radius).
- **Typo:** Playfair Display (Headlines, kursiv-gold) + Outfit (Body).
- **Dark:** BG `#08131e`, Cards `#112233`, Text `#f2ede4`.
- **Light:** BG `#f4eee2`, Cards `#fff`, Text `#2a2a27`. Header/Footer bleiben
  in beiden Skins Navy.

Vollständige Marken-/Struktur-Spezifikation: [../design-paket.md](../design-paket.md).
Feature-Board-Build-Spec: [../roadmap/feature-board-spec.md](../roadmap/feature-board-spec.md).
