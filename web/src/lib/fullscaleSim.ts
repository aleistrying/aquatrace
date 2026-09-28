/**
 * Ported from the real Python app's delivery_comparison.py (small seeded-
 * sample comparison) and delivery_comparison_fullscale.py (real community-
 * scale comparison + fleet-size sensitivity). Every constant/formula below
 * is copied from those two files — the "measured: blind rotation vs.
 * predictive+batch" expander and the "how many drivers would actually
 * help" what-if slider on the Simulation page both run the ACTUAL ported
 * simulation here, not precomputed/mocked numbers.
 *
 * Not bit-identical to the Python runs (this uses a JS seeded PRNG, not
 * CPython's Mersenne Twister — see model.ts's file-header note, same
 * caveat applies here), but same distributions/shapes/thresholds/decision
 * rules, faithfully re-derived from the source.
 */

import {
  COMMUNITIES,
  TANK_SIZES_L,
  PER_CAPITA_LOW_LPD,
  PER_CAPITA_HIGH_LPD,
  RANK,
  type Household,
  type Variant,
  chlorineResidualNow,
  qualityStatus,
  waterQuantityStatus,
  currentSewagePct,
  sewageStatus,
  currentUsedL,
  predictedNeedsTruck,
  facilityPosition,
  jitteredPosition,
} from "./model";

