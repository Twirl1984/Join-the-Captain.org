import Link from "next/link";
import { Icon } from "./Icon";
import { uebersetzer } from "@/lib/i18n/server";
import { BuchungLink } from "./BuchungLink";
import { SprachUmschalter } from "./SprachUmschalter";

// Footer mit Pflicht-Affiliate-Disclaimer (UWG), Navy in beiden Themes.
// Zweisprachig seit REQ-I18N-001 — MIT EINER AUSNAHME, siehe unten beim
// Affiliate-Hinweis.
export async function SiteFooter() {
  const t = await uebersetzer();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="stack" style={{ gap: 14 }}>
            <div className="brand">
              <span className="mark">
                <Icon name="compass" size={18} />
              </span>
              <span>
                join-the-captain<span className="dot-org">.org</span>
              </span>
            </div>
            <p className="footer-desc">{t("fuss.beschreibung")}</p>
          </div>
          <div className="footer-col">
            <h4>{t("fuss.bereiche")}</h4>
            <ul>
              <li><Link href="/tools">{t("kopf.tools")}</Link></li>
              <li><Link href="/navigation">{t("fuss.nav_wetter")}</Link></li>
              <li><a href="mailto:support@join-the-captain.org">{t("fuss.support")}</a></li>
              <li><Link href="/podcast">{t("kopf.podcast")}</Link></li>
              <li><Link href="/community">{t("kopf.community")}</Link></li>
              <li><Link href="/entrepreneurs">{t("kopf.entrepreneurs")}</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>{t("fuss.mehr")}</h4>
            <ul>
              <li>
                <BuchungLink von="fuss">{t("fuss.zur_buchung_de")}</BuchungLink>
              </li>
              <li><Link href="/preise">{t("kopf.preise")}</Link></li>
              <li><Link href="/impressum">{t("fuss.impressum")}</Link></li>
              <li><Link href="/datenschutz">{t("fuss.datenschutz")}</Link></li>
            </ul>
            {/* Auf schmalen Geraeten steht der Sprachschalter hier statt im Kopf. */}
            <SprachUmschalter ort="fuss" />
          </div>
        </div>
        <div className="footer-bottom">
          {/*
            BEWUSST NICHT ÜBERSETZT (REQ-I18N-001, REQ-SAFE-002):
            Dies ist die nach UWG vorgeschriebene Affiliate-Kennzeichnung. Sie
            bleibt im deutschen Wortlaut, weil eine selbst formulierte
            Übersetzung den rechtlichen Gehalt verschieben könnte. Das `lang`
            sagt dem Screenreader, dass hier Deutsch steht.

            OFFENER PUNKT für den Betreiber: Eine Kennzeichnung, die der Leser
            nicht versteht, erfüllt ihren Zweck möglicherweise nicht. Wenn die
            englische Fassung wirklich an englischsprachige Nutzer geht, sollte
            ein Jurist eine englische Kennzeichnung freigeben — dann kann sie
            hier ergänzt werden.
          */}
          <span className="center-note" lang="de">
            <Icon name="info-circle" size={14} style={{ color: "var(--accent)" }} />
            Mit Affiliate gekennzeichnete Links bringen JTC eine Provision — für
            dich ohne Mehrkosten.
          </span>
          <span>© {new Date().getFullYear()} Join the Captain</span>
        </div>
      </div>
    </footer>
  );
}
