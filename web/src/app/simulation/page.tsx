"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import TankSvg from "@/components/TankSvg";
import TruckIcon from "@/components/TruckIcon";
import {
  COMMUNITIES,
  type Household,
  seedHouseholds,
  fetchCurrentTempC,
  facilityPosition,
  jitteredPosition,
  qualityStatus,
  sewageStatus,
} from "@/lib/model";
import {
  type SimState,
  type SimTruckState,
  type SimEvent,
  type EventType,
  type FleetKind,
  type SnapshotEntry,
  newFleets,
  advanceOneTick,
  computeDriverNeed,
  addTruckToFleet,
  removeTruckFromFleet,
  formatSimTime,
  formatSimDateTime,
  MAX_STEPS_PER_CLICK,
} from "@/lib/simEngine";
import {
  runStrategySmallScale,
  runStrategyFullscale,
  generateFullscaleHouseholds,
  fleetSize,
  MAX_SIM_DAYS,
  type SmallScaleResult,
  type FullscaleResult,
} from "@/lib/fullscaleSim";
import { useCountUp, useFlashOnChange } from "@/lib/useMotion";
import InfoIcon from "@/components/InfoIcon";
import SingleScreenTabs, { SingleScreenPage } from "@/components/SingleScreenTabs";

const COMMUNITY_NAMES = Object.keys(COMMUNITIES);

/** A live, auto-detected "this community needs more drivers" recommendation
 * — see the surge-detection effect in SimulationPage for the detection rule
 * and how `addN`/`baseFleet` are computed (real fleet-sensitivity re-run,
 * not a guess). */
interface SurgeRecommendation {
  community: string;
  addN: number;
  baseFleet: number;
}

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  dispatch: "🚚🚛 dispatch",
  arrival: "✅ arrival/delivery",
  delay: "📻 delay",
  sync: "📡 batch sync",
};
const EVENT_TYPE_COLOR: Record<EventType, string> = {
  dispatch: "var(--teal)",
  arrival: "var(--green)",
  delay: "var(--gold)",
  sync: "var(--ink-soft)",
};
const EVENT_TYPE_ICON: Record<EventType, string> = {
  dispatch: "🚚",
  arrival: "✅",
  delay: "📻",
  sync: "📡",
};

// Fixed seed instant for this "isolated demo clock" (see the page's own
// InfoIcon on that label) - using the live Date.now() here made the initial
// household seed (and every value derived from it) differ between the
// server-rendered HTML and the client's first render, since the two happen
// at different real-world instants. Same fix idiom as householdStore.ts's
// SEED_BASELINE_MS.
const SIM_BASELINE_MS = Date.parse("2026-09-26T00:00:00Z");

function createInitialSimState(): SimState {
  const now = SIM_BASELINE_MS;
  return {
    now,
    households: seedHouseholds(now),
    waterTrucks: newFleets(),
    sewageTrucks: newFleets(),
    events: [],
    totalServiced: 0,
    lastSync: now,
    syncedSnapshot: {},
    justSynced: false,
  };
}

// ---------------------------------------------------------------------------
// Small shared bits of UI (no design-system component exists yet for these -
// built inline, same hand-rolled-inline-SVG/CSS-token style as the rest of
// the app rather than a new dependency).
// ---------------------------------------------------------------------------
function InfoPill({ children }: { children: ReactNode }) {
  return (
    <span className="badge" style={{ background: "var(--teal-tint)", color: "var(--teal)" }}>
      {children}
    </span>
  );
}

/** A compact "here's the one number that matters" chip — same idea as the
 * deck's own big-stat treatment, used in place of a sentence whose whole
 * point is a single figure (e.g. "~2 wks blind rotation"). The reasoning
 * behind the figure belongs in an adjacent InfoIcon, not squeezed in here. */
function MiniStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        padding: "6px 14px",
        borderRadius: 10,
        background: "var(--gold-tint)",
        border: "1px solid var(--gold)",
        minWidth: 150,
      }}
    >
      <span style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-display)", color, lineHeight: 1.2 }}>{value}</span>
      <span style={{ fontSize: "0.68rem", color: "var(--ink-soft)" }}>{label}</span>
    </div>
  );
}

function Metric({ label, value, help, testId }: { label: string; value: ReactNode; help?: string; testId?: string }) {
  return (
    <div style={{ minWidth: 130 }} title={help}>
      <div style={{ fontSize: "0.68rem", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div data-testid={testId} style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>{value}</div>
    </div>
  );
}

/** Wraps a numeric metric value so it flashes briefly whenever it changes,
 * instead of silently swapping — same idiom as FlashBadge below, just for
 * plain text values (a background wash rather than a glow ring). */
function BacklogFlashValue({ value }: { value: number }) {
  const flashing = useFlashOnChange(String(value));
  return <span className={flashing ? "pg-flash-value" : undefined}>{value}</span>;
}

/** Eases a "days to cover everyone" number from its previous value to the
 * new one whenever it changes (community switch or driver-count slider
 * move) — matches the deck's own count-up idiom instead of an instant
 * number swap. `null` (didn't finish within MAX_SIM_DAYS) passes through. */
function CoverageDaysValue({ days }: { days: number | null }) {
  const animated = useCountUp(days);
  return <>{fmtDays(animated)}</>;
}

/** Wraps a badge/pill so it flashes briefly whenever its rendered content
 * (label+variant, i.e. its underlying state) changes — the "no drivers
 * needed" <-> "N more drivers would help" badges should read as an event. */
function FlashBadge({ flashKey, children }: { flashKey: string; children: ReactNode }) {
  const flashing = useFlashOnChange(flashKey);
  return <span className={flashing ? "pg-flash-badge" : undefined}>{children}</span>;
}

/** Gear glyph for the dev-only pacing-knobs toggle button — same idiom as
 * the deck's Household Reading slide settings gear and statistics page's
 * methodology gear, reused here as a real React component since this page
 * (unlike the deck) is plain React, not hand-rolled DOM/JS. */
function GearIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Item C's headline KPI — the single big "needed vs. have" number pair
 * for the currently-selected community, replacing what would otherwise be
 * yet another small-caps stat row. Color/icon carry the verdict (rule 4:
 * icons over text) — the "why" behind the `needed` figure lives in the
 * caller's own adjacent InfoIcon, not squeezed in here. */
function DriverNeedKPI({ needed, have }: { needed: number; have: number }) {
  const short = have < needed;
  const color = short ? "var(--danger)" : "var(--green)";
  const bg = short ? "var(--danger-tint)" : "var(--green-tint)";
  const flashKey = `${needed}-${have}`;
  const flashing = useFlashOnChange(flashKey);
  return (
    <div
      className={flashing ? "pg-flash-value" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 18px",
        borderRadius: 14,
        background: bg,
        border: `1px solid ${color}`,
      }}
    >
      <span style={{ fontSize: "1.7rem" }} aria-hidden="true">
        {short ? "⚠️" : "✅"}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          data-testid="kpi-drivers-needed"
          style={{ fontSize: "2.3rem", fontWeight: 800, fontFamily: "var(--font-display)", color, lineHeight: 1 }}
        >
          {needed}
        </span>
        <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>needed</span>
        <span style={{ fontSize: "1.2rem", color: "var(--ink-soft)" }}>/</span>
        <span
          data-testid="kpi-drivers-have"
          style={{ fontSize: "2.3rem", fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--ink)", lineHeight: 1 }}
        >
          {have}
        </span>
        <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>have</span>
      </div>
    </div>
  );
}

/** Item D's "+ / -" pair for one fleet type (water or sewage) of the
 * currently-selected community — compact icon+count+buttons rather than a
 * bordered card, matching rule 7 (reduce repetitive chrome: two of these
 * side by side should read as one small control, not two cards). */
function FleetAdjustRow({
  icon,
  label,
  color,
  count,
  onAdd,
  onRemove,
  testId,
}: {
  icon: string;
  label: string;
  color: string;
  count: number;
  onAdd: () => void;
  onRemove: () => void;
  testId: string;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span aria-hidden="true">{icon}</span> {label}
      </span>
      <button
        type="button"
        data-testid={`${testId}-minus`}
        onClick={onRemove}
        disabled={count === 0}
        aria-label={`Remove one ${label.toLowerCase()} truck`}
        style={fleetAdjustButtonStyle(color, count === 0)}
      >
        −
      </button>
      <strong data-testid={`${testId}-count`} style={{ minWidth: 16, textAlign: "center", fontSize: "0.9rem" }}>
        {count}
      </strong>
      <button
        type="button"
        data-testid={`${testId}-plus`}
        onClick={onAdd}
        aria-label={`Add one ${label.toLowerCase()} truck`}
        style={fleetAdjustButtonStyle(color, false)}
      >
        +
      </button>
    </div>
  );
}

function fleetAdjustButtonStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: `1px solid ${disabled ? "var(--border)" : color}`,
    background: "var(--surface)",
    color: disabled ? "var(--ink-soft)" : color,
    fontWeight: 700,
    lineHeight: 1,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    padding: 0,
  };
}

function ProgressBar({ pct, color, label }: { pct: number; color: string; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position: "relative", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, height: 20, overflow: "hidden" }}>
      <div style={{ width: `${clamped}%`, background: color, height: "100%", transition: "width 0.3s linear" }} />
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.68rem",
          fontWeight: 600,
          color: "var(--ink)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          padding: "0 4px",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function fmtDays(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}d` : `>${MAX_SIM_DAYS}d (didn't finish)`;
}

function avgOf(values: (number | null)[]): number {
  const finite = values.filter((v): v is number => v !== null);
  return finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : NaN;
}

