"use client";

/**
 * Ported from pages/1_Houses.py — demonstrates the data a household
 * water/sewage sensor (or, where none exists yet, a simple manual backup
 * button) would feed into the centralized system. Residents themselves
 * don't need this dashboard; it exists to show judges/the team what data
 * arrives from each house.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import TankSvg from "@/components/TankSvg";
import TankCyclePreview from "@/components/TankCyclePreview";
import BoilWaterBanner from "@/components/BoilWaterBanner";
import CrisisBanner from "@/components/CrisisBanner";
import InfoIcon from "@/components/InfoIcon";
import { useNow } from "@/lib/useNow";
import { displayStatusForForecast, potabilityForecast, sewageForecast, waterForecast } from "@/lib/tankForecast";
import { useHouseholds, setManualAlert } from "@/lib/householdStore";
import { boilWaterAdvisoryActive } from "@/lib/plantStore";
import {
  COMMUNITIES,
  REGION_NAME,
  REGION_COMMUNITY_COUNT,
  fetchCurrentTempC,
  chlorineResidualNow,
  qualityStatus,
  depletionDaysBand,
  sewageStatus,
  currentSewagePct,
  currentUsedL,
  waterQuantityStatus,
  potabilityPct,
  worstVariant,
  RANK,
  type Household,
  type Variant,
} from "@/lib/model";

const COMMUNITY_NAMES = Object.keys(COMMUNITIES);

const MANUAL_VARIANT: Record<string, Variant> = {
  "All good": "low",
  "Tank getting low": "medium",
  "Something's wrong": "high",
};
const MANUAL_TOOLTIP: Record<string, string> = {
  "All good": "Resident pressed the backup button to report no problems.",
  "Tank getting low": "Resident pressed the backup button to flag the water tank getting low.",
  "Something's wrong": "Resident pressed the backup button to flag a possible problem — needs follow-up.",
};

function waterQtyPct(h: Household, now: number): number {
  return 100 * (1 - currentUsedL(h, now) / h.tankCapacityL);
}

function worstVariantFor(h: Household, tempC: number, now: number): Variant {
  let v: Variant;
  if (h.hasAutoSensor) {
    const residual = chlorineResidualNow(h, tempC, now);
    const qualityV = qualityStatus(residual).variant;
    const qtyV = waterQuantityStatus(waterQtyPct(h, now)).variant;
    v = worstVariant(qualityV, qtyV);
  } else {
    v = h.manualAlert ? MANUAL_VARIANT[h.manualAlert] : "medium";
  }
  const sewV = sewageStatus(currentSewagePct(h, now)).variant;
  return worstVariant(v, sewV);
}

export default function HousesPage() {
  const now = useNow();
  const allHouseholds = useHouseholds();
  const boilActive = boilWaterAdvisoryActive();

  const [community, setCommunity] = useState(COMMUNITY_NAMES[0]);
  const [tempC, setTempC] = useState<number | null>(null);
  const [tempSource, setTempSource] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const coords = COMMUNITIES[community];
    fetchCurrentTempC(coords.lat, coords.lon).then(({ tempC: t, source }) => {
      if (!cancelled) {
        setTempC(t);
        setTempSource(source);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [community]);

  const households = useMemo(
    () => allHouseholds.filter((h) => h.community === community),
    [allHouseholds, community],
  );

  const householdsSorted = useMemo(() => {
    if (tempC === null) return households;
    return [...households].sort(
      (a, b) => RANK[worstVariantFor(b, tempC, now)] - RANK[worstVariantFor(a, tempC, now)],
    );
  }, [households, tempC, now]);

  // Derived rather than effect-driven: falls back to the most-urgent
  // household whenever the explicit selection isn't (or isn't yet) valid
  // for the current community — e.g. right after switching communities.
  const effectiveSelectedId =
    selectedId && households.some((h) => h.id === selectedId) ? selectedId : (householdsSorted[0]?.id ?? null);

  const anyWrongButton = households.some((h) => h.manualAlert === "Something's wrong");
  const anySewageBlocked = households.some((h) => currentSewagePct(h, now) >= 90);
  const anyTankEmpty = households.some((h) => h.hasAutoSensor && waterQtyPct(h, now) <= 3);

  let crisisMessage: string | null = null;
  if (anyWrongButton || anySewageBlocked || anyTankEmpty) {
    const parts: string[] = [];
    if (anyTankEmpty) parts.push("a water tank is empty");
    if (anyWrongButton) parts.push("a household backup button reported a possible problem");
    if (anySewageBlocked) parts.push("a sewage tank is full and blocking water use");
    const joined = parts.join(" — and — ");
    crisisMessage = joined.charAt(0).toUpperCase() + joined.slice(1) + ". See below.";
  }

  const h = households.find((hh) => hh.id === effectiveSelectedId) ?? null;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 60px" }}>
      <PageHeader
        title="Houses"
        subtitle="What a household water tank, sewage tank, or backup button would report"
      />

      {boilActive && <BoilWaterBanner />}

      <div
        className="card"
        style={{
          marginBottom: "1rem",
          background: "var(--teal-tint)",
          borderColor: "var(--teal)",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem 0.6rem",
          alignItems: "center",
        }}
      >
        <Badge
          label="Demo only"
          variant="medium"
          title="Residents don't operate this page — it shows judges/the team what a sensor or backup button reports."
        />
        <InfoIcon label="Why this page is demo-only">
          Residents don&apos;t operate this page — it shows what a sensor (or, until installed, a simple
          wired backup button) reports. Try one below on a house marked &ldquo;no sensor yet.&rdquo;
        </InfoIcon>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "0.75rem" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Community</span>
          <select
            value={community}
            onChange={(e) => {
              setCommunity(e.target.value);
              setSelectedId(null);
            }}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            {COMMUNITY_NAMES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
        <span>
          Ambient temperature:{" "}
          <strong style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>
            {tempC === null ? "…" : `${tempC.toFixed(1)}°C`}
          </strong>
          {tempC !== null && <span className="aq-live-dot" title="Live reading" />}
        </span>
        <InfoIcon label="Reading source and demo scope">
          Source: {tempSource || "loading"}. {REGION_NAME} region has {REGION_COMMUNITY_COUNT} communities total —
          this demo covers 4.
        </InfoIcon>
      </div>

      {crisisMessage && <CrisisBanner message={crisisMessage} />}

      <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
          Household ({households.length} in {community}, most urgent first)
        </span>
        <select
          value={effectiveSelectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", maxWidth: 320 }}
        >
          {householdsSorted.map((hh) => (
            <option key={hh.id} value={hh.id}>
              {hh.id}
            </option>
          ))}
        </select>
      </label>

      {h && tempC !== null && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 420px", minWidth: 280 }}>
            {h.hasAutoSensor ? (
              <AutoSensorCard h={h} tempC={tempC} now={now} />
            ) : (
              <ManualCard h={h} now={now} />
            )}
            <TankCyclePreview h={h} tempC={tempC} />
          </div>
          <div style={{ flex: "1 1 200px", minWidth: 220 }}>
            {!h.hasAutoSensor && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={() => setManualAlert(h.id, "All good")}
                  style={bigButtonStyle("var(--green-tint)", "var(--green)")}
                >
                  ✅ All good
                </button>
                <button
                  onClick={() => setManualAlert(h.id, "Tank getting low")}
                  style={bigButtonStyle("var(--gold-tint)", "var(--gold)")}
                >
                  💧 Tank getting low
                </button>
                <button
                  onClick={() => setManualAlert(h.id, "Something's wrong")}
                  style={bigButtonStyle("var(--danger-tint)", "var(--danger)")}
                >
                  ⚠️ Something&apos;s wrong
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <details style={{ marginTop: "1.5rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Sensor list used at the household stage</summary>
        <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
          <SensorTable
            rows={[
              [
                "Water tank level",
                "Ultrasonic (non-contact) — same category piloted by Université Laval / Sentinel Nord in Kuujjuaq",
                "No (local readout); relay for remote view",
                "No wetted parts, freeze-tolerant",
                "Tank is indoors — sensor sees heated indoor air, not -49°C outside; no hardening needed",
              ],
              [
                "Water tank quality",
                "Turbidity (optical/IR) + amperometric chlorine residual probe",
                "No (local readout); relay for remote view",
                "Amperometric preferred — no reagents to freeze or expire",
                "Probe is submerged in tank water (stays above freezing indoors) — cold-safe by placement, not spec",
              ],
              [
                "Sewage tank level",
                "Float switch (mechanical/magnetic reed)",
                "No (local readout); relay for remote view",
                "More failure-tolerant than ultrasonic in a corrosive-gas tank (no false readings from foam/condensation)",
                "Tank is outdoors — mount float low to stay liquid-buffered, heat-trace/insulate the cable run and junction; add a mechanical sight-gauge as no-electronics backup",
              ],
              [
                "Backup button",
                "Wired doorbell-style button, house power",
                "Uses house's existing connectivity",
                "No battery to fail, near-zero maintenance",
                "Entirely indoors on house power — never touches outside ambient at all",
              ],
            ]}
          />
        </div>
      </details>
    </main>
  );
}

function bigButtonStyle(bg: string, fg: string): CSSProperties {
  return {
    fontSize: "1.05rem",
    fontWeight: 700,
    padding: "1rem 1.2rem",
    borderRadius: 14,
    border: `2px solid ${fg}`,
    background: bg,
    color: fg,
    cursor: "pointer",
    minHeight: "3.6rem",
    width: "100%",
  };
}

function SensorTable({ rows }: { rows: string[][] }) {
  const headers = ["Measurement", "Sensor type", "Needs connectivity?", "Maintenance note", "Cold-weather note"];
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.82rem" }}>
      <thead>
        <tr>
          {headers.map((hd) => (
            <th key={hd} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid var(--border)", whiteSpace: "nowrap" }}>
              {hd}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--ink-soft)", verticalAlign: "top" }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AutoSensorCard({ h, tempC, now }: { h: Household; tempC: number; now: number }) {
  const sewagePct = currentSewagePct(h, now);
  const sew = sewageStatus(sewagePct);
  const residual = chlorineResidualNow(h, tempC, now);
  const quality = qualityStatus(residual);
  const [soonest, latest] = depletionDaysBand(h, tempC, now);
  const hoursSince = (now - h.lastDelivery) / 3_600_000;
  const waterRemainingPct = waterQtyPct(h, now);
  const qty = waterQuantityStatus(waterRemainingPct);

  const potPct = potabilityPct(residual);

  const waterFc = waterForecast(h, tempC, now);
  const sewageFc = sewageForecast(h, now);
  const potFc = potabilityForecast(h, tempC, now);

  // Escalate the displayed color/label (never the underlying %-based variant
  // used for dispatch logic) when the days-remaining caption is itself
  // urgent, so a tank never shows a reassuring "OK" badge right next to an
  // alarming "~9 hrs until empty" caption — see tankForecast.ts.
  const qtyDisp = displayStatusForForecast("water", qty.variant, qty.label, waterFc.soonestDays);
  const sewDisp = displayStatusForForecast("sewage", sew.variant, sew.label, sewageFc.days);
  const qualityDisp = displayStatusForForecast("potability", quality.variant, quality.label, potFc.days);

  // Headline water badge = whichever of quality/quantity is worse — a tank
  // at 0% must never read as merely "approaching the floor."
  const showQtyAsHeadline = RANK[qtyDisp.variant] > RANK[qualityDisp.variant];
  const waterBadge = showQtyAsHeadline ? qtyDisp : qualityDisp;
  const waterBadgeTitle = showQtyAsHeadline ? qty.action : quality.action;
  const sewageLead = sew.variant === "high" ? "Sewage full — water use blocked regardless of tank quality." : null;

  return (
    <div className="card">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.4rem 0.6rem", marginBottom: "0.4rem" }}>
        <div style={{ flex: "1 1 auto", minWidth: 160 }}>
          <strong style={{ fontSize: "1.05rem" }}>{h.id}</strong> ({h.householdSize} people, {h.tankCapacityL}L tank)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          <Badge label={waterBadge.label} variant={waterBadge.variant} title={waterBadgeTitle} />
          <Badge label={sewDisp.label} variant={sewDisp.variant} title={sew.action} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "1.2rem", justifyContent: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <TankSvg pctFull={waterRemainingPct} variant={qtyDisp.variant} label="Water" width={100} height={150} />
          <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)", textAlign: "center", maxWidth: 118 }}>{waterFc.text}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <TankSvg pctFull={sewagePct} variant={sewDisp.variant} label="Sewage" width={100} height={150} />
          <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)", textAlign: "center", maxWidth: 118 }}>{sewageFc.text}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <TankSvg pctFull={potPct} variant={qualityDisp.variant} label="Potability" width={100} height={150} />
          <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)", textAlign: "center", maxWidth: 118 }}>{potFc.text}</span>
        </div>
      </div>
      <details style={{ marginTop: "0.75rem" }}>
        <summary style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Show details</summary>
        <div
          style={{
            marginTop: "0.6rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "0.5rem 1rem",
          }}
        >
          <MiniStat label="Chlorine residual" value={`${residual.toFixed(2)} mg/L`} />
          <MiniStat label="Potability" value={`${potPct.toFixed(0)}%`} />
          <MiniStat label="Last fill" value={`${hoursSince.toFixed(0)}h ago`} />
          <MiniStat label="Water left" value={`~${soonest.toFixed(1)}–${latest.toFixed(1)} d`} />
          <MiniStat label="Tank size" value={`${h.tankCapacityL} L`} />
          <MiniStat label="Avg use" value={`${h.consumptionLpd.toFixed(0)} L/day`} />
          <MiniStat label="Sewage fill" value={`${h.sewageFillRatePctPerDay.toFixed(1)} %/day`} />
        </div>
        <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>What these statuses mean</span>
          <InfoIcon label="What these statuses mean">
            {sewageLead && <>{sewageLead} </>}
            Quality: {quality.action} Quantity: {qty.action} Tank is a plastic cistern — capacity varies house to
            house, not standardized.
          </InfoIcon>
        </div>
      </details>
    </div>
  );
}

function ManualCard({ h, now }: { h: Household; now: number }) {
  const sewagePct = currentSewagePct(h, now);
  const sew = sewageStatus(sewagePct);
  const sewageFc = sewageForecast(h, now);
  const sewDisp = displayStatusForForecast("sewage", sew.variant, sew.label, sewageFc.days);
  return (
    <div className="card">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.4rem 0.6rem", marginBottom: "0.4rem" }}>
        <div style={{ flex: "1 1 auto", minWidth: 160 }}>
          <strong style={{ fontSize: "1.05rem" }}>{h.id}</strong> ({h.householdSize} people, {h.tankCapacityL}L tank)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          <Badge
            label="No sensor yet"
            variant="medium"
            title="This household has no automatic sensor installed yet — status comes from the resident's own backup button."
          />
          {h.manualAlert && (
            <Badge label={h.manualAlert} variant={MANUAL_VARIANT[h.manualAlert]} title={MANUAL_TOOLTIP[h.manualAlert]} />
          )}
          <Badge label={sewDisp.label} variant={sewDisp.variant} title={sew.action} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "1.2rem", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <TankSvg pctFull={sewagePct} variant={sewDisp.variant} label="Sewage" width={110} height={160} />
          <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)", textAlign: "center", maxWidth: 130 }}>{sewageFc.text}</span>
        </div>
      </div>
      <details style={{ marginTop: "0.75rem" }}>
        <summary style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Show details</summary>
        <div
          style={{
            marginTop: "0.6rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "0.5rem 1rem",
          }}
        >
          <MiniStat label="Tank size" value={`${h.tankCapacityL} L`} />
          <MiniStat label="Avg use" value={`${h.consumptionLpd.toFixed(0)} L/day`} />
          <MiniStat label="Sewage fill" value={`${h.sewageFillRatePctPerDay.toFixed(1)} %/day`} />
        </div>
        <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>Why this data</span>
          <InfoIcon label="Why this data">
            Backup button is the only signal from {h.id} — no auto-sensor installed at this address. {sew.action}
          </InfoIcon>
        </div>
      </details>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: "0.66rem", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>
        {value}
      </span>
    </div>
  );
}
