import { describe, expect, it } from "vitest";
import { fileMimeOf, splitText, titleOf } from "./prepare";

const file = (name: string, type = "") => new File(["x"], name, { type });

describe("uploads (12 §4 Q60)", () => {
  it("takes PDFs, Word documents and photos by name, even when the browser gives no type", () => {
    expect(fileMimeOf(file("Notes.PDF"))).toBe("application/pdf");
    expect(fileMimeOf(file("week 3.docx"))).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(fileMimeOf(file("IMG_0042.HEIC"))).toBe("image/heic");
    expect(fileMimeOf(file("board", "image/png"))).toBe("image/png");
    expect(fileMimeOf(file("old.doc", "application/msword"))).toBeNull();
    expect(fileMimeOf(file("setup.exe"))).toBeNull();
  });

  it("names the material after the file", () => {
    expect(titleOf(file("MTH 101 lecture 4.pdf"))).toBe("MTH 101 lecture 4");
  });

  it("splits a Word document's text into pages at paragraph breaks", () => {
    const para = "a".repeat(1200);
    const pages = splitText([para, para, para].join("\n\n"), 3000);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toBe(`${para}\n\n${para}`);
    expect(splitText("b".repeat(7000), 3000).map((p) => p.length)).toEqual([3000, 3000, 1000]);
    expect(splitText("\n\n  \n\n")).toEqual([]);
  });
});
