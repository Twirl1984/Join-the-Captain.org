import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Plausible } from "@/components/Plausible";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-outfit",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://join-the-captain.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Join the Captain — Tools, Podcast & Community für deinen Törn",
    template: "%s · join-the-captain.org",
  },
  description:
    "Geprüfte Tools, ehrliche Empfehlungen und Stimmen aus der Szene. " +
    "Von Seglern für Segler — von der Planung bis nach dem Anlegen.",
  openGraph: {
    type: "website",
    siteName: "join-the-captain.org",
    locale: "de_DE",
  },
  robots: { index: true, follow: true },
  // PWA/Home-Screen: iOS liest apple-touch-icon, nicht die Manifest-Icons.
  icons: {
    icon: "/assets/icons/icon-192.png",
    apple: "/assets/icons/icon-192.png",
  },
};

// Setzt data-theme vor dem ersten Paint (kein Flackern beim Laden).
// Default = dunkel (neues Startdesign); gespeicherte Wahl gewinnt.
const themeScript = `(function(){try{var t=localStorage.getItem('jtc-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      data-theme="dark"
      suppressHydrationWarning
      className={`${outfit.variable} ${playfair.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Plausible />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
