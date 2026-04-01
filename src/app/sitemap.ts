import type { MetadataRoute } from "next";
import { GUIDES } from "@/constants/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const guideEntries: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: `https://ohunjal.com/guides/${g.slug}`,
    lastModified: new Date(g.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: "https://ohunjal.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://ohunjal.com/guides",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...guideEntries,
    {
      url: "https://ohunjal.com/terms",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: "https://ohunjal.com/privacy",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
