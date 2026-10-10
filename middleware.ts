import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Edge `middleware.ts`, not Node `proxy.ts`: OpenNext on Cloudflare needs Edge middleware
// (CLAUDE.md stack; recorded in specifications/12-review-log.md §4). Next 16 marks the
// `middleware` name deprecated; it still works.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Every route except the static landing page "/" and static assets, icons and share images.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|txt|xml|webmanifest)$).+)",
  ],
};
