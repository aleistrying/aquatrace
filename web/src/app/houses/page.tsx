"use client";

/**
 * Ported from pages/1_Houses.py — demonstrates the data a household
 * water/sewage sensor (or, where none exists yet, a simple manual backup
 * button) would feed into the centralized system. Residents themselves
 * don't need this dashboard; it exists to show judges/the team what data
 * arrives from each house.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import SingleScreenTabs, { SingleScreenPage } from "@/components/SingleScreenTabs";
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

const VARIANT_COLOR: Record<Variant, string> = { low: "var(--green)", medium: "var(--gold)", high: "var(--danger)" };
const VARIANT_TINT: Record<Variant, string> = { low: "var(--green-tint)", medium: "var(--gold-tint)", high: "var(--danger-tint)" };

/**
 * Small icon+color affordance so status reads at a glance without parsing
 * text (check = OK, dot = watch, x = urgent) — same three-variant model as
 * Badge, just a faster-reading glyph instead of / alongside a text pill.
 */
function StatusIcon({ variant, size = 18 }: { variant: Variant; size?: number }) {
  const color = VARIANT_COLOR[variant];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill={color} opacity={0.16} />
      {variant === "low" && (
        <path d="M7 12.5l3 3 7-7" stroke={color} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      )}
      {variant === "medium" && (
        <path d="M12 7v6.2M12 16.6v.01" stroke={color} strokeWidth={2.3} strokeLinecap="round" fill="none" />
      )}
      {variant === "high" && (
        <path d="M8 8l8 8M16 8l-8 8" stroke={color} strokeWidth={2.3} strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}

/**
 * The single big, bold visual anchor for "is this household's water OK, and
 * for how long" — the one operational question this page exists to answer.
 * Everything it shows (label + forecast text) is already computed upstream
 * from the real model.ts/tankForecast.ts formulas; this just gives that
 * existing answer top billing instead of letting it compete with the small
 * badges/tank captions around it.
 */
function HeroStatus({
  eyebrow,
  label,
  detail,
  variant,
  title,
}: {
  eyebrow: string;
  label: string;
  detail?: string;
  variant: Variant;
  title?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.7rem",
        padding: "0.55rem 0.85rem",
        borderRadius: 12,
        background: VARIANT_TINT[variant],
        border: `1px solid ${VARIANT_COLOR[variant]}`,
        marginBottom: "0.6rem",
      }}
      title={title}
    >
      <StatusIcon variant={variant} size={30} />
      <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 100 }}>
        <span style={{ fontSize: "0.64rem", fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {eyebrow}
        </span>
        <span style={{ fontSize: "1.3rem", fontWeight: 800, color: VARIANT_COLOR[variant], lineHeight: 1.15 }}>{label}</span>
      </div>
      {detail && (
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: VARIANT_COLOR[variant] }}>
            {detail}
          </span>
        </div>
      )}
    </div>
  );
}

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

  const liveReadingTab = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: "0.6rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "1.2rem", flexShrink: 0 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200 }}>
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

        <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "var(--ink-soft)", paddingBottom: 9 }}>
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
      </div>

      {h && tempC !== null ? (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
          <div style={{ flex: "2 1 420px", minWidth: 280 }}>
            {h.hasAutoSensor ? (
              <AutoSensorCard h={h} tempC={tempC} now={now} />
            ) : (
              <ManualCard h={h} now={now} />
            )}
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
      ) : (
        <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", fontSize: "0.85rem" }}>
          Loading current readings…
        </div>
      )}
    </div>
  );

  const fillCycleTab =
    h && tempC !== null ? (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 0, overflowY: "auto" }}>
        <div style={{ maxWidth: 640, width: "100%" }}>
          <TankCyclePreview h={h} tempC={tempC} />
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-soft)", fontSize: "0.85rem" }}>
        Loading current readings…
      </div>
    );

  const sensorListTab = (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Sensor list used at the household stage</div>
        <SensorTable
          rows={[
              {
                measurement: "Water tank level",
                sensorType: "Ultrasonic (non-contact) — same category piloted by Université Laval / Sentinel Nord in Kuujjuaq",
                needsConnectivity: false,
                connectivityNote: "Local readout only; a relay adds remote view.",
                maintenanceNote: "No wetted parts, freeze-tolerant.",
                coldNote: "Tank is indoors — sensor sees heated indoor air, not -49°C outside; no hardening needed.",
              },
              {
                measurement: "Water tank quality",
                sensorType: "Turbidity (optical/IR) + amperometric chlorine residual probe",
                needsConnectivity: false,
                connectivityNote: "Local readout only; a relay adds remote view.",
                maintenanceNote: "Amperometric preferred — no reagents to freeze or expire.",
                coldNote: "Probe is submerged in tank water (stays above freezing indoors) — cold-safe by placement, not spec.",
              },
              {
                measurement: "Sewage tank level",
                sensorType: "Float switch (mechanical/magnetic reed)",
                needsConnectivity: false,
                connectivityNote: "Local readout only; a relay adds remote view.",
                maintenanceNote: "More failure-tolerant than ultrasonic in a corrosive-gas tank (no false readings from foam/condensation).",
                coldNote: "Tank is outdoors — mount float low to stay liquid-buffered, heat-trace/insulate the cable run and junction; add a mechanical sight-gauge as no-electronics backup.",
              },
              {
                measurement: "Backup button",
                sensorType: "Wired doorbell-style button, house power",
                needsConnectivity: true,
                connectivityNote: "Uses the house's existing connectivity.",
                maintenanceNote: "No battery to fail, near-zero maintenance.",
                coldNote: "Entirely indoors on house power — never touches outside ambient at all.",
              },
            ]}
        />
      </div>
    </div>
  );

  return (
    <SingleScreenPage>
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.3rem 1rem", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.3rem 0.7rem" }}>
            <h1 style={{ fontSize: "1.4rem" }}>Houses</h1>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-soft)" }}>
              What a household water tank, sewage tank, or backup button would report
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
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
        </div>

        {boilActive && <BoilWaterBanner />}
        {crisisMessage && <CrisisBanner message={crisisMessage} />}
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <SingleScreenTabs
          tabs={[
            { id: "live", label: "Live reading", content: liveReadingTab },
            { id: "cycle", label: "Fill-cycle preview", content: fillCycleTab },
            { id: "sensors", label: "Sensor list", content: sensorListTab },
          ]}
        />
      </div>
    </SingleScreenPage>
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

