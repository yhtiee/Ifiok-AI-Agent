// Judge accounts and demo data for the PayPal AI Hackathon (10 MVP-08, 12 §4 Q63). Two students
// (everyone is a student; sharing, tutoring and learning are things students do, not roles) and
// one admin, all on the hosted project. Re-running resets the demo to the same starting point.
//
//   Student 1: struggling with Kirchhoff's laws (weak area from recent wrong answers), so the
//              tutoring agent has something to act on; can book a tutor and share materials.
//   Student 2: tutors Kirchhoff's laws and Thevenin's theorem ($8.00 a session), shared notes that
//              are in the Library and earned usage points this month, and a written explainer.
//   Admin:     the admin interface only (review, payouts, tutoring).
//
// Needs in .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JUDGE_PASSWORD (12+ chars,
// never committed). Optional: JUDGE_STUDENT1_PAYPAL / JUDGE_STUDENT2_PAYPAL (US PayPal sandbox
// personal accounts), JUDGE_EMAIL_DOMAIN (default judges.ifiok.test).
// Usage: node --experimental-transform-types scripts/seed-judges.mts
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { CONSENT_VERSION, REQUIRED_CONSENTS } from "@ifiok/core/consent";
import type { Database } from "@ifiok/core/db/types";

const env: Record<string, string> = {};
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
  }
}
const password = env.JUDGE_PASSWORD ?? "";
if (password.length < 12) {
  console.error("✗ Set JUDGE_PASSWORD (12+ characters) in .env first. It's never committed.");
  process.exit(1);
}
const domain = env.JUDGE_EMAIL_DOMAIN || "judges.ifiok.test";
const db = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const must = <T,>(r: { data: T | null; error: { message: string } | null }, what: string): NonNullable<T> => {
  if (r.error || r.data === null) throw new Error(`${what}: ${r.error?.message ?? "no data"}`);
  return r.data as NonNullable<T>;
};

// Fixed ids, so a re-run updates the same rows.
const ID = {
  notes: "5e9d0000-0000-4000-8000-000000000001",
  explainer: "5e9d0000-0000-4000-8000-000000000002",
  items: Array.from({ length: 8 }, (_, i) => `5e9d0000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`),
};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

async function findUser(email: string): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(email: string): Promise<string> {
  const existing = await findUser(email);
  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing, { password, email_confirm: true });
    if (error) throw new Error(`reset ${email}: ${error.message}`);
    return existing;
  }
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`create ${email}: ${error?.message}`);
  return data.user.id;
}

