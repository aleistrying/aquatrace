"use client";

/**
 * Ported from pages/2_Plant.py — the treatment facility. One of only two
 * points in the whole system with reliable connectivity (the other being
 * households).
 */

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import Badge from "@/components/Badge";
import BoilWaterBanner from "@/components/BoilWaterBanner";
import InfoIcon from "@/components/InfoIcon";
import SingleScreenTabs, { SingleScreenPage, type ScreenTab } from "@/components/SingleScreenTabs";
import { LEVEL_BAR_COLOR } from "@/components/TankSvg";
import { useNow } from "@/lib/useNow";
import { useHouseholds } from "@/lib/householdStore";
import { usePlantState, logBatch, boilWaterAdvisoryActive, CLEAR_RESULT, DETECTED_RESULT } from "@/lib/plantStore";
import {
  COMMUNITIES,
  fetchCurrentTempC,
  facilityPosition,
  jitteredPosition,
  chlorineResidualNow,
  qualityStatus,
  currentSewagePct,
  sewageStatus,
  worstVariant,
  type Household,
  type Variant,
  type StatusResult,
} from "@/lib/model";

const COMMUNITY_NAMES = Object.keys(COMMUNITIES);
const DOSE_OPTIONS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8];

const MANUAL_VARIANT: Record<string, Variant> = {
  "All good": "low",
  "Tank getting low": "medium",
  "Something's wrong": "high",
};

// Distance BANDS, not compass-direction sectors: the facility sits a fixed
// ~7.8km due south of every community center, so every household's bearing
// from the facility is always "roughly north" regardless of community —
// distance bands actually split the population usefully instead.
const NEAR_BAND_KM = 7.0;
const MID_BAND_KM = 8.0;
const CLUSTER_LABELS = [`Near (<${NEAR_BAND_KM.toFixed(0)}km)`, `Mid (${NEAR_BAND_KM.toFixed(0)}-${MID_BAND_KM.toFixed(0)}km)`, `Far (${MID_BAND_KM.toFixed(0)}km+)`];

function distanceCluster(distKm: number): string {
  if (distKm < NEAR_BAND_KM) return CLUSTER_LABELS[0];
  if (distKm < MID_BAND_KM) return CLUSTER_LABELS[1];
  return CLUSTER_LABELS[2];
}

/** Same flat-earth km-per-degree approximation jitteredPosition() uses. */
function facilityDistanceKm(hLat: number, hLon: number, fLat: number, fLon: number): number {
  const dlatKm = (hLat - fLat) * 111.0;
  const dlonKm = (hLon - fLon) * 111.0 * Math.cos((fLat * Math.PI) / 180);
  return Math.hypot(dlatKm, dlonKm);
}

function householdWaterStatus(h: Household, tempC: number, now: number): StatusResult {
  if (h.hasAutoSensor) {
    return qualityStatus(chlorineResidualNow(h, tempC, now));
  }
  const variant = h.manualAlert ? MANUAL_VARIANT[h.manualAlert] : "medium";
  const label = h.manualAlert ?? "Awaiting manual check-in";
  return { variant, label, action: "Reported via the household's backup button — no auto-sensor at this address." };
}

const RANK: Record<Variant, number> = { low: 0, medium: 1, high: 2 };

/**
 * Stable per-id pseudo-random unit value in [0, 1) — used only to spread
 * dots vertically in the distance-track visual so households at similar
 * real distances don't render exactly on top of each other. Purely a
 * layout jitter (same spirit as model.ts's jitteredPosition), never fed
 * back into any real distance/status computation.
 */
function hashUnit(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 977) / 977;
}

interface NetworkRow {
  id: string;
  size: number;
  distKm: number;
  cluster: string;
  water: StatusResult;
  sewage: StatusResult;
  worst: Variant;
}

