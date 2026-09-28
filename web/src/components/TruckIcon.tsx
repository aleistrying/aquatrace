"use client";

/**
 * A small hand-rolled truck glyph (cargo box + cab + two wheels) — used on
 * the Simulation page's live map, rotated to face its direction of travel,
 * and reused on the Communities page's fleet-capacity check as a pictogram
 * ("N trucks we have" vs "N more we'd need") instead of plain numbers.
 * Plain inline SVG, no icon library — matches this app's existing
 * hand-built visual style. Deliberately NOT a circle/dot, so it reads as a
 * distinct kind of marker next to household dots at a glance.
 *
 * `outline` renders a dashed, unfilled "ghost" truck — used for a truck the
 * fleet doesn't actually have yet (a shortfall), so "have" vs "still need"
 * is visually obvious without reading any numbers.
 */
export default function TruckIcon({
  x = 0,
  y = 0,
  rotationDeg = 0,
  scale = 1,
  color,
  outline = false,
}: {
  x?: number;
  y?: number;
  rotationDeg?: number;
  scale?: number;
  color: string;
  outline?: boolean;
}) {
  const wheelFill = outline ? "none" : "var(--ink)";
  const bodyProps = {
    fill: outline ? "none" : color,
    stroke: color,
    strokeWidth: outline ? 1.4 : 1,
    strokeDasharray: outline ? "2.4 2" : undefined,
  };
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotationDeg}) scale(${scale})`}>
      {/* cargo box */}
      <rect x={-7} y={-4.5} width={11.5} height={8.5} rx={1.6} {...bodyProps} />
      {/* cab, at the +x (front/nose) end — this is the end rotation points
          "forward" toward, so travel direction reads correctly */}
      <path d="M4.5,-4.5 H7.6 L9.6,-1.8 V4 H4.5 Z" strokeLinejoin="round" {...bodyProps} />
      <circle
        cx={-3.5}
        cy={4.2}
        r={1.9}
        fill={wheelFill}
        stroke={outline ? color : undefined}
        strokeWidth={outline ? 1.2 : undefined}
      />
      <circle
        cx={6}
        cy={4.2}
        r={1.9}
        fill={wheelFill}
        stroke={outline ? color : undefined}
        strokeWidth={outline ? 1.2 : undefined}
      />
    </g>
  );
}
