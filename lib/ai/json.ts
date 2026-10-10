// Parsing model output (04 §2 step 5). Models sometimes wrap JSON in a code fence, and sometimes
// forget to escape a LaTeX backslash: "\frac" in JSON becomes a form feed followed by "rac",
// "\theta" a tab + "heta", "\nu" a newline + "u". Those are rejected so the repair retry fixes them.

/** Pulls the JSON value out of a reply, tolerating a ```json fence or text around one object. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1]! : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new SyntaxError("The reply is not valid JSON.");
  }
}

// Form feed, tab, backspace or carriage return touching a letter.
const CONTROL_NEXT_TO_LETTER = /[\f\t\b\r][A-Za-z]|[A-Za-z][\f\t\b\r]/;
// In LaTeX: a newline directly followed by letters (what "\nu", "\neq", "\nabla" become).
const NEWLINE_THEN_LETTER = /\n[A-Za-z]/;

const isLatexField = (key: string) => key === "latex" || key.endsWith("_latex");
const isMarkdownField = (key: string) => key === "md" || key.endsWith("_md");

/** Returns one message per suspicious string, with its path, for the repair prompt. */
export function findControlCharIssues(value: unknown, path = "$"): string[] {
  if (typeof value === "string") return [];
  const issues: string[] = [];
  const visit = (node: unknown, at: string, key: string) => {
    if (typeof node === "string") {
      if (CONTROL_NEXT_TO_LETTER.test(node))
        issues.push(`${at}: contains a control character next to a letter (escape backslashes as \\)`);
      else if (isLatexField(key) && NEWLINE_THEN_LETTER.test(node))
        issues.push(`${at}: LaTeX contains a newline followed by letters (escape backslashes as \\)`);
      else if (isMarkdownField(key)) {
        for (const span of node.match(/\$[^$]*\$/g) ?? []) {
          if (NEWLINE_THEN_LETTER.test(span)) {
            issues.push(`${at}: inline maths contains a newline followed by letters (escape backslashes as \\)`);
            break;
          }
        }
      }
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${at}[${i}]`, key));
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) visit(v, `${at}.${k}`, k);
    }
  };
  visit(value, path, "");
  return issues;
}
