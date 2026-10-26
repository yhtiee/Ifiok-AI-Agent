import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getSiteUrl } from "@/lib/env";
import "./globals.css";

// specifications/07-brand-ui-ux.md §3.3 typography: display, text, instrument readings only.
// All three families are self-hosted from app/fonts (Latin subsets from Fontsource 5.3.0, SIL OFL
// 1.1): next/font/google crashes the Turbopack dev server in Next 16.3.8 ("next/font/google
// queries have exactly one entry"), first for Atkinson, then for Bricolage after a cache clear.
const bricolage = localFont({
  variable: "--font-bricolage",
  src: [
    { path: "./fonts/bricolage-grotesque-latin-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/bricolage-grotesque-latin-800.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

const atkinson = localFont({
  variable: "--font-atkinson",
  src: [
    { path: "./fonts/atkinson-hyperlegible-next-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/atkinson-hyperlegible-next-latin-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

const jetbrains = localFont({
  variable: "--font-jetbrains",
  src: [{ path: "./fonts/jetbrains-mono-latin-400.woff2", weight: "400", style: "normal" }],
  fallback: ["ui-monospace", "Consolas", "monospace"],
  // Only instrument readouts use it (labs, the landing Trust band): don't preload it on every page.
  display: "optional",
  preload: false,
});

// Share text: specifications/landing/04 §3.7 (WhatsApp first). Pages set their own title,
// description and canonical; the root keeps the defaults and the share card.
const description =
  "Interactive lessons for any topic in your course, built for Nigerian university students. Free, 18+.";
const shareTitle = "Ifiok · the AI learning agent for students";
const shareDescription =
  "Lessons you can move for any topic in your course. Free for Nigerian university students, 18+.";

export const metadata: Metadata = {
  // Absolute base for canonical and share-image URLs (NEXT_PUBLIC_SITE_URL, required in production).
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Ifiok · the AI learning agent",
    template: "%s · Ifiok",
  },
  description,
  applicationName: "Ifiok",
  category: "education",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    title: shareTitle,
    description: shareDescription,
    url: "/",
    siteName: "Ifiok",
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: shareTitle,
    description: shareDescription,
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
    <html lang="en-NG" className={`${bricolage.variable} ${atkinson.variable} ${jetbrains.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
