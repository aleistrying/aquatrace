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

const COMMUNITY_NAMES = Object.keys(COMMUNITIES);

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  dispatch: "🚚🚛 dispatch",
  arrival: "✅ arrival/delivery",
  delay: "📻 delay",
  sync: "📡 batch sync",
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
          px = facilityPt.x + (targetPt.x - facilityPt.x) * frac;
          py = facilityPt.y + (targetPt.y - facilityPt.y) * frac;
          angleDeg = (Math.atan2(targetPt.y - facilityPt.y, targetPt.x - facilityPt.x) * 180) / Math.PI;

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
              strokeOpacity={0.8}
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
                ? `en route to ${truck.target}${truck.batch.length ? ` (+${truck.batch.length} nearby)` : ""} — ${Math.round(
                    frac * 100,
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

  const doReset = useCallback(() => {
    simRef.current = createInitialSimState();
    setStepCount(0);
    setLastStepEvents([]);
    setFfWarning(null);
    setSim({ ...simRef.current });
  }, []);

  const driverNeed = useMemo(() => computeDriverNeed(sim, temps), [sim, temps]);
  const totalBacklog = useMemo(
    () => COMMUNITY_NAMES.reduce((acc, c) => acc + driverNeed[c].water.backlog + driverNeed[c].sewage.backlog, 0),
    [driverNeed],
  );

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

  return (
    <main style={{ padding: "20px", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        title="Simulation"
        subtitle="Fast-forward demo — 2 water-delivery trucks + 2 sewage-pump trucks per community, watch the algorithm work over simulated time"
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <InfoPill>Isolated demo clock</InfoPill>
        <InfoIcon label="Why this clock is separate">
          Separate households, sped-up time — same math as every other page.
        </InfoIcon>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <MiniStat value="~2 wks" label="blind rotation to reach everyone" color="var(--gold)" />
        <InfoIcon label="Why refills are slow today">
          No per-house data means a truck visits blind — about 2 weeks to reach everyone once. Real measurement lets
          the same trucks prioritize who actually needs it.
        </InfoIcon>
      </div>

      {/* ---------------- Measured comparison ---------------- */}
      <details className="card" style={{ marginBottom: 16 }}>
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
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <h4 style={{ margin: 0 }}>🚚 How many drivers would actually help?</h4>
          <InfoIcon label="About this section">
            The real simulation, re-run with a different fleet size. &quot;Documented&quot; is Inukjuak&apos;s cited 3-truck fleet.
          </InfoIcon>
        </div>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>Community</span>
          <br />
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

        {!sensitivity || chosenDrivers === null ? (
          <p style={{ color: "var(--ink-soft)" }}>Modeling different driver counts for this community…</p>
        ) : (
          <>
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>What if this community had this many drivers/trucks?</span>
              <br />
              <input
                type="range"
                min={driverOptions[0]}
                max={driverOptions[driverOptions.length - 1]}
                step={1}
                value={chosenDrivers}
                onChange={(e) => setChosenDrivers(Number(e.target.value))}
                style={{ width: "100%", maxWidth: 320 }}
              />
              <span style={{ marginLeft: 8, fontWeight: 700 }}>{chosenDrivers}</span>
            </label>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <Badge label={`📈 +${chosenDrivers - documentedFleet} driver(s) scenario`} variant="low" />
                <InfoIcon label="What this scenario means">
                  If {chosenDrivers - documentedFleet} more driver(s)/truck(s) become available for {fleetCommunity}, the same
                  dispatch logic runs faster immediately — no code change, just a fleet-size update. If not, {fleetCommunity} still
                  runs today on its documented {documentedFleet}.
                </InfoIcon>
              </div>
            ) : chosenDrivers < documentedFleet ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <Badge label="Reference only — below today's fleet" variant="medium" />
                <InfoIcon label="Why this is reference only">
                  Shown for reference only — {fleetCommunity} is not proposed to lose a driver.
                </InfoIcon>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
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
      <div className="card" style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 20 }}>
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

        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
          Sim minutes / tick: <strong>{minutesPerTick}</strong>
          <input type="range" min={2} max={90} value={minutesPerTick} onChange={(e) => setMinutesPerTick(Number(e.target.value))} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
          Batch sync every (sim min): <strong>{batchSyncMinutes}</strong>
          <input
            type="range"
            min={15}
            max={120}
            step={15}
            value={batchSyncMinutes}
            onChange={(e) => setBatchSyncMinutes(Number(e.target.value))}
          />
        </label>

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

      <label style={{ display: "block", marginBottom: 16 }}>
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

      {/* ---------------- Manual step-through controls ---------------- */}
      {mode === "manual" && (
        <div className="card" style={{ marginBottom: 16 }}>
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

      {/* ---------------- Live state ---------------- */}
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Metric label="Simulated time" value={formatSimDateTime(sim.now)} testId="metric-sim-time" />
        <Metric label="Households filled/emptied so far" value={sim.totalServiced} />
        <Metric
          label="🚚 Extra drivers needed right now"
          value={<BacklogFlashValue value={totalBacklog} />}
          help="Households currently urgent (water or sewage) that no truck is already heading to, across all 4 communities — 0 means the current fleet is keeping up with every urgent household this instant."
        />
      </div>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <Metric label="📡 Last synced" value={`${minutesSinceSync.toFixed(0)} min ago`} help={`Simulated time of last batch sync: ${formatSimDateTime(sim.lastSync)}`} />
        <Metric label="Next batch sync in" value={`${minutesUntilSync.toFixed(0)} min`} />
        <InfoIcon label="How syncing works in real deployment">
          Real deployment: data batches whenever a connection is available (at the plant, at a house, or via a radio check-in) — not
          continuous live telemetry, since trucks have no signal in transit.
        </InfoIcon>
      </div>
      {sim.justSynced && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <FlashBadge flashKey={`synced-${sim.now}`}>
            <InfoPill>📡 Synced at {formatSimTime(sim.now)}</InfoPill>
          </FlashBadge>
          <InfoIcon label="What just happened">Batch sync completed — household readings below just refreshed.</InfoIcon>
        </div>
      )}

      {/* ---------------- Trucks right now ---------------- */}
      <h4 style={{ margin: "18px 0 6px 0" }}>Trucks right now</h4>
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

        function needBadge(need: typeof wNeed, icon: string, label: string) {
          const flashKey = `${community}-${label}-${need.backlog}-${need.urgent}-${need.active}-${need.idle}`;
          let inner: ReactNode;
          if (need.backlog > 0) {
            inner = (
              <Badge
                label={`${icon} ${label}: ${need.active}/${need.fleetSize} out — ${need.backlog} more driver${need.backlog !== 1 ? "s" : ""} would help right now`}
                variant="high"
                pulse={false}
              />
            );
          } else if (need.urgent > 0) {
            inner = <Badge label={`${icon} ${label}: ${need.active}/${need.fleetSize} out — called, fleet keeping up`} variant="medium" pulse={false} />;
          } else if (need.active > 0) {
            inner = <InfoPill>{`${icon} ${label}: ${need.active}/${need.fleetSize} out — finishing prior trips`}</InfoPill>;
          } else {
            inner = <Badge label={`${icon} ${label}: currently no drivers needed — fleet idle at plant`} variant="low" pulse={false} />;
          }
          return <FlashBadge flashKey={flashKey}>{inner}</FlashBadge>;
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

      {/* ---------------- Truck map ---------------- */}
      <h4 style={{ margin: "18px 0 8px 0" }}>Live truck map — {mapCommunity}</h4>
      <div className="card" style={{ marginBottom: 16 }}>
        <TruckMap
          community={mapCommunity}
          waterTrucks={sim.waterTrucks[mapCommunity]}
          sewageTrucks={sim.sewageTrucks[mapCommunity]}
          householdsHere={sim.households.filter((h) => h.community === mapCommunity)}
          snapshot={sim.syncedSnapshot}
          now={sim.now}
        />
      </div>

      {/* ---------------- Household status / community summary ---------------- */}
      {viewMode === "households" ? (
        <>
          <h4 style={{ margin: "18px 0 8px 0" }}>Household status</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
            {sim.households.map((h) => {
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
        </>
      ) : (
        <>
          <h4 style={{ margin: "18px 0 8px 0" }}>Community summary</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
            {COMMUNITY_NAMES.map((community) => {
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
        </>
      )}

      {/* ---------------- Event log ---------------- */}
      <details className="card" style={{ marginBottom: 40 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Event log ({sim.events.length})</summary>
        <div style={{ marginTop: 10, maxHeight: 360, overflowY: "auto" }}>
          {[...sim.events]
            .slice(-40)
            .reverse()
            .map((event) => (
              <div
                key={`${event.atMs}-${event.type}-${event.text}`}
                className="pg-event-row"
                style={{ fontSize: "0.8rem", padding: "4px 0", borderBottom: "1px solid var(--border)" }}
              >
                {event.text}
              </div>
            ))}
        </div>
      </details>
    </main>
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