// ---------------------------------------------------------------------------
// Truck map — hand-rolled SVG "mini-map" standing in for the Python
// version's pydeck map. Facility + household positions are still derived
// from model.ts's REAL facilityPosition/jitteredPosition (a true bearing +
// radius from the community center) — nothing here is invented — but this
// map uses its OWN pixel-space distance scale (a fixed household radius
// band + a fixed facility anchor distance) instead of one shared lat/lon->km
// scale, so the facility (genuinely ~7.8km away) no longer squashes the
// household cluster (genuinely only 0.3-1.5km wide) down to a blob. A light
// collision-relaxation pass then nudges any two households that still land
// too close together apart, purely for legibility (see relaxCollisions).
// ---------------------------------------------------------------------------
const MAP_W = 360;
const MAP_H = 336;
const VILLAGE_CENTER = { x: MAP_W / 2, y: 116 };
// Illustrative FIXED pixel distance from village center to the facility
// marker — not to scale with the real ~7.8km offset (drawing it to the same
// scale as the household cluster would push it off-canvas). The DIRECTION is
// still the real bearing: the facility is due south of every community here,
// so it always draws below the households, same as reality.
const FACILITY_ANCHOR_PX = 168;
// Mirrors jitteredPosition's own 0.3-1.5km radius band (model.ts) — reused
// here only to remap that already-real per-household distance into a pixel
// band that doesn't collapse into an indistinguishable smear at this map's
// zoom level.
const HH_JITTER_MIN_KM = 0.3;
const HH_JITTER_MAX_KM = 1.5;
const HH_RADIUS_MIN_PX = 40;
const HH_RADIUS_MAX_PX = 150;
const HH_DOT_MIN_SEPARATION_PX = 17;

/** Real bearing + radius (km) of (lat,lon) from a center point, expressed as
 * a screen-space unit vector (ux: +right, uy: +down) plus the true radius —
 * so callers can re-scale the MAGNITUDE for legibility while leaving the
 * real DIRECTION untouched. */
function screenBearing(lat: number, lon: number, centerLat: number, centerLon: number) {
  const dLatKm = (lat - centerLat) * 111;
  const dLonKm = (lon - centerLon) * 111 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.1);
  const radiusKm = Math.hypot(dLatKm, dLonKm) || 0.0001;
  return { ux: dLonKm / radiusKm, uy: -dLatKm / radiusKm, radiusKm };
}

/** Nudges any two points closer than minDist apart, iteratively — a plain
 * beeswarm-style declutter pass so households that happen to jitter close
 * together in real lat/lon still render as visually separate dots instead
 * of overlapping into a blob. */
function relaxCollisions(points: { x: number; y: number }[], minDist: number, iterations = 26) {
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        let dx = points[j].x - points[i].x;
        let dy = points[j].y - points[i].y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = 0.05 * (j - i);
          dy = 0.05 * (i - j + 1);
          dist = Math.hypot(dx, dy) || 0.05;
        }
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          points[i].x -= ux * push;
          points[i].y -= uy * push;
          points[j].x += ux * push;
          points[j].y += uy * push;
        }
      }
    }
  }
}

/** Distinct "facility" marker — a rounded badge with a water-drop glyph, not
 * a circle or a truck, so it reads as a fixed anchor at a glance. */
function FacilityGlyph({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-13} y={-13} width={26} height={26} rx={7} fill="var(--surface-raised)" stroke="var(--ink-soft)" strokeWidth={2.4} />
      <path
        d="M0,-7 C3.6,-2.4 5.6,1 5.6,3.4 C5.6,6.6 3.1,9 0,9 C-3.1,9 -5.6,6.6 -5.6,3.4 C-5.6,1 -3.6,-2.4 0,-7 Z"
        fill="var(--teal)"
      />
    </g>
  );
}

function MapLegendItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width={20} height={20} viewBox="-13 -13 26 26" style={{ flexShrink: 0, overflow: "visible" }} aria-hidden="true">
        {icon}
      </svg>
      {label}
    </span>
  );
}

function TruckMap({
  community,
  waterTrucks,
  sewageTrucks,
  householdsHere,
  snapshot,
  now,
}: {
  community: string;
  waterTrucks: SimTruckState[];
  sewageTrucks: SimTruckState[];
  householdsHere: Household[];
  snapshot: Record<string, SnapshotEntry>;
  now: number;
}) {
  const coords = COMMUNITIES[community];
  const [fLat, fLon] = facilityPosition(community);
  const facilityBearing = screenBearing(fLat, fLon, coords.lat, coords.lon);
  const facilityPt = {
    x: VILLAGE_CENTER.x + facilityBearing.ux * FACILITY_ANCHOR_PX,
    y: VILLAGE_CENTER.y + facilityBearing.uy * FACILITY_ANCHOR_PX,
  };

  // Household pixel positions: real bearing, remapped radius, then a
  // collision-declutter pass — memoized on the household id list + community
  // so it's stable tick to tick (only trucks actually move) instead of
  // being recomputed every second in Auto mode.
  const householdIdKey = householdsHere.map((h) => h.id).join(",");
  const householdPositions = useMemo(() => {
    const base = householdsHere.map((h) => {
      const [hLat, hLon] = jitteredPosition(h.id, coords.lat, coords.lon);
      const b = screenBearing(hLat, hLon, coords.lat, coords.lon);
      const clampedKm = Math.min(HH_JITTER_MAX_KM, Math.max(HH_JITTER_MIN_KM, b.radiusKm));
      const rPx =
        HH_RADIUS_MIN_PX +
        ((clampedKm - HH_JITTER_MIN_KM) / (HH_JITTER_MAX_KM - HH_JITTER_MIN_KM)) * (HH_RADIUS_MAX_PX - HH_RADIUS_MIN_PX);
      return { h, x: VILLAGE_CENTER.x + b.ux * rPx, y: VILLAGE_CENTER.y + b.uy * rPx };
    });
    relaxCollisions(base, HH_DOT_MIN_SEPARATION_PX);
    for (const p of base) {
      p.x = Math.max(22, Math.min(MAP_W - 22, p.x));
      p.y = Math.max(22, Math.min(MAP_H - 60, p.y));
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdIdKey, coords.lat, coords.lon]);

  const posById = new Map(householdPositions.map((p) => [p.h.id, p]));

  const assignedIds = new Set<string>();
  for (const t of [...waterTrucks, ...sewageTrucks]) {
    if (t.target) assignedIds.add(t.target);
    t.batch.forEach((b) => assignedIds.add(b));
  }

  const fleetStyle: Record<FleetKind, string> = { water: "var(--teal)", sewage: "var(--gold)" };
  let waterActive = 0;
  let sewageActive = 0;
  const roadLines: ReactNode[] = [];
  const activeLines: ReactNode[] = [];
  const truckMarkers: ReactNode[] = [];

  // Faint road network to every household — this alone makes the map read
  // as "a delivery network", not just a scatter of dots, even before any
  // truck has moved.
  for (const p of householdPositions) {
    roadLines.push(
      <line
        key={`road-${p.h.id}`}
        x1={facilityPt.x}
        y1={facilityPt.y}
        x2={p.x}
        y2={p.y}
        stroke="var(--border)"
        strokeWidth={1}
        strokeDasharray="1.5 4"
        strokeOpacity={0.9}
      />,
    );
  }

  (["water", "sewage"] as FleetKind[]).forEach((kind) => {
    const fleet = kind === "water" ? waterTrucks : sewageTrucks;
    const color = fleetStyle[kind];
    const idleRowY = kind === "water" ? 24 : 42;
    let idleIdx = 0;

    fleet.forEach((truck, idx) => {
      let px = facilityPt.x;
      let py = facilityPt.y;
      let angleDeg = 0;
      let frac = 0;

      if (truck.status === "en_route" && truck.tripStart !== null && truck.target) {
        frac = Math.max(0, Math.min(1, (now - truck.tripStart) / (truck.tripDuration as number)));
        if (kind === "water") waterActive += 1;
        else sewageActive += 1;
        const targetPt = posById.get(truck.target);
        if (targetPt) {
          // The dispatch/availability timer (simEngine.ts's TRIP_DURATION_MS)
          // already represents the truck's FULL round trip - out, deliver,
          // back - so this splits that same real duration into two visual
          // legs (out for the first half, back for the second) rather than
          // treating frac=1 as "arrived" and snapping straight to idle at
          // the depot. No engine/timing change, purely how the existing
          // number is animated.
          const returning = frac >= 0.5;
          const legT = returning ? (frac - 0.5) / 0.5 : frac / 0.5;
          const fromPt = returning ? targetPt : facilityPt;
          const toPt = returning ? facilityPt : targetPt;
          px = fromPt.x + (toPt.x - fromPt.x) * legT;
          py = fromPt.y + (toPt.y - fromPt.y) * legT;
          angleDeg = (Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x) * 180) / Math.PI;

          activeLines.push(
            <line
              key={`route-${kind}-${idx}`}
              className="pg-route-active"
              x1={facilityPt.x}
              y1={facilityPt.y}
              x2={targetPt.x}
              y2={targetPt.y}
              stroke={color}
              strokeWidth={2.5}
              strokeOpacity={returning ? 0.4 : 0.8}
              strokeDasharray={returning ? "3 3" : undefined}
            />,
          );
          for (const bId of truck.batch) {
            const bp = posById.get(bId);
            if (bp) {
              activeLines.push(
                <line
                  key={`route-${kind}-${idx}-${bId}`}
                  x1={facilityPt.x}
                  y1={facilityPt.y}
                  x2={bp.x}
                  y2={bp.y}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.45}
                  strokeDasharray="4 3"
                />,
              );
            }
          }
        }
      } else {
        // Idle: parked in a small depot row beside the facility rather than
        // stacked exactly on top of it, so 2+ idle trucks of the same kind
        // don't render as a single indistinguishable marker.
        const spread = 22;
        const startX = facilityPt.x - ((fleet.length - 1) * spread) / 2;
        px = startX + idleIdx * spread;
        py = facilityPt.y + idleRowY;
        idleIdx += 1;
      }

      truckMarkers.push(
        <g
          key={`truck-${kind}-${idx}`}
          style={{ transform: `translate(${px}px, ${py}px) rotate(${angleDeg}deg)`, transition: "transform 900ms linear" }}
        >
          <TruckIcon color={color} scale={1.3} />
          <title>
            {`${kind} truck ${idx + 1}: ${
              truck.status === "en_route"
                ? frac >= 0.5
                  ? `returning to the plant from ${truck.target}${truck.batch.length ? ` (+${truck.batch.length} nearby)` : ""} — ${Math.round(
                      ((frac - 0.5) / 0.5) * 100,
                    )}% of the way back${truck.delayed ? `, delayed (${truck.delayReason})` : ""}`
                  : `en route to ${truck.target}${truck.batch.length ? ` (+${truck.batch.length} nearby)` : ""} — ${Math.round(
                      (frac / 0.5) * 100,
                    )}% there${truck.delayed ? `, delayed (${truck.delayReason})` : ""}`
                : "idle at facility"
            }`}
          </title>
        </g>,
      );
    });
  });

  const householdDots = householdPositions.map(({ h, x, y }) => {
    const worst = snapshot[h.id]?.worstVariant ?? "low";
    const color = worst === "high" ? "var(--danger)" : worst === "medium" ? "var(--gold)" : "var(--green)";
    const highlighted = assignedIds.has(h.id);
    return (
      <g key={h.id}>
        {highlighted && <circle cx={x} cy={y} r={9} fill="none" stroke="var(--teal)" strokeWidth={2} />}
        {worst === "high" && (
          <>
            <circle className="pg-sonar-ring a" cx={x} cy={y} r={5} />
            <circle className="pg-sonar-ring b" cx={x} cy={y} r={5} />
          </>
        )}
        <circle cx={x} cy={y} r={5} fill={color} stroke="var(--surface)" strokeWidth={1.5}>
          <title>{`${h.id} — ${worst}${highlighted ? " (truck assigned)" : ""}`}</title>
        </circle>
      </g>
    );
  });

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        style={{
          maxWidth: MAP_W,
          display: "block",
          margin: "0 auto",
          background: "var(--surface-raised)",
          borderRadius: 12,
          border: "1px solid var(--border)",
        }}
        role="img"
        aria-label={`Live truck map for ${community}`}
      >
        {roadLines}
        {activeLines}
        {householdDots}
        {truckMarkers}
        <FacilityGlyph x={facilityPt.x} y={facilityPt.y} />
      </svg>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 16px",
          marginTop: 10,
          fontSize: "0.76rem",
          color: "var(--ink-soft)",
        }}
      >
        <MapLegendItem icon={<FacilityGlyph />} label="Facility (illustrative position)" />
        <MapLegendItem
          icon={<TruckIcon color="var(--teal)" scale={1.3} />}
          label={`Water truck (${waterActive}/${waterTrucks.length} en route)`}
        />
        <MapLegendItem
          icon={<TruckIcon color="var(--gold)" scale={1.3} />}
          label={`Sewage truck (${sewageActive}/${sewageTrucks.length} en route)`}
        />
        <MapLegendItem icon={<circle cx={0} cy={0} r={5} fill="var(--green)" />} label="Household OK" />
        <MapLegendItem icon={<circle cx={0} cy={0} r={5} fill="var(--gold)" />} label="Approaching threshold" />
        <MapLegendItem icon={<circle cx={0} cy={0} r={5} fill="var(--danger)" />} label="Needs truck now" />
      </div>
      <p style={{ fontSize: "0.74rem", color: "var(--ink-soft)", textAlign: "center", marginTop: 6 }}>
        Dotted lines = the delivery route to every household &middot; solid lines = the route a truck is actively driving right now.
        Straight-line paths shown, not real road routing — and household spacing on this map is stretched for legibility, not to
        real-world scale.
      </p>
    </div>
  );
}

