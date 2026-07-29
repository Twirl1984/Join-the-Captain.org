import type { MetadataRoute } from "next";
import { getTools } from "@/lib/data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://join-the-captain.org";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statisch: MetadataRoute.Sitemap = [
    "", "/reisen", "/tools", "/navigation", "/wetter", "/community", "/preise",
    // Reiseblog-Berichte (statische Seiten in public/reisen).
    "/reisen/aeolische-inseln.html", "/reisen/schaeren-route.html",
    "/reisen/daenische-suedsee.html", "/reisen/kanaren.html",
  ].map((p) => ({
    url: `${siteUrl}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.8,
  }));

  // Tool-Detailseiten dynamisch; bei DB-Fehler bleibt die Sitemap robust.
  let dynamisch: MetadataRoute.Sitemap = [];
  try {
    const tools = await getTools();
    dynamisch = tools.map((t) => ({
      url: `${siteUrl}/tools/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    // DB nicht erreichbar (z.B. Build ohne DATABASE_URL) → nur statische URLs.
  }

  return [...statisch, ...dynamisch];
}
