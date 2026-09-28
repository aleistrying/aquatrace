"use client";

/**
 * Communities page — ported from pages/4_Communities.py. An overview across
 * all 4 communities: live ambient temp, aggregate household counts, a risk
 * breakdown per community, a household-level "does the truck need to
 * leave?" prediction view, and the fleet-capacity surge/shortfall check —
 * all driven by the SAME model.ts functions the rest of the app uses.
 *
 * Uses the shared householdStore (useHouseholds()) rather than calling
 * seedHouseholds() directly, so this page shows the same live household
 * list as Houses/Plant/Truck instead of an independently-reseeded copy.
 *
 * The real page's pydeck/deck.gl scatter maps are ported as plain inline
 * SVG scatter panels (per-community "does the truck need to leave" dots,
 * plus a compact 4-community overview map) rather than a literal map
 * widget — same content (every household, colored by worst current
 * status), simplest faithful visual for a non-pydeck stack.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import InfoIcon from "@/components/InfoIcon";
import TankSvg from "@/components/TankSvg";
import TruckIcon from "@/components/TruckIcon";
import { useHouseholds } from "@/lib/householdStore";
import { useNow } from "@/lib/useNow";
import {
  COMMUNITIES,
  REGION_NAME,
  REGION_COMMUNITY_COUNT,
  PER_CAPITA_LOW_LPD,
  PER_CAPITA_HIGH_LPD,
  FALLBACK_TEMP_C,
  fetchCurrentTempC,
  chlorineResidualNow,
  qualityStatus,
  sewageStatus,
  currentSewagePct,
  currentUsedL,
  predictedNeedsTruck,
  jitteredPosition,
  facilityPosition,
  worstVariant,
  RANK,
  type Household,
  type Variant,
} from "@/lib/model";

// ---------------------------------------------------------------------------
// Constants from delivery_comparison_fullscale.py that aren't in model.ts —
// reused here verbatim (not reinvented) for the fleet-capacity section, same
// as 4_Communities.py's own `import delivery_comparison_fullscale as dcf`.
// ---------------------------------------------------------------------------
const TRUCK_CAPACITY_L = 10_000; // dcf.TRUCK_CAPACITY_L
const ACTUAL_TRUCKS_PER_TYPE = 2; // matches pages/5_Simulation.py's _new_fleets()
const PEOPLE_PER_HOUSEHOLD = 4.0; // dcf.PEOPLE_PER_HOUSEHOLD
const TRUCK_SPEED_KMH = 20.0; // dcf.TRUCK_SPEED_KMH
const ROAD_DETOUR_FACTOR = 1.3; // dcf.ROAD_DETOUR_FACTOR
const ONSITE_SERVICE_MINUTES = 25.0; // dcf.ONSITE_SERVICE_MINUTES
const TURNAROUND_MINUTES = 27.0; // dcf.TURNAROUND_MINUTES

function realscaleHouseholdCount(population: number): number {
  return Math.max(1, Math.round(population / PEOPLE_PER_HOUSEHOLD));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371.0;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlmb = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlmb / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** dcf.trip_duration_for, extra_stops=0 — same round-trip cycle-time model. */
function tripDurationMinutesFor(community: string, householdId: string): number {
  const coords = COMMUNITIES[community];
  const [fLat, fLon] = facilityPosition(community);
  const [hLat, hLon] = jitteredPosition(householdId, coords.lat, coords.lon);
  const oneWayKm = haversineKm(fLat, fLon, hLat, hLon) * ROAD_DETOUR_FACTOR;
  const travelMinutes = (oneWayKm / TRUCK_SPEED_KMH) * 60 * 2;
  return travelMinutes + ONSITE_SERVICE_MINUTES + TURNAROUND_MINUTES;
}

/** Same has_auto_sensor / manual_alert fallback mapping as 4_Communities.py. */
function waterQualityVariant(h: Household, tempC: number, now: number): Variant {
  if (h.hasAutoSensor) {
    return qualityStatus(chlorineResidualNow(h, tempC, now)).variant;
  }
  const map: Record<string, Variant> = {
    "All good": "low",
    "Tank getting low": "medium",
    "Something's wrong": "high",
  };
  return h.manualAlert ? map[h.manualAlert] ?? "medium" : "medium";
}

const VARIANT_COLOR: Record<Variant, string> = {
  low: "var(--green)",
  medium: "var(--gold)",
  high: "var(--danger)",
};

