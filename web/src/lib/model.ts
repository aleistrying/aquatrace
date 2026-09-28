/**
 * Ported, formula-for-formula, from the real Python app's common.py.
 * Every constant and every deterministic formula below (chlorine decay,
 * tank depletion, sewage fill, status thresholds, predicted-needs-truck)
 * is copied over unchanged from common.py — not reinvented, not
 * approximated. This is the single source of truth both the Home page's
 * pitch numbers and every product page's live math read from.
 *
 * The one thing that is NOT bit-identical to the Python version is the
 * seeded illustrative household sample (seedHouseholds below): Python's
 * random.Random Mersenne Twister sequence can't be reproduced exactly in
 * JS without re-implementing CPython's PRNG bit for bit. The README already
 * labels this household list as "illustrative, clearly labeled in-app" -
 * not itself a scientific claim - so this port uses an equivalent seeded
 * PRNG (mulberry32) driving the SAME distributions/ranges/shapes as the
 * Python version, not a literal value-for-value replay.
 */

// ---------------------------------------------------------------------------
// Communities (identical to common.py's COMMUNITIES)
// ---------------------------------------------------------------------------
export const REGION_NAME = "Nunavik";
export const REGION_COMMUNITY_COUNT = 14;

export const COMMUNITIES: Record<string, { lat: number; lon: number; population: number }> = {
  Inukjuak: { lat: 58.4708, lon: -78.1064, population: 2000 },
  Kuujjuaraapik: { lat: 55.2813, lon: -77.7644, population: 750 },
  Puvirnituq: { lat: 60.05, lon: -77.2833, population: 2000 },
  Kangiqsujuaq: { lat: 61.5833, lon: -71.9833, population: 750 },
};

export const FACILITY_LAT_OFFSET_DEG = 0.07; // ~7.8 km south, same as common.py

export function facilityPosition(community: string): [number, number] {
  const c = COMMUNITIES[community];
  return [c.lat - FACILITY_LAT_OFFSET_DEG, c.lon];
}

// ---------------------------------------------------------------------------
// Water-quality / depletion constants (see REFERENCES.md for sourcing) -
// values copied verbatim from common.py
// ---------------------------------------------------------------------------
export const RESIDUAL_LOW_THRESHOLD = 0.2;
export const RESIDUAL_MED_THRESHOLD = 0.5;
export const K_REF_20C = Math.log(1.5 / RESIDUAL_LOW_THRESHOLD) / 72.0;
export const Q10 = 2.0;

export const PER_CAPITA_LOW_LPD = 90;
export const PER_CAPITA_HIGH_LPD = 150;

export const FREEZE_DRIP_THRESHOLD_C = -30.0;
export const FREEZE_DRIP_MULTIPLIER = 1.1;

export const WATER_QUANTITY_LOW_PCT = 15;
export const WATER_QUANTITY_EMPTY_PCT = 3;

export const SEWAGE_WARNING_PCT = 70;
export const SEWAGE_BLOCKED_PCT = 90;

export const POTABILITY_REFERENCE_MGL = 1.8;

export type Variant = "low" | "medium" | "high";

export interface Household {
  id: string;
  community: string;
  householdSize: number;
  tankCapacityL: number;
  lastDelivery: number; // epoch ms
  initialChlorineMgL: number;
  hasAutoSensor: boolean;
  manualAlert: string | null;
  consumptionLpd: number;
  sewageFillRatePctPerDay: number;
  sewageBaselinePct: number;
  recordStart: number; // epoch ms
}

function daysSince(then: number, now: number): number {
  return Math.max((now - then) / 86_400_000, 0);
}

export function currentUsedL(h: Household, now: number): number {
  return Math.min(h.tankCapacityL, h.consumptionLpd * daysSince(h.lastDelivery, now));
}

export function currentSewagePct(h: Household, now: number): number {
  return Math.min(100, h.sewageBaselinePct + h.sewageFillRatePctPerDay * daysSince(h.recordStart, now));
}

