import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { StepScreen } from "@/components/ui/StepScreen";
import { contacts } from "@/lib/site";

export const metadata: Metadata = { title: "Ifiok is 18+ for now", robots: { index: false } };

// Shown after an under-18 date of birth. The account was already deleted: nothing was kept (08 §3).
// Public page: it never receives the date of birth or any identifier.
export default function NotYetPage() {
  return (
    <StepScreen
      title="Ifiok is for students 18 and older, for now"
      intro="We haven't kept anything you entered: your account and details have been deleted."
      action={
        <ButtonLink href="/" variant="secondary" full>
          Back to the Ifiok home page
        </ButtonLink>
      }
    >
      <div className="grid gap-4 text-base">
        <p>
          The AI services Ifiok uses, and Nigeria&apos;s data protection law, set extra rules for anyone under 18. We
          want to support younger students properly, with a parent&apos;s or guardian&apos;s consent, before we open
          Ifiok to them.
        </p>
        {contacts.minors ? (
          <p>
            Ask a parent or guardian to email{" "}
            <a className="font-semibold text-quantity underline underline-offset-4" href={`mailto:${contacts.minors}`}>
              {contacts.minors}
            </a>{" "}
            if you&apos;d like us to tell you when Ifiok supports under-18s.
          </p>
        ) : null}
      </div>
    </StepScreen>
  );
}
