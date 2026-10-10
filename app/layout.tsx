import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// specifications/07-brand-ui-ux.md §3.3 typography: display, text, instrument readings only.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "800"],
  display: "swap",
});

// Self-hosted from app/fonts (Latin, from Fontsource, SIL OFL 1.1). next/font/google's version of
// this family crashes the Turbopack dev server in Next 16.3.8 ("queries have exactly one entry").
const atkinson = localFont({
  variable: "--font-atkinson",
  src: [
    { path: "./fonts/atkinson-hyperlegible-next-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/atkinson-hyperlegible-next-latin-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
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
    <html lang="en-NG" className={`${bricolage.variable} ${atkinson.variable} ${jetbrains.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
