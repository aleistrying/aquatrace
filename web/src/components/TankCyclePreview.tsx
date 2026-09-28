"use client";

/**
 * An illustrative, sped-up "fill cycle" preview: drain -> threshold -> reset,
 * looped continuously so a viewer can watch a full lifecycle in a demo
 * without waiting real days. Every value it renders is a genuine output of
 * the real model.ts formulas (currentUsedL / currentSewagePct /
 * chlorineResidualNow / potabilityPct / the tankForecast helpers) - the only
 * thing that's synthetic is the clock fed into them: a fast local elapsed-ms
 * counter, remapped per tank into that tank's own real time-to-threshold, so
 * the loop finishes in ~20-30s of real time instead of real days.
 *
 * This is intentionally a SEPARATE panel from the real, actual-elapsed-time
 * card above it - it must never overwrite or contradict the household's real
 * current reading, which the rest of this page (and this same household,
 * elsewhere) shows from the real ticking clock (useNow). Keeping it as its
 * own clearly-labeled card is what keeps the two from being confused with
 * one another while still living side by side.
 */

import { useEffect, useRef, useState } from "react";
import TankSvg from "./TankSvg";
import {
  type Household,
  SEWAGE_BLOCKED_PCT,
  chlorineRateConstant,
  chlorineResidualNow,
  currentSewagePct,
  currentUsedL,
  potabilityPct,
  qualityStatus,
  sewageStatus,
  waterQuantityStatus,
} from "@/lib/model";
import { potabilityForecastFromResidual, sewageForecastFromPct, waterForecastFromRemainingL } from "@/lib/tankForecast";

// Demo-friendly cycle lengths (real seconds) - independent per tank so the
// three loops don't feel robotically locked to one another, same idea the
// deck slide's own preview uses.
const WATER_CYCLE_MS = 24_000;
const SEWAGE_CYCLE_MS = 18_000;
const POTABILITY_CYCLE_MS = 30_000;

// Floor residual the potability sweep decays toward before "redosing" -
// small-but-nonzero so the exponential decay curve stays well-defined.
const POTABILITY_FLOOR_MGL = 0.05;

/** Real elapsed ms since mount, client-only (mirrors useNow's SSR-safe pattern: start at 0 so server/client hydration match, then start a real timer from inside an effect). */
function useElapsedMs(tickMs = 150): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    const kickoff = setTimeout(() => {
      startRef.current = Date.now();
    }, 0);
    const id = setInterval(() => {
      if (startRef.current !== null) setElapsed(Date.now() - startRef.current);
    }, tickMs);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, [tickMs]);
  return elapsed;
}

export default function TankCyclePreview({ h, tempC }: { h: Household; tempC: number }) {
  const elapsed = useElapsedMs();

  // Water: sawtooth from a full tank down toward empty, over this
  // household's OWN real full-tank runway (tankCapacityL / consumptionLpd),
  // then a fast "refill" as the cycle wraps.
  const waterCoveredDays = h.tankCapacityL / Math.max(h.consumptionLpd, 1);
  const waterSimDays = ((elapsed % WATER_CYCLE_MS) / WATER_CYCLE_MS) * waterCoveredDays;
  const waterUsedL = currentUsedL({ ...h, lastDelivery: 0 }, waterSimDays * 86_400_000);
  const waterPct = 100 * (1 - waterUsedL / h.tankCapacityL);
  const waterRemainingL = Math.max(h.tankCapacityL - waterUsedL, 0);
  const waterQty = waterQuantityStatus(waterPct);
  const waterFc = waterForecastFromRemainingL(waterRemainingL, h.householdSize, tempC);

  // Sewage: sawtooth from just-pumped-out (0%) up to blocked (SEWAGE_BLOCKED_PCT).
  const sewageCoveredDays = SEWAGE_BLOCKED_PCT / Math.max(h.sewageFillRatePctPerDay, 0.0001);
  const sewageSimDays = ((elapsed % SEWAGE_CYCLE_MS) / SEWAGE_CYCLE_MS) * sewageCoveredDays;
  const sewagePct = currentSewagePct({ ...h, recordStart: 0, sewageBaselinePct: 0 }, sewageSimDays * 86_400_000);
  const sewageSt = sewageStatus(sewagePct);
  const sewageFc = sewageForecastFromPct(sewagePct, h.sewageFillRatePctPerDay);

  // Potability: sawtooth chlorine decay from this household's real initial
  // dose down to a near-empty floor, at this community's real ambient temp.
  const k = chlorineRateConstant(tempC);
  const potCoveredDays = Math.log(h.initialChlorineMgL / POTABILITY_FLOOR_MGL) / Math.max(k, 1e-9) / 24;
  const potSimDays = ((elapsed % POTABILITY_CYCLE_MS) / POTABILITY_CYCLE_MS) * potCoveredDays;
  const residual = chlorineResidualNow({ ...h, lastDelivery: 0 }, tempC, potSimDays * 86_400_000);
  const potPct = potabilityPct(residual);
  const quality = qualityStatus(residual);
  const potFc = potabilityForecastFromResidual(residual, tempC);

  return (
    <div className="card" style={{ marginTop: "0.75rem", background: "var(--surface-raised)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: "0.4rem" }}>
        <strong style={{ fontSize: "0.82rem" }}>Fill-cycle preview (illustrative, sped up)</strong>
        <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)" }}>
          A looped, fast-forwarded run of this household&apos;s own math &mdash; not the real current reading above.
        </span>
      </div>
      <div style={{ display: "flex", gap: "1.2rem", justifyContent: "center", flexWrap: "wrap" }}>
        {h.hasAutoSensor && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <TankSvg pctFull={waterPct} variant={waterQty.variant} label="Water" width={90} height={130} />
            <span style={{ fontSize: "0.66rem", color: "var(--ink-soft)", textAlign: "center", maxWidth: 108 }}>{waterFc.text}</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <TankSvg pctFull={sewagePct} variant={sewageSt.variant} label="Sewage" width={90} height={130} />
          <span style={{ fontSize: "0.66rem", color: "var(--ink-soft)", textAlign: "center", maxWidth: 108 }}>{sewageFc.text}</span>
        </div>
        {h.hasAutoSensor && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <TankSvg pctFull={potPct} variant={quality.variant} label="Potability" width={90} height={130} />
            <span style={{ fontSize: "0.66rem", color: "var(--ink-soft)", textAlign: "center", maxWidth: 108 }}>{potFc.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