export default function PlantPage() {
  const now = useNow();
  const allHouseholds = useHouseholds();
  const plant = usePlantState();
  const boilActive = boilWaterAdvisoryActive();

  const [community, setCommunity] = useState(COMMUNITY_NAMES[0]);
  const [tempC, setTempC] = useState<number | null>(null);
  const [tempSource, setTempSource] = useState("");

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

  // --- Log a treated batch form state ---
  const [dose, setDose] = useState(1.5);
  const [destination, setDestination] = useState(COMMUNITY_NAMES[0]);
  const [testResult, setTestResult] = useState<string>(CLEAR_RESULT);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [successSeq, setSuccessSeq] = useState(0);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    logBatch(dose, testResult);
    setSuccessMsg(`Logged: ${dose.toFixed(1)} mg/L batch for ${destination}. This dose is what the truck page will apply to new deliveries.`);
    setSuccessSeq((n) => n + 1);
  }

  const daysAgo = Math.max(0, Math.floor((now - plant.lastTestDate) / 86_400_000));
  const testPassed = plant.lastTestResult.includes("Clear");

  // --- Household network table ---
  const coords = COMMUNITIES[community];
  const [fLat, fLon] = facilityPosition(community);
  const hhHere = useMemo(() => allHouseholds.filter((h) => h.community === community), [allHouseholds, community]);

  const networkRows: NetworkRow[] = useMemo(() => {
    if (tempC === null) return [];
    return hhHere.map((h) => {
      const [hLat, hLon] = jitteredPosition(h.id, coords.lat, coords.lon);
      const distKm = facilityDistanceKm(hLat, hLon, fLat, fLon);
      const water = householdWaterStatus(h, tempC, now);
      const sewage = sewageStatus(currentSewagePct(h, now));
      const worst = worstVariant(water.variant, sewage.variant);
      return { id: h.id, size: h.householdSize, distKm, cluster: distanceCluster(distKm), water, sewage, worst };
    });
  }, [hhHere, coords.lat, coords.lon, fLat, fLon, tempC, now]);

  const presentClusters = CLUSTER_LABELS.filter((c) => networkRows.some((r) => r.cluster === c));
  const [clusterFilter, setClusterFilter] = useState("All clusters");
  const [sortChoice, setSortChoice] = useState("Urgency (highest first)");

  const filteredRows = useMemo(() => {
    let rows = clusterFilter === "All clusters" ? networkRows : networkRows.filter((r) => r.cluster === clusterFilter);
    rows = [...rows];
    if (sortChoice === "Distance (near → far)") rows.sort((a, b) => a.distKm - b.distKm);
    else if (sortChoice === "Distance (far → near)") rows.sort((a, b) => b.distKm - a.distKm);
    else if (sortChoice === "Household ID") rows.sort((a, b) => a.id.localeCompare(b.id));
    else rows.sort((a, b) => RANK[b.worst] - RANK[a.worst] || b.distKm - a.distKm);
    return rows;
  }, [networkRows, clusterFilter, sortChoice]);

  // Grouped for display: cluster sections always in fixed Near->Mid->Far
  // geographic order, each internally kept in whatever order filteredRows
  // (the chosen sort) already put its members in.
  const groupedRows = useMemo(() => {
    return CLUSTER_LABELS.map((cluster) => ({ cluster, rows: filteredRows.filter((r) => r.cluster === cluster) })).filter(
      (g) => g.rows.length > 0,
    );
  }, [filteredRows]);

  const plantStatusTab: ReactNode = (
    <div style={{ height: "100%", overflowY: "auto", paddingRight: 4 }}>
      <div
        className="card"
        style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "stretch" }}
      >
        <div
          className="aq-facility-anchor"
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "0.35rem 1.5rem 0.35rem 0.25rem",
            minWidth: 190,
            textAlign: "center",
          }}
        >
          <ColiformStatusIcon passed={testPassed} />
          <div style={{ fontSize: "1.7rem", fontWeight: 800, color: testPassed ? "var(--green)" : "var(--danger)", letterSpacing: "0.02em" }}>
            {testPassed ? "PASS" : "FAIL"}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
            Weekly coliform test &middot; {daysAgo} day(s) ago
            <InfoIcon label={testPassed ? "About this pass result" : "About this fail result"}>
              {testPassed
                ? "No coliforms detected — the most consequential reading on this page."
                : "Coliforms detected — this triggers the plant-wide boil-water advisory, active until retested clear."}
            </InfoIcon>
          </div>
        </div>

        <div
          className="aq-facility-stats"
          style={{
            flex: "1 1 220px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: "1.25rem",
          }}
        >
          <StatRow label="Connectivity" value="Connected" live info="Always-on connectivity at this location, per the team's connectivity map." />
          <StatRow label="Current chlorine dose" value={`${plant.doseMgL.toFixed(1)} mg/L`} flashOnChange />
          <StatRow
            label="Ambient temperature"
            value={tempC === null ? "…" : `${tempC.toFixed(1)} °C`}
            live={tempC !== null}
            info={`Source: ${tempSource || "loading"}`}
            last
          />
        </div>
      </div>

      <details style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Sensor list used at this stage</summary>
        <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                {["Measurement", "Sensor type", "Notes", "Cold-weather note"].map((hd) => (
                  <th key={hd} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid var(--border)", whiteSpace: "nowrap" }}>
                    {hd}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Chlorine dosing/residual</td>
                <td style={tdStyle}>Continuous amperometric or colorimetric bench-style analyzer</td>
                <td style={tdStyle}>Standard practice in comparable northern systems already — least new work needed here</td>
                <td style={tdStyle}>Housed inside the heated plant building — no direct cold exposure</td>
              </tr>
              <tr>
                <td style={tdStyle}>Coliform testing</td>
                <td style={tdStyle}>Weekly lab/field test (existing practice per reference material)</td>
                <td style={tdStyle}>The gap this system targets is <em>after</em> this point, not here</td>
                <td style={tdStyle}>Performed indoors at the plant — no cold-weather hardening needed</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );

  const logBatchTab: ReactNode = (
    <div style={{ height: "100%", overflowY: "auto", paddingRight: 4 }}>
      <h2 style={{ fontSize: "1.1rem", marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        Log a treated batch
        <InfoIcon label="Why dropdowns, not free text">
          Pre-made choices, not free text — fast to fill in while running the plant.
        </InfoIcon>
      </h2>
      <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.9rem", maxWidth: 640 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Chlorine dose applied (mg/L): {dose.toFixed(1)}</span>
          <input
            type="range"
            min={0}
            max={DOSE_OPTIONS.length - 1}
            step={1}
            value={DOSE_OPTIONS.indexOf(dose)}
            onChange={(e) => setDose(DOSE_OPTIONS[Number(e.target.value)])}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 280 }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Destination community</span>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          >
            {COMMUNITY_NAMES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <legend style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 2 }}>Weekly coliform test result</legend>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              padding: "0.5rem 0.7rem",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            <input type="radio" name="test_result" value={CLEAR_RESULT} checked={testResult === CLEAR_RESULT} onChange={() => setTestResult(CLEAR_RESULT)} />
            <span>{CLEAR_RESULT}</span>
          </label>

          <label
            className={`aq-detected-option${testResult === DETECTED_RESULT ? " aq-detected-selected" : ""}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
              padding: "0.6rem 0.8rem",
              borderRadius: 10,
              border: "1.5px solid var(--border)",
            }}
          >
            <input
              type="radio"
              name="test_result"
              value={DETECTED_RESULT}
              checked={testResult === DETECTED_RESULT}
              onChange={() => setTestResult(DETECTED_RESULT)}
              style={{ marginTop: 3 }}
            />
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 3.6 L21 19.8 H3 Z" fill="var(--danger-tint)" />
              <path d="M12 9.6 V14.2" />
              <circle cx="12" cy="16.9" r="1" fill="var(--danger)" stroke="none" />
            </svg>
            <span>
              <span style={{ fontWeight: 700, color: "var(--danger)" }}>{DETECTED_RESULT}</span>
              <br />
              <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                Fires a plant-wide boil-water advisory, visible on every page, until retested clear — not a routine
                choice.
              </span>
            </span>
          </label>

          {testResult === DETECTED_RESULT && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--danger-tint)",
                color: "var(--danger)",
                borderRadius: 10,
                padding: "0.6rem 0.8rem",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              Logging this batch will trigger the boil-water advisory for {destination} on submit.
            </div>
          )}
        </fieldset>
        <button
          type="submit"
          style={{
            alignSelf: "flex-start",
            fontSize: "1rem",
            fontWeight: 700,
            padding: "0.7rem 1.3rem",
            borderRadius: 12,
            border: "2px solid var(--teal)",
            background: "var(--teal-tint)",
            color: "var(--teal)",
            cursor: "pointer",
          }}
        >
          Log batch
        </button>
        {successMsg && (
          <div
            key={successSeq}
            style={{ display: "flex", alignItems: "center", gap: 8, animation: "aq-success-enter 0.4s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" fill="var(--green-tint)" />
              <path
                d="M6.5 12.5 L10.2 16.2 L17.5 8"
                stroke="var(--green)"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "aq-check-draw 0.45s ease-out 0.12s forwards" }}
              />
            </svg>
            <p style={{ color: "var(--green)", fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>{successMsg}</p>
          </div>
        )}
      </form>
    </div>
  );

  const householdNetworkTab: ReactNode = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flexShrink: 0 }}>
        <h2 style={{ fontSize: "1.1rem", marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          Household network — {community}
          <InfoIcon label="What this section is for">
            Operator-facing detail the community-wide maps don&apos;t show: every household this facility serves,
            its distance from the plant, which cluster it&apos;s in, and its current water/sewage status — for
            routing/logistics judgment calls, not the public overview.
          </InfoIcon>
        </h2>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Filter by cluster</span>
            <select
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              <option>All clusters</option>
              {presentClusters.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Sort by</span>
            <select
              value={sortChoice}
              onChange={(e) => setSortChoice(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              {["Urgency (highest first)", "Distance (near → far)", "Distance (far → near)", "Household ID"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>

        <p style={{ color: "var(--ink-soft)", fontSize: "0.78rem", margin: "0 0 0.4rem" }}>
          Showing {filteredRows.length} of {networkRows.length} households monitored in {community}.
        </p>

        {networkRows.length > 0 && <DistanceTrack rows={networkRows} highlighted={filteredRows} />}
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
        {groupedRows.map(({ cluster, rows }) => (
          <div key={cluster} style={{ marginTop: "0.9rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", margin: 0 }}>{cluster}</h3>
              <span style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>&middot; {rows.length} household(s)</span>
            </div>
            {rows.map((r) => (
              <div key={r.id} className="card" style={{ marginBottom: "0.5rem", padding: "0.6rem 0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <strong>{r.id}</strong>{" "}
                    <span style={{ color: "var(--ink-soft)", fontSize: "0.82rem" }}>
                      &middot; {r.size} people &middot; {r.distKm.toFixed(1)} km from facility
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <Badge label={r.water.label} variant={r.water.variant} title={r.water.action} />
                    <Badge label={r.sewage.label} variant={r.sewage.variant} title={r.sewage.action} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {filteredRows.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>No households match this filter.</p>}
      </div>
    </div>
  );

  const tabs: ScreenTab[] = [
    { id: "status", label: "Plant status", content: plantStatusTab },
    { id: "log", label: "Log a batch", content: logBatchTab },
    { id: "network", label: "Household network", content: householdNetworkTab },
  ];

  return (
    <SingleScreenPage>
      <style>{`
        @keyframes aq-success-enter { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes aq-check-draw { to { stroke-dashoffset: 0; } }
        @keyframes aq-value-flash { 0% { background: var(--gold-tint); } 100% { background: transparent; } }
        @keyframes aq-fail-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .aq-facility-stats { border-left: 1px solid var(--border); }
        @media (max-width: 560px) {
          .aq-facility-anchor { padding-right: 0.25rem !important; min-width: 0 !important; width: 100%; }
          .aq-facility-stats { border-left: none; border-top: 1px solid var(--border); padding-left: 0 !important; padding-top: 0.9rem; margin-top: 0.25rem; width: 100%; }
        }
        .aq-detected-option { transition: background 0.15s ease, border-color 0.15s ease; }
        .aq-detected-option.aq-detected-selected { background: var(--danger-tint); border-color: var(--danger); }
        .aq-cluster-dot { flex-shrink: 0; }
      `}</style>

      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.4rem 1rem",
            padding: "2px 2px 8px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: "1.15rem", margin: 0, lineHeight: 1.25 }}>Treatment facility</h1>
            <p style={{ margin: "1px 0 0", fontSize: "0.74rem", color: "var(--ink-soft)" }}>
              One of the two fixed points with reliable connectivity (the other is houses)
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <Badge label="Already monitored weekly" variant="low" title="Coliform testing at the plant is already standard practice in comparable northern systems." />
            <InfoIcon label="What this page does and doesn't cover">
              The gap this system targets is everything <em>after</em> water leaves here (truck → tank → tap), not
              the plant.
            </InfoIcon>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Facility serving</span>
              <select
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                style={{ padding: "6px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem" }}
              >
                {COMMUNITY_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {boilActive && <BoilWaterBanner />}
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <SingleScreenTabs tabs={tabs} />
      </div>
    </SingleScreenPage>
  );
}

const tdStyle: CSSProperties = { padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--ink-soft)", verticalAlign: "top" };

/**
 * The coliform pass/fail result is the single most consequential number on
 * this page (it's what flips the plant-wide boil-water advisory) — this is
 * its visual anchor: a large status glyph instead of another equal-weight
 * metric tile. Pass = a drawn checkmark (echoes the batch-log success
 * check); fail = the same hazard triangle used by BoilWaterBanner, so the
 * two places that mean "boil-water advisory" share one glyph.
 */
function ColiformStatusIcon({ passed }: { passed: boolean }) {
  if (passed) {
    return (
      <svg width={44} height={44} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="var(--green-tint)" />
        <path
          d="M6.5 12.5 L10.2 16.2 L17.5 8"
          stroke="var(--green)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "aq-check-draw 0.45s ease-out 0.12s forwards" }}
        />
      </svg>
    );
  }
  return (
    <svg
      width={44}
      height={44}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--danger)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ animation: "aq-fail-pulse 1.6s ease-in-out infinite" }}
    >
      <path d="M12 3.6 L21 19.8 H3 Z" fill="var(--danger-tint)" />
      <path d="M12 9.6 V14.2" />
      <circle cx="12" cy="16.9" r="1" fill="var(--danger)" stroke="none" />
    </svg>
  );
}

function StatRow({
  label,
  value,
  info,
  live,
  flashOnChange,
  last,
}: {
  label: string;
  value: string;
  info?: string;
  live?: boolean;
  flashOnChange?: boolean;
  last?: boolean;
}) {
  const prevValue = useRef<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const prev = prevValue.current;
    prevValue.current = value;
    if (!flashOnChange || prev === null || prev === value) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [value, flashOnChange]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.4rem 0",
        borderBottom: last ? "none" : "1px solid var(--border)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
        {info && <InfoIcon label={`About ${label}`}>{info}</InfoIcon>}
      </span>
      <span
        style={{
          fontSize: "1.05rem",
          fontWeight: 700,
          borderRadius: 6,
          display: "inline-block",
          animation: flash ? "aq-value-flash 0.9s ease-out" : undefined,
        }}
      >
        {value}
        {live && <span className="aq-live-dot" />}
      </span>
    </div>
  );
}

/**
 * Visual encoding of the real per-household distance-from-facility data
 * (already computed above as distKm/cluster) as a near/mid/far dot plot,
 * instead of only stating the distance as text in each row. Dots are
 * colored by worst water/sewage status, and dim when a household is
 * filtered out of the list below (so this stays in sync with the
 * filter/sort controls rather than being a separate, disconnected view).
 */
function DistanceTrack({ rows, highlighted }: { rows: NetworkRow[]; highlighted: NetworkRow[] }) {
  const clipId = useId();
  const width = 640;
  const height = 64;
  const trackTop = 4;
  const trackBottom = height - 4;
  const maxD = Math.max(MID_BAND_KM + 1, ...rows.map((r) => r.distKm));
  const nearX = (NEAR_BAND_KM / maxD) * width;
  const midX = (MID_BAND_KM / maxD) * width;
  const nearPct = (NEAR_BAND_KM / maxD) * 100;
  const midPct = ((MID_BAND_KM - NEAR_BAND_KM) / maxD) * 100;
  const farPct = 100 - nearPct - midPct;
  const midY = height / 2;
  const jitterRange = height / 2 - 10;
  const highlightedIds = useMemo(() => new Set(highlighted.map((r) => r.id)), [highlighted]);

  return (
    <div className="card" style={{ margin: "0.75rem 0 1rem", padding: "0.85rem 1rem 0.7rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4, fontSize: "0.72rem", color: "var(--ink-soft)", marginBottom: 6 }}>
        <span>Facility (0 km)</span>
        <span>Each dot is one household, plotted at its real distance &middot; color = worst status</span>
        <span>{maxD.toFixed(0)}+ km</span>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block" }}
        role="img"
        aria-label="Households plotted by distance from the treatment facility, grouped into near, mid and far bands"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0.5} y={trackTop} width={width - 1} height={trackBottom - trackTop} rx={8} ry={8} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect x={0} y={trackTop} width={nearX} height={trackBottom - trackTop} fill="var(--surface-raised)" />
          <rect x={nearX} y={trackTop} width={midX - nearX} height={trackBottom - trackTop} fill="transparent" />
          <rect x={midX} y={trackTop} width={width - midX} height={trackBottom - trackTop} fill="var(--surface-raised)" />
        </g>
        <rect x={0.5} y={trackTop} width={width - 1} height={trackBottom - trackTop} rx={8} ry={8} fill="none" stroke="var(--border)" />
        <line x1={nearX} x2={nearX} y1={trackTop} y2={trackBottom} stroke="var(--border)" strokeDasharray="3 3" />
        <line x1={midX} x2={midX} y1={trackTop} y2={trackBottom} stroke="var(--border)" strokeDasharray="3 3" />
        <circle cx={4} cy={midY} r={4} fill="var(--teal)" />
        {rows.map((r) => {
          const x = Math.min(width - 6, Math.max(10, (r.distKm / maxD) * width));
          const y = midY + (hashUnit(r.id) - 0.5) * 2 * jitterRange;
          const dim = !highlightedIds.has(r.id);
          return (
            <circle key={r.id} cx={x} cy={y} r={4} fill={LEVEL_BAR_COLOR[r.worst]} opacity={dim ? 0.15 : 0.88}>
              <title>{`${r.id} — ${r.distKm.toFixed(1)} km from facility (${r.cluster}) — water: ${r.water.label}, sewage: ${r.sewage.label}`}</title>
            </circle>
          );
        })}
      </svg>
      <div style={{ display: "flex", marginTop: 6 }}>
        <div style={{ flex: `${nearPct} 0 0%`, textAlign: "center", fontSize: "0.72rem", color: "var(--ink-soft)" }}>{CLUSTER_LABELS[0]}</div>
        <div style={{ flex: `${midPct} 0 0%`, textAlign: "center", fontSize: "0.72rem", color: "var(--ink-soft)" }}>{CLUSTER_LABELS[1]}</div>
        <div style={{ flex: `${farPct} 0 0%`, textAlign: "center", fontSize: "0.72rem", color: "var(--ink-soft)" }}>{CLUSTER_LABELS[2]}</div>
      </div>
    </div>
  );
}
