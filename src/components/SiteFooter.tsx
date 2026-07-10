import Link from "next/link";
import { Icon } from "./Icon";

// Footer mit Pflicht-Affiliate-Disclaimer (UWG), Navy in beiden Themes.
export function SiteFooter() {
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
            <p className="footer-desc">
              Geprüfte Tools, ehrliche Empfehlungen und Stimmen aus der Szene.
              Von Seglern für Segler — von der Planung bis nach dem Anlegen.
            </p>
          </div>
          <div className="footer-col">
            <h4>Bereiche</h4>
            <ul>
              <li><Link href="/tools">Tools</Link></li>
              <li><Link href="/navigation">Navigation &amp; Wetter</Link></li>
              <li><a href="mailto:support@join-the-captain.org">Support</a></li>
              <li><Link href="/podcast">Podcast</Link></li>
              <li><Link href="/community">Community</Link></li>
              <li><Link href="/entrepreneurs">Entrepreneurs</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Mehr</h4>
            <ul>
              <li>
                <a href="https://join-the-captain.de" target="_blank" rel="noopener noreferrer">
                  Zur Buchung (.de)
                </a>
              </li>
              <li><Link href="/impressum">Impressum</Link></li>
              <li><Link href="/datenschutz">Datenschutz</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="center-note">
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
