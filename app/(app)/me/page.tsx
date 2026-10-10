import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Panel } from "@/components/app/Page";
import { AppPage } from "@/components/app/AppPage";
import { buttonClass } from "@/components/ui/button-styles";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Me", robots: { index: false } };

const LEVEL_LABEL: Record<number, string> = { 700: "Postgraduate" };

// Me (07 §4): profile and settings. Editing, data export and account deletion arrive with
// Settings → Privacy (P1-14); study details can be changed through the setup steps until then.
export default async function MePage() {
  const { profile, email } = await requireOnboardedPage();
  let university = "Not listed";
  if (profile.university_id) {
    const supabase = await createClient();
    const { data } = await supabase.from("universities").select("name").eq("id", profile.university_id).maybeSingle();
    university = data?.name ?? university;
  }
  const level = profile.level ? (LEVEL_LABEL[profile.level] ?? `${profile.level} level`) : "Not set";

  return (
    <AppPage crumbs={[{ label: "Me" }]} title="Me" description="Your account and study settings.">
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel
          title="Study profile"
          action={
            <Link
              href="/onboarding/university"
              className="text-sm font-semibold text-quantity underline-offset-4 hover:underline"
            >
              Change
            </Link>
          }
        >
          <ul className="grid divide-y divide-line">
            <Row label="University" value={university} />
            <Row label="Level" value={level} />
            <Row label="Daily study time" value={`${profile.daily_minutes} minutes`} />
          </ul>
        </Panel>

        <Panel title="Account">
          <ul className="grid divide-y divide-line">
            <Row label="Email" value={email ?? "Signed in with Google"} />
            <Row
              label="Legal"
              value={
                <span className="flex flex-wrap gap-x-4">
                  <Link className="text-quantity underline-offset-4 hover:underline" href="/terms">
                    Terms
                  </Link>
                  <Link className="text-quantity underline-offset-4 hover:underline" href="/privacy">
                    Privacy
                  </Link>
                  <Link className="text-quantity underline-offset-4 hover:underline" href="/ai">
                    How Ifiok uses AI
                  </Link>
                </span>
              }
            />
          </ul>
          <form action="/auth/sign-out" method="post" className="mt-4">
            <button type="submit" className={buttonClass("secondary")}>
              Sign out
            </button>
          </form>
        </Panel>
      </div>
    </AppPage>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </li>
  );
}
