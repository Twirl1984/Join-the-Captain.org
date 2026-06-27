import Link from "next/link";
import { Icon } from "./Icon";

// Footer mit Pflicht-Affiliate-Disclaimer (UWG).
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="row-between" style={{ flexWrap: "wrap", gap: 16 }}>
          <div className="brand">
            <span className="mark">
              <Icon name="compass" size={18} />
            </span>
            <span>
              join-the-captain<span className="dot-org">.org</span>
            </span>
          </div>
          <nav className="site-nav" style={{ marginLeft: 0 }}>
            <Link href="/tools">Tools</Link>
            <Link href="/podcast">Podcast</Link>
            <Link href="/entrepreneurs">Entrepreneurs</Link>
            <Link href="/community">Community</Link>
          </nav>
        </div>
        <p className="caption center-note" style={{ marginTop: 24, color: "var(--grau-200)" }}>
          <Icon name="info-circle" size={14} style={{ color: "var(--teal)" }} />
          Mit Affiliate gekennzeichnete Links bringen JTC eine Provision — für
          dich ohne Mehrkosten.
        </p>
      </div>
    </footer>
  );
}
