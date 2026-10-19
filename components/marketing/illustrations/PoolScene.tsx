import { useId } from "react";
import { POOL_CAP } from "../demos/points";
import { Eye } from "./parts";

// Earn: the month's pool (a calabash) poured into five example bowls (specifications/landing/05 §3.3).
// Bowl fill height = share ÷ 20%. The "You" bowl tracks the calculator. Drawn by PointsCalculator.

export const POOL_ALT =
  "A month's pool split by points among five example contributors; one share stops at 20% and the rest carries to next month.";

const BOWLS = [24, 90, 156, 222, 288];
const FIXED = [
  { y: 150, h: 44 },
  { y: 174, h: 20 },
  { y: 181, h: 13 },
  { y: 185, h: 9 },
];
const bowl = (x: number) => `M${x} 150 H${x + 56} C${x + 56} 208 ${x} 208 ${x} 150Z`;

export function PoolScene({ share }: { share: number }) {
  const id = useId();
  const youH = Math.max(2, (44 * Math.min(share, POOL_CAP)) / POOL_CAP);
  return (
    <svg viewBox="0 0 410 256" role="img" aria-labelledby={`${id}-t`}>
      <title id={`${id}-t`}>{POOL_ALT}</title>
      <g className="lp-perk">
        <path d="M120 26 L114 14 M280 26 L286 14" stroke="var(--ill-line)" strokeWidth="4" strokeLinecap="round" />
        <path
          d="M110 30 H290 C290 108 110 108 110 30Z"
          fill="var(--ill-earn)"
          stroke="var(--ill-line)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M124 54 l12 -9 l12 9 l12 -9 l12 9 l12 -9 l12 9 l12 -9 l12 9 l12 -9 l12 9 l12 -9 l12 9"
          fill="none"
          stroke="var(--ill-line)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <Eye x={182} y={72} r={8} />
        <Eye x={218} y={72} r={8} />
      </g>
      <path
        d="M200 100 V116 M200 116 H52 M200 116 H310 M52 116 V140 M118 116 V140 M184 116 V140 M250 116 V140 M310 116 V140"
        fill="none"
        stroke="var(--ill-line)"
        strokeWidth="2.5"
        strokeDasharray="2 6"
        strokeLinecap="round"
      />
      <defs>
        {BOWLS.map((x, i) => (
          <clipPath key={x} id={`${id}-b${i}`}>
            <path d={bowl(x)} />
          </clipPath>
        ))}
      </defs>
      <g fill="var(--ill-earn)">
        {FIXED.map((b, i) => (
          <rect key={i} clipPath={`url(#${id}-b${i})`} x={BOWLS[i]} y={b.y} width="56" height={b.h} />
        ))}
        <rect
          clipPath={`url(#${id}-b4)`}
          x={BOWLS[4]}
          y={194 - youH}
          width="56"
          height={youH}
          fill="var(--ill-dot)"
          data-testid="pool-you"
        />
      </g>
      <g fill="none" stroke="var(--ill-line)" strokeWidth="3" strokeLinejoin="round">
        {BOWLS.map((x, i) => (
          <path key={x} d={bowl(x)} strokeWidth={i === 4 ? 4 : 3} />
        ))}
      </g>
      <path
        d="M24 150 C 10 156, 8 176, 12 214"
        fill="none"
        stroke="var(--ill-earn)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="3 6"
      />
      <path
        d="M352 196 H392 C392 226 352 226 352 196Z"
        fill="var(--ill-white)"
        stroke="var(--ill-line)"
        strokeWidth="2.5"
        strokeDasharray="4 4"
      />
      <g fontSize="13" fill="var(--ill-line)" fontWeight="600" textAnchor="middle">
        <text x="52" y="232">
          20% cap
        </text>
        <text x="316" y="232" fontSize="14">
          You
        </text>
        <text x="372" y="244" fontWeight="400" fontSize="12">
          Next month
        </text>
      </g>
    </svg>
  );
}
