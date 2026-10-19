import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";

// Public pages are crawlable; API, auth callbacks and the signed-in app are not (landing 04 §3.8).
export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/onboarding", "/today", "/courses", "/learn", "/practice", "/me"],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
