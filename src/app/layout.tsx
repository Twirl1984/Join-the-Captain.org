import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Plausible } from "@/components/Plausible";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={poppins.variable}>
      <body>
        <Plausible />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
