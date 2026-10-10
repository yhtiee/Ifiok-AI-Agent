import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "How Ifiok uses AI",
  description: "What Ifiok's AI does, how its answers are checked, and where it can be wrong.",
};

// AI disclosure (F0-FR3, 08 §4 "AI and automated decisions"). Facts from 00, 01, 04 and 05.
export default function AiDisclosurePage() {
  return (
    <LegalPage title="How Ifiok uses AI" updated="10 October 2026">
      <section>
        <h2>Ifiok is an AI, and it can be wrong</h2>
        <p>
          Ifiok&apos;s tutor, lessons and marking are produced with AI models from Google (Gemini) and Anthropic
          (Claude), called from our servers. AI can misread a question, mix up facts or explain something badly. We
          design for that, and we ask you to check anything that matters.
        </p>
      </section>
      <section>
        <h2>How answers are checked</h2>
        <ul>
          <li>
            Every number in a lesson, practice question or worked step comes from a maths engine, not the AI&apos;s
            memory.
          </li>
          <li>Lessons that fail our automatic checks are not published.</li>
          <li>
            Explanations link to the notes they came from. Answers that aren&apos;t from course material are labelled.
          </li>
          <li>
            Marks from snap-and-mark are always labelled estimates. You confirm the reading of your handwriting before
            it is marked.
          </li>
          <li>Anyone can flag a wrong step. Three flags hide it until it is fixed.</li>
          <li>Lessons in medicine, nursing, pharmacy and law wait for a human reviewer before anyone sees them.</li>
        </ul>
      </section>
      <section>
        <h2>Plans and mastery are suggestions</h2>
        <p>
          Your daily plan and mastery levels are worked out by fixed rules from your activity. They are recommendations
          to help you study, not decisions about you. You can report a mark you think is wrong.
        </p>
      </section>
      <section>
        <h2>What the AI sees</h2>
        <p>
          To answer you, the AI receives your question and the parts of your course material that match it. Ifiok never
          shows exam questions as &quot;predicted&quot;: it shows how often a topic was asked in past papers.
        </p>
      </section>
      <section>
        <h2>Google can see what you send</h2>
        <p>
          Ifiok uses Google&apos;s Gemini AI on its free plan to keep Ifiok free. On that plan Google may keep your
          questions, photos and notes, use them to improve its products, and have people review them.
        </p>
        <ul>
          <li>
            Don&apos;t include your name, phone number, matric number, NIN or other personal details, even in photos.
          </li>
          <li>Ifiok removes email addresses, phone numbers and long ID-like numbers from text before sending it.</li>
          <li>We never send your name, email address or account details to Google.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
