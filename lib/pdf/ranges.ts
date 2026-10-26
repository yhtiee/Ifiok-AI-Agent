// "1-5, 8, 10–12" → [1, 2, 3, 4, 5, 8, 10, 11, 12], for the page picker's range box.

export type RangeResult = { ok: true; pages: number[] } | { ok: false; message: string };

export function parsePageRanges(input: string, numPages: number): RangeResult {
  const pages = new Set<number>();
  const parts = input
    .replace(/\s*[-–—]\s*/g, "-")
    .split(/[,;\s]+/)
    .filter(Boolean);
  if (parts.length === 0) return { ok: false, message: "Type pages like 1-5, 8." };

  for (const part of parts) {
    const m = /^(\d+)(?:[-–—](\d+))?$/.exec(part);
    if (!m) return { ok: false, message: `"${part}" isn't a page or range. Type pages like 1-5, 8.` };
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    if (from < 1 || to < from) return { ok: false, message: `"${part}" isn't a valid range.` };
    if (to > numPages) return { ok: false, message: `This PDF has ${numPages} pages; "${part}" goes past the end.` };
    for (let p = from; p <= to; p++) pages.add(p);
  }
  return { ok: true, pages: [...pages].sort((a, b) => a - b) };
}
