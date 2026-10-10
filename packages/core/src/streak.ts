import { APP_TIME_ZONE } from "./constants";

/** A date as YYYY-MM-DD in Lagos time (the day boundary for streaks and daily_activity, F6-FR6). */
export function lagosDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive study days ending today, from the days with at least one study session
 * (server-written daily_activity, never client data). If the student hasn't studied yet today,
 * the streak still counts up to yesterday: it only breaks once a whole day is missed.
 */
export function studyStreak(activeDays: Iterable<string>, today: string): number {
  const days = new Set(activeDays);
  let cursor = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}
