"use client";

import { useId } from "react";
import type { Variant } from "@/lib/model";

export const LEVEL_BAR_COLOR: Record<Variant, string> = {
  low: "var(--green)",
  medium: "var(--gold)",
  high: "var(--danger)",
};

/**
 * Ported from common.py's tank_svg(): a vertical rounded-rect tank outline
 * with a fill rising to pctFull. Same geometry/formula, just React instead
 * of a Python f-string returning HTML.
 */
export default function TankSvg({
  pctFull,
  variant,
  label,
  width = 84,
  height = 128,
}: {
  pctFull: number;
  variant: Variant;
  label: string;
  width?: number;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, pctFull));
  const colorVar = LEVEL_BAR_COLOR[variant];
  const pad = 6;
  const labelH = 20;
  const bodyW = width - 2 * pad;
  const bodyH = height - 2 * pad - labelH;
  const fillH = bodyH * (pct / 100);
  const fillY = pad + labelH + (bodyH - fillH);
  const clipId = useId();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "0.2rem 0.4rem" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--ink-soft)", marginBottom: "0.15rem" }}>{label}</div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${pct.toFixed(0)}% full`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={pad} y={pad + labelH} width={bodyW} height={bodyH} rx={12} ry={12} />
          </clipPath>
        </defs>
        <rect
          x={pad}
          y={pad + labelH}
          width={bodyW}
          height={bodyH}
          rx={12}
          ry={12}
          style={{ fill: "var(--surface-raised)", stroke: "var(--border)", strokeWidth: 2 }}
        />
        <rect
          x={pad}
          y={fillY.toFixed(1)}
          width={bodyW}
          height={fillH.toFixed(1)}
          style={{
            fill: colorVar,
            transition: "y 0.7s cubic-bezier(0.4,0,0.2,1), height 0.7s cubic-bezier(0.4,0,0.2,1), fill 0.5s ease",
          }}
          clipPath={`url(#${clipId})`}
        />
      </svg>
      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginTop: "0.15rem" }}>{pct.toFixed(0)}%</div>
    </div>
  );
}
