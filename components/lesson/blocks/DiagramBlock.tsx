"use client";

import { useId } from "react";
import { RichText } from "../RichText";
import type { BlockOf } from "./types";

// Concept and process diagrams (05 §3): nodes placed on a 0–100 grid, joined by labelled edges.
// Drawn from data with our own SVG; the list underneath says the same thing in words.

const W = 100;
const H = 62;

export function DiagramBlock({ block }: { block: BlockOf<"diagram"> }) {
  const markerId = useId();
  const byId = new Map(block.nodes.map((n) => [n.id, n]));
  const pos = (n: { x: number; y: number }) => ({ x: (n.x / 100) * W, y: (n.y / 100) * H });
  const nodeW = 22;
  const nodeH = 8;

  const edges = block.edges.flatMap((e) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    return a && b ? [{ e, a: pos(a), b: pos(b), from: a.label, to: b.label }] : [];
  });

  return (
    <figure className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-line bg-paper p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={`${markerId}-desc`}>
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-2)" />
            </marker>
          </defs>
          {edges.map(({ e, a, b }, i) => {
            // Stop arrows at the node's edge rather than its centre.
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const pad = Math.min(nodeW / 2, Math.abs((nodeH / 2) * (len / (Math.abs(dy) || 1))), len / 3);
            const end = { x: b.x - (dx / len) * pad, y: b.y - (dy / len) * pad };
            return (
              <g key={i}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="var(--ink-2)"
                  strokeWidth={0.5}
                  strokeDasharray={e.style === "dashed" ? "1.5 1" : undefined}
                  markerEnd={e.style === "arrow" ? `url(#${markerId})` : undefined}
                />
                {e.label ? (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 1}
                    textAnchor="middle"
                    fontSize={2.6}
                    fill="var(--ink-2)"
                  >
                    {e.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          {block.nodes.map((n) => {
            const { x, y } = pos(n);
            return (
              <g key={n.id}>
                {n.shape === "circle" ? (
                  <circle
                    cx={x}
                    cy={y}
                    r={nodeH / 1.4}
                    fill="var(--surface)"
                    stroke="var(--quantity)"
                    strokeWidth={0.6}
                  />
                ) : (
                  <rect
                    x={x - nodeW / 2}
                    y={y - nodeH / 2}
                    width={nodeW}
                    height={nodeH}
                    rx={n.shape === "pill" ? nodeH / 2 : 1.2}
                    fill="var(--surface)"
                    stroke="var(--quantity)"
                    strokeWidth={0.6}
                  />
                )}
                <text x={x} y={y + 1} textAnchor="middle" fontSize={2.8} fill="var(--ink)">
                  {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {block.caption ? (
        <figcaption className="text-sm text-ink-2">
          <RichText text={block.caption} />
        </figcaption>
      ) : null}
      <div id={`${markerId}-desc`}>
        <p className="text-sm font-semibold text-ink">In words</p>
        <ul className="list-inside list-disc text-sm text-ink-2">
          {edges.length
            ? edges.map(({ e, from, to }, i) => (
                <li key={i}>
                  {from} {e.style === "arrow" ? "→" : "—"} {to}
                  {e.label ? ` (${e.label})` : ""}
                </li>
              ))
            : block.nodes.map((n) => <li key={n.id}>{n.label}</li>)}
        </ul>
      </div>
    </figure>
  );
}
