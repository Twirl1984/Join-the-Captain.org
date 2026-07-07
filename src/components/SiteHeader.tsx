import Link from "next/link";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

// Globaler Header der .org-Site (Navy in beiden Themes, Gold-Akzent).
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
          <Link href="/wissen">Wissen</Link>
          <Link href="/wetter">Wetter</Link>
          <Link href="/podcast">Podcast</Link>
          <Link href="/community">Community</Link>
          <Link href="/entrepreneurs">Entrepreneurs</Link>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
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
      </div>
    </header>
  );
}
