import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Link preview image for social shares (WhatsApp, X, LinkedIn…). Rendered once at build time.
// Satori can't read CSS variables, so the 07 §3.3 token values are repeated here.
const PAPER = "#F2F4F7";
const SURFACE = "#FBFCFD";
const INK = "#131B26";
const INK_2 = "#4A5563";
const LINE = "#DDE2E8";
const QUANTITY = "#2650B8";
const CHANGE = "#B0500F";

export const shareImageAlt =
  "Ifiok, the AI learning agent. See it. Try it. Master it. A graph of y = x squared with its tangent line.";
export const shareImageSize = { width: 1200, height: 630 };

// Plot: y = x² on x ∈ [-3, 3], y ∈ [-1, 9], tangent at a = 1 (same as the landing hero).
const PW = 400;
const PH = 360;
const sx = (x: number) => ((x + 3) / 6) * PW;
const sy = (y: number) => ((9 - y) / 10) * PH;
const A = 1;
const curve = Array.from({ length: 61 }, (_, i) => {
  const x = -3 + (6 * i) / 60;
  return `${i === 0 ? "M" : "L"}${sx(x).toFixed(1)},${sy(x * x).toFixed(1)}`;
}).join(" ");
const tangentY = (x: number) => A * A + 2 * A * (x - A);

export async function renderShareImage() {
  const dir = join(process.cwd(), "assets", "og");
  const [display, text] = await Promise.all([
    readFile(join(dir, "bricolage-grotesque-latin-800-normal.woff")),
    readFile(join(dir, "atkinson-hyperlegible-next-latin-400-normal.woff")),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: PAPER,
        color: INK,
        fontFamily: "Atkinson",
        padding: "64px 72px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
        {/* Wordmark: dotless i with a camwood tittle */}
        <div style={{ display: "flex", alignItems: "flex-end", fontFamily: "Bricolage", fontSize: 64, lineHeight: 1 }}>
          <div style={{ display: "flex", position: "relative" }}>
            <span>{"ı"}</span>
            <div
              style={{
                position: "absolute",
                top: 6,
                left: 4,
                width: 13,
                height: 13,
                borderRadius: 999,
                background: CHANGE,
              }}
            />
          </div>
          <span>fiok</span>
          <span style={{ fontFamily: "Atkinson", fontSize: 28, color: INK_2, marginLeft: 20, marginBottom: 6 }}>
            the AI learning agent
          </span>
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", fontFamily: "Bricolage", fontSize: 92, lineHeight: 1.02 }}
        >
          <span>See it.</span>
          <span>Try it.</span>
          <span style={{ color: CHANGE }}>Master it.</span>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: INK_2 }}>
          Your course, made easy to see, try and master.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignSelf: "center",
          background: SURFACE,
          border: `2px solid ${LINE}`,
          borderRadius: 24,
          padding: 24,
        }}
      >
        <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
          {[-2, -1, 1, 2].map((x) => (
            <line key={`x${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={PH} stroke={LINE} strokeWidth={2} />
          ))}
          {[2, 4, 6, 8].map((y) => (
            <line key={`y${y}`} x1={0} x2={PW} y1={sy(y)} y2={sy(y)} stroke={LINE} strokeWidth={2} />
          ))}
          <line x1={0} x2={PW} y1={sy(0)} y2={sy(0)} stroke={INK_2} strokeWidth={2} />
          <line x1={sx(0)} x2={sx(0)} y1={0} y2={PH} stroke={INK_2} strokeWidth={2} />
          <path d={curve} fill="none" stroke={QUANTITY} strokeWidth={7} strokeLinecap="round" />
          <line
            x1={sx(-0.25)}
            y1={sy(tangentY(-0.25))}
            x2={sx(3)}
            y2={sy(tangentY(3))}
            stroke={CHANGE}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <circle cx={sx(A)} cy={sy(A * A)} r={26} fill={CHANGE} fillOpacity={0.15} />
          <circle cx={sx(A)} cy={sy(A * A)} r={13} fill={SURFACE} stroke={CHANGE} strokeWidth={6} />
        </svg>
      </div>
    </div>,
    {
      ...shareImageSize,
      fonts: [
        { name: "Bricolage", data: display, weight: 800, style: "normal" },
        { name: "Atkinson", data: text, weight: 400, style: "normal" },
      ],
    },
  );
}