interface SensorRow {
  measurement: string;
  sensorType: string;
  needsConnectivity: boolean;
  connectivityNote: string;
  maintenanceNote: string;
  coldNote: string;
}

/**
 * Connectivity is a plain yes/no — an icon reads faster than repeating
 * "No (local readout)"/"Uses house's existing connectivity" in every row
 * (rule: icons over text where an icon reads faster). The explanatory
 * clause moves behind a hover/tap InfoIcon rather than sitting in the cell
 * as an always-visible sentence.
 */
function ConnectivityCell({ needsConnectivity, note }: { needsConnectivity: boolean; note: string }) {
  const color = needsConnectivity ? "var(--teal)" : "var(--ink-soft)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width={15} height={15} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
        {needsConnectivity ? (
          <path d="M6 12.5l4 4 8-9" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : (
          <path d="M6 12h12" stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        )}
      </svg>
      <span style={{ color, fontWeight: 600 }}>{needsConnectivity ? "Yes" : "No"}</span>
      <InfoIcon label="Connectivity note">{note}</InfoIcon>
    </span>
  );
}

/**
 * Sensor reference table: each row used to carry two full sentences of
 * always-visible "why" prose (maintenance rationale, cold-weather
 * rationale). That background explanation now lives behind one InfoIcon per
 * row instead of two wide text columns — nothing removed, just no longer
 * competing for attention with the identifying facts (measurement/sensor
 * type/connectivity) that a viewer actually scans this table for.
 */
