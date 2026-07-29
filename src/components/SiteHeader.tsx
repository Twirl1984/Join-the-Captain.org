import Link from "next/link";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { SprachUmschalter } from "./SprachUmschalter";
import { BuchungLink } from "./BuchungLink";
import { navigationEnabled } from "@/lib/flags";
import { uebersetzer } from "@/lib/i18n/server";

// Globaler Header der .org-Site (Navy in beiden Themes, Gold-Akzent).
// Zweisprachig seit REQ-I18N-001: Beschriftungen kommen aus dem Wörterbuch,
// die URLs bleiben unverändert deutsch (keine Sprachpräfixe) — bestehende
// Links und Lesezeichen sollen weiter funktionieren.
export async function SiteHeader() {
  const t = await uebersetzer();
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
          <Link href="/reisen">Reiseblog</Link>
          <Link href="/tools">{t("kopf.tools")}</Link>
          <Link href="/wetter">{t("kopf.wetter")}</Link>
          {navigationEnabled() && <Link href="/navigation">{t("kopf.navigation")}</Link>}
          <Link href="/community">{t("kopf.community")}</Link>
        </nav>
        <div className="header-actions">
          <SprachUmschalter />
          <ThemeToggle />
          <BuchungLink von="kopf" className="header-cta" mitPfeil>
            {t("kopf.zur_buchung")}
          </BuchungLink>
          <button className="burger" aria-label={t("kopf.menue_oeffnen")}>
            <Icon name="menu" size={24} />
          </button>
        </div>
      </div>
    </header>
  );
}
