/** Lesson DSL version (specifications/05-lesson-and-lab-engine.md §2). */
export const DSL_VERSION = 1 as const;

/** Mastery ladder labels in order (00 §8, 01 F5-FR4). Thresholds live with the mastery logic. */
export const MASTERY_LEVELS = ["Not started", "Familiar", "Proficient", "Mastered"] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

/** All Lagos-day logic (streaks, daily_activity, quotas) uses this zone (01 F6-FR6). */
export const APP_TIME_ZONE = "Africa/Lagos" as const;