async function ensureStudent(email: string, first: string, last: string, level: number, universityId: string) {
  const id = await ensureUser(email);
  must(
    await db
      .from("profiles")
      .update({
        role: "student",
        is_adult: true,
        birth_year: 2003,
        birth_month: 5,
        university_id: universityId,
        level,
        daily_minutes: 30,
        onboarded_at: new Date().toISOString(),
        first_name: first,
        last_name: last,
      })
      .eq("id", id)
      .select("id"),
    `profile ${email}`,
  );
  await db.from("consents").upsert(
    REQUIRED_CONSENTS.map((kind) => ({ user_id: id, kind, version: CONSENT_VERSION })),
    { onConflict: "user_id,kind,version", ignoreDuplicates: true },
  );
  return id;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const TOPICS = [
  {
    slug: "phy.ohms-law",
    title: "Ohm's law",
    description: "Current through a conductor is proportional to the voltage across it: V = IR.",
  },
  {
    slug: "phy.kirchhoffs-laws",
    title: "Kirchhoff's laws",
    description: "The junction rule (charge is conserved) and the loop rule (energy is conserved) for circuits.",
  },
  {
    slug: "phy.thevenins-theorem",
    title: "Thevenin's theorem",
    description: "Any linear two-terminal circuit can be replaced by one voltage source in series with one resistance.",
  },
  {
    slug: "phy.capacitors",
    title: "Capacitors",
    description: "Storing charge: C = Q/V, capacitors in series and parallel, and the energy stored.",
  },
];

async function ensureConcept(t: (typeof TOPICS)[number]): Promise<string> {
  const { data } = await db
    .from("concepts")
    .select("id")
    .eq("slug", t.slug)
    .eq("level_band", "introductory")
    .maybeSingle();
  if (data) return data.id;
  const { data: row, error } = await db
    .from("concepts")
    .insert({
      slug: t.slug,
      title: t.title,
      description: t.description,
      subject: "physics",
      level_band: "introductory",
      status: "active",
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(`concept ${t.slug}: ${error?.message}`);
  return row.id;
}

const NOTES = [
  "Kirchhoff's laws: my notes from PHY 102.",
  "Junction rule (KCL): at any junction, the total current flowing in equals the total current flowing out, because charge is conserved. If 3 A and 2 A flow into a node, 5 A must flow out.",
  "Loop rule (KVL): going round any closed loop, the sum of the EMFs equals the sum of the IR drops, because energy is conserved. Pick a direction round the loop and stick to it.",
  "Signs: crossing a resistor in the direction of the current is a drop of IR; against the current it is a rise. Crossing a cell from - to + is a rise of its EMF.",
  "Method: label a current in every branch, write a junction equation at all but one node, write one loop equation for each independent loop, then solve the simultaneous equations. A negative answer just means the current flows the other way.",
  "Common mistake: changing the loop direction halfway round, which flips the sign of some IR terms.",
].join("\n\n");

const EXPLAINER = `## Kirchhoff's laws in two steps

**1. Junctions.** Whatever current goes into a junction comes out. 3 A and 2 A in means 5 A out. That's the junction rule: charge doesn't pile up.

**2. Loops.** Walk once round a closed loop. Add every EMF you pass, subtract every IR drop, and you get zero. That's the loop rule: energy is conserved.

The trick is signs. Choose a direction to walk *before* you start and never change it. Through a resistor *with* the current: −IR. Against it: +IR. If a current comes out negative, it simply flows the other way.`;

// Practice questions with answers the maths engine checks (stated answer = answer_expr).
function numericItem(id: string, conceptId: string, prompt: string, expected: number, expr: string, why: string) {
  return {
    id,
    concept_id: conceptId,
    type: "numeric" as const,
    stem: { prompt },
    answer: { expected, answer_expr: expr, why },
    verification: { type: "numeric", answer_expr: expr, stated: expected, tolerance: null },
    origin: "generated",
    status: "published" as const,
  };
}

// ---------------------------------------------------------------------------

async function main() {
  const { data: uni } = await db.from("universities").select("id").eq("short_name", "UNIUYO").single();
  if (!uni) throw new Error("UNIUYO is missing from universities (seed 00_universities.sql)");

  const s1Email = `student1@${domain}`;
  const s2Email = `student2@${domain}`;
  const adminEmail = `admin@${domain}`;
  const s1 = await ensureStudent(s1Email, "Amara", "Nwosu", 200, uni.id);
  const s2 = await ensureStudent(s2Email, "Tunde", "Bello", 300, uni.id);
  const admin = await ensureUser(adminEmail);
  must(
    await db
      .from("profiles")
      .update({ role: "admin", is_adult: true, first_name: "Ifiok", last_name: "Admin" })
      .eq("id", admin)
      .select("id"),
    "admin profile",
  );

  const [ohm, kvl, thevenin, caps] = await Promise.all(TOPICS.map(ensureConcept));

  // The course both students take, with its outline.
  let course = (
    await db.from("courses").select("id").eq("university_id", uni.id).eq("code_norm", "IFK102").maybeSingle()
  ).data;
  course ??= must(
    await db
      .from("courses")
      .insert({
        university_id: uni.id,
        code: "IFK 102",
        title: "Electricity and Magnetism (Ifiok demo)",
        subject: "physics",
        created_by: s2,
      })
      .select("id")
      .single(),
    "course",
  );
  const courseId = course.id;
  const { count: topicCount } = await db
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  if (!topicCount) {
    must(
      await db
        .from("topics")
        .insert(
          [ohm, kvl, thevenin, caps].map((concept_id, i) => ({
            course_id: courseId,
            concept_id: concept_id!,
            position: i + 1,
            week: i + 1,
            title: TOPICS[i]!.title,
          })),
        )
        .select("id"),
      "topics",
    );
  }
  await db.from("enrollments").upsert(
    [s1, s2].map((user_id) => ({ user_id, course_id: courseId })),
    {
      onConflict: "user_id,course_id",
      ignoreDuplicates: true,
    },
  );

  // Practice questions on Ohm's law and Kirchhoff's laws.
  must(
    await db
      .from("items")
      .upsert([
        numericItem(
          ID.items[0]!,
          ohm!,
          "A 6 V cell drives current through a 3 ohm resistor. What is the current in amperes?",
          2,
          "6/3",
          "I = V/R = 6/3.",
        ),
        numericItem(
          ID.items[1]!,
          ohm!,
          "2 A flows through a 5 ohm resistor. What is the voltage across it in volts?",
          10,
          "2*5",
          "V = IR = 2 × 5.",
        ),
        numericItem(
          ID.items[2]!,
          ohm!,
          "A 12 V supply gives 0.5 A. What is the resistance in ohms?",
          24,
          "12/0.5",
          "R = V/I = 12/0.5.",
        ),
        numericItem(
          ID.items[3]!,
          kvl!,
          "Currents of 3 A and 2 A flow into a junction. What current in amperes flows out?",
          5,
          "3+2",
          "Junction rule: in = out, 3 + 2.",
        ),
        numericItem(
          ID.items[4]!,
          kvl!,
          "4 A flows into a junction and 1.5 A leaves by one wire. What current in amperes leaves by the other?",
          2.5,
          "4-1.5",
          "Junction rule: 4 = 1.5 + I.",
        ),
        numericItem(
          ID.items[5]!,
          kvl!,
          "A 9 V cell is in a loop with a 2 ohm and a 1 ohm resistor in series. What is the current in amperes?",
          3,
          "9/(2+1)",
          "Loop rule: 9 = I(2 + 1).",
        ),
        numericItem(
          ID.items[6]!,
          kvl!,
          "In a loop, a 12 V cell drives 2 A through a 4 ohm resistor and one unknown resistor. What is the unknown resistance in ohms?",
          2,
          "(12-2*4)/2",
          "Loop rule: 12 = 2 × 4 + 2R.",
        ),
        numericItem(
          ID.items[7]!,
          thevenin!,
          "A 10 V source with 2 ohm internal resistance feeds a 3 ohm load. What is the load current in amperes?",
          2,
          "10/(2+3)",
          "I = V/(R_th + R_L) = 10/5.",
        ),
      ])
      .select("id"),
    "items",
  );

  // Student 1's recent answers: strong on Ohm's law, stuck on Kirchhoff's laws (sign mistakes).
  await db.from("attempts").delete().eq("user_id", s1).in("item_id", ID.items);
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  must(
    await db
      .from("attempts")
      .insert(
        [
          { item: 0, correct: true, value: 2, min: 3000 },
          { item: 1, correct: true, value: 10, min: 2990 },
          { item: 2, correct: true, value: 24, min: 2980 },
          { item: 3, correct: true, value: 5, min: 1500 },
          { item: 4, correct: false, value: 5.5, min: 1490 },
          { item: 5, correct: false, value: 9, min: 1480 },
          { item: 6, correct: false, value: 5, min: 240 },
          { item: 5, correct: false, value: 4.5, min: 230 },
        ].map((a) => ({
          id: crypto.randomUUID(),
          user_id: s1,
          item_id: ID.items[a.item]!,
          correct: a.correct,
          response: { value: a.value },
          created_at: ago(a.min),
        })),
      )
      .select("id"),
    "attempts",
  );
  await db.from("mastery").upsert(
    [
      { user_id: s1, concept_id: ohm!, m: 0.72, level: "proficient", attempts_count: 3 },
      { user_id: s1, concept_id: kvl!, m: 0.22, level: "not_started", attempts_count: 5 },
      { user_id: s2, concept_id: kvl!, m: 0.92, level: "mastered", attempts_count: 14 },
      { user_id: s2, concept_id: thevenin!, m: 0.8, level: "proficient", attempts_count: 9 },
    ],
    { onConflict: "user_id,concept_id" },
  );
  await db
    .from("daily_activity")
    .upsert({ user_id: s1, day: new Date().toISOString().slice(0, 10), sessions: 2 }, { onConflict: "user_id,day" });

  // Student 2 tutors two topics at $8.00 a session.
  must(
    await db
      .from("tutor_profiles")
      .upsert({
        user_id: s2,
        availability: "Weekday evenings after 6 pm, Saturday mornings",
        active: true,
        price_cents: 800,
      })
      .select("user_id"),
    "tutor profile",
  );
  await db.from("tutor_concepts").upsert(
    [kvl, thevenin].map((concept_id) => ({ user_id: s2, concept_id: concept_id! })),
    {
      onConflict: "user_id,concept_id",
      ignoreDuplicates: true,
    },
  );

  // Student 2's shared notes, approved into the Library and the contribution pool.
  const now = new Date().toISOString();
  must(
    await db
      .from("sources")
      .upsert({
        id: ID.notes,
        owner_id: s2,
        course_id: courseId,
        concept_id: kvl!,
        kind: "notes",
        title: "Kirchhoff's laws: worked notes",
        page_count: 1,
        visibility: "private",
        shared_at: now,
        license_attested_at: now,
      })
      .select("id"),
    "notes",
  );
  await db.from("chunks").delete().eq("source_id", ID.notes);
  must(
    await db
      .from("chunks")
      .insert({
        source_id: ID.notes,
        owner_id: s2,
        course_id: courseId,
        visibility: "private",
        page: 1,
        content: NOTES,
      })
      .select("id"),
    "chunks",
  );
  must(await db.rpc("approve_shared_source", { p_source: ID.notes, p_concepts: [kvl!] }), "approve notes");
  await db.rpc("enqueue_job_once", {
    p_queue: "embed",
    p_payload: { source_id: ID.notes },
    p_dedupe: `embed:${ID.notes}:seed-${Date.now()}`,
    p_owner: s2,
  });

  // And a written explainer, approved.
  must(
    await db
      .from("explainers")
      .upsert({
        id: ID.explainer,
        author_id: s2,
        concept_id: kvl!,
        kind: "text",
        title: "Kirchhoff's laws in two steps",
        body_md: EXPLAINER,
        status: "approved",
        approved_by: admin,
        approved_at: now,
        numbers_checked: true,
      })
      .select("id"),
    "explainer",
  );

  // Usage this month: Student 1 learned from Student 2's notes and explainer (one point each).
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  await db.from("usage_points").upsert(
    [
      { resource_kind: "source", resource_id: ID.notes, contributor_id: s2, consumer_id: s1, month },
      { resource_kind: "explainer", resource_id: ID.explainer, contributor_id: s2, consumer_id: s1, month },
    ],
    { onConflict: "resource_kind,resource_id,consumer_id,month", ignoreDuplicates: true },
  );

  // PayPal sandbox emails, when given (students can also add them on My earnings).
  for (const [user, key] of [
    [s1, "JUDGE_STUDENT1_PAYPAL"],
    [s2, "JUDGE_STUDENT2_PAYPAL"],
  ] as const) {
    if (env[key])
      await db.from("payout_accounts").upsert({ user_id: user, paypal_email: env[key]!.trim().toLowerCase() });
  }

  // A fresh start for the money flows: no open drafts or unpaid bookings left from earlier runs.
  await db.from("agent_proposals").update({ status: "dismissed" }).eq("user_id", s1).eq("status", "proposed");
  await db
    .from("tutoring_bookings")
    .update({ status: "cancelled" })
    .eq("learner_id", s1)
    .eq("status", "awaiting_payment");

  // Build the shared lessons now, so judges don't wait (the worker picks these up).
  for (const conceptId of [ohm, kvl, thevenin, caps]) {
    const { data: c } = await db.from("concepts").select("current_lesson_id").eq("id", conceptId!).single();
    if (c?.current_lesson_id) continue;
    await db.rpc("enqueue_job_once", {
      p_queue: "lesson_gen",
      p_payload: { concept_id: conceptId!, course_id: courseId, user_id: s1 },
      p_dedupe: `lesson:${conceptId}`,
      p_owner: s1,
    });
  }

  console.log("✓ Judge accounts ready (password: JUDGE_PASSWORD from .env)");
  console.log(`  Student 1 (Amara N.): ${s1Email}${env.JUDGE_STUDENT1_PAYPAL ? " · PayPal email set" : ""}`);
  console.log(`  Student 2 (Tunde B.): ${s2Email}${env.JUDGE_STUDENT2_PAYPAL ? " · PayPal email set" : ""}`);
  console.log(`  Admin:                ${adminEmail}`);
  console.log(`  Course: IFK 102 · Electricity and Magnetism (Ifiok demo), 4 topics; lessons queued.`);
}

main().catch((err: unknown) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
