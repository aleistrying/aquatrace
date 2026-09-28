/**
 * "Days/hours remaining before the next threshold" captions for each tank.
 *
 * Every number here is derived from the real formulas and real constants
 * already in `./model.ts` (chlorine decay, depletion band, sewage fill rate,
 * status thresholds) - nothing in this file invents a new rate or threshold.
 * Two entry points are provided per tank:
 *   - a Household+now wrapper (used by the live Houses page, which already
 *     has a real Household object and a real ticking clock), and
 *   - a from-current-level primitive (used by the deck's animated preview,
 *     which only knows the fill level an SVG animation is *currently*
 *     rendering, not a synthetic "now" to feed back through model.ts).
 * The from-level primitives are the same arithmetic model.ts's
 * `depletionDaysBand`/`sewagePredictedNeedsTruck`/chlorine-decay math uses -
 * just entered from a known remaining quantity instead of from a
 * household+timestamp pair - and the Household+now wrappers call straight
 * through to them, so there is exactly one implementation of each formula.
 */

import {
  type Household,
  type Variant,
  FREEZE_DRIP_MULTIPLIER,
  FREEZE_DRIP_THRESHOLD_C,
  PER_CAPITA_HIGH_LPD,
  PER_CAPITA_LOW_LPD,
  RESIDUAL_LOW_THRESHOLD,
  RESIDUAL_MED_THRESHOLD,
  SEWAGE_BLOCKED_PCT,
  chlorineRateConstant,
  chlorineResidualNow,
  currentSewagePct,
  depletionDaysBand,
  worstVariant,
} from "./model";

export interface RangeForecast {
  soonestDays: number;
  latestDays: number;
  text: string;
}

export interface ThresholdForecast {
  days: number;
  text: string;
}

function fmtDaysOrHours(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "0 hrs";
  if (days < 1) {
    const hrs = days * 24;
    return `${hrs < 10 ? hrs.toFixed(1) : Math.round(hrs)} hr${hrs >= 1.05 ? "s" : ""}`;
  }
  return `${days.toFixed(days < 10 ? 1 : 0)} day${days >= 1.05 ? "s" : ""}`;
}

function rangeForecast(soonestDays: number, latestDays: number): RangeForecast {
  const text =
    soonestDays <= 0 && latestDays <= 0
      ? "Already empty — delivery needed now"
      : `~${fmtDaysOrHours(soonestDays)}–${fmtDaysOrHours(latestDays)} until empty`;
  return { soonestDays, latestDays, text };
}

// ---------------------------------------------------------------------------
// Water: depletion-days band, straight from model.ts's depletionDaysBand.
// ---------------------------------------------------------------------------
export function waterForecast(h: Household, tempC: number, now: number): RangeForecast {
  const [highUseDays, lowUseDays] = depletionDaysBand(h, tempC, now);
  return rangeForecast(Math.min(highUseDays, lowUseDays), Math.max(highUseDays, lowUseDays));
}

/** Same depletion-band arithmetic as `waterForecast`, entered from a known remaining-litres figure. */
export function waterForecastFromRemainingL(remainingL: number, householdSize: number, tempC: number): RangeForecast {
  const freezeMult = tempC <= FREEZE_DRIP_THRESHOLD_C ? FREEZE_DRIP_MULTIPLIER : 1.0;
  const highUseDays = remainingL / Math.max(PER_CAPITA_HIGH_LPD * householdSize * freezeMult, 1);
  const lowUseDays = remainingL / Math.max(PER_CAPITA_LOW_LPD * householdSize * freezeMult, 1);
  return rangeForecast(Math.min(highUseDays, lowUseDays), Math.max(highUseDays, lowUseDays));
}

// ---------------------------------------------------------------------------
// Sewage: days until SEWAGE_BLOCKED_PCT at the household's own fill rate.
// ---------------------------------------------------------------------------
export function sewageForecastFromPct(pctFull: number, fillRatePctPerDay: number): ThresholdForecast {
  if (pctFull >= SEWAGE_BLOCKED_PCT) return { days: 0, text: "Full now — pump-out needed" };
  const days = (SEWAGE_BLOCKED_PCT - pctFull) / Math.max(fillRatePctPerDay, 0.0001);
  return { days, text: `~${fmtDaysOrHours(days)} until full — pump-out needed` };
}

