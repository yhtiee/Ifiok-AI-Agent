// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MathHtmlProvider } from "../RichText";
import { CheckpointBlock } from "./CheckpointBlock";
import { DiagramBlock } from "./DiagramBlock";
import { PlotBlock } from "./PlotBlock";
import type { BlockOf } from "./types";

afterEach(cleanup);

const order: BlockOf<"checkpoint"> = {
  id: "s5b1",
  type: "checkpoint",
  item: {
    type: "order",
    stem_md: "Order the stages.",
    steps: ["First", "Second", "Third"],
    why: "That is the sequence.",
  },
};

const match: BlockOf<"checkpoint"> = {
  id: "s8b1",
  type: "checkpoint",
  item: {
    type: "match",
    stem_md: "Match each arm.",
    pairs: [
      ["Legislature", "Makes laws"],
      ["Executive", "Carries out laws"],
    ],
    why: "One core job each.",
  },
};

const rows = () => screen.getAllByRole("listitem").map((li) => li.textContent ?? "");

describe("order checkpoint", () => {
  it("never starts in the answer order, and is marked correct once the student fixes it", () => {
    render(<CheckpointBlock block={order} />);
    const start = rows().map((r) => r.replace(/^\d|Up|Down/g, ""));
    expect(start.join("|")).not.toBe("First|Second|Third");

    // Bubble the steps into order with the Up buttons.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < 3; i++) {
        const texts = rows();
        const want = ["First", "Second", "Third"];
        const at = (n: number) => want.findIndex((w) => texts[n]!.includes(w));
        if (at(i) < at(i - 1)) fireEvent.click(screen.getByRole("button", { name: `Move step ${i + 1} up` }));
      }
    }
    fireEvent.click(screen.getByRole("button", { name: "Check order" }));
    expect(screen.getByRole("status").textContent).toContain("Correct.");
  });

  it("says which steps are in the wrong place", () => {
    render(<CheckpointBlock block={order} />);
    fireEvent.click(screen.getByRole("button", { name: "Check order" }));
    expect(screen.getAllByText("Wrong place").length).toBeGreaterThan(0);
    expect(screen.getByRole("status").textContent).toContain("Not quite.");
  });
});

describe("match checkpoint", () => {
  it("enables checking only when every item is matched, then grades it", () => {
    render(<CheckpointBlock block={match} />);
    const check = screen.getByRole("button", { name: "Check matches" });
    expect((check as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Legislature"), { target: { value: "Makes laws" } });
    fireEvent.change(screen.getByLabelText("Executive"), { target: { value: "Carries out laws" } });
    fireEvent.click(check);
    expect(screen.getByRole("status").textContent).toContain("Correct.");
  });

  it("shows the right match for a wrong pick", () => {
    render(<CheckpointBlock block={match} />);
    fireEvent.change(screen.getByLabelText("Legislature"), { target: { value: "Carries out laws" } });
    fireEvent.change(screen.getByLabelText("Executive"), { target: { value: "Makes laws" } });
    fireEvent.click(screen.getByRole("button", { name: "Check matches" }));
    expect(screen.getAllByText(/Matches:/).length).toBe(2);
  });
});

describe("plot sliders", () => {
  it("draws a slider per parameter and updates the summary as it moves", () => {
    const plot: BlockOf<"plot"> = {
      id: "s3b1",
      type: "plot",
      x: [-5, 5],
      functions: [{ expr: "a * x", role: "quantity", label: "y = ax" }],
      params: [{ name: "a", min: 1, max: 3, step: 1, value: 1, label: "Gradient a" }],
      compiled: {
        functions: [{ type: "binary", op: "*", left: { type: "var", name: "a" }, right: { type: "var", name: "x" } }],
      },
    };
    render(<PlotBlock block={plot} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "3" } });
    expect(screen.getByText(/with Gradient a = 3/)).toBeTruthy();
    // The curve itself changes: a path is drawn from the compiled AST.
    expect(document.querySelector("path")?.getAttribute("d")).toMatch(/^M /);
  });
});

describe("diagram", () => {
  it("draws the diagram and says the connections in words", () => {
    const diagram: BlockOf<"diagram"> = {
      id: "s3b2",
      type: "diagram",
      nodes: [
        { id: "a", label: "Legislature", x: 50, y: 10, shape: "box" },
        { id: "b", label: "Executive", x: 20, y: 80, shape: "box" },
      ],
      edges: [{ from: "a", to: "b", label: "can impeach", style: "arrow" }],
    };
    render(<DiagramBlock block={diagram} />);
    expect(screen.getByRole("img")).toBeTruthy();
    expect(screen.getByText(/Legislature → Executive \(can impeach\)/)).toBeTruthy();
  });
});

describe("inline maths", () => {
  it("shows the server's pre-rendered formula, and the source when there is none", () => {
    const block: BlockOf<"checkpoint"> = {
      id: "s5b1",
      type: "checkpoint",
      item: { type: "short_text", stem_md: "Explain $x^2$ and $y$.", key_ideas: ["k"], why: "Because." },
    };
    const { container } = render(
      <MathHtmlProvider value={{ "x^2": '<span class="katex">X2</span>' }}>
        <CheckpointBlock block={block} />
      </MathHtmlProvider>,
    );
    expect(container.querySelector(".katex")?.textContent).toBe("X2");
    expect(container.querySelector("code")?.textContent).toBe("y");
  });
});
