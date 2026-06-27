import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://join-the-captain.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API und Feature-Detail-Seiten nicht crawlen.
      disallow: ["/api/", "/community/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
