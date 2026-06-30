# Architektur — Join the Captain (Gesamtbild)

Zwei Domains, ein gemeinsamer Community-Hub auf Discord.

```
┌─────────────────────────────────────────────────────────┐
│  join-the-captain.DE (Buchung)                          │
│  → Community-Schicht: Feature-Wünsche + Voting           │
│  → Ziel: Roadmap-Input + Engagement                      │
└─────────────────────────────────────────────────────────┘
                    │ geteilte Discord-Community │
┌─────────────────────────────────────────────────────────┐
│  join-the-captain.ORG (eigenes Standbein)               │
│  → Affiliate-Verzeichnis "Tools für deinen Törn"        │
│  → Podcast / Segler-Entrepreneurs                        │
│  → Ziel: Affiliate-Umsatz + Reichweite                  │
└─────────────────────────────────────────────────────────┘
                    │
              ┌─────┴─────┐
              │  DISCORD  │  ← zentraler Community-Hub
              │  + KI-Bot │     (Feature-Sammlung, Voting, Moderation)
              └───────────┘
```

Discord ist der Dreh- und Angelpunkt. Beide Domains speisen rein, der Bot lebt dort.

## Rollen der Bausteine

| Baustein | Repo | Rolle | Ziel |
|---|---|---|---|
| **`.de`** | `Twirl1984/join-the-captain` | Schlanke Buchungsplattform. Community-Schicht (Feature-Wünsche, Voting) hängt sich an. | Roadmap-Input + Engagement |
| **`.org`** | `Twirl1984/Join-the-Captain.org` (dieses Repo) | Medien-/Affiliate-Standbein: Tool-Verzeichnis, Podcast, Segler-Entrepreneurs. **Beheimatet den Feature-Loop** unter `/community`. | Affiliate-Umsatz + Reichweite |
| **Discord** | — (künftig) | Zentraler Community-Hub: Feature-Sammlung, Voting, KI-Moderation. | Bindung + Funnel |

## Konsolidierungs-Hinweis (wichtig)

Der **Community-Feature-Loop** war ursprünglich für `.de` skizziert, **lebt jetzt
aber auf `.org`** (`/community`). `.de` bleibt die reine Buchungsplattform und ist
**nicht** Teil dieses Repos — der `.org`-Header verlinkt nur dorthin.

## Kopplung Feature-Loop ↔ Affiliate-Verzeichnis

Findet der **App-Scout** (KI, siehe [feature-board-spec.md](feature-board-spec.md))
im Feature-Loop eine bereits existierende App, wird daraus ein Eintrag im
**Tool-Verzeichnis** (`affiliate_tool`, `veroeffentlicht=false`). So füttert der
Community-Wunsch direkt das Affiliate-Standbein — beide nutzen dasselbe Datenmodell.

## Deploy-Topologie

Beide Domains laufen auf **demselben Strato-VPS** (`194.164.197.23`), strikt
voneinander isoliert (eigener Port, eigenes Verzeichnis, eigene DB, eigener
nginx-Server-Block, eigenes TLS-Zertifikat). Details und Schritte:
[../DEPLOYMENT.md](../DEPLOYMENT.md).
