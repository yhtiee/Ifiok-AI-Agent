import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using Ifiok.",
};

// Terms of use (F0 trade-offs, 06 §10, 08 §3 and §8). Draft until OWN-06.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="10 October 2026">
      <section>
        <h2>Who can use Ifiok</h2>
        <p>
          You must be 18 or older. You tell us your birth month and year when you sign up, and we rely on that. If we
          learn an account belongs to someone under 18, we block it while we check.
        </p>
      </section>
      <section>
        <h2>Learning with AI</h2>
        <p>
          Ifiok uses AI. It can be wrong, so check anything important against your course material. Marks are estimates,
          not grades from your university. Read{" "}
          <a className="font-semibold text-quantity underline underline-offset-4" href="/ai">
            how Ifiok uses AI
          </a>
          .
        </p>
      </section>
      <section>
        <h2>Using Ifiok fairly</h2>
        <ul>
          <li>Don&apos;t use Ifiok to cheat during an exam or test.</li>
          <li>Don&apos;t upload published textbooks, or notes and papers you don&apos;t have the right to share.</li>
          <li>Don&apos;t post abusive or offensive content, or try to break or misuse the service.</li>
        </ul>
      </section>
      <section>
        <h2>What you share</h2>
        <p>
          When you share notes or other material with Ifiok&apos;s library, you let Ifiok use and show it, and lessons
          made from it, to other students. You keep ownership. You can withdraw an item: we stop using it in new
          lessons. Rights holders can ask us to take material down, and we hide it within 24 hours while we review.
        </p>
      </section>
      <section>
        <h2>Units and earnings (from the paid launch)</h2>
        <p>
          Units are prepaid credits for extra AI features. They have no cash value, can&apos;t be transferred and are
          refunded only if a feature fails to deliver. Units you earn expire after 90 days. Rules for contributor
          earnings will be published here before any money moves.
        </p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>If these terms change, we&apos;ll ask you to agree again the next time you open Ifiok.</p>
      </section>
    </LegalPage>
  );
}
