// Structured data for the landing page (specifications/landing/04 §3.6): one @graph built from the
// same copy the page renders. Never add aggregateRating, review or user counts.

import type { FeatureFlags } from "@/lib/features";
import { NAME_MEANING, openFeatureList, type FaqGroups } from "./copy";

export function landingJsonLd({
  siteUrl,
  flags,
  faq,
  description,
}: {
  siteUrl: string;
  flags: FeatureFlags;
  faq: FaqGroups;
  description: string;
}) {
  const base = siteUrl.replace(/\/$/, "");
  const org = `${base}/#organization`;
  const offers = [
    { "@type": "Offer", name: "Free", price: 0, priceCurrency: "NGN", availability: "https://schema.org/InStock" },
    {
      "@type": "Offer",
      name: "Ifiok Plus, monthly",
      price: 500,
      priceCurrency: "NGN",
      ...(flags.plusBilling ? { availability: "https://schema.org/InStock" } : {}),
    },
    {
      "@type": "Offer",
      name: "Ifiok Plus, semester",
      price: 1500,
      priceCurrency: "NGN",
      ...(flags.plusBilling ? { availability: "https://schema.org/InStock" } : {}),
    },
  ];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: "Ifiok",
        url: `${base}/`,
        logo: `${base}/apple-icon.png`,
        description: `Ifiok is an AI learning agent for Nigerian university students. ${NAME_MEANING}`,
        ...(flags.codePublic ? { sameAs: ["https://github.com/yhtiee/Ifiok-AI-Agent"] } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: `${base}/`,
        name: "Ifiok",
        alternateName: ["Ifiok AI"],
        inLanguage: "en-NG",
        publisher: { "@id": org },
      },
      {
        "@type": "WebApplication",
        "@id": `${base}/#app`,
        name: "Ifiok",
        url: `${base}/`,
        description,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any web browser",
        isAccessibleForFree: true,
        inLanguage: "en-NG",
        audience: { "@type": "EducationalAudience", audienceType: "Nigerian university students aged 18 and over" },
        featureList: openFeatureList(flags),
        offers,
        publisher: { "@id": org },
      },
      {
        "@type": "FAQPage",
        "@id": `${base}/#faq`,
        mainEntity: [...faq.main, ...faq.judges].map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };
}

/** Serialise for a <script type="application/ld+json"> (next docs: json-ld guide). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