// ---------------------------------------------------------------------------
// Shared seeded PRNG (own copy — model.ts's mulberry32/weightedChoice are
// module-private, not exported; duplicated here rather than touching model.ts)
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedChoice<T>(rng: () => number, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function cloneHouseholds(households: Household[]): Household[] {
  return households.map((h) => ({ ...h }));
}

/** Worst-of(chlorine quality, water quantity, sewage fill) — the single
 * "how bad is this household right now" summary used to score both
 * comparison strategies. Same logic as delivery_comparison.py's
 * worst_variant() / the Simulation page's _worst_variant(). */
export function worstVariantForHousehold(h: Household, tempC: number, now: number): Variant {
  const residual = chlorineResidualNow(h, tempC, now);
  let waterVariant = qualityStatus(residual).variant;
  const qtyVariant = waterQuantityStatus(100 * (1 - currentUsedL(h, now) / h.tankCapacityL)).variant;
  if (RANK[qtyVariant] > RANK[waterVariant]) waterVariant = qtyVariant;
  const sewVariant = sewageStatus(currentSewagePct(h, now)).variant;
  return RANK[waterVariant] >= RANK[sewVariant] ? waterVariant : sewVariant;
}

// =============================================================================
// Small-scale comparison — ports delivery_comparison.py's run_strategy():
// SAME seeded household sample (model.ts's seedHouseholds), one truck per
// community, flat 45-min trip duration for both strategies.
// =============================================================================
const SMALL_TRIP_DURATION_MS = 45 * 60_000;
const SMALL_CLOSE_ENOUGH: ReadonlySet<Variant> = new Set(["medium", "high"]);
const SMALL_TICK_MINUTES = 30;
const SMALL_MAX_SIM_DAYS = 60;
const SMALL_BREAKDOWN_CHANCE_PER_TICK = 0.02;
const SMALL_DELAY_EXTENSION_MS = 75 * 60_000;
const SMALL_DELAY_SEED = 20260926;

interface SmallTruckState {
  status: "idle" | "en_route";
  target: string | null;
  tripStart: number | null;
  tripDuration: number | null;
  batch: string[];
  delayed: boolean;
}

export interface SmallScaleResult {
  coverageDay: Record<string, number | null>;
  badStateDays: Record<string, number>;
}

export function runStrategySmallScale(
  strategy: "baseline" | "optimized",
  households: Household[],
  startNow: number,
  temps: Record<string, number>,
): SmallScaleResult {
  const hh = cloneHouseholds(households);
  const byCommunity: Record<string, Household[]> = {};
  for (const h of hh) (byCommunity[h.community] ??= []).push(h);

  const trucks: Record<string, SmallTruckState> = {};
  const rrOrder: Record<string, Household[]> = {};
  const rrIndex: Record<string, number> = {};
  for (const [community, hhHere] of Object.entries(byCommunity)) {
    trucks[community] = { status: "idle", target: null, tripStart: null, tripDuration: null, batch: [], delayed: false };
    rrOrder[community] = [...hhHere].sort((a, b) => a.id.localeCompare(b.id));
    rrIndex[community] = 0;
  }

  const servicedEver: Record<string, Set<string>> = {};
  const coverageDay: Record<string, number | null> = {};
  const badStateDays: Record<string, number> = {};
  for (const community of Object.keys(byCommunity)) {
    servicedEver[community] = new Set();
    coverageDay[community] = null;
    badStateDays[community] = 0;
  }

  const delayRng = mulberry32(SMALL_DELAY_SEED);
  const tickMs = SMALL_TICK_MINUTES * 60_000;
  const maxTicks = Math.floor((SMALL_MAX_SIM_DAYS * 24 * 60) / SMALL_TICK_MINUTES);
  let now = startNow;

  for (let i = 0; i < maxTicks; i++) {
    const prevNow = now;
    now += tickMs;
    const dtDays = (now - prevNow) / 86_400_000;

    for (const [community, hhHere] of Object.entries(byCommunity)) {
      const truck = trucks[community];
      const tempC = temps[community];

      for (const h of hhHere) {
        if (worstVariantForHousehold(h, tempC, now) === "high") badStateDays[community] += dtDays;
      }

      if (truck.status === "en_route" && truck.tripStart !== null) {
        if (!truck.delayed && delayRng() < SMALL_BREAKDOWN_CHANCE_PER_TICK) {
          truck.tripDuration = (truck.tripDuration as number) + SMALL_DELAY_EXTENSION_MS;
          truck.delayed = true;
        }
        const frac = (now - truck.tripStart) / (truck.tripDuration as number);
        if (frac >= 1.0) {
          const servicedIds = new Set([truck.target as string, ...truck.batch]);
          for (const h of hhHere) {
            if (servicedIds.has(h.id)) {
              h.lastDelivery = now;
              h.initialChlorineMgL = 1.5;
              h.sewageBaselinePct = 10.0;
              h.recordStart = now;
              servicedEver[community].add(h.id);
            }
          }
          truck.status = "idle";
          truck.target = null;
          truck.tripStart = null;
          truck.tripDuration = null;
          truck.batch = [];
          truck.delayed = false;
        }
      }

      if (truck.status === "idle") {
        if (strategy === "optimized") {
          const urgent = hhHere.filter(
            (h) => worstVariantForHousehold(h, tempC, now) === "high" || predictedNeedsTruck(h, tempC, now),
          );
          if (urgent.length) {
            const primary = urgent[0];
            const nearby = hhHere
              .filter((h) => h.id !== primary.id && SMALL_CLOSE_ENOUGH.has(worstVariantForHousehold(h, tempC, now)))
              .map((h) => h.id);
            truck.status = "en_route";
            truck.target = primary.id;
            truck.tripStart = now;
            truck.tripDuration = SMALL_TRIP_DURATION_MS;
            truck.batch = nearby;
          }
        } else {
          const order = rrOrder[community];
          if (order.length) {
            const primary = order[rrIndex[community] % order.length];
            rrIndex[community] += 1;
            truck.status = "en_route";
            truck.target = primary.id;
            truck.tripStart = now;
            truck.tripDuration = SMALL_TRIP_DURATION_MS;
            truck.batch = [];
          }
        }
      }

      if (coverageDay[community] === null && servicedEver[community].size >= hhHere.length) {
        coverageDay[community] = (now - startNow) / 86_400_000;
      }
    }

    if (Object.values(coverageDay).every((v) => v !== null)) break;
  }

  return { coverageDay, badStateDays };
}

// =============================================================================
// Full-scale comparison + fleet-size sensitivity — ports
// delivery_comparison_fullscale.py in full: real population-scale household
// counts, population-scaled multi-truck fleets, a mechanistic round-trip
// cycle time (outbound + on-site + return + turnaround), volume-capped
// batching, and an ~8%-per-trip blizzard/breakdown whole-trip-lost retry.
// =============================================================================
const PEOPLE_PER_HOUSEHOLD = 4.0;
const PEOPLE_PER_TRUCK = 700.0;
const TRUCK_SPEED_KMH = 20.0;
const ROAD_DETOUR_FACTOR = 1.3;
const ONSITE_SERVICE_MINUTES = 25.0;
const TURNAROUND_MINUTES = 27.0;
const EXTRA_BATCH_STOP_MINUTES = 10.0;
const TRUCK_CAPACITY_L = 10_000.0;
const BLIZZARD_BREAKDOWN_RETRY_PROB = 0.08;
export const FULLSCALE_TICK_MINUTES = 30;
export const MAX_SIM_DAYS = 90;
const DELAY_SEED = 20260926;
const FULLSCALE_CLOSE_ENOUGH: ReadonlySet<Variant> = new Set(["medium", "high"]);

const COMMUNITY_PREFIX: Record<string, string> = {
  Inukjuak: "INU",
  Kuujjuaraapik: "KUJ",
  Puvirnituq: "PUV",
  Kangiqsujuaq: "KAN",
};
const FAMILY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];
const FAMILY_SIZE_WEIGHTS = [0.08, 0.18, 0.2, 0.2, 0.16, 0.11, 0.05, 0.02];

