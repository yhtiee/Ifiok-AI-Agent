import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppPage } from "@/components/app/AppPage";
import { Row, RowList, SectionHeading } from "@/components/app/Page";
import { ChalkboardTeacherIcon, CoinsIcon, PresentationChartIcon, ShieldCheckIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { isReviewAdmin, requireOnboardedPage } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { NameForm } from "./NameForm";

export const metadata: Metadata = { title: "Me", robots: { index: false } };

const LEVEL_LABEL: Record<number, string> = { 700: "Postgraduate" };

const link = "inline-flex min-h-11 items-center text-base text-quantity underline-offset-4 hover:underline";

// Me (07 §4, app-overhaul §5.8): plain sections in one column. Name editing is here (Q30); study
// details are changed through the setup steps until Settings → Privacy (P1-14).
export default async function MePage() {
  const { profile, email } = await requireOnboardedPage();
  let university = "Not listed";
  if (profile.university_id) {
    const supabase = await createClient();
    const { data } = await supabase.from("universities").select("name").eq("id", profile.university_id).maybeSingle();
    university = data?.name ?? university;
  }
  const isAdmin = await isReviewAdmin();
  const level = profile.level ? (LEVEL_LABEL[profile.level] ?? `${profile.level} level`) : "Not set";

  return (
    <AppPage crumbs={[{ label: "Me" }]} title="Me">
      {/* Wide screens: name on the left, profile and account on the right; one column on phones. */}
      <div className="grid max-w-6xl gap-10 xl:grid-cols-2 xl:gap-16">
        <div className="grid content-start gap-10">
          <section aria-labelledby="your-name" className="grid gap-4">
            <SectionHeading id="your-name">Your name</SectionHeading>
            <NameForm firstName={profile.first_name} lastName={profile.last_name} />
          </section>

          <form action="/auth/sign-out" method="post" className="hidden xl:block">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>

        <div className="grid content-start gap-10">
          <section aria-labelledby="study-profile" className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading id="study-profile">Study profile</SectionHeading>
              <Link href="/onboarding/university" className={link} aria-label="Change your study profile">
                Change
              </Link>
            </div>
            <ul className="divide-y divide-line border-y border-line">
              <Item label="University" value={university} />
              <Item label="Level" value={level} />
            </ul>
          </section>

          <section aria-labelledby="teach-earn" className="grid gap-3">
            <SectionHeading id="teach-earn">Teach and earn</SectionHeading>
            <RowList labelledBy="teach-earn">
              <Row
                href="/me/earnings"
                icon={<CoinsIcon size={22} />}
                tone="add"
                title="My earnings"
                meta="Usage points and Units from what you share and explain"
              />
              <Row
                href="/me/explainers"
                icon={<PresentationChartIcon size={22} />}
                tone="topic"
                title="Explainers"
                meta="Teach a topic in writing, a voice note or a short video"
              />
              <Row
                href="/me/tutor"
                icon={<ChalkboardTeacherIcon size={22} />}
                tone="course"
                title="Tutor profile"
                meta="Offer to tutor topics; bookings open after launch"
              />
              {isAdmin ? (
                <Row
                  href="/admin"
                  icon={<ShieldCheckIcon size={22} />}
                  tone="plain"
                  title="Review"
                  meta="Explainers and held shares waiting for an admin"
                />
              ) : null}
            </RowList>
          </section>

          <section aria-labelledby="account" className="grid gap-3">
            <SectionHeading id="account">Account</SectionHeading>
            <ul className="divide-y divide-line border-y border-line">
              <Item label="Email" value={email ?? "Signed in with Google"} />
            </ul>
            <p className="flex flex-wrap gap-x-5">
              <Link className={link} href="/terms">
                Terms
              </Link>
              <Link className={link} href="/privacy">
                Privacy
              </Link>
              <Link className={link} href="/ai">
                How Ifiok uses AI
              </Link>
            </p>
          </section>
        </div>

        <form action="/auth/sign-out" method="post" className="xl:hidden">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </AppPage>
  );
}

function Item({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="text-base font-semibold [overflow-wrap:anywhere]">{value}</span>
    </li>
  );
}
