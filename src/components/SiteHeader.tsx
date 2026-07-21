import Link from "next/link";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { SprachUmschalter } from "./SprachUmschalter";
import { navigationEnabled } from "@/lib/flags";
import { uebersetzer } from "@/lib/i18n/server";

// Globaler Header der .org-Site (Navy in beiden Themes, Gold-Akzent).
// Zweisprachig seit REQ-I18N-001: Beschriftungen kommen aus dem Wörterbuch,
// die URLs bleiben unverändert deutsch (keine Sprachpräfixe) — bestehende
// Links und Lesezeichen sollen weiter funktionieren.
export async function SiteHeader() {
  const t = await uebersetzer();
  const buchungUrl = "https://join-the-captain.de";
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand">
          <span className="mark">
            <Icon name="compass" size={18} />
          </span>
          <span>
            join-the-captain<span className="dot-org">.org</span>
          </span>
        </Link>
        <nav className="site-nav">
          <Link href="/tools">{t("kopf.tools")}</Link>
          <Link href="/wissen">{t("kopf.wissen")}</Link>
          <Link href="/wetter">{t("kopf.wetter")}</Link>
          {navigationEnabled() && <Link href="/navigation">{t("kopf.navigation")}</Link>}
          <Link href="/podcast">{t("kopf.podcast")}</Link>
          <Link href="/community">{t("kopf.community")}</Link>
          <Link href="/entrepreneurs">{t("kopf.entrepreneurs")}</Link>
        </nav>
        <div className="header-actions">
          <SprachUmschalter />
          <ThemeToggle />
          <a
            className="header-cta"
            href={buchungUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("kopf.zur_buchung")} <Icon name="arrow-right" size={16} />
          </a>
          <button className="burger" aria-label={t("kopf.menue_oeffnen")}>
            <Icon name="menu" size={24} />
          </button>
        </div>
      </div>
    </header>
  );
}