const VARIANT_TOOLTIP: Record<Variant, string> = {
  high: "At least one household needs a truck now — see the list below.",
  medium: "At least one household is approaching a threshold — worth checking soon.",
  low: "No households in this community currently need urgent action.",
};

// Global (all-4-communities) lat/lon -> SVG projection for the compact
// overview map. Illustrative only — same "positions simulated, not
// individually geotagged" honesty framing as the Python page.
const OVERVIEW_SIZE = 320;
const OVERVIEW_PAD = 34;
const communityCoordList = Object.values(COMMUNITIES);
const MIN_LAT = Math.min(...communityCoordList.map((c) => c.lat)) - 0.4;
const MAX_LAT = Math.max(...communityCoordList.map((c) => c.lat)) + 0.4;
const MIN_LON = Math.min(...communityCoordList.map((c) => c.lon)) - 0.4;
const MAX_LON = Math.max(...communityCoordList.map((c) => c.lon)) + 0.4;

function projectOverview(lat: number, lon: number): [number, number] {
  const x = OVERVIEW_PAD + ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * (OVERVIEW_SIZE - 2 * OVERVIEW_PAD);
  const y = OVERVIEW_PAD + ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (OVERVIEW_SIZE - 2 * OVERVIEW_PAD);
  return [x, y];
}

// Local (per-community) projection for the household-level scatter panels —
// centers on the community and renders household jitter (0.3-1.5km radius)
// at a scale where individual dots are actually distinguishable, unlike a
// single all-communities map which would collapse each community's cluster
// to a single indistinguishable smear at that zoom.
const LOCAL_SIZE = 170;
const PX_PER_KM = 42;

function projectLocal(lat: number, lon: number, centerLat: number, centerLon: number): [number, number] {
  const dLatKm = (lat - centerLat) * 111.0;
  const dLonKm = (lon - centerLon) * 111.0 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.1);
  const x = LOCAL_SIZE / 2 + dLonKm * PX_PER_KM;
  const y = LOCAL_SIZE / 2 - dLatKm * PX_PER_KM;
  return [x, y];
}

const noopSubscribe = () => () => {};

/**
 * True only once the client has mounted — no-op subscribe + a snapshot that
 * differs between server (`false`) and client (`true`), the idiomatic
 * setState-free way to gate hydration-unsafe content (see useSyncExternalStore
 * docs). Needed because households/now/temps are all wall-clock-dependent
 * (useHouseholds seeds off Date.now() at module load, useNow snapshots
 * Date.now() at first render) — the server-rendered pass and the browser's
 * first render happen at genuinely different instants, so any text derived
 * from them would otherwise mismatch during hydration.
 */
function useHasMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function InfoBadge({ label, title }: { label: string; title: string }) {
  return (
    <span className="badge" title={title} style={{ background: "var(--teal-tint)", color: "var(--teal)" }}>
      {label}
    </span>
  );
}

/** Trucks "have" vs. trucks "still need", as a row of truck pictograms
 * instead of a sentence of numbers — a solid truck per truck actually on the
 * roster, then a dashed/outlined "ghost" truck per truck short of what's
 * needed, so the shortfall is visible at a glance instead of requiring the
 * reader to do (needed - have) themselves. */
function FleetIconRow({ label, have, needed, color }: { label: string; have: number; needed: number; color: string }) {
  const shortfall = Math.max(needed - have, 0);
  const total = have + shortfall;
  const step = 24;
  const width = Math.max(step, total * step);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
      <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)", minWidth: 58 }}>{label}</span>
      <svg
        width={width}
        height={22}
        viewBox={`0 0 ${width} 22`}
        role="img"
        aria-label={`${label}: ${have} truck(s) on hand, ${shortfall > 0 ? `${shortfall} more needed` : "enough for today's demand"}`}
      >
        {Array.from({ length: have }).map((_, i) => (
          <TruckIcon key={`have-${i}`} x={12 + i * step} y={11} scale={1.35} color={color} />
        ))}
        {Array.from({ length: shortfall }).map((_, i) => (
          <TruckIcon key={`short-${i}`} x={12 + (have + i) * step} y={11} scale={1.35} color="var(--danger)" outline />
        ))}
      </svg>
      {shortfall > 0 && (
        <span style={{ fontSize: "0.76rem", color: "var(--danger)", fontWeight: 700 }}>+{shortfall} short</span>
      )}
    </div>
  );
}