export function chlorineRateConstant(tempC: number): number {
  return K_REF_20C * Q10 ** ((tempC - 20.0) / 10.0);
}

export function chlorineResidualNow(h: Household, tempC: number, now: number): number {
  const hoursElapsed = Math.max((now - h.lastDelivery) / 3_600_000, 0);
  const k = chlorineRateConstant(tempC);
  return h.initialChlorineMgL * Math.exp(-k * hoursElapsed);
}

export function potabilityPct(residualMgL: number): number {
  return Math.max(0, Math.min(100, (residualMgL / POTABILITY_REFERENCE_MGL) * 100));
}

export interface StatusResult {
  variant: Variant;
  label: string;
  action: string;
}

export function qualityStatus(residualMgL: number): StatusResult {
  if (residualMgL < RESIDUAL_LOW_THRESHOLD) {
    return { variant: "high", label: "Retest recommended", action: "Below the safe floor — retest or boil before drinking." };
  }
  if (residualMgL < RESIDUAL_MED_THRESHOLD) {
    return { variant: "medium", label: "Approaching the floor", action: "Still likely safe, but nearing retest threshold." };
  }
  return { variant: "low", label: "Likely safe", action: "No action needed." };
}

export function waterQuantityStatus(pctRemaining: number): StatusResult {
  if (pctRemaining <= WATER_QUANTITY_EMPTY_PCT) {
    return { variant: "high", label: "Tank empty", action: "Little to no water left in the tank — needs a delivery now, independent of chlorine quality." };
  }
  if (pctRemaining <= WATER_QUANTITY_LOW_PCT) {
    return { variant: "medium", label: "Tank getting low", action: "Water volume is running low — schedule a delivery soon." };
  }
  return { variant: "low", label: "Tank OK", action: "Water volume has room to spare." };
}

export function sewageStatus(pctFull: number): StatusResult {
  if (pctFull >= SEWAGE_BLOCKED_PCT) {
    return { variant: "high", label: "Sewage full — water use blocked", action: "No space for used water — blocks dishes, laundry, flushing, bathing until pumped out." };
  }
  if (pctFull >= SEWAGE_WARNING_PCT) {
    return { variant: "medium", label: "Filling up", action: "Schedule a pump-out soon." };
  }
  return { variant: "low", label: "OK", action: "Sewage tank has space." };
}

export function depletionDaysBand(h: Household, tempC: number, now: number): [number, number] {
  const freezeMult = tempC <= FREEZE_DRIP_THRESHOLD_C ? FREEZE_DRIP_MULTIPLIER : 1.0;
  const remainingL = Math.max(h.tankCapacityL - currentUsedL(h, now), 0);
  const highUseDays = remainingL / Math.max(PER_CAPITA_HIGH_LPD * h.householdSize * freezeMult, 1);
  const lowUseDays = remainingL / Math.max(PER_CAPITA_LOW_LPD * h.householdSize * freezeMult, 1);
  return [highUseDays, lowUseDays];
}

export function waterPredictedNeedsTruck(h: Household, tempC: number, now: number, horizonDays = 1.0): boolean {
  const freezeMult = tempC <= FREEZE_DRIP_THRESHOLD_C ? FREEZE_DRIP_MULTIPLIER : 1.0;
  const remainingL = Math.max(h.tankCapacityL - currentUsedL(h, now), 0);
  const actualDaysRemaining = remainingL / Math.max(h.consumptionLpd * freezeMult, 1);
  return actualDaysRemaining > 0 && actualDaysRemaining <= horizonDays;
}

export function sewagePredictedNeedsTruck(h: Household, now: number, horizonDays = 1.0): boolean {
  const cur = currentSewagePct(h, now);
  const projected = Math.min(100, cur + h.sewageFillRatePctPerDay * horizonDays);
  return cur < SEWAGE_BLOCKED_PCT && projected >= SEWAGE_BLOCKED_PCT;
}

