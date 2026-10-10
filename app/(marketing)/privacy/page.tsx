import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/marketing/LegalPage";
import { contacts } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "What Ifiok collects, why, who processes it, where, for how long, and your rights.",
};

// Privacy notice (08 §4 "Transparent notice", §5 retention, §6 rights). Draft until OWN-06.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="10 October 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your email address, to sign you in.</li>
          <li>The month and year you were born, to check you are 18 or older. Never the day.</li>
          <li>Your university, level and daily study time, if you give them.</li>
          <li>What you do while learning: lessons opened, answers, practice and lab results, and your study plan.</li>
          <li>What you send us: questions to the tutor, photos of your working, and notes you upload.</li>
        </ul>
        <p>
          We don&apos;t ask for your phone number or a photo of you. Textbook PDFs are read on your phone and never
          uploaded.
        </p>
      </section>
      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To provide Ifiok to you (our contract with you).</li>
          <li>To process your questions and work with AI, which you agree to when you sign up (consent).</li>
          <li>To keep Ifiok safe and prevent fraud (legitimate interest).</li>
        </ul>
      </section>
      <section>
        <h2>Who processes it, and where</h2>
        <p>
          Your account and progress are stored outside Nigeria, with Supabase (database and sign-in, in Ireland, EU). We
          also use providers for hosting, email and error reports. Each works only on our instructions.
        </p>
        <p>
          <strong>AI.</strong> What you send Ifiok&apos;s AI (questions, photos of your working, notes, course names and
          topics) is processed by Google&apos;s Gemini API on its free plan, in the United States or elsewhere. On that
          plan Google uses what it receives, and the answers, to provide and improve its products, and people at Google
          may read it. Before sending text, Ifiok removes email addresses, phone numbers and ID-like numbers it can
          detect; it can&apos;t do that for photos. We never send your name, email or account details to Google. If
          Gemini is unavailable, Anthropic (Claude) may answer instead. You agree to this when you sign up; you can stop
          at any time by not using the AI features and deleting your account.
        </p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>Photos for snap-and-mark: deleted 7 days after marking.</li>
          <li>Your lessons, tutor chats and progress: while your account exists. You can delete any tutor chat.</li>
          <li>Technical records of AI use and planning: 13 months.</li>
          <li>
            Payment records (when payments start): as long as the law requires, even after you delete your account.
          </li>
        </ul>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>
          You can download your data, correct it, or delete your account from Settings. You can also email us; we reply
          within 30 days. You can complain to the Nigeria Data Protection Commission.
        </p>
        <p>
          Contact:{" "}
          <ContactLine
            email={contacts.privacy}
            fallback="our privacy address will be published here before the pilot opens."
          />
        </p>
      </section>
      <section>
        <h2>Under 18</h2>
        <p>
          Ifiok is for people 18 and older. If someone under 18 signs up, we delete their account and everything they
          entered straight away.
        </p>
      </section>
    </LegalPage>
  );
}