export default function CommunitiesPage() {
  const households = useHouseholds();
  const now = useNow(15_000);

  const communityNames = Object.keys(COMMUNITIES);
  const [temps, setTemps] = useState<Record<string, { tempC: number; source: string }>>(() =>
    Object.fromEntries(communityNames.map((name) => [name, { tempC: FALLBACK_TEMP_C, source: "loading…" }])),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        Object.entries(COMMUNITIES).map(
          async ([name, c]) => [name, await fetchCurrentTempC(c.lat, c.lon)] as const,
        ),
      );
      if (!cancelled) setTemps(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mounted = useHasMounted();

  if (!mounted) {
    return (
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 20px 60px" }}>
        <PageHeader
          title="Communities"
          subtitle={`${REGION_NAME} region has ${REGION_COMMUNITY_COUNT} communities in total — this demo covers 4`}
        />
      </main>
    );
  }

  const rows = communityNames.map((name) => {
    const coords = COMMUNITIES[name];
    const tempC = temps[name].tempC;
    const hhHere = households.filter((h) => h.community === name);
    let worst: Variant = "low";
    const counts: Record<Variant, number> = { low: 0, medium: 0, high: 0 };
    for (const h of hhHere) {
      const waterV = waterQualityVariant(h, tempC, now);
      const sewV = sewageStatus(currentSewagePct(h, now)).variant;
      const hWorst = worstVariant(waterV, sewV);
      counts[hWorst] += 1;
      worst = worstVariant(worst, hWorst);
    }
    return {
      name,
      coords,
      tempC,
      hhHere,
      worst,
      counts,
      estLow: coords.population * PER_CAPITA_LOW_LPD,
      estHigh: coords.population * PER_CAPITA_HIGH_LPD,
    };
  });

  const needsTruckSoon = households
    .filter((h) => predictedNeedsTruck(h, temps[h.community].tempC, now))
    .map((h) => h.id);

  const fleetRows = rows.map(({ name, coords, hhHere }) => {
    const realHhCount = realscaleHouseholdCount(coords.population);
    const scale = hhHere.length > 0 ? realHhCount / hhHere.length : 0;
    const waterDemandL = hhHere.reduce((sum, h) => sum + currentUsedL(h, now), 0) * scale;
    const sewageDemandL =
      hhHere.reduce((sum, h) => sum + (currentSewagePct(h, now) / 100) * h.tankCapacityL, 0) * scale;
    const avgTripMinutes =
      hhHere.length > 0
        ? hhHere.reduce((sum, h) => sum + tripDurationMinutesFor(name, h.id), 0) / hhHere.length
        : 0;
    const tripsPerTruckPerDay = avgTripMinutes > 0 ? (24 * 60) / avgTripMinutes : 0;
    const calc = (demandL: number) => {
      const truckloads = Math.ceil(demandL / TRUCK_CAPACITY_L);
      const trucksNeeded = truckloads && tripsPerTruckPerDay > 0 ? Math.ceil(truckloads / tripsPerTruckPerDay) : 0;
      const shortfall = Math.max(trucksNeeded - ACTUAL_TRUCKS_PER_TYPE, 0);
      return { truckloads, trucksNeeded, shortfall };
    };
    return {
      name,
      waterDemandL,
      sewageDemandL,
      tripsPerTruckPerDay,
      water: calc(waterDemandL),
      sewage: calc(sewageDemandL),
    };
  });

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 20px 60px" }}>
      <PageHeader
        title="Communities"
        subtitle={`${REGION_NAME} region has ${REGION_COMMUNITY_COUNT} communities in total — this demo covers 4`}
      />

      <div
        className="card"
        style={{ marginBottom: 18, background: "var(--gold-tint)", borderColor: "var(--gold)" }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
          <Badge
            label="Red = predicted (~1 day ahead)"
            variant="high"
            title="Household predicted to need a truck within about 1 day, based on its current usage trend."
          />
          <InfoBadge
            label="Already empty → Houses page"
            title="Households already out of water show as an empty tank on the Houses page, not as a red dot here."
          />
          <InfoIcon label="About these map positions">
            Positions are simulated within each community, not individually geotagged.
          </InfoIcon>
        </div>
      </div>

      <h2 className="eyebrow" style={{ marginTop: 0 }}>Household prediction map — does the truck need to leave?</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 10,
        }}
      >
        {rows.map(({ name, coords, hhHere, tempC }) => {
          const points = hhHere.map((h) => {
            const [hlat, hlon] = jitteredPosition(h.id, coords.lat, coords.lon);
            const [x, y] = projectLocal(hlat, hlon, coords.lat, coords.lon);
            return { id: h.id, predicted: predictedNeedsTruck(h, tempC, now), x, y };
          });
          const redCount = points.filter((p) => p.predicted).length;
          return (
            <div key={name} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <strong style={{ fontSize: "0.88rem" }}>{name}</strong>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>{redCount}/{points.length} soon</span>
              </div>
              <svg viewBox={`0 0 ${LOCAL_SIZE} ${LOCAL_SIZE}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`Household predictions for ${name}`}>
                <rect x={0} y={0} width={LOCAL_SIZE} height={LOCAL_SIZE} rx={10} style={{ fill: "var(--surface-raised)" }} />
                {points.map((p) => (
                  <g key={p.id}>
                    {p.predicted && (
                      <>
                        <circle className="pg-sonar-ring a" cx={p.x} cy={p.y} r={5} />
                        <circle className="pg-sonar-ring b" cx={p.x} cy={p.y} r={5} />
                      </>
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={4}
                      style={{ fill: p.predicted ? "var(--danger)" : "var(--green)" }}
                    >
                      <title>{`${p.id}${p.predicted ? " — predicted to need a truck within ~1 day" : " — OK"}`}</title>
                    </circle>
                  </g>
                ))}
              </svg>
            </div>
          );
        })}
      </div>

      {needsTruckSoon.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "6px 0 22px" }}>
          <Badge
            label={`${needsTruckSoon.length} need the truck within ~1 day`}
            variant="high"
            title="Predicted from each household's current water-use and sewage-fill rate — see the Houses page for individual detail."
          />
          <span style={{ color: "var(--ink-soft)", fontSize: "0.82rem" }}>
            {needsTruckSoon.slice(0, 6).join(", ")}
            {needsTruckSoon.length > 6 ? ` · +${needsTruckSoon.length - 6} more` : ""}
          </span>
        </div>
      ) : (
        <div style={{ margin: "6px 0 22px" }}>
          <Badge label="No trucks needed within ~1 day" variant="low" />
        </div>
      )}

      <h2 className="eyebrow">
        Community overview map
        <InfoIcon label="How to read this map">
          Marker size = population, colour = worst current household status in that community.
        </InfoIcon>
      </h2>
      <div className="card" style={{ marginBottom: 22, display: "flex", justifyContent: "center" }}>
        <svg viewBox={`0 0 ${OVERVIEW_SIZE} ${OVERVIEW_SIZE}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label="Community overview map">
          {rows.map(({ name, coords, worst }) => {
            const [x, y] = projectOverview(coords.lat, coords.lon);
            const r = Math.max(10, Math.sqrt(coords.population) / 2.4);
            return (
              <g key={name}>
                <circle cx={x} cy={y} r={r} style={{ fill: VARIANT_COLOR[worst], opacity: 0.85 }}>
                  <title>{`${name} — population ~${coords.population.toLocaleString()}, worst status: ${worst}`}</title>
                </circle>
                <text x={x} y={y + r + 14} textAnchor="middle" style={{ fontSize: 11, fill: "var(--ink)" }}>
                  {name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <h2 className="eyebrow">Community summary</h2>
      <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        {rows.map(({ name, coords, hhHere, worst, counts, tempC, estLow, estHigh }) => (
          <div key={name} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <strong style={{ fontSize: "1.15rem" }}>{name}</strong>
              <span className={worst === "high" ? "pg-badge-pulse" : undefined}>
                <Badge label={worst[0].toUpperCase() + worst.slice(1)} variant={worst} title={VARIANT_TOOLTIP[worst]} />
              </span>
            </div>
            <p style={{ margin: "6px 0 0 0", color: "var(--ink-soft)", fontSize: "0.86rem" }}>
              Population ~{coords.population.toLocaleString()} · {hhHere.length} household(s) monitored in this demo ·{" "}
              {tempC.toFixed(1)}°C
              <span className="pg-live-dot" title="Live ambient temperature reading" />
              {" "}· est. daily water use {estLow.toLocaleString()}–{estHigh.toLocaleString()} L
            </p>

            {/* Full risk distribution across every monitored household — not
                just the single worst-case badge above, so a community with
                one bad house and 20 fine ones reads differently from one
                where most houses are struggling. */}
            <div
              style={{ display: "flex", height: 9, borderRadius: 99, overflow: "hidden", background: "var(--surface-raised)", marginTop: 10 }}
              title={`${counts.high} needing a truck now · ${counts.medium} approaching a threshold · ${counts.low} OK`}
            >
              {(["high", "medium", "low"] as Variant[])
                .filter((v) => counts[v] > 0)
                .map((v) => (
                  <div key={v} style={{ width: `${(counts[v] / Math.max(1, hhHere.length)) * 100}%`, background: VARIANT_COLOR[v] }} />
                ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: "0.76rem", color: "var(--ink-soft)", flexWrap: "wrap" }}>
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--danger)", marginRight: 5 }} />
                {counts.high} urgent
              </span>
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--gold)", marginRight: 5 }} />
                {counts.medium} watch
              </span>
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--green)", marginRight: 5 }} />
                {counts.low} OK
              </span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="eyebrow" style={{ marginBottom: 14 }}>
        Household water &amp; sewage levels, by community
        <InfoIcon label="How these are sorted">
          Highest-risk households first — grouped so it&rsquo;s clear which community actually needs a truck, not just
          which single house.
        </InfoIcon>
      </h2>
      <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        {rows.map(({ name, hhHere, tempC }) => {
          const communityNeedsTruck =
            hhHere.some((h) => predictedNeedsTruck(h, tempC, now)) ||
            hhHere.some((h) => currentSewagePct(h, now) >= 90);

          const detailRows = hhHere
            .map((h) => {
              const usedL = currentUsedL(h, now);
              const waterRemainingPct = 100 * (1 - usedL / h.tankCapacityL);
              const waterVariant = waterQualityVariant(h, tempC, now);
              const sewagePct = currentSewagePct(h, now);
              const sewVariant = sewageStatus(sewagePct).variant;
              const urgency =
                Math.max(RANK[waterVariant], RANK[sewVariant]) * 1000 + (100 - waterRemainingPct) + sewagePct;
              return { h, waterRemainingPct, waterVariant, sewagePct, sewVariant, urgency };
            })
            .sort((a, b) => b.urgency - a.urgency);

          const shown = detailRows.slice(0, 8);

          return (
            <details key={name} className="card" open={communityNeedsTruck}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                {name} — {communityNeedsTruck ? "🚨 needs a truck soon" : "no truck needed right now"}
              </summary>
              {detailRows.length > shown.length && (
                <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)", margin: "8px 0 0" }}>
                  Showing the {shown.length} highest-risk households of {detailRows.length} in {name}.
                </p>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 12,
                  marginTop: 10,
                }}
              >
                {shown.map(({ h, waterRemainingPct, waterVariant, sewagePct, sewVariant }) => (
                  <div key={h.id} style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                      {h.id} ({h.householdSize} people)
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <TankSvg pctFull={waterRemainingPct} variant={waterVariant} label="Water" width={64} height={100} />
                      <TankSvg pctFull={sewagePct} variant={sewVariant} label="Sewage" width={64} height={100} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <h2 className="eyebrow" style={{ marginBottom: 14 }}>
        Fleet capacity — surge / shortfall check
        <InfoIcon label="The operational question">
          How many truckloads does each community need RIGHT NOW to refill every household&rsquo;s water and pump out
          every sewage tank, how many trucks does that take, and how does that compare to the 2 water + 2 sewage
          trucks each community actually runs?
        </InfoIcon>
      </h2>
      <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
        {fleetRows.map((r) => (
          <div key={r.name} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <strong style={{ fontSize: "1.05rem" }}>{r.name}</strong>
                <InfoIcon label="How these numbers are calculated">
                  Water: {r.waterDemandL.toLocaleString(undefined, { maximumFractionDigits: 0 })} L needed now →{" "}
                  {r.water.truckloads} load(s) ÷ ~{r.tripsPerTruckPerDay.toFixed(1)} trips/truck/day →{" "}
                  {r.water.trucksNeeded} truck(s) needed (have {ACTUAL_TRUCKS_PER_TYPE}). Sewage:{" "}
                  {r.sewageDemandL.toLocaleString(undefined, { maximumFractionDigits: 0 })} L needing pump-out →{" "}
                  {r.sewage.truckloads} load(s) → {r.sewage.trucksNeeded} truck(s) needed (have {ACTUAL_TRUCKS_PER_TYPE}).
                </InfoIcon>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Badge
                  label={r.water.shortfall > 0 ? `Water: short ${r.water.shortfall} truck(s)` : "Water: sufficient"}
                  variant={r.water.shortfall > 0 ? "high" : "low"}
                  title={
                    r.water.shortfall > 0
                      ? `Needs ${r.water.shortfall} more water truck(s) than the ${ACTUAL_TRUCKS_PER_TYPE} on hand to clear today's demand.`
                      : `The ${ACTUAL_TRUCKS_PER_TYPE} water trucks on hand can cover today's demand.`
                  }
                />
                <Badge
                  label={r.sewage.shortfall > 0 ? `Sewage: short ${r.sewage.shortfall} truck(s)` : "Sewage: sufficient"}
                  variant={r.sewage.shortfall > 0 ? "high" : "low"}
                  title={
                    r.sewage.shortfall > 0
                      ? `Needs ${r.sewage.shortfall} more sewage truck(s) than the ${ACTUAL_TRUCKS_PER_TYPE} on hand to clear today's demand.`
                      : `The ${ACTUAL_TRUCKS_PER_TYPE} sewage trucks on hand can cover today's demand.`
                  }
                />
              </div>
            </div>

            <FleetIconRow label="Water" have={ACTUAL_TRUCKS_PER_TYPE} needed={r.water.trucksNeeded} color="var(--teal)" />
            <FleetIconRow label="Sewage" have={ACTUAL_TRUCKS_PER_TYPE} needed={r.sewage.trucksNeeded} color="var(--gold)" />
          </div>
        ))}
      </div>

      <details className="card" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>How the fleet-capacity numbers are calculated</summary>
        <ul style={{ fontSize: "0.84rem", color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 10 }}>
          <li>
            <strong>Demand</strong>: for every monitored household, how many liters it would take to top its water
            tank back to full right now (<code>currentUsedL</code>), or how many liters are already sitting in its
            sewage tank waiting to be pumped (<code>currentSewagePct% × tankCapacityL</code>) — summed across the
            community, then scaled from this demo&rsquo;s household SAMPLE up to the real household count for that
            community&rsquo;s population.
          </li>
          <li>
            <strong>Truck capacity</strong>: ~{TRUCK_CAPACITY_L.toLocaleString()} L/load — the same figure
            delivery_comparison_fullscale.py uses to volume-cap a batch.
          </li>
          <li>
            <strong>Truckloads needed</strong>: <code>ceil(total_demand_liters / truck_capacity_liters)</code>.
          </li>
          <li>
            <strong>Trips/truck/day</strong>: derived from the same mechanistic round-trip model — travel there and
            back at {TRUCK_SPEED_KMH.toFixed(0)} km/h with a {ROAD_DETOUR_FACTOR}x road-detour factor, plus{" "}
            {ONSITE_SERVICE_MINUTES.toFixed(0)} min on-site service and {TURNAROUND_MINUTES.toFixed(0)} min facility
            turnaround per trip — averaged per community rather than a flat number.
          </li>
          <li>
            <strong>Trucks needed</strong>: <code>ceil(truckloads_needed / trips_per_truck_per_day)</code>, compared
            against the actual {ACTUAL_TRUCKS_PER_TYPE} trucks of that type this community&rsquo;s fleet runs to get
            the shortfall.
          </li>
          <li>
            This is a ceiling-division fleet-sizing estimate (related to the capacitated Inventory Routing Problem in
            the OR literature), not a full vehicle-routing solve — multi-truck scheduling conflicts (two trucks
            needed at the same moment, etc.) aren&rsquo;t modeled here.
          </li>
        </ul>
      </details>

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          About the other {REGION_COMMUNITY_COUNT - communityNames.length} {REGION_NAME} communities
        </summary>
        <p style={{ fontSize: "0.86rem", color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.6 }}>
          {REGION_NAME} is a region of {REGION_COMMUNITY_COUNT} communities across northern Quebec (e.g. Kuujjuaq,
          Salluit, Akulivik, Aupaluk, Kangiqsualujjuaq, and others), each a separate fly-in/sealift-only hamlet with
          its own treatment facility and truck-based delivery. This prototype demonstrates 4 of the 14 to keep the
          demo scope realistic for a 3-hour build — the same architecture (plant → truck/radio → house sensors →
          this dashboard) is designed to extend to all 14 without redesign, since nothing here is specific to any one
          community&rsquo;s geography.
        </p>
      </details>
    </main>
  );
}