export function predictedNeedsTruck(h: Household, tempC: number, now: number, horizonDays = 1.0): boolean {
  return waterPredictedNeedsTruck(h, tempC, now, horizonDays) || sewagePredictedNeedsTruck(h, now, horizonDays);
}

export const RANK: Record<Variant, number> = { low: 0, medium: 1, high: 2 };

export function worstVariant(a: Variant, b: Variant): Variant {
  return RANK[a] >= RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Live weather (Open-Meteo, free/no-auth) - same endpoint, same fallback
// value as common.py's fetch_current_temp_c.
// ---------------------------------------------------------------------------
export const FALLBACK_TEMP_C = -18.0;

export async function fetchCurrentTempC(lat: number, lon: number): Promise<{ tempC: number; source: string }> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`,
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const temp = Number(data?.current?.temperature_2m);
    if (Number.isNaN(temp)) throw new Error("no temperature in response");
    return { tempC: temp, source: "live (Open-Meteo)" };
  } catch {
    return { tempC: FALLBACK_TEMP_C, source: "fallback (offline demo value)" };
  }
}

// ---------------------------------------------------------------------------
// Jittered per-household position - same haversine-ish flat approximation
// as common.py's _jittered_position, seeded per-id so a household's pin
// never moves between renders.
// ---------------------------------------------------------------------------
function stringSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

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

export function jitteredPosition(seedId: string, lat: number, lon: number): [number, number] {
  const rng = mulberry32(stringSeed(seedId));
  const radiusKm = 0.3 + rng() * (1.5 - 0.3);
  const angle = rng() * 2 * Math.PI;
  const dlat = (radiusKm / 111.0) * Math.cos(angle);
  const dlon = (radiusKm / (111.0 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1))) * Math.sin(angle);
  return [lat + dlat, lon + dlon];
}

// ---------------------------------------------------------------------------
// Seeded illustrative household sample - same distributions/shapes/ranges as
// common.py's seed_households()/_procedural_households()/_make_household(),
// driven by a JS-side seeded PRNG (see file header note on why this isn't
// bit-identical to the Python RNG sequence).
// ---------------------------------------------------------------------------
const COMMUNITY_PREFIX: Record<string, string> = {
  Inukjuak: "INU",
  Kuujjuaraapik: "KUJ",
  Puvirnituq: "PUV",
  Kangiqsujuaq: "KAN",
};

const FAMILY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];
const FAMILY_SIZE_WEIGHTS = [0.08, 0.18, 0.2, 0.2, 0.16, 0.11, 0.05, 0.02];
export const TANK_SIZES_L = [1200, 1500, 1800, 2000, 2200, 2500];
const AUTO_SENSOR_RATIO = 0.7;

function weightedChoice<T>(rng: () => number, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function householdSampleSize(population: number): number {
  return Math.min(25, Math.max(12, Math.round(population / 80)));
}

export function seedHouseholds(nowMs: number = Date.now()): Household[] {
  const rng = mulberry32(20260926);
  const out: Household[] = [];
  for (const [community, coords] of Object.entries(COMMUNITIES)) {
    const count = householdSampleSize(coords.population);
    const prefix = COMMUNITY_PREFIX[community];
    for (let i = 0; i < count; i++) {
      const householdSize = weightedChoice(rng, FAMILY_SIZES, FAMILY_SIZE_WEIGHTS);
      const tankCapacityL = TANK_SIZES_L[Math.floor(rng() * TANK_SIZES_L.length)];
      const hoursSinceDelivery = 2 + rng() * (140 - 2);
      const initialChlorineMgL = 1.3 + rng() * (1.8 - 1.3);
      const sewageBaselinePct = 10 + rng() * (90 - 10);
      const hasAutoSensor = rng() < AUTO_SENSOR_RATIO;
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
