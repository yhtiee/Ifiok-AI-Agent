// The study plan to an exam date (F6 light, F8-FR6, 10 MVP-04): a deterministic rules engine,
// no AI, so the same state always gives the same plan and every session says why it is there.
//
// Topics are ordered by share of marks × (1 − mastery): what the papers ask most and the student
// knows least comes first. A first pass gives every topic one session (so nothing is left out
// before the exam), a second pass adds the rest. Days fill up to the student's daily minutes; a
// timed practice paper takes the last day when there is room. If the days run out, the topics that
// don't fit are named with the daily minutes that would fit them (never silently).

/** "getting_started": tried but still below Familiar (12 §4 Q54). */
export type PlanLevel = "not_started" | "getting_started" | "familiar" | "proficient" | "mastered";

export type PlanTopic = {
  conceptId: string;
  title: string;
  /** Share of the papers' marks (0–1), or null when there are no papers yet. */
  share: number | null;
  /** Papers that asked it, of `papers`. */
  asked: number;
  m: number;
  level: PlanLevel;
  practice: number;
  pastQuestions: number;
};

export type SessionKind = "lesson" | "practice" | "past_questions" | "paper";

export type Session = { conceptId: string | null; title: string; kind: SessionKind; minutes: number; why: string };
export type PlanDay = { date: string; sessions: Session[] };
export type StudyPlan = {
  examDate: string;
  days: PlanDay[];
  /** Topics that didn't fit before the exam, and the daily minutes that would fit everything. */
  overflow: { titles: string[]; suggestedMinutes: number } | null;
};

export const MINUTES: Record<SessionKind, number> = { lesson: 12, practice: 8, past_questions: 10, paper: 30 };

const LEVEL_WORDS: Record<PlanLevel, string> = {
  not_started: "not started",
  getting_started: "getting started",
  familiar: "Familiar",
  proficient: "Proficient",
  mastered: "Mastered",
};

/** ISO dates from `from` up to the day before `to` (Lagos calendar dates, 'YYYY-MM-DD'). */
export function daysUntil(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t < end; t += 86_400_000)
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function priority(t: PlanTopic, topicCount: number): number {
  const share = t.share ?? 1 / Math.max(1, topicCount);
  // Even a Mastered topic keeps a little weight so it still gets one session.
  return share * Math.max(0.05, 1 - t.m);
}

function why(t: PlanTopic, papers: number): string {
  const level = `you're ${LEVEL_WORDS[t.level]}`;
  if (papers === 0 || t.share === null) return `In your outline; ${level}`;
  if (t.asked === 0) return `Not asked in your ${papers} ${papers === 1 ? "paper" : "papers"}; ${level}`;
  return `Asked in ${t.asked} of ${papers} ${papers === 1 ? "paper" : "papers"} · ~${Math.round(t.share * 100)}% of marks; ${level}`;
}

/** The sessions for one topic, in the order to do them. Always at least one. */
export function topicSessions(t: PlanTopic, papers: number): Session[] {
  const base = { conceptId: t.conceptId, title: t.title, why: why(t, papers) };
  const out: Session[] = [];
  if (t.m < 0.3) out.push({ ...base, kind: "lesson", minutes: MINUTES.lesson });
  if (t.practice > 0 && t.m < 0.85) out.push({ ...base, kind: "practice", minutes: MINUTES.practice });
  if (t.pastQuestions > 0) out.push({ ...base, kind: "past_questions", minutes: MINUTES.past_questions });
  if (out.length === 0) out.push({ ...base, kind: "lesson", minutes: MINUTES.lesson });
  return out;
}

export function buildPlan(input: {
  today: string;
  examDate: string;
  dailyMinutes: number;
  papers: number;
  topics: PlanTopic[];
}): StudyPlan {
  const daily = Math.max(10, input.dailyMinutes);
  const dates = daysUntil(input.today, input.examDate);
  const days: PlanDay[] = dates.map((date) => ({ date, sessions: [] }));
  if (days.length === 0) return { examDate: input.examDate, days, overflow: null };

  const ordered = [...input.topics].sort(
    (a, b) => priority(b, input.topics.length) - priority(a, input.topics.length) || a.title.localeCompare(b.title),
  );
  const perTopic = ordered.map((t) => topicSessions(t, input.papers));

  // The last day holds a timed practice paper when the plan has more than one day.
  const paperDay = days.length >= 2 ? days.length - 1 : -1;
  const capacity = (i: number) => daily - (i === paperDay ? MINUTES.paper : 0);
  const used = days.map(() => 0);
  let cursor = 0;
  const place = (s: Session): boolean => {
    while (cursor < days.length) {
      const room = capacity(cursor) - used[cursor]!;
      // A day with nothing in it takes one session even if it runs over (a short daily goal).
      if (s.minutes <= room || (used[cursor] === 0 && room > 0)) {
        days[cursor]!.sessions.push(s);
        used[cursor]! += s.minutes;
        return true;
      }
      cursor++;
    }
    return false;
  };

  const missing: string[] = [];
  perTopic.forEach((sessions, i) => {
    if (!place(sessions[0]!)) missing.push(ordered[i]!.title);
  });
  for (const sessions of perTopic) for (const s of sessions.slice(1)) place(s);
  if (paperDay >= 0) {
    days[paperDay]!.sessions.push({
      conceptId: null,
      title: "Timed practice paper",
      kind: "paper",
      minutes: MINUTES.paper,
      why: "A full paper under time before the exam",
    });
  }

  const firstSessions = perTopic.reduce((n, s) => n + s[0]!.minutes, 0) + (paperDay >= 0 ? MINUTES.paper : 0);
  return {
    examDate: input.examDate,
    days,
    overflow: missing.length
      ? { titles: missing, suggestedMinutes: Math.ceil(firstSessions / days.length / 5) * 5 }
      : null,
  };
}
