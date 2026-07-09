import { permanentRedirect } from "next/navigation";

// /wetter ist in /navigation aufgegangen (REQ-NAV-016, User-Entscheid 2026-07-08).
// Permanenter Redirect, damit alle geteilten Links (WhatsApp, Foren, Sitemap-
// Altbestand) weiter funktionieren.
export default function WetterRedirect() {
  permanentRedirect("/navigation");
}