function SensorTable({ rows }: { rows: SensorRow[] }) {
  // Column order deliberately keeps both InfoIcon triggers (Connectivity,
  // Notes) away from the table's right edge, with the free-text "Sensor
  // type" description — which has no popover to clip — last. InfoIcon's
  // popover always opens to the right of its trigger, so a trigger sitting
  // flush against the right edge of a full-width table would push its
  // popover off-screen; this ordering keeps every popover on-screen at
  // 1366px without needing to touch the shared InfoIcon component.
  const headers = ["Measurement", "Needs connectivity?", "Notes", "Sensor type"];
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
        {rows.map((row) => (
          <tr key={row.measurement}>
            <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--ink)", fontWeight: 600, verticalAlign: "top", whiteSpace: "nowrap" }}>
              {row.measurement}
            </td>
            <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "top", whiteSpace: "nowrap" }}>
              <ConnectivityCell needsConnectivity={row.needsConnectivity} note={row.connectivityNote} />
            </td>
            <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "top", whiteSpace: "nowrap" }}>
              <InfoIcon label={`Maintenance and cold-weather notes for ${row.measurement}`}>
                <strong>Maintenance:</strong> {row.maintenanceNote}
                <br />
                <br />
                <strong>Cold weather:</strong> {row.coldNote}
              </InfoIcon>
            </td>
            <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--ink-soft)", verticalAlign: "top", width: "100%" }}>
              {row.sensorType}
            </td>
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
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.4rem 0.6rem", marginBottom: "0.5rem" }}>
        <div style={{ flex: "1 1 auto", minWidth: 160 }}>
          <strong style={{ fontSize: "1.05rem" }}>{h.id}</strong> ({h.householdSize} people, {h.tankCapacityL}L tank)
        </div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.4rem" }}>
          <StatusIcon variant={sewDisp.variant} size={16} />
          <Badge label={sewDisp.label} variant={sewDisp.variant} title={sew.action} />
        </div>
      </div>

      {/* Big-number anchor: the worse of quality/quantity, with the matching
          real days-remaining forecast — the one number this card exists to
          answer. The small per-tank badge/caption below stays as backup detail. */}
      <HeroStatus
        eyebrow="Water status"
        label={waterBadge.label}
        detail={showQtyAsHeadline ? waterFc.text : potFc.text}
        variant={waterBadge.variant}
        title={waterBadgeTitle}
      />

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
  const manualVariant: Variant = h.manualAlert ? MANUAL_VARIANT[h.manualAlert] : "medium";
  const manualLabel = h.manualAlert ?? "No report yet";
  const manualTitle = h.manualAlert ? MANUAL_TOOLTIP[h.manualAlert] : "Resident hasn't pressed the backup button yet.";
  return (
    <div className="card">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.4rem 0.6rem", marginBottom: "0.5rem" }}>
        <div style={{ flex: "1 1 auto", minWidth: 160 }}>
          <strong style={{ fontSize: "1.05rem" }}>{h.id}</strong> ({h.householdSize} people, {h.tankCapacityL}L tank)
        </div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.4rem" }}>
          <Badge
            label="No sensor yet"
            variant="medium"
            title="This household has no automatic sensor installed yet — status comes from the resident's own backup button."
          />
          <StatusIcon variant={sewDisp.variant} size={16} />
          <Badge label={sewDisp.label} variant={sewDisp.variant} title={sew.action} />
        </div>
      </div>

      {/* Big-number anchor for the manual-report households: there's no
          formula-driven forecast here (no sensor), so the resident's own
          last report IS the answer to "is this household's water OK" — give
          it the same top billing the sensor-backed card gives its forecast. */}
      <HeroStatus eyebrow="Water status (resident-reported)" label={manualLabel} variant={manualVariant} title={manualTitle} />

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
