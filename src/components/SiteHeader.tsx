import Link from "next/link";
import { Icon } from "./Icon";

// Globaler Header der .org-Site (Navy Deep, volle Breite).
export function SiteHeader() {
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
          <Link href="/tools">Tools</Link>
          <Link href="/podcast">Podcast</Link>
          <Link href="/entrepreneurs">Entrepreneurs</Link>
          <Link href="/community">Community</Link>
        </nav>
        <a
          className="header-cta"
          href={buchungUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Zur Buchung <Icon name="arrow-right" size={16} />
        </a>
        <button className="burger" aria-label="Menü öffnen">
          <Icon name="menu" size={24} />
        </button>
      </div>
    </header>
  );
}
