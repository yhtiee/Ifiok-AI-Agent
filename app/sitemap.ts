import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";

// The public, indexable pages. /sign-in is noindex and stays out.
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${site}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${site}/ai`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