function SensitivityChart({
  driverOptions,
  results,
}: {
  driverOptions: number[];
  results: Record<number, { coverageDays: number | null; badStateDays: number }>;
}) {
  const width = 320;
  const height = 150;
  const pad = 30;
  const values = driverOptions.map((n) => results[n]?.coverageDays ?? null);
  const finite = values.filter((v): v is number => v !== null);
  const maxV = Math.max(1, ...finite);
  const xStep = driverOptions.length > 1 ? (width - pad * 2) / (driverOptions.length - 1) : 0;
  const points = driverOptions.map((n, i) => {
    const v = results[n]?.coverageDays ?? null;
    const x = pad + i * xStep;
    const y = v === null ? null : height - pad - (v / maxV) * (height - pad * 2);
    return { n, x, y, v };
  });
  const pathD = points
    .filter((p) => p.y !== null)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: width, display: "block" }}>
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--border)" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="var(--border)" />
      <path d={pathD} fill="none" stroke="var(--teal)" strokeWidth={2} />
      {points.map((p) => (p.y !== null ? <circle key={p.n} cx={p.x} cy={p.y} r={3.5} fill="var(--teal)" /> : null))}
      {points.map((p) => (
        <text key={`lbl-${p.n}`} x={p.x} y={height - pad + 14} fontSize={9} textAnchor="middle" fill="var(--ink-soft)">
          {p.n}
        </text>
      ))}
      <text x={width / 2} y={height - 4} fontSize={9} textAnchor="middle" fill="var(--ink-soft)">
        drivers/trucks
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SimulationPage() {
  // `sim` (React state) is the only thing the render body reads. `simRef`
  // mirrors the same object for imperative mutation inside effects/event
  // handlers (advanceOneTick mutates in place for performance), then
  // syncs back into `sim` via setSim({ ...simRef.current }) - this keeps
  // ref access confined to non-render code paths.
  const [sim, setSim] = useState<SimState>(createInitialSimState);
  const simRef = useRef<SimState>(sim);

  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [running, setRunning] = useState(true);
  const [minutesPerTick, setMinutesPerTick] = useState(10);
  const [batchSyncMinutes, setBatchSyncMinutes] = useState(30);
  const [viewMode, setViewMode] = useState<"households" | "summary">("households");
  const [mapCommunity, setMapCommunity] = useState<string>(COMMUNITY_NAMES[0]);
  const [stepCount, setStepCount] = useState(0);
  const [lastStepEvents, setLastStepEvents] = useState<SimEvent[]>([]);
  const [ffWarning, setFfWarning] = useState<EventType | null>(null);

  // Item A: the two pacing knobs (sim minutes/tick, batch sync interval) are
  // internal dev/testing parameters, not something a demo viewer needs - kept
  // behind this gear-toggled floating panel (see the ref below for the
  // outside-click/Escape close handling) rather than inline in the main
  // mode-controls card. `minutesPerTick`/`batchSyncMinutes` themselves are
  // unchanged - only WHERE their sliders render moved.
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const devPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!devPanelOpen) return;
    function onDocClick(e: MouseEvent) {
      if (devPanelRef.current && !devPanelRef.current.contains(e.target as Node)) setDevPanelOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDevPanelOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [devPanelOpen]);

  const [temps, setTemps] = useState<Record<string, number>>({});

  // Live weather, fetched once per community (Python's fetch_current_temp_c
  // is cached ttl=1800s server-side; we fetch once at mount and reuse for
  // the whole demo run instead of refetching every tick).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        Object.entries(COMMUNITIES).map(async ([name, c]) => {
          const { tempC } = await fetchCurrentTempC(c.lat, c.lon);
          return [name, tempC] as const;
        }),
      );
      if (cancelled) return;
      const t: Record<string, number> = {};
      for (const [name, tempC] of entries) t[name] = tempC;
      setTemps(t);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto (real-time) mode: ticks by itself once a second - the direct React
  // equivalent of the Python fragment's run_every="1s".
  useEffect(() => {
    if (mode !== "auto" || !running) return;
    const id = setInterval(() => {
      advanceOneTick(simRef.current, minutesPerTick, batchSyncMinutes, temps);
      setSim({ ...simRef.current });
    }, 1000);
    return () => clearInterval(id);
  }, [mode, running, minutesPerTick, batchSyncMinutes, temps]);

  const doStep = useCallback(() => {
    const events = advanceOneTick(simRef.current, minutesPerTick, batchSyncMinutes, temps);
    setStepCount((c) => c + 1);
    setLastStepEvents(events);
    setFfWarning(null);
    setSim({ ...simRef.current });
  }, [minutesPerTick, batchSyncMinutes, temps]);

  const doFastForward = useCallback(
    (eventType: EventType) => {
      const collected: SimEvent[] = [];
      let steps = 0;
      let found = false;
      for (let i = 0; i < MAX_STEPS_PER_CLICK; i++) {
        const events = advanceOneTick(simRef.current, minutesPerTick, batchSyncMinutes, temps);
        collected.push(...events);
        steps += 1;
        if (events.some((e) => e.type === eventType)) {
          found = true;
          break;
        }
      }
      setStepCount((c) => c + steps);
      setLastStepEvents(collected);
      setFfWarning(found ? null : eventType);
      setSim({ ...simRef.current });
    },
    [minutesPerTick, batchSyncMinutes, temps],
  );

  // Rolling backlog history + cached fleet-sensitivity recommendation for
  // the surge detector below — declared here (ahead of doReset) purely so
  // doReset can clear them; see the detection effect further down for what
  // they hold and why.
  const pressureHistoryRef = useRef<Record<string, number[]>>({});
  const surgeCacheRef = useRef<Record<string, { triggerPressure: number; addN: number; baseFleet: number }>>({});
  const [surge, setSurge] = useState<SurgeRecommendation | null>(null);

  const doReset = useCallback(() => {
    simRef.current = createInitialSimState();
    setStepCount(0);
    setLastStepEvents([]);
    setFfWarning(null);
    pressureHistoryRef.current = {};
    surgeCacheRef.current = {};
    setSurge(null);
    setSim({ ...simRef.current });
  }, []);

  // Item D: the "+ / -" driver buttons mutate the SAME simRef the tick loop
  // reads/writes every second (not a separate hypothetical calc) via
  // simEngine.ts's addTruckToFleet/removeTruckFromFleet, then syncs `sim`
  // exactly like doStep/doFastForward already do - so the very next tick
  // (Auto mode) or the next Step press picks up the new fleet size
  // immediately, and every other tab reading `sim.waterTrucks`/`sim.sewageTrucks`
  // (Trucks & map, the KPI here, computeDriverNeed) reflects it right away.
  const adjustFleet = useCallback((community: string, kind: FleetKind, delta: 1 | -1) => {
    if (delta === 1) {
      addTruckToFleet(simRef.current, community, kind);
    } else {
      removeTruckFromFleet(simRef.current, community, kind);
    }
    setSim({ ...simRef.current });
  }, []);

  const driverNeed = useMemo(() => computeDriverNeed(sim, temps), [sim, temps]);
  const totalBacklog = useMemo(
    () => COMMUNITY_NAMES.reduce((acc, c) => acc + driverNeed[c].water.backlog + driverNeed[c].sewage.backlog, 0),
    [driverNeed],
  );

  // -------------------------------------------------------------------
  // Proactive "you may need more drivers" surge detector — Problem 2 of
  // this page's brief: the manual what-if slider above only explores ONE
  // community at a time, on demand. This watches the SAME live
  // `computeDriverNeed` numbers that already drive the Trucks & map
  // badges, every tick, for every community/fleet, and raises a
  // recommendation on its own when the live state shows a genuine surge —
  // e.g. "houses emptied almost at once because of looping patterns".
  //
  // Signal: `backlog` vs. `urgent` — measured, not assumed. `backlog` is
  // the textbook-correct signal ("urgent households nobody is already
  // heading to" — literally what more drivers would shorten). It was the
  // first thing tried here. But this page's live tick engine (simEngine.ts)
  // lets a single idle truck batch an UNLIMITED number of simultaneously-
  // urgent households into one visit (no per-trip capacity cap, unlike the
  // more realistic fullscaleSim.ts model) — so empirically, driving this
  // exact page through tens of thousands of ticks never produced a single
  // backlog>0 sample: one truck always instantly absorbs every currently-
  // urgent household the moment it's idle, which is most ticks. What DOES
  // spike hard is the raw `urgent` count itself — observed climbing past
  // 25 (out of a ~12-25-household sample) in these same runs, because a
  // batch of households serviced together earlier all get reset to the
  // same baseline and later re-decay back into urgency together, i.e.
  // exactly the "looping pattern" the product owner described. So the
  // watched quantity here is `pressure = urgent + 2*backlog` per
  // community (both fleets combined) — `urgent` as the real, achievable
  // leading indicator this engine actually produces, `backlog` still
  // weighted in (and would dominate) on the rarer occasion it's nonzero.
  //
  // Detection rule (cheap — plain arithmetic on numbers already computed
  // this tick, safe to run every tick including once/second in Auto mode):
  // a rolling window of the last SURGE_WINDOW samples is kept per
  // community. A surge is flagged when EITHER:
  //     (a) pressure >= SURGE_PRESSURE_THRESHOLD for the last SURGE_SUSTAIN
  //         consecutive samples ("sustained"), or
  //     (b) pressure is still >= SURGE_PRESSURE_THRESHOLD now AND has grown
  //         by >= SURGE_PRESSURE_THRESHOLD since the oldest sample in the
  //         window ("rising").
  //   SURGE_PRESSURE_THRESHOLD = 5 was picked from that same empirical run:
  //   ordinary single/double-household dispatches (the everyday "called,
  //   fleet keeping up" gold state already shown on the Trucks & map badges)
  //   topped out around 3 urgent households at once; a real multi-household
  //   surge cleared 5 quickly and kept climbing. Requiring SUSTAIN
  //   consecutive samples (not one tick) is what rules out a one-tick blip
  //   a truck already en route clears next tick.
  //
  // Recommendation (expensive — a real fleet-sensitivity simulation run —
  // only triggered when the cheap check above first flags a community, or
  // when its pressure changes materially since the last run; cached
  // otherwise so an active surge doesn't re-run this every tick): re-runs
  // the EXACT SAME `runStrategyFullscale` sensitivity math the "how many
  // drivers would actually help" panel above already uses, over this
  // community's ACTUAL current households and live temps (not a synthetic
  // full-population sample), trying today's documented fleet size +1 and
  // +2, and recommending the smallest addition whose projected
  // household-days-in-a-bad-state at least halves relative to today's
  // documented fleet. Falls back to +2 if neither try clears that bar.
  // -------------------------------------------------------------------
  const SURGE_WINDOW = 6;
  const SURGE_SUSTAIN = 3;
  const SURGE_PRESSURE_THRESHOLD = 5;
  const SURGE_MATERIAL_CHANGE = 3;

  useEffect(() => {
    // Cheap part: rolling-window bookkeeping + the sustained/rising check.
    // No setState here — pure ref/local arithmetic — so this always runs
    // synchronously, every tick, in lockstep with the tick itself (this is
    // what makes "3 CONSECUTIVE samples" actually mean consecutive ticks).
    const surgingPressure: Record<string, number> = {};
    for (const community of COMMUNITY_NAMES) {
      const w = driverNeed[community].water;
      const s = driverNeed[community].sewage;
      // See the comment block above: `urgent` (not `backlog`) is the signal
      // that actually moves in this engine — `backlog` is still weighted in
      // (x2) so it would dominate on the rare tick it's nonzero.
      const pressure = w.urgent + s.urgent + 2 * (w.backlog + s.backlog);
      const hist = (pressureHistoryRef.current[community] ??= []);
      hist.push(pressure);
      if (hist.length > SURGE_WINDOW) hist.shift();

      const sustained = hist.length >= SURGE_SUSTAIN && hist.slice(-SURGE_SUSTAIN).every((v) => v >= SURGE_PRESSURE_THRESHOLD);
      const rising =
        hist.length >= SURGE_SUSTAIN &&
        hist[hist.length - 1] >= SURGE_PRESSURE_THRESHOLD &&
        hist[hist.length - 1] - hist[0] >= SURGE_PRESSURE_THRESHOLD;
      if (sustained || rising) surgingPressure[community] = pressure;
      if (typeof window !== "undefined" && (window as unknown as { __DEBUG_SURGE__?: boolean }).__DEBUG_SURGE__ && pressure >= 4) {
         
        console.log("PRESSURE", community, pressure, "hist=", JSON.stringify(hist), "sustained=", sustained, "rising=", rising);
      }
    }
    if (typeof window !== "undefined" && (window as unknown as { __DEBUG_SURGE__?: boolean }).__DEBUG_SURGE__ && Object.keys(surgingPressure).length) {
       
      console.log("SURGING", JSON.stringify(surgingPressure));
    }

    // Wait for live weather like the other sensitivity effects do — the
    // fleet-sensitivity re-run needs a real temp per community.
    if (COMMUNITY_NAMES.some((c) => temps[c] === undefined)) return;

    // Expensive part (a real fleet-sensitivity simulation) plus the
    // resulting setSurge() call are deferred to a macrotask — same
    // "measuring…" deferral idiom the other sensitivity effects on this
    // page already use for runStrategyFullscale. This keeps setState calls
    // out of the effect's synchronous body and only pays the simulation
    // cost when a surge is newly flagged or has materially changed, never
    // on every one-second tick.
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const prevCache = surgeCacheRef.current;
      // Rebuilt from scratch (never mutated in place) — a community that's
      // no longer surging simply isn't carried into nextCache, which is how
      // a cleared surge drops out without needing an in-place delete.
      const nextCache: Record<string, { triggerPressure: number; addN: number; baseFleet: number }> = {};

      for (const community of Object.keys(surgingPressure)) {
        const pressure = surgingPressure[community];
        const cached = prevCache[community];
        const materialChange = !cached || Math.abs(pressure - cached.triggerPressure) >= SURGE_MATERIAL_CHANGE;
        if (!materialChange) {
          nextCache[community] = cached;
          continue;
        }

        // Reached only when a surge is first flagged, or an already-flagged
        // surge has meaningfully worsened/improved — reuses the SAME
        // runStrategyFullscale sensitivity math as the "how many drivers
        // would actually help" panel, over this community's ACTUAL current
        // households and live temp, not a synthetic sample.
        const hhHere = sim.households.filter((h) => h.community === community);
        const tempsHere = { [community]: temps[community] };
        const baseFleet = fleetSize(COMMUNITIES[community].population);
        const baseline = runStrategyFullscale("optimized", hhHere, sim.now, tempsHere, { [community]: baseFleet });
        const baselineBad = baseline.badStateDays[community] ?? 0;
        let addN = 2;
        for (const extra of [1, 2]) {
          const result = runStrategyFullscale("optimized", hhHere, sim.now, tempsHere, { [community]: baseFleet + extra });
          const bad = result.badStateDays[community] ?? 0;
          if (bad <= baselineBad * 0.5 || (baselineBad < 1 && bad === 0)) {
            addN = extra;
            break;
          }
        }
        nextCache[community] = { triggerPressure: pressure, addN, baseFleet };
      }

      surgeCacheRef.current = nextCache;

      const surging = Object.keys(nextCache);
      if (surging.length === 0) {
        setSurge((prev) => (prev === null ? prev : null));
        return;
      }
      // Show the worst (highest live backlog) surging community if more
      // than one qualifies at once.
      const worstCommunity = surging.reduce((best, c) =>
        (surgingPressure[c] ?? 0) > (surgingPressure[best] ?? 0) ? c : best,
      );
      const w = nextCache[worstCommunity];
      if (typeof window !== "undefined" && (window as unknown as { __DEBUG_SURGE__?: boolean }).__DEBUG_SURGE__) {
         
        console.log("SET_SURGE", worstCommunity, w.addN, w.baseFleet);
      }
      setSurge((prev) =>
        prev && prev.community === worstCommunity && prev.addN === w.addN && prev.baseFleet === w.baseFleet
          ? prev
          : { community: worstCommunity, addN: w.addN, baseFleet: w.baseFleet },
      );
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // sim.households/sim.now/temps are read above but intentionally left out
    // of the deps: `driverNeed` is itself derived from exactly this same
    // (sim, temps) pair via useMemo, so it changes identity precisely when
    // they do — re-running this effect on `driverNeed` alone avoids a
    // second, redundant trigger for the same tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverNeed]);

  // Live "M households need service at once" figure for the banner —
  // `urgent` (both fleets), not `backlog`: this is what's actually visible
  // as a real-time count in this engine (see the surge-detector comment
  // above for why raw urgent, not backlog, is the reliable moving signal
  // here). Recomputed every tick from `driverNeed` directly (cheap), kept
  // separate from the cached `addN` recommendation so the household count
  // stays live even between the detector's own (rarer) recompute passes.
  const liveSurgeUrgent = surge
    ? driverNeed[surge.community].water.urgent + driverNeed[surge.community].sewage.urgent
    : 0;

  const nextSyncAt = sim.lastSync + batchSyncMinutes * 60_000;
  const minutesSinceSync = (sim.now - sim.lastSync) / 60_000;
  const minutesUntilSync = Math.max(0, (nextSyncAt - sim.now) / 60_000);

  // ---------------------------------------------------------------------
  // Measured comparisons — the ACTUAL ported dispatch simulations
  // (delivery_comparison.py / delivery_comparison_fullscale.py), not
  // precomputed numbers. Computed once live weather has loaded for all 4
  // communities, using a SEPARATE seeded household population from the live
  // tick engine above (matches the Python page calling seed_households()
  // fresh for this, independent of st.session_state.sim_households).
  // ---------------------------------------------------------------------
  const [smallCompare, setSmallCompare] = useState<{ baseline: SmallScaleResult; optimized: SmallScaleResult } | null>(null);
  const [fullCompare, setFullCompare] = useState<{ baseline: FullscaleResult; optimized: FullscaleResult } | null>(null);
  const [comparisonsLoading, setComparisonsLoading] = useState(true);

  useEffect(() => {
    if (COMMUNITY_NAMES.some((c) => temps[c] === undefined)) return;
    let cancelled = false;
    // Deferred to a macrotask (not run synchronously in the effect body) so
    // the "measuring…" loading text gets a chance to paint first - this is
    // a real (if fast) simulation run, not a lookup.
    const timer = setTimeout(() => {
      if (cancelled) return;
      const startNow = Date.now();
      const baseHh = seedHouseholds();
      const bSmall = runStrategySmallScale("baseline", baseHh, startNow, temps);
      const oSmall = runStrategySmallScale("optimized", baseHh, startNow, temps);
      if (cancelled) return;
      setSmallCompare({ baseline: bSmall, optimized: oSmall });

      const fsHh = generateFullscaleHouseholds();
      const bFull = runStrategyFullscale("baseline", fsHh, startNow, temps);
      const oFull = runStrategyFullscale("optimized", fsHh, startNow, temps);
      if (cancelled) return;
      setFullCompare({ baseline: bFull, optimized: oFull });
      setComparisonsLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [temps]);

  const [fleetCommunity, setFleetCommunity] = useState<string>(COMMUNITY_NAMES[0]);
  const [chosenDrivers, setChosenDrivers] = useState<number | null>(null);
  const [sensitivity, setSensitivity] = useState<Record<number, { coverageDays: number | null; badStateDays: number }> | null>(null);
  const documentedFleet = fleetSize(COMMUNITIES[fleetCommunity].population);
  const driverOptions = useMemo(() => {
    const start = Math.max(1, documentedFleet - 1);
    const stop = documentedFleet + 3;
    const out: number[] = [];
    for (let n = start; n < stop; n++) out.push(n);
    return out;
  }, [documentedFleet]);

  useEffect(() => {
    const tempHere = temps[fleetCommunity];
    if (tempHere === undefined) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const startNow = Date.now();
      const fsHhAll = generateFullscaleHouseholds();
      const hhHere = fsHhAll.filter((h) => h.community === fleetCommunity);
      const tempsHere = { [fleetCommunity]: tempHere };
      const results: Record<number, { coverageDays: number | null; badStateDays: number }> = {};
      for (const n of driverOptions) {
        const { coverageDay, badStateDays } = runStrategyFullscale("optimized", hhHere, startNow, tempsHere, { [fleetCommunity]: n });
        results[n] = { coverageDays: coverageDay[fleetCommunity], badStateDays: badStateDays[fleetCommunity] };
      }
      if (cancelled) return;
      setSensitivity(results);
      setChosenDrivers(documentedFleet);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleetCommunity, temps[fleetCommunity]]);

  // Households tab's own community filter — a per-tab selector (same idiom
  // as the Houses page) so the ~90-tile household grid fits one screen
  // without page-level scroll instead of always rendering all 4 communities
  // at once. "All" still renders everything (inside that tab's own internal
  // scroll region) — nothing is hidden, just scoped on request.
  const [householdFilterCommunity, setHouseholdFilterCommunity] = useState<string>("All");

  // -------------------------------------------------------------------
  // Tab content — the page's top-level state/effects above are untouched
  // by this split: every hook that must keep ticking (the auto-mode
  // interval, simRef, stepCount, etc.) lives at component scope, not
  // inside any of these ReactNode values, so switching which tab is
  // *rendered* below never unmounts or pauses the simulation. Only the
  // active tab's JSX actually mounts DOM (SingleScreenTabs renders just
  // `activeTab.content`) — the others are cheap unmounted element trees.
  // -------------------------------------------------------------------

  const controlsTab: ReactNode = (
    <div style={{ height: "100%", overflowY: "auto", paddingRight: 4 }}>
      {/* Two previously-stacked header rows (isolated-clock badge, ~2wks
          rotation stat) merged into one line — same info, half the vertical
          space, each still backed by its own InfoIcon rather than inline
          prose. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <InfoPill>Isolated demo clock</InfoPill>
        <InfoIcon label="Why this clock is separate">
          Separate households, sped-up time — same math as every other page.
        </InfoIcon>
        <MiniStat value="~2 wks" label="blind rotation to reach everyone" color="var(--gold)" />
        <InfoIcon label="Why refills are slow today">
          No per-house data means a truck visits blind — about 2 weeks to reach everyone once. Real measurement lets
          the same trucks prioritize who actually needs it.
        </InfoIcon>
      </div>

      {/* Monitoring stats — relocated from the old always-on-every-tab
          status strip (see the persistent header above) so they only cost
          space on this monitoring tab, not on Trucks/Households/Event log
          too. "Extra drivers needed" here is the raw aggregate backlog
          count across all 4 communities; the surge banner above the tabs is
          a different, more actionable signal (a SUSTAINED trend for ONE
          community with a real recommended fix) - the InfoIcon spells out
          the distinction so the two numbers are never read as contradicting
          each other. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
          padding: "6px 12px",
          marginBottom: 12,
          borderRadius: 10,
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <Metric label="Households filled/emptied so far" value={sim.totalServiced} />
        <Metric
          label="🚚 Extra drivers needed right now"
          value={<BacklogFlashValue value={totalBacklog} />}
          help="Households currently urgent (water or sewage) that no truck is already heading to, across all 4 communities — 0 means the current fleet is keeping up with every urgent household this instant. This is a raw instant count, unlike the surge banner above (which only fires for a SUSTAINED trend in one community and comes with a real recommended fix)."
        />
        <Metric label="📡 Last synced" value={`${minutesSinceSync.toFixed(0)} min ago`} help={`Simulated time of last batch sync: ${formatSimDateTime(sim.lastSync)}`} />
        <Metric label="Next batch sync in" value={`${minutesUntilSync.toFixed(0)} min`} />
        <InfoIcon label="How syncing works in real deployment">
          Real deployment: data batches whenever a connection is available (at the plant, at a house, or via a radio check-in) — not
          continuous live telemetry, since trucks have no signal in transit.
        </InfoIcon>
      </div>

      {/* ---------------- Measured comparison ---------------- */}
      <details className="card" style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          📊 Measured: blind rotation vs. predictive+batch (this demo&apos;s seeded households)
        </summary>
        {comparisonsLoading || !smallCompare || !fullCompare ? (
          <p style={{ color: "var(--ink-soft)" }}>Measuring baseline vs. predictive+batch dispatch…</p>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <InfoPill>Small-sample run</InfoPill>
              <InfoIcon label="Methodology">
                Same seeded households, same one-truck-per-community, same 45-min trip duration for both strategies — only WHICH
                household gets visited when differs. Run over this demo&apos;s household SAMPLE (12-25 per community standing in for
                the real ~750-2000 population), not the full population.
              </InfoIcon>
            </div>
            {(() => {
              const bAvg = avgOf(Object.values(smallCompare.baseline.coverageDay));
              const oAvg = avgOf(Object.values(smallCompare.optimized.coverageDay));
              const bBad = Object.values(smallCompare.baseline.badStateDays).reduce((a, b) => a + b, 0);
              const oBad = Object.values(smallCompare.optimized.badStateDays).reduce((a, b) => a + b, 0);
              return (
                <>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
                    <Metric label="Baseline — avg days to cover everyone" value={bAvg.toFixed(2)} />
                    <Metric label="Baseline — household-days in a bad state" value={bBad.toFixed(1)} />
                    <Metric label="Predictive+batch — avg days to cover everyone" value={oAvg.toFixed(2)} />
                    <Metric label="Predictive+batch — household-days in a bad state" value={oBad.toFixed(1)} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <Badge
                      label={oAvg <= bAvg ? "▼ Predictive+batch faster to full coverage" : "▲ Blind rotation faster to full coverage"}
                      variant={oAvg <= bAvg ? "low" : "medium"}
                    />
                    <InfoIcon label="Why">
                      {oAvg <= bAvg
                        ? "Predictive+batch is faster on this run."
                        : "Blind rotation actually finishes touching every household sooner here — it never idles, so it works through its fixed route non-stop. Predictive+batch waits for real need, so covering the LAST unremarkable household can take longer."}
                    </InfoIcon>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <Badge
                      label={oBad <= bBad ? "▼ Predictive+batch fewer bad-state days" : "Bad-state days not reduced"}
                      variant={oBad <= bBad ? "low" : "medium"}
                    />
                    <InfoIcon label="Why this matters">
                      {oBad <= bBad
                        ? "Far fewer household-days spent already in a bad state (tank empty/unsafe or sewage blocked) — predictive+batch prioritizes preventing that, not blind coverage."
                        : "Household-days in a bad state were not lower for predictive+batch on this run."}
                    </InfoIcon>
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <h5 style={{ margin: 0 }}>Larger-scale run: REAL population + realistic round-trip logistics</h5>
                    <InfoIcon label="Methodology">
                      A DIFFERENT, standalone run over the REAL household count (~450-500 for a ~1800-2000-person community, ~185-190
                      for a ~750-person one), a population-scaled multi-truck fleet (anchored on Inukjuak&apos;s documented 3 trucks),
                      and a mechanistic trip-cycle time — outbound + on-site + return + turnaround, plus an ~8% per-trip chance a
                      blizzard/breakdown costs a whole trip with no delivery.
                    </InfoIcon>
                  </div>
                  {(() => {
                    const fbAvg = avgOf(Object.values(fullCompare.baseline.coverageDay));
                    const foAvg = avgOf(Object.values(fullCompare.optimized.coverageDay));
                    const fbBad = Object.values(fullCompare.baseline.badStateDays).reduce((a, b) => a + b, 0);
                    const foBad = Object.values(fullCompare.optimized.badStateDays).reduce((a, b) => a + b, 0);
                    const bigCommunities = COMMUNITY_NAMES.filter((c) => COMMUNITIES[c].population >= 1500);
                    const fbBigAvg = avgOf(bigCommunities.map((c) => fullCompare.baseline.coverageDay[c]));
                    const inRange = fbBigAvg >= 14.0 && fbBigAvg <= 16.0;
                    return (
                      <>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
                          <Metric label="Baseline — avg days to cover everyone" value={fbAvg.toFixed(2)} />
                          <Metric label="Baseline — household-days in a bad state" value={fbBad.toFixed(0)} />
                          <Metric label="Predictive+batch — avg days to cover everyone" value={foAvg.toFixed(2)} />
                          <Metric label="Predictive+batch — household-days in a bad state" value={foBad.toFixed(0)} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          <Badge
                            label={`${inRange ? "✅" : "⚠️"} Reference check: ${fbBigAvg.toFixed(2)}d avg`}
                            variant={inRange ? "low" : "medium"}
                          />
                          <InfoIcon label="What this reference check means">
                            Baseline blind-rotation for the ~1800-2000-population communities averages {fbBigAvg.toFixed(2)} days to
                            reach every household once —{" "}
                            {inRange
                              ? "lands inside the independently-cited ~14-16 day full-cycle figure this app's problem framing is built on."
                              : "outside the cited ~14-16 day range on this particular run (live-weather variance can shift chlorine-decay-driven urgency slightly run to run)."}
                          </InfoIcon>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          <Badge
                            label={
                              foAvg <= fbAvg
                                ? `▼ Predictive+batch faster at real scale (${foAvg.toFixed(2)}d vs ${fbAvg.toFixed(2)}d)`
                                : `▲ Blind rotation faster at real scale (${fbAvg.toFixed(2)}d vs ${foAvg.toFixed(2)}d)`
                            }
                            variant={foAvg <= fbAvg ? "low" : "medium"}
                          />
                          <InfoIcon label="Why">
                            {foAvg <= fbAvg
                              ? "Batching sweeps up many urgent households per trip."
                              : "Same qualitative finding as the small sample."}
                          </InfoIcon>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <Badge
                            label={`Bad-state days: ${foBad.toFixed(0)} predictive+batch vs ${fbBad.toFixed(0)} baseline`}
                            variant={foBad <= fbBad ? "low" : "medium"}
                          />
                          <InfoIcon label="What this means">
                            {foBad <= fbBad
                              ? "Predictive+batch still spends far fewer household-days in a bad state at this scale."
                              : "Predictive+batch does NOT reduce household-days in a bad state at this scale on this run."}
                          </InfoIcon>
                        </div>
                      </>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}
      </details>

      {/* ---------------- How many drivers would help ---------------- */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <h4 style={{ margin: 0 }}>🚚 How many drivers would actually help?</h4>
          <InfoIcon label="About this section">
            The real simulation, re-run with a different fleet size. &quot;Documented&quot; is Inukjuak&apos;s cited 3-truck fleet.
          </InfoIcon>
        </div>
        {/* Community picker + what-if slider on one row (was two stacked
            block labels each on their own line) — same two controls, half
            the height. */}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 20, marginBottom: 12 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>Community</span>
          <select
            value={fleetCommunity}
            onChange={(e) => setFleetCommunity(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            {COMMUNITY_NAMES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* ---------------- Item C: big-number "needed vs. have" KPI + item D's
            live "+ / -" driver controls, both scoped to `fleetCommunity` (the
            SAME community picker above — no second picker introduced).

            "needed": when this community has an ACTIVE live surge (the same
            detector driving the banner above the tabs), needed = the fleet
            size that surge's own fleet-sensitivity re-run recommended
            (`baseFleet + addN`, both frozen at the instant the surge was
            flagged/last materially updated - see the surge-cache effect
            above) - a FIXED target, not `liveHave + addN`. Anchoring to
            liveHave instead would make "needed" chase "have" upward by
            addN forever, so clicking + could never close the gap no matter
            how many trucks got added - the whole point of a target is that
            "have" can reach and pass it. Otherwise, needed falls back to the
            documented fleet-sensitivity baseline (`documentedFleet` =
            fleetSize(population), the exact number the panel below already
            treats as "today") - the honest steady-state answer to "how many
            trucks should this community have".

            "have": always the REAL live combined fleet size right now
            (state.waterTrucks[c].length + state.sewageTrucks[c].length) —
            not the documented baseline — so clicking + / - below moves this
            number immediately, including the demo-friendly case of
            deliberately removing a driver to show `have` drop below
            `needed`. */}
        {(() => {
          const waterCount = sim.waterTrucks[fleetCommunity].length;
          const sewageCount = sim.sewageTrucks[fleetCommunity].length;
          const liveHave = waterCount + sewageCount;
          const surgeActiveHere = surge?.community === fleetCommunity;
          const neededCount = surgeActiveHere ? surge!.baseFleet + surge!.addN : documentedFleet;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
              <DriverNeedKPI needed={neededCount} have={liveHave} />
              <InfoIcon label="How &quot;needed&quot; is computed">
                {surgeActiveHere
                  ? `A live surge is flagged for ${fleetCommunity} right now — "needed" (${neededCount}) is the fleet size (${surge!.baseFleet} documented + ${surge!.addN} recommended) that surge's own fleet-sensitivity re-run found would clear it (the same figure behind the banner above). It's a fixed target: add trucks with the buttons below and watch "have" close the gap.`
                  : `No active surge for ${fleetCommunity} — "needed" falls back to the documented fleet-sensitivity baseline for this community's population (${documentedFleet}), the same number the chart below treats as "today". "Have" is always the real, live fleet size, which the +/- buttons here actually change.`}
              </InfoIcon>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <FleetAdjustRow
                  icon="🚚"
                  label="Water"
                  color="var(--teal)"
                  count={waterCount}
                  onAdd={() => adjustFleet(fleetCommunity, "water", 1)}
                  onRemove={() => adjustFleet(fleetCommunity, "water", -1)}
                  testId="fleet-water"
                />
                <FleetAdjustRow
                  icon="🚛"
                  label="Sewage"
                  color="var(--gold)"
                  count={sewageCount}
                  onAdd={() => adjustFleet(fleetCommunity, "sewage", 1)}
                  onRemove={() => adjustFleet(fleetCommunity, "sewage", -1)}
                  testId="fleet-sewage"
                />
              </div>
            </div>
          );
        })()}

        {!sensitivity || chosenDrivers === null ? (
          <p style={{ color: "var(--ink-soft)" }}>Modeling different driver counts for this community…</p>
        ) : (
          <>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }} title="What if this community had this many drivers/trucks?">
                What if: drivers/trucks
              </span>
              <input
                type="range"
                min={driverOptions[0]}
                max={driverOptions[driverOptions.length - 1]}
                step={1}
                value={chosenDrivers}
                onChange={(e) => setChosenDrivers(Number(e.target.value))}
                style={{ width: 220 }}
              />
              <span style={{ fontWeight: 700 }}>{chosenDrivers}</span>
            </label>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
              <Metric
                label={`Today — ${documentedFleet} driver${documentedFleet !== 1 ? "s" : ""} (documented)`}
                value={<CoverageDaysValue days={sensitivity[documentedFleet]?.coverageDays ?? null} />}
              />
              <Metric
                label={`What if — ${chosenDrivers} driver${chosenDrivers !== 1 ? "s" : ""}`}
                value={<CoverageDaysValue days={sensitivity[chosenDrivers]?.coverageDays ?? null} />}
                help="Days for every household in this community to be reached at least once."
              />
            </div>

            {chosenDrivers > documentedFleet ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <Badge label={`📈 +${chosenDrivers - documentedFleet} driver(s)`} variant="low" />
                <InfoIcon label="What this scenario means">
                  If {chosenDrivers - documentedFleet} more driver(s)/truck(s) become available for {fleetCommunity}, the same
                  dispatch logic runs faster immediately — no code change, just a fleet-size update. If not, {fleetCommunity} still
                  runs today on its documented {documentedFleet}.
                </InfoIcon>
              </div>
            ) : chosenDrivers < documentedFleet ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <Badge label="Reference only" variant="medium" />
                <InfoIcon label="Why this is reference only">
                  Shown for reference only — {fleetCommunity} is not proposed to lose a driver.
                </InfoIcon>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <InfoPill>Today&apos;s documented fleet</InfoPill>
                <InfoIcon label="About this baseline">
                  This is today&apos;s real, documented fleet size — the baseline every other number on this page assumes.
                </InfoIcon>
              </div>
            )}

            <SensitivityChart driverOptions={driverOptions} results={sensitivity} />
          </>
        )}
      </div>

      {/* ---------------- Mode controls ---------------- */}
      <div className="card" style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 20 }}>
        <div>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginBottom: 4 }}>Simulation mode</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["auto", "manual"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 99,
                  border: "1px solid var(--border)",
                  background: mode === m ? "var(--teal-tint)" : "var(--surface)",
                  color: mode === m ? "var(--teal)" : "var(--ink)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {m === "auto" ? "Auto (real-time)" : "Manual step-through"}
              </button>
            ))}
          </div>
        </div>

        <div>
          {mode === "manual" ? (
            <Metric label="Step" value={stepCount} testId="metric-step" />
          ) : (
            <label style={{ display: "flex", flexDirection: "column", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              Running
              <button
                onClick={() => setRunning((r) => !r)}
                style={{
                  marginTop: 4,
                  padding: "6px 14px",
                  borderRadius: 99,
                  border: "1px solid var(--border)",
                  background: running ? "var(--green-tint)" : "var(--surface)",
                  color: running ? "var(--green)" : "var(--ink)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {running ? "▶ Running" : "⏸ Paused"}
              </button>
            </label>
          )}
        </div>

        {/* Item A: dev-only pacing knobs, hidden behind a gear toggle — see
            DESIGN_RULES.md rule 6 and the deck's Household Reading slide
            settings gear for the reference idiom. Mode toggle/Running/Reset/
            View above and below this are left inline on purpose: they're
            controls a live demo presenter would actually click. */}
        <div ref={devPanelRef} style={{ position: "relative" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginBottom: 4 }}>&nbsp;</div>
          <button
            type="button"
            aria-label="Developer pacing settings"
            aria-expanded={devPanelOpen}
            data-testid="dev-panel-toggle"
            onClick={() => setDevPanelOpen((v) => !v)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: devPanelOpen ? "var(--teal-tint)" : "var(--surface)",
              color: devPanelOpen ? "var(--teal)" : "var(--ink-soft)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GearIcon />
          </button>
          {devPanelOpen && (
            <div
              data-testid="dev-panel"
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: 0,
                zIndex: 50,
                width: 250,
                padding: 14,
                borderRadius: 12,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <GearIcon size={13} />
                <strong style={{ fontSize: "0.8rem" }}>Dev: pacing knobs</strong>
              </div>
              <label style={{ display: "flex", flexDirection: "column", fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: 12 }}>
                Sim minutes / tick: <strong style={{ color: "var(--ink)" }}>{minutesPerTick}</strong>
                <input type="range" min={2} max={90} value={minutesPerTick} onChange={(e) => setMinutesPerTick(Number(e.target.value))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                Batch sync every (sim min): <strong style={{ color: "var(--ink)" }}>{batchSyncMinutes}</strong>
                <input
                  type="range"
                  min={15}
                  max={120}
                  step={15}
                  value={batchSyncMinutes}
                  onChange={(e) => setBatchSyncMinutes(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginBottom: 4 }}>View</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["households", "summary"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 99,
                  border: "1px solid var(--border)",
                  background: viewMode === v ? "var(--teal-tint)" : "var(--surface)",
                  color: viewMode === v ? "var(--teal)" : "var(--ink)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {v === "households" ? "Households" : "Community summary"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            onClick={doReset}
            style={{
              padding: "8px 14px",
              borderRadius: 99,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--danger)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🔄 Reset simulation
          </button>
        </div>
      </div>

      {/* ---------------- Manual step-through controls ---------------- */}
      {mode === "manual" && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)", fontWeight: 600 }}>Manual controls</span>
            <InfoIcon label="How these buttons work">
              Each button advances the simulation one or more ticks — &quot;Step&quot; always does exactly one; the others
              fast-forward only until that specific situation happens, then stop so you can look at the result.
            </InfoIcon>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button data-testid="btn-step" onClick={doStep} style={buttonStyle()}>
              ⏭️ Step
            </button>
            <button data-testid="btn-dispatch" onClick={() => doFastForward("dispatch")} style={buttonStyle()}>
              🚚 Dispatch
            </button>
            <button data-testid="btn-arrival" onClick={() => doFastForward("arrival")} style={buttonStyle()}>
              ✅ Arrival
            </button>
            <button data-testid="btn-delay" onClick={() => doFastForward("delay")} style={buttonStyle()}>
              📻 Delay
            </button>
            <button data-testid="btn-sync" onClick={() => doFastForward("sync")} style={buttonStyle()}>
              📡 Sync
            </button>
          </div>
          {ffWarning && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <Badge label={`No ${EVENT_TYPE_LABEL[ffWarning]} in ${MAX_STEPS_PER_CLICK} steps`} variant="medium" />
              <InfoIcon label="What to do">Try again, or switch to Auto mode to let it run longer.</InfoIcon>
            </div>
          )}
          {lastStepEvents.length > 0 && (
            <div data-testid="what-just-happened">
              <h5 style={{ margin: "8px 0 6px 0" }}>What just happened</h5>
              {lastStepEvents.slice(-6).map((ev, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: "0.82rem",
                    padding: "6px 10px",
                    borderRadius: 8,
                    marginBottom: 4,
                    background:
                      ev.type === "arrival" ? "var(--green-tint)" : ev.type === "delay" ? "var(--gold-tint)" : "var(--teal-tint)",
                    color: ev.type === "arrival" ? "var(--green)" : ev.type === "delay" ? "var(--gold)" : "var(--teal)",
                  }}
                >
                  {ev.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const trucksTab: ReactNode = (
    <div style={{ height: "100%", display: "flex", gap: 16, minHeight: 0 }}>
      <div style={{ flex: "1 1 60%", minWidth: 0, overflowY: "auto", minHeight: 0, paddingRight: 4 }}>
        <h4 style={{ margin: "0 0 6px 0" }}>Trucks right now</h4>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 10, fontSize: "0.78rem", color: "var(--ink-soft)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--teal)", display: "inline-block" }} />
            Water-delivery truck
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--gold)", display: "inline-block" }} />
            Sewage-pump truck
          </span>
          <InfoIcon label="Fleet size">2 of each per community, grouped below.</InfoIcon>
        </div>
        {COMMUNITY_NAMES.map((community) => {
        const hhHere = sim.households.filter((h) => h.community === community);
        const wNeed = driverNeed[community].water;
        const sNeed = driverNeed[community].sewage;

        // Compact chip + InfoIcon, not a sentence-length badge: the full
        // "N more drivers would help right now" / "called, fleet keeping
        // up" wording moves into the InfoIcon, same "components not
        // summaries" idiom as Houses/Plant/Communities/Statistics (a short
        // Badge for the at-a-glance state, an "i" for the why). Color
        // semantics unchanged: green=idle, gold=called/keeping up,
        // red=backlog.
        function needBadge(need: typeof wNeed, icon: string, label: string) {
          const flashKey = `${community}-${label}-${need.backlog}-${need.urgent}-${need.active}-${need.idle}`;
          let chip: ReactNode;
          let detail: string;
          if (need.backlog > 0) {
            chip = <Badge label={`${icon} ${label}: ${need.backlog} short`} variant="high" pulse={false} />;
            detail = `${need.active}/${need.fleetSize} out right now — ${need.backlog} more driver${need.backlog !== 1 ? "s" : ""} would help immediately.`;
          } else if (need.urgent > 0) {
            chip = <Badge label={`${icon} ${label}: Called`} variant="medium" pulse={false} />;
            detail = `${need.active}/${need.fleetSize} out — called, and the fleet is keeping up with every urgent household right now.`;
          } else if (need.active > 0) {
            chip = <InfoPill>{`${icon} ${label}: En route`}</InfoPill>;
            detail = `${need.active}/${need.fleetSize} out — finishing prior trips; nothing new is urgent right now.`;
          } else {
            chip = <Badge label={`${icon} ${label}: Idle`} variant="low" pulse={false} />;
            detail = `Currently no drivers needed for ${label.toLowerCase()} — fleet idle at the plant.`;
          }
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <FlashBadge flashKey={flashKey}>{chip}</FlashBadge>
              <InfoIcon label={`${label} fleet status`}>{detail}</InfoIcon>
            </span>
          );
        }

        return (
          <div key={community} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <strong>{community}</strong>
              {needBadge(wNeed, "🚚", "Water")}
              {needBadge(sNeed, "🚛", "Sewage")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {(["water", "sewage"] as FleetKind[]).map((kind) => {
                const fleet = kind === "water" ? sim.waterTrucks[community] : sim.sewageTrucks[community];
                const color = kind === "water" ? "var(--teal)" : "var(--gold)";
                return (
                  <div key={kind}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {kind === "water" ? "🚚" : "🚛"} {kind[0].toUpperCase() + kind.slice(1)} trucks
                    </div>
                    {fleet.map((truck, idx) => {
                      if (truck.status === "en_route") {
                        const frac = Math.min((sim.now - (truck.tripStart as number)) / (truck.tripDuration as number), 1);
                        const assignedIds = [truck.target as string, ...truck.batch];
                        return (
                          <div key={idx} style={{ marginBottom: 8 }}>
                            {truck.delayed ? (
                              <div style={{ fontSize: "0.78rem", color: "var(--gold)", marginBottom: 4 }}>
                                📻 #{idx + 1}: delayed ({truck.delayReason}, radioed in) — {truck.target} {Math.round(frac * 100)}%
                              </div>
                            ) : (
                              <ProgressBar pct={frac * 100} color={color} label={`#${idx + 1}: ${truck.target} ${Math.round(frac * 100)}%`} />
                            )}
                            <details>
                              <summary style={{ cursor: "pointer", fontSize: "0.76rem", color: "var(--ink-soft)" }}>
                                Manifest #{idx + 1} ({assignedIds.length} house{assignedIds.length !== 1 ? "s" : ""})
                              </summary>
                              {assignedIds.map((hid) => {
                                const hh = hhHere.find((x) => x.id === hid);
                                if (!hh) return null;
                                const snap = sim.syncedSnapshot[hh.id];
                                return (
                                  <div key={hid} style={{ fontSize: "0.75rem", color: "var(--ink-soft)", margin: "3px 0" }}>
                                    <strong>{hh.id}</strong> ({hh.tankCapacityL}L) — water {(snap?.wPct ?? 0).toFixed(0)}% &middot; sewage{" "}
                                    {(snap?.sPct ?? 0).toFixed(0)}% &middot; potability {(snap?.pPct ?? 0).toFixed(0)}%
                                  </div>
                                );
                              })}
                            </details>
                          </div>
                        );
                      }
                      return (
                        <div key={idx} style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: 8 }}>
                          #{idx + 1}: idle at plant
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
        })}
      </div>

      <div style={{ flex: "1 1 40%", minWidth: 300, overflowY: "auto", minHeight: 0 }}>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Truck map — community</span>
          <br />
          <select
            value={mapCommunity}
            onChange={(e) => setMapCommunity(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            {COMMUNITY_NAMES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <h4 style={{ margin: "0 0 8px 0" }}>Live truck map — {mapCommunity}</h4>
        <div className="card">
          <TruckMap
            community={mapCommunity}
            waterTrucks={sim.waterTrucks[mapCommunity]}
            sewageTrucks={sim.sewageTrucks[mapCommunity]}
            householdsHere={sim.households.filter((h) => h.community === mapCommunity)}
            snapshot={sim.syncedSnapshot}
            now={sim.now}
          />
        </div>
      </div>
    </div>
  );

  const householdsTab: ReactNode = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <label>
          <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>Filter by community</span>
          <br />
          <select
            value={householdFilterCommunity}
            onChange={(e) => setHouseholdFilterCommunity(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            <option value="All">All communities</option>
            {COMMUNITY_NAMES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {sim.justSynced && (
          <FlashBadge flashKey={`synced-${sim.now}`}>
            <InfoPill>📡 Synced at {formatSimTime(sim.now)}</InfoPill>
          </FlashBadge>
        )}
        {sim.justSynced && <InfoIcon label="What just happened">Batch sync completed — household readings below just refreshed.</InfoIcon>}
      </div>

      {/* ---------------- Household status / community summary ---------------- */}
      {viewMode === "households" ? (
        <>
          <h4 style={{ margin: "0 0 8px 0", flexShrink: 0 }}>Household status</h4>
          <div style={{ flex: "1 1 auto", overflowY: "auto", minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
            {sim.households
              .filter((h) => householdFilterCommunity === "All" || h.community === householdFilterCommunity)
              .map((h) => {
              const snap = sim.syncedSnapshot[h.id];
              const worstVariant = snap?.worstVariant ?? "low";
              const residual = snap?.residual ?? 0;
              const wPct = snap?.wPct ?? 0;
              const sPct = snap?.sPct ?? 0;
              const pPct = snap?.pPct ?? 0;
              const beingServedWater = sim.waterTrucks[h.community].some(
                (t) => t.status === "en_route" && (t.target === h.id || t.batch.includes(h.id)),
              );
              const beingServedSewage = sim.sewageTrucks[h.community].some(
                (t) => t.status === "en_route" && (t.target === h.id || t.batch.includes(h.id)),
              );
              let statusLabel: string;
              let statusVariant: "low" | "medium" | "high" | "info";
              if (beingServedWater && beingServedSewage) {
                statusLabel = "🚚🚛 En route (water+sewage)";
                statusVariant = "info";
              } else if (beingServedWater) {
                statusLabel = "🚚 En route (water)";
                statusVariant = "info";
              } else if (beingServedSewage) {
                statusLabel = "🚛 En route (sewage)";
                statusVariant = "info";
              } else {
                statusLabel = worstVariant[0].toUpperCase() + worstVariant.slice(1);
                statusVariant = worstVariant;
              }
              return (
                <div key={h.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{h.id}</strong>
                    {statusVariant === "info" ? <InfoPill>{statusLabel}</InfoPill> : <Badge label={statusLabel} variant={statusVariant} />}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--ink-soft)", margin: "4px 0" }}>
                    {h.tankCapacityL}L tank &middot; {h.consumptionLpd.toFixed(0)} L/day &middot; sewage +{h.sewageFillRatePctPerDay.toFixed(1)}%/day
                  </div>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                    <TankSvg pctFull={wPct} variant={qualityStatus(residual).variant} label="Water" width={58} height={92} />
                    <TankSvg pctFull={sPct} variant={sewageStatus(sPct).variant} label="Sewage" width={58} height={92} />
                    <TankSvg pctFull={pPct} variant={qualityStatus(residual).variant} label="Potable" width={58} height={92} />
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </>
      ) : (
        <>
          <h4 style={{ margin: "0 0 8px 0", flexShrink: 0 }}>Community summary</h4>
          <div style={{ flex: "1 1 auto", overflowY: "auto", minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
            {COMMUNITY_NAMES.filter((c) => householdFilterCommunity === "All" || c === householdFilterCommunity).map((community) => {
              const hhHere = sim.households.filter((h) => h.community === community);
              const approachingSewage = hhHere.filter((h) => {
                const v = sim.syncedSnapshot[h.id]?.sewVariant;
                return v === "medium" || v === "high";
              }).length;
              const approachingWater = hhHere.filter((h) => {
                const v = sim.syncedSnapshot[h.id]?.waterVariant;
                return v === "medium" || v === "high";
              }).length;
              const avgConsumption = hhHere.reduce((a, h) => a + h.consumptionLpd, 0) / Math.max(hhHere.length, 1);
              const avgSewageRate = hhHere.reduce((a, h) => a + h.sewageFillRatePctPerDay, 0) / Math.max(hhHere.length, 1);
              return (
                <div key={community} className="card">
                  <strong>{community}</strong>
                  <p style={{ margin: "6px 0 0 0", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                    {hhHere.length} households
                    <br />
                    <Badge label={`${approachingSewage} approaching sewer need`} variant={approachingSewage ? "medium" : "low"} />
                    <br />
                    <Badge label={`${approachingWater} approaching water need`} variant={approachingWater ? "medium" : "low"} />
                    <br />
                    Avg consumption: {avgConsumption.toFixed(0)} L/day
                    <br />
                    Avg sewage fill rate: {avgSewageRate.toFixed(1)} %/day
                  </p>
                </div>
              );
            })}
          </div>
          </div>
        </>
      )}
    </div>
  );

  const eventsTab: ReactNode = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 8, flexShrink: 0 }}>
        <h4 style={{ margin: 0 }}>Event log ({sim.events.length})</h4>
        {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((t) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "var(--ink-soft)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: EVENT_TYPE_COLOR[t], display: "inline-block" }} />
            {EVENT_TYPE_LABEL[t]}
          </span>
        ))}
      </div>
      {/* Icon+color per row (by event.type) instead of a plain text dump —
          same "components not summaries" idiom as the rest of the app,
          applied to a log that was previously the one wall-of-text holdout. */}
      <div style={{ flex: "1 1 auto", overflowY: "auto", minHeight: 0 }}>
        {[...sim.events]
          .slice(-40)
          .reverse()
          .map((event) => (
            <div
              key={`${event.atMs}-${event.type}-${event.text}`}
              className="pg-event-row"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: "0.8rem",
                padding: "6px 4px",
                borderBottom: "1px solid var(--border)",
                borderLeft: `3px solid ${EVENT_TYPE_COLOR[event.type]}`,
              }}
            >
              <span aria-hidden="true" style={{ flexShrink: 0 }}>
                {EVENT_TYPE_ICON[event.type]}
              </span>
              <span>{event.text}</span>
            </div>
          ))}
      </div>
    </div>
  );

  if (typeof window !== "undefined" && (window as unknown as { __DEBUG_SURGE__?: boolean }).__DEBUG_SURGE__) {
     
    console.log("RENDER surge=", JSON.stringify(surge));
  }

  return (
    <SingleScreenPage>
      <PageHeader
        title="Simulation"
        subtitle="Fast-forward demo — 2 water-delivery trucks + 2 sewage-pump trucks per community, watch the algorithm work over simulated time"
      />

      {/* Persistent live-status strip — kept to ONE proof-of-life number
          (shown above the tabs regardless of which one is active) so it
          never competes for attention with tab-specific content. The
          household/backlog/sync counters that used to live here permanently
          on every tab are still real and still shown - just relocated into
          the Controls tab below, where the rest of the monitoring context
          already lives, instead of costing space on Trucks/Households/Event
          log too. */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
          padding: "6px 12px",
          marginBottom: 8,
          borderRadius: 10,
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <Metric label="Simulated time" value={formatSimDateTime(sim.now)} testId="metric-sim-time" />
      </div>

      {/* Proactive surge recommendation — see the detection effect above for
          the rule. Placed in this same persistent strip (not inside a tab)
          on purpose: a surge is exactly the kind of thing that shouldn't
          require the viewer to already be on "Trucks & map" or "Controls &
          drivers" to notice. Only rendered when a real surge is currently
          flagged, so it costs zero screen space the rest of the time. */}
      {surge && (
        <div
          data-testid="surge-banner"
          className="pg-badge-pulse"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: "6px 12px",
            marginBottom: 8,
            borderRadius: 10,
            background: "var(--danger-tint)",
            border: "1px solid var(--danger)",
          }}
        >
          <Badge label={`⚠ ${surge.community}: recommend +${surge.addN} driver${surge.addN !== 1 ? "s" : ""}`} variant="high" pulse={false} />
          <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
            {liveSurgeUrgent} household{liveSurgeUrgent !== 1 ? "s" : ""} need service at once, sustained over several ticks.
          </span>
          <InfoIcon label="How this recommendation is computed">
            Auto-detected: this community&apos;s urgent-household count (water + sewage combined — a real leading indicator of demand
            outstripping the fleet, weighted extra if any of them are a literal unassigned backlog) has stayed high for several
            consecutive ticks, or is climbing fast — not a one-tick blip a truck already en route would clear next tick. The +
            {surge.addN} figure re-runs the same fleet-sensitivity simulation as the &quot;how many drivers would actually help&quot;
            panel, over this community&apos;s actual current households, trying today&apos;s documented {surge.baseFleet}-truck fleet +1
            and +2, and picking the smallest addition that roughly halves projected household-days in a bad state.
          </InfoIcon>
        </div>
      )}

      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* The "start here" hint that used to sit here was a band-aid for a
            tab bar that had to compete with too much surrounding chrome for
            attention. With the status strip above cut to one number and the
            hint itself removed, the tab bar is now the first interactive
            thing on the page - it doesn't need a sign pointing at it. */}
        <div style={{ flex: "1 1 auto", minHeight: 0 }}>
          <SingleScreenTabs
            tabs={[
              { id: "controls", label: "Controls & drivers", content: controlsTab },
              { id: "trucks", label: "Trucks & map", content: trucksTab },
              { id: "households", label: "Households", content: householdsTab },
              { id: "events", label: "Event log", content: eventsTab },
            ]}
          />
        </div>
      </div>
    </SingleScreenPage>
  );
}

function buttonStyle(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 99,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--ink)",
    fontWeight: 600,
    cursor: "pointer",
  };
}
