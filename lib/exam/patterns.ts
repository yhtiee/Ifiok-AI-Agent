// Exam patterns (F8-FR3, 10 MVP-04): per topic, how many papers asked it and its share of the
// marks, plus the usual question style. Counts and shares only, never predictions (guardrail 13).
// With 3 or more papers, newer papers count more (weights 1.0, 0.8, 0.6, then 0.5); with fewer,
// the shares are plain.

export type PatternQuestion = {
  paper: string;
  year: number | null;
  conceptId: string | null;
  marks: number | null;
  qtype: string | null;
};

export type TopicPattern = {
  conceptId: string;
  /** Papers that asked it. */
  asked: number;
  /** Share of all marks (0–1), recency-weighted when there are ≥ 3 papers. */
  share: number;
  /** The most common question style, when one stands out. */
  style: string | null;
};

export type ExamPatterns = { papers: number; weighted: boolean; topics: TopicPattern[]; unassigned: number };

export const RECENCY_WEIGHTS = [1, 0.8, 0.6, 0.5] as const;
export const WEIGHTED_FROM = 3;

const STYLE_WORDS: Record<string, string> = {
  calc: "mostly calculations",
  theory: "mostly explain or discuss",
  definition: "mostly definitions",
  proof: "mostly proofs",
  diagram: "mostly diagrams",
  mcq: "mostly multiple choice",
};

export function examPatterns(questions: PatternQuestion[]): ExamPatterns {
  // Papers newest first (unknown years last); each gets its recency weight.
  const papers = [...new Map(questions.map((q) => [q.paper, q.year])).entries()].sort(
    (a, b) => (b[1] ?? -Infinity) - (a[1] ?? -Infinity),
  );
  const weighted = papers.length >= WEIGHTED_FROM;
  const weightOf = new Map(
    papers.map(([id], i) => [id, weighted ? (RECENCY_WEIGHTS[i] ?? RECENCY_WEIGHTS.at(-1)!) : 1]),
  );

  const total = questions.reduce((sum, q) => sum + (q.marks ?? 1) * weightOf.get(q.paper)!, 0);
  const byTopic = new Map<string, PatternQuestion[]>();
  for (const q of questions) {
    if (!q.conceptId) continue;
    byTopic.set(q.conceptId, [...(byTopic.get(q.conceptId) ?? []), q]);
  }

  const topics = [...byTopic.entries()]
    .map(([conceptId, qs]) => {
      const styles = new Map<string, number>();
      for (const q of qs) if (q.qtype) styles.set(q.qtype, (styles.get(q.qtype) ?? 0) + 1);
      const [topStyle, topCount] = [...styles.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
      return {
        conceptId,
        asked: new Set(qs.map((q) => q.paper)).size,
        share: total ? qs.reduce((sum, q) => sum + (q.marks ?? 1) * weightOf.get(q.paper)!, 0) / total : 0,
        // A style "stands out" when it's at least half the topic's questions.
        style: topStyle && topCount * 2 >= qs.length ? (STYLE_WORDS[topStyle] ?? null) : null,
      };
    })
    .sort((a, b) => b.share - a.share || b.asked - a.asked);

  return { papers: papers.length, weighted, topics, unassigned: questions.filter((q) => !q.conceptId).length };
}

/** "Asked in 6 of 8 papers · ~24% of marks" (counts and shares only). */
export function patternText(t: Pick<TopicPattern, "asked" | "share" | "style">, papers: number): string {
  const parts = [
    `Asked in ${t.asked} of ${papers} ${papers === 1 ? "paper" : "papers"}`,
    `~${Math.round(t.share * 100)}% of marks`,
  ];
  if (t.style) parts.push(t.style);
  return parts.join(" · ");
}
