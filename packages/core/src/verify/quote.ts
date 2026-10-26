/**
 * Verifies that a source quote is an exact substring of the cited chunk content
 * after whitespace normalization (specifications/05-lesson-and-lab-engine.md §6).
 */
export function checkQuote(quote: string, chunkContent: string): boolean {
  if (!quote || !chunkContent) return false;

  const normalizeWhitespace = (str: string) => str.replace(/\s+/g, " ").trim().toLowerCase();

  const normQuote = normalizeWhitespace(quote);
  const normChunk = normalizeWhitespace(chunkContent);

  return normChunk.includes(normQuote);
}

/**
 * A quote that differs from the chunk only in punctuation, case or spacing (models often turn "acts;"
 * into "acts.") is replaced by the chunk's exact wording, so what students see is still verbatim.
 * Returns null when the words themselves differ: then the quote fails verification.
 */
export function snapQuote(quote: string, chunkContent: string): string | null {
  const isWordChar = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
  // The chunk's letters and digits, lower-cased, with each one's position in the original text.
  const positions: number[] = [];
  let letters = "";
  for (let i = 0; i < chunkContent.length; i++) {
    const ch = chunkContent[i]!;
    if (isWordChar(ch)) {
      letters += ch.toLowerCase();
      positions.push(i);
    }
  }
  const target = [...quote].filter(isWordChar).join("").toLowerCase();
  // Too short to be a meaningful quote.
  if (target.length < 12) return null;
  const at = letters.indexOf(target);
  if (at < 0) return null;
  const start = positions[at]!;
  let end = positions[at + target.length - 1]! + 1;
  // Keep closing punctuation that ends the quoted sentence.
  if (/[.!?;:)]/.test(chunkContent[end] ?? "")) end++;
  return chunkContent.slice(start, end);
}