export function realscaleHouseholdCount(population: number): number {
  return Math.max(1, Math.round(population / PEOPLE_PER_HOUSEHOLD));
}

export function fleetSize(population: number): number {
  return Math.max(1, Math.round(population / PEOPLE_PER_TRUCK));
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

function tripDurationMs(community: string, householdId: string, extraStops = 0): number {
  const coords = COMMUNITIES[community];
  const [fLat, fLon] = facilityPosition(community);
  const [hLat, hLon] = jitteredPosition(householdId, coords.lat, coords.lon);
  const oneWayKm = haversineKm(fLat, fLon, hLat, hLon) * ROAD_DETOUR_FACTOR;
  const travelMinutes = (oneWayKm / TRUCK_SPEED_KMH) * 60.0 * 2;
  const totalMinutes = travelMinutes + ONSITE_SERVICE_MINUTES + TURNAROUND_MINUTES + EXTRA_BATCH_STOP_MINUTES * extraStops;
  return totalMinutes * 60_000;
}

/** Real community-scale population (~450-500 households for a ~1800-2000
 * person community, ~185-190 for a ~750-person one) — same per-household
 * generator shape as model.ts's seedHouseholds(), just uncapped counts. */
export function generateFullscaleHouseholds(nowMs: number = Date.now()): Household[] {
  const rng = mulberry32(920260926);
  const out: Household[] = [];
  for (const [community, coords] of Object.entries(COMMUNITIES)) {
    const count = realscaleHouseholdCount(coords.population);
    const prefix = COMMUNITY_PREFIX[community];
    for (let i = 0; i < count; i++) {
      const householdSize = weightedChoice(rng, FAMILY_SIZES, FAMILY_SIZE_WEIGHTS);
      const tankCapacityL = TANK_SIZES_L[Math.floor(rng() * TANK_SIZES_L.length)];
      const hoursSinceDelivery = 2 + rng() * (140 - 2);
      const initialChlorineMgL = 1.3 + rng() * (1.8 - 1.3);
      const sewageBaselinePct = 10 + rng() * (90 - 10);
      const hasAutoSensor = rng() < 0.7;
      const perCapita = PER_CAPITA_LOW_LPD + rng() * (PER_CAPITA_HIGH_LPD - PER_CAPITA_LOW_LPD);
      const consumptionLpd = perCapita * householdSize;
      const sewageFillRatePctPerDay = (consumptionLpd / tankCapacityL) * 100 * (1.0 + rng() * 0.3);
      out.push({
        id: `${prefix}-${String(i + 1).padStart(3, "0")}`,
        community,
        householdSize,
        tankCapacityL,
        lastDelivery: nowMs - hoursSinceDelivery * 3_600_000,
        initialChlorineMgL,
        hasAutoSensor,
        manualAlert: null,
        consumptionLpd,
        sewageFillRatePctPerDay,
        sewageBaselinePct,
        recordStart: nowMs,
      });
    }
  }
  return out;
}

interface FullscaleTruckState {
  status: "idle" | "en_route";
  target: string | null;
  tripStart: number | null;
  tripDuration: number | null;
  batch: string[];
}

export interface FullscaleResult {
  coverageDay: Record<string, number | null>;
  badStateDays: Record<string, number>;
  retryCount: Record<string, number>;
}

/** Ports delivery_comparison_fullscale.py's run_strategy_fullscale():
 * baseline = N fixed, non-overlapping fixed routes (interleaved slices,
 * cycled in id order); optimized = N trucks sharing one community-wide
 * urgent-first + volume-capped-batch queue (reuses the same dispatch
 * decision rule as the Simulation page's live tick engine). */
export function runStrategyFullscale(
  strategy: "baseline" | "optimized",
  households: Household[],
  startNow: number,
  temps: Record<string, number>,
  fleetOverride?: Record<string, number>,
): FullscaleResult {
  const hh = cloneHouseholds(households);
  const byCommunity: Record<string, Household[]> = {};
  for (const h of hh) (byCommunity[h.community] ??= []).push(h);

  const trucks: Record<string, FullscaleTruckState[]> = {};
  const rrChunks: Record<string, Household[][]> = {};
  for (const [community, hhHere] of Object.entries(byCommunity)) {
    const n = fleetOverride?.[community] ?? fleetSize(COMMUNITIES[community].population);
    trucks[community] = Array.from({ length: n }, () => ({
      status: "idle" as const,
      target: null,
      tripStart: null,
      tripDuration: null,
      batch: [] as string[],
    }));
    const order = [...hhHere].sort((a, b) => a.id.localeCompare(b.id));
    rrChunks[community] = Array.from({ length: n }, (_, i) => order.filter((_, idx) => idx % n === i));
  }
  const rrIndex: Record<string, number[]> = {};
  for (const community of Object.keys(byCommunity)) rrIndex[community] = new Array(trucks[community].length).fill(0);

  const servicedEver: Record<string, Set<string>> = {};
  const coverageDay: Record<string, number | null> = {};
  const badStateDays: Record<string, number> = {};
  const retryCount: Record<string, number> = {};
  for (const community of Object.keys(byCommunity)) {
    servicedEver[community] = new Set();
    coverageDay[community] = null;
    badStateDays[community] = 0;
    retryCount[community] = 0;
  }

  const delayRng = mulberry32(DELAY_SEED);
  const tickMs = FULLSCALE_TICK_MINUTES * 60_000;
  const maxTicks = Math.floor((MAX_SIM_DAYS * 24 * 60) / FULLSCALE_TICK_MINUTES);
  let now = startNow;

  for (let tickIdx = 0; tickIdx < maxTicks; tickIdx++) {
    const prevNow = now;
    now += tickMs;
    const dtDays = (now - prevNow) / 86_400_000;

    for (const [community, hhHere] of Object.entries(byCommunity)) {
      const tempC = temps[community];
      const fleet = trucks[community];

      for (const h of hhHere) {
        if (worstVariantForHousehold(h, tempC, now) === "high") badStateDays[community] += dtDays;
      }

      const claimedIds = new Set<string>();
      for (const t of fleet) {
        if (t.target) claimedIds.add(t.target);
        for (const b of t.batch) claimedIds.add(b);
      }

      fleet.forEach((truck, truckIdx) => {
        if (truck.status === "en_route" && truck.tripStart !== null) {
          const frac = (now - truck.tripStart) / (truck.tripDuration as number);
          if (frac >= 1.0) {
            if (delayRng() < BLIZZARD_BREAKDOWN_RETRY_PROB) {
              retryCount[community] += 1;
              truck.tripStart = now;
              truck.tripDuration = tripDurationMs(community, truck.target as string, truck.batch.length);
            } else {
              const servicedIds = new Set([truck.target as string, ...truck.batch]);
              for (const h of hhHere) {
                if (servicedIds.has(h.id)) {
                  h.lastDelivery = now;
                  h.initialChlorineMgL = 1.5;
                  h.sewageBaselinePct = 10.0;
                  h.recordStart = now;
                  servicedEver[community].add(h.id);
                }
              }
              truck.status = "idle";
              truck.target = null;
              truck.tripStart = null;
              truck.tripDuration = null;
              truck.batch = [];
              servicedIds.forEach((id) => claimedIds.delete(id));
            }
          }
        }

        if (truck.status === "idle") {
          if (strategy === "optimized") {
            const urgent = hhHere.filter(
              (h) =>
                !claimedIds.has(h.id) &&
                (worstVariantForHousehold(h, tempC, now) === "high" || predictedNeedsTruck(h, tempC, now)),
            );
            if (urgent.length) {
              urgent.sort((a, b) => a.lastDelivery - b.lastDelivery);
              const primary = urgent[0];
              const nearbyPool = hhHere.filter(
                (h) =>
                  !claimedIds.has(h.id) &&
                  h.id !== primary.id &&
                  FULLSCALE_CLOSE_ENOUGH.has(worstVariantForHousehold(h, tempC, now)),
              );
              nearbyPool.sort((a, b) => a.lastDelivery - b.lastDelivery);
              let remainingCapacityL = TRUCK_CAPACITY_L - Math.min(currentUsedL(primary, now), TRUCK_CAPACITY_L);
              const nearby: string[] = [];
              for (const cand of nearbyPool) {
                const needL = currentUsedL(cand, now);
                if (needL <= remainingCapacityL) {
                  nearby.push(cand.id);
                  remainingCapacityL -= needL;
                }
              }
              truck.status = "en_route";
              truck.target = primary.id;
              truck.tripStart = now;
              truck.tripDuration = tripDurationMs(community, primary.id, nearby.length);
              truck.batch = nearby;
              claimedIds.add(primary.id);
              nearby.forEach((id) => claimedIds.add(id));
            }
          } else {
            const myOrder = rrChunks[community][truckIdx];
            if (myOrder.length) {
              const primary = myOrder[rrIndex[community][truckIdx] % myOrder.length];
              rrIndex[community][truckIdx] += 1;
              truck.status = "en_route";
              truck.target = primary.id;
              truck.tripStart = now;
              truck.tripDuration = tripDurationMs(community, primary.id, 0);
              truck.batch = [];
            }
          }
        }
      });

      if (coverageDay[community] === null && servicedEver[community].size >= hhHere.length) {
        coverageDay[community] = (now - startNow) / 86_400_000;
      }
    }

    if (Object.values(coverageDay).every((v) => v !== null)) break;
  }

  return { coverageDay, badStateDays, retryCount };
}
