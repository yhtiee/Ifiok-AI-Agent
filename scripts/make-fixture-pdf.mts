// Writes small synthetic PDFs for tests (MVP-01 F3 network test, 11 §2 item 4). Each page carries a
// unique marker (ZQXPAGE<n>MARK) so a test can prove no unpicked page's text left the device.
// Usage: node scripts/make-fixture-pdf.mts [out=e2e/fixtures/marked-pages.pdf] [pages=5] [blank=5]
// `blank` lists pages drawn with no text layer (like a scan), comma-separated.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function markedPdf(pageCount: number, blankPages: number[] = [], linesPerPage = 6): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) - 0; // 1-based ids follow push order
  // 1 catalog, 2 pages, 3 font; pages and contents follow.
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("PLACEHOLDER");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const kids: number[] = [];
  for (let n = 1; n <= pageCount; n++) {
    let stream: string;
    if (blankPages.includes(n)) {
      // A filled rectangle: something to see, no text layer.
      stream = "0.6 g 72 300 450 300 re f";
    } else {
      const lines = [`Page ${n} marker ZQXPAGE${n}MARK`];
      for (let i = 1; i < linesPerPage; i++) {
        lines.push(`Projectile motion page ${n} line ${i}: range R equals u squared sin two theta over g.`);
      }
      stream = ["BT /F1 12 Tf 72 720 Td 16 TL", ...lines.map((l) => `(${l.replace(/[()\\]/g, "")}) Tj T*`), "ET"].join(
        "\n",
      );
    }
    const contentId = objects.length + 2;
    const pageId = objects.length + 1;
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(pageId);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("make-fixture-pdf.mts")
) {
  const out = process.argv[2] ?? "e2e/fixtures/marked-pages.pdf";
  const pages = Number(process.argv[3] ?? 5);
  const blank = (process.argv[4] ?? "5").split(",").filter(Boolean).map(Number);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, markedPdf(pages, blank));
  console.log(`✓ wrote ${out} (${pages} pages, no text on ${blank.join(", ") || "none"})`);
}
