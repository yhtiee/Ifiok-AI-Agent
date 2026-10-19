import type { Metadata } from "next";
import { landingCopy, metaDescription, TITLE } from "@/components/marketing/landing/copy";
import { landingJsonLd, serializeJsonLd } from "@/components/marketing/landing/jsonld";
import { Header } from "@/components/marketing/landing/sections/Header";
import { Hero } from "@/components/marketing/landing/sections/Hero";
import { Journey } from "@/components/marketing/landing/sections/Journey";
import { Contribute, Earn, Learn, Prepare, Teach } from "@/components/marketing/landing/sections/PathSections";
import { Faq, FinalCta, Footer, Pricing, Trust } from "@/components/marketing/landing/sections/Closing";
import { StickyCta } from "@/components/marketing/landing/StickyCta";
import { getSiteUrl, publicEnv } from "@/lib/env";
import { featureFlags } from "@/lib/features";
import "@/components/marketing/landing/landing.css";

// Landing page: specifications/landing/04-strategy-and-copy.md (order, SEO, every word) and
// 05-design-spec.md (look, illustrations, interactions); 12 §4 Q47. Static: no cookies, headers or
// Supabase. Every status badge and flag-dependent line reads lib/features.ts through ./copy.

// Rebuild daily so date-gated lines (the judges' FAQ group) drop off without a deploy.
export const revalidate = 86400;

const flags = featureFlags();

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: metaDescription(flags),
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  const copy = landingCopy(flags);
  const jsonLd = landingJsonLd({
    siteUrl: getSiteUrl(),
    flags,
    faq: copy.faq,
    description: metaDescription(flags),
  });

  return (
    <div className="lp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <a className="lp-skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero lead={copy.heroLead} />
        <Journey steps={copy.journey} />
        <Learn copy={copy} />
        <Prepare copy={copy} />
        <Contribute copy={copy} />
        <Teach copy={copy} />
        <Earn copy={copy} />
        <Trust copy={copy} />
        <Pricing copy={copy} />
        <Faq groups={copy.faq} />
        <FinalCta />
      </main>
      <Footer privacyEmail={publicEnv.NEXT_PUBLIC_PRIVACY_EMAIL ?? null} codePublic={flags.codePublic} />
      <StickyCta heroId="hero-cta" endId="start" />
    </div>
  );
}