export function sewageForecast(h: Household, now: number): ThresholdForecast {
  return sewageForecastFromPct(currentSewagePct(h, now), h.sewageFillRatePctPerDay);
}

// ---------------------------------------------------------------------------
// Potability: analytic time-to-threshold from the same exponential chlorine
// decay model.ts's chlorineResidualNow/qualityStatus use (residual(t) =
// residual0 * exp(-k*t) => t = ln(residual0/threshold)/k).
// ---------------------------------------------------------------------------
export function potabilityForecastFromResidual(residualMgL: number, tempC: number): ThresholdForecast {
  const k = chlorineRateConstant(tempC);
  if (residualMgL > RESIDUAL_MED_THRESHOLD) {
    const days = Math.log(residualMgL / RESIDUAL_MED_THRESHOLD) / k / 24;
    return { days, text: `~${fmtDaysOrHours(days)} until retest recommended` };
  }
  if (residualMgL > RESIDUAL_LOW_THRESHOLD) {
    const days = Math.log(residualMgL / RESIDUAL_LOW_THRESHOLD) / k / 24;
    return { days, text: `~${fmtDaysOrHours(days)} until below the safe floor` };
  }
  return { days: 0, text: "Retest recommended now" };
}

export function potabilityForecast(h: Household, tempC: number, now: number): ThresholdForecast {
  return potabilityForecastFromResidual(chlorineResidualNow(h, tempC, now), tempC);
}

// ---------------------------------------------------------------------------
// Display-only status escalation: a household can sit above the % threshold
// that earns a "low"/green badge (model.ts's water/sewage/quality status
// functions) while still being real hours away from crossing it - a fast
// per-person consumption rate against a small tank can drain the remaining
// margin quickly even from a technically-"OK" percentage. Both numbers are
// correct on their own terms (one's a % cutoff, the other's an absolute-time
// projection), but showing "OK" next to "~9 hrs until empty" reads as
// contradictory. This does NOT change the real % thresholds, the dispatch
// trigger (water/sewagePredictedNeedsTruck already do their own proper
// day-based horizon check independently), or any simulation behavior - it
// only escalates what badge color a household's card displays alongside a
// days-remaining caption, and only when that caption is actually urgent.
// ---------------------------------------------------------------------------
const URGENT_SOON_DAYS = 1; // caption reads as clearly urgent below this
const URGENT_NOW_DAYS = 0.25; // ~6 hours - display as high regardless of the % badge

export type TankKind = "water" | "sewage" | "potability";

const URGENCY_LABEL: Record<TankKind, { medium: string; high: string }> = {
  water: { medium: "Draining fast", high: "Empty within hours" },
  sewage: { medium: "Filling fast", high: "Full within hours" },
  potability: { medium: "Decaying fast", high: "Below floor within hours" },
};

/**
 * Escalates BOTH the variant (for color) and the label (for text) together -
 * fixing color alone left a bug where a gold-colored badge still read "Tank
 * OK", which is if anything more confusing than the original green-OK/urgent-
 * caption contradiction it was meant to fix. When soonestDays isn't actually
 * urgent, returns the original {variant, label} unchanged.
 */
export function displayStatusForForecast(
  kind: TankKind,
  pctVariant: Variant,
  pctLabel: string,
  soonestDays: number,
): { variant: Variant; label: string } {
  if (!Number.isFinite(soonestDays)) return { variant: pctVariant, label: pctLabel };
  const target = soonestDays <= URGENT_NOW_DAYS ? "high" : soonestDays <= URGENT_SOON_DAYS ? "medium" : pctVariant;
  const escalated = worstVariant(pctVariant, target);
  // Only swap in the generic urgency wording when the days-check actually
  // made things worse than the % status already said - if pctVariant was
  // already at/above that level for its own (more specific) real reason,
  // keep its real label rather than overwrite it with generic phrasing.
  if (escalated === pctVariant) return { variant: pctVariant, label: pctLabel };
  return { variant: escalated, label: URGENCY_LABEL[kind][escalated === "high" ? "high" : "medium"] };
}
