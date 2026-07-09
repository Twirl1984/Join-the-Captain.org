import type { MetadataRoute } from "next";
import { getTools, getEpisodes } from "@/lib/data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://join-the-captain.org";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statisch: MetadataRoute.Sitemap = [
    "", "/tools", "/wissen", "/navigation", "/wetter", "/podcast", "/entrepreneurs", "/community",
  ].map((p) => ({
    url: `${siteUrl}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.8,
  }));

  // Tools und Podcast bei Fehler überspringen, Sitemap soll robust bleiben.
  let dynamisch: MetadataRoute.Sitemap = [];
  try {
    const [tools, episodes] = await Promise.all([getTools(), getEpisodes()]);
    dynamisch = [
      ...tools.map((t) => ({
        url: `${siteUrl}/tools/${t.slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...episodes.map((e) => ({
        url: `${siteUrl}/podcast#folge-${e.folge_nr}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // DB nicht erreichbar (z.B. Build ohne DATABASE_URL) → nur statische URLs.
  }

  return [...statisch, ...dynamisch];
}
