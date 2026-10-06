import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible_Next,
  Bricolage_Grotesque,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

// specifications/07-brand-ui-ux.md §3.3 typography: display, text, instrument readings only.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "800"],
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  // next/font has no metric overrides for this face yet; fall back to system UI fonts.
  adjustFontFallback: false,
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// Absolute base for canonical and share-image URLs. Set NEXT_PUBLIC_SITE_URL per deploy
// (the production domain is open question Q7 in specifications/12-review-log.md §4).
// Without it, share previews only resolve locally.
const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

const description =
  "Your course, made easy to see, try and master. Lessons you can move, labs you can run and practice that adapts, for Nigerian university students.";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Ifiok · the AI learning agent",
    template: "%s · Ifiok",
  },
  description,
  applicationName: "Ifiok",
  keywords: [
    "Ifiok",
    "AI learning agent",
    "Nigerian university students",
    "interactive lessons",
    "virtual lab",
    "past questions",
    "exam revision",
    "AI tutor",
  ],
  category: "education",
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    title: "Ifiok · the AI learning agent",
    description: "See it. Try it. Master it. Your course, made easy to see, try and master.",
    url: "/",
    siteName: "Ifiok",
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ifiok · the AI learning agent",
    description: "See it. Try it. Master it. Your course, made easy to see, try and master.",
  },
  appleWebApp: { title: "Ifiok", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1318" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-NG"
      className={`${bricolage.variable} ${atkinson.variable} ${jetbrains.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
