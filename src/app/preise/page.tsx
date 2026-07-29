import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { uebersetzer } from "@/lib/i18n/server";

// Produkt- und Preisseite (REQ-EXP-011).
//
// Anlass: Die Funnel-Analyse vom 2026-07-20 fand, dass Interessenten nirgends
// erfahren, was das Produkt kann und was es kosten soll. Ohne diese Seite läuft
// jede Reichweite ins Leere.
//
// Bewusst gleichwertig aufgebaut: „Was sie kann" und „Was sie NICHT ist" stehen
// nebeneinander, nicht als Kleingedrucktes. Bei einem Werkzeug, das über
// Wassertiefen spricht, ist die ehrliche Abgrenzung Teil des Angebots — und sie
// schützt beide Seiten (REQ-SAFE-002).
export const metadata: Metadata = {
  title: "Produkt & Preise — Navigations-App",
  description:
    "Was die Navigations-App kann, was sie ausdrücklich nicht ist, und was sie kosten wird. " +
    "Saison 24 €, Jahr 39 €, Ausprobieren kostenlos.",
  alternates: { canonical: "/preise" },
};

export default async function PreisePage() {
  const t = await uebersetzer();
  const kann = [
    t("preis.kann_1"),
    t("preis.kann_2"),
    t("preis.kann_3"),
    t("preis.kann_4"),
    t("preis.kann_5"),
    t("preis.kann_6"),
  ];
  const pakete = [
    { name: t("preis.frei_name"), preis: t("preis.frei_preis"), text: t("preis.frei_text") },
    { name: t("preis.saison_name"), preis: t("preis.saison_preis"), text: t("preis.saison_text"), hervor: true },
    { name: t("preis.jahr_name"), preis: t("preis.jahr_preis"), text: t("preis.jahr_text") },
  ];

  return (
    <div className="container section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 8 }}>
        <span className="section-label">{t("preis.eyebrow")}</span>
        <h1>{t("preis.titel")}</h1>
        <p className="muted" style={{ maxWidth: 660 }}>{t("preis.einleitung")}</p>
        <p className="caption">{t("preis.status_hinweis")}</p>
      </div>

      <div className="preis-zwei">
        <div className="card stack" style={{ gap: 10 }} data-testid="preise-kann">
          <span className="section-label">{t("preis.kann_titel")}</span>
          <ul className="stack" style={{ gap: 8, margin: 0, paddingLeft: 18 }}>
            {kann.map((z, i) => (
              <li key={i}>{z}</li>
            ))}
          </ul>
        </div>
        {/*
          Die Abgrenzung steht gleichwertig neben den Fähigkeiten, nicht im
          Kleingedruckten — bewusste Entscheidung (REQ-SAFE-002).
        */}
        <div className="card stack" style={{ gap: 10 }} data-testid="preise-nicht">
          <span className="section-label">{t("preis.nicht_titel")}</span>
          <p style={{ margin: 0 }}>{t("preis.nicht_text")}</p>
        </div>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <span className="section-label">{t("preis.preise_titel")}</span>
        <div className="preis-pakete" data-testid="preise-pakete">
          {pakete.map((p) => (
            <div
              key={p.name}
              className={`card stack preis-paket${p.hervor ? " preis-paket--hervor" : ""}`}
              style={{ gap: 6 }}
            >
              <span className="caption">{p.name}</span>
              <strong className="preis-betrag">{p.preis}</strong>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>{p.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card stack" style={{ gap: 6 }} data-testid="preise-versprechen">
        <span className="section-label">{t("preis.versprechen_titel")}</span>
        <p style={{ margin: 0 }}>{t("preis.versprechen_text")}</p>
      </div>

      <div>
        <Link className="btn btn-teal" href="/navigation" data-testid="preise-cta">
          {t("preis.cta")} <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
}
