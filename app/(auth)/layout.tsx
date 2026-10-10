import Link from "next/link";
import { Wordmark } from "@/components/marketing/Brand";
import { SetupProgress } from "@/components/app/SetupProgress";

// Sign-in and onboarding.
// Phones: a slim top bar and a full-width form (16 px gutters).
// Laptops and desktops: a split screen. A fixed left panel shows where the student is in setup;
// the form fills the space beside it, left-aligned, instead of floating in the middle.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-r border-line bg-surface px-10 py-8 lg:flex">
        <div>
          <Link href="/" className="flex min-h-11 items-center" aria-label="Ifiok home">
            <Wordmark className="text-[2rem]" />
          </Link>
          <p className="mt-3 max-w-[30ch] text-base text-ink-2">
            Lessons you can move, practicals you can run and practice that adapts.
          </p>
          <div className="mt-10">
            <SetupProgress />
          </div>
        </div>
        <p className="text-sm text-ink-2">
          Ifiok is for students 18 and older. It takes about three minutes to set up.
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 items-center px-4 lg:hidden">
          <Link href="/" className="flex min-h-11 items-center" aria-label="Ifiok home">
            <Wordmark className="text-[1.6rem]" />
          </Link>
        </header>
        <main className="flex w-full max-w-3xl flex-1 flex-col px-4 pt-4 sm:px-6 sm:pt-8 lg:px-16 lg:pt-20 lg:pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
