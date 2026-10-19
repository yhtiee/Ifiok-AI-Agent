// "Work out your points" (specifications/landing/04 §5.7, 06 §3): points and percentages only,
// never naira (12 §4 Q42). One point per student per item per month; share = points / all
// contributors' points, capped at 20% of the pool.

export const POOL_CAP = 0.2;
export const POINTS_MAX = 999;

export type PointsInput = { uploads: number; explainers: number; all: number };
export type PointsResult = { points: number; total: number; rawShare: number; share: number; capped: boolean };

const whole = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

export function clampStudents(n: number): number {
  return Math.min(POINTS_MAX, whole(n));
}

export function computePoints({ uploads, explainers, all }: PointsInput, cap = POOL_CAP): PointsResult {
  const points = clampStudents(uploads) + clampStudents(explainers);
  // All contributors' points include yours, so the total is never below your points.
  const total = Math.max(whole(all), points);
  const rawShare = total > 0 ? points / total : 0;
  return { points, total, rawShare, share: Math.min(rawShare, cap), capped: rawShare > cap };
}

/** One decimal under 10% ("3%", "4.5%"), whole numbers from 10% ("12%"). */
export function formatShare(share: number): string {
  const pct = share * 100;
  return `${pct < 10 ? pct.toFixed(1).replace(/\.0$/, "") : pct.toFixed(0)}%`;
}

/** Digits only from a typed number such as "1,400". */
export function parseCount(text: string): number {
  const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function formatCount(n: number): string {
  return whole(n).toLocaleString("en-NG");
}
