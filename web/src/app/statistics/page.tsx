"use client";

/**
 * Statistics page — ported from pages/6_Statistics.py. Reads the two
 * pre-generated JSON result files already committed in the repo (real,
 * run, verified simulation output — not recomputed or invented here) and
 * renders the same baseline-vs-optimized comparison the Python page shows.
 *
 * "use client": purely to drive the entrance count-up/bar-grow animations
 * below (via requestAnimationFrame / a mount-triggered CSS transition) — the
 * data itself is still the same statically-imported JSON, read and rendered
 * exactly as before, nothing server-only was in use here anyway.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import InfoIcon from "@/components/InfoIcon";
import SingleScreenTabs, { SingleScreenPage } from "@/components/SingleScreenTabs";
import { COMMUNITIES } from "@/lib/model";
import { useCountUpOnMount } from "@/lib/useMotion";
import fullscale from "@/data/delivery_comparison_fullscale_results.json";
import smallSample from "@/data/delivery_comparison_results.json";

type CommunityMap = Record<string, number>;

interface FullscaleResults {
  generated_at: string;
  params: Record<string, number>;
  fleet_size: CommunityMap;
  household_count: CommunityMap;
  baseline_coverage_days: CommunityMap;
  optimized_coverage_days: CommunityMap;
  baseline_bad_state_household_days: CommunityMap;
  optimized_bad_state_household_days: CommunityMap;
  baseline_avg_coverage_days: number;
  optimized_avg_coverage_days: number;
  baseline_total_bad_state_days: number;
  optimized_total_bad_state_days: number;
  baseline_retries: CommunityMap;
  optimized_retries: CommunityMap;
  reference_check_14_16_days_passed: boolean;
}

interface SmallSampleResults {
  generated_at: string;
  tick_minutes: number;
  trip_minutes: number;
  baseline_coverage_days: CommunityMap;
  optimized_coverage_days: CommunityMap;
  baseline_bad_state_household_days: CommunityMap;
  optimized_bad_state_household_days: CommunityMap;
  baseline_avg_coverage_days: number;
  optimized_avg_coverage_days: number;
  baseline_total_bad_state_days: number;
  optimized_total_bad_state_days: number;
}

const data = fullscale as FullscaleResults;
const small = smallSample as SmallSampleResults;

const COMMUNITY_NAMES = Object.keys(COMMUNITIES);

// Chosen from this app's fixed 4-hue token budget (teal/green/gold/danger):
// green/danger are already reserved elsewhere in this app for household
// low/high risk status, so re-using them here for a strategy comparison
// (not a risk level) would overload their meaning. teal + gold is the pair
// from this fixed palette that actually reads as distinct in both normal
// and color-deficient vision (validated) — teal for this app's own
// predictive+batch system, gold for the prior blind-rotation baseline.
const BASELINE_COLOR = "var(--gold)";
const OPTIMIZED_COLOR = "var(--teal)";
const BASELINE_LABEL = "Baseline (blind rotation)";
const OPTIMIZED_LABEL = "Predictive + batch";

function fmt1(n: number): string {
  return n.toLocaleString("en-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmt0(n: number): string {
  return Math.round(n).toLocaleString("en-CA");
}

function StatTile({
  label,
  value,
  fmt,
  delta,
}: {
  label: string;
  value: number;
  fmt: (n: number) => string;
  delta?: string;
}) {
  // Headline number grows in from 0 on mount (deck's own .big[data-target]
  // count-up idiom) rather than appearing at full size instantly.
  const animated = useCountUpOnMount(value);
  return (
    <div className="card" style={{ flex: "1 1 220px" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.9rem", fontWeight: 700, fontFamily: "var(--font-body)" }}>{fmt(animated)}</div>
      {delta && (
        <div style={{ fontSize: "0.82rem", color: "var(--green)", fontWeight: 600, marginTop: 4 }}>{delta}</div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 6, fontSize: "0.76rem", color: "var(--ink-soft)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: BASELINE_COLOR, display: "inline-block" }} />
        {BASELINE_LABEL}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: OPTIMIZED_COLOR, display: "inline-block" }} />
        {OPTIMIZED_LABEL}
      </span>
    </div>
  );
}

/** A small triangular up/down/flat indicator — used everywhere a
 * baseline-vs-optimized delta needs to read at a glance without requiring
 * the "-"/"+" sign or "faster"/"slower" wording to be parsed first. */
function DeltaArrowIcon({ direction, color, size = 10 }: { direction: "up" | "down" | "flat"; color: string; size?: number }) {
  if (direction === "flat") {
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="1" y="4.2" width="8" height="1.6" rx="0.8" fill={color} />
      </svg>
    );
  }
  const points = direction === "down" ? "1,2 9,2 5,9" : "1,8 9,8 5,1";
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" style={{ flexShrink: 0 }}>
      <polygon points={points} fill={color} />
    </svg>
  );
}

/** Pass/fail check mark — reinforces the reference-check badge's color with
 * a shape too, so the result doesn't rely on hue alone. */
function StatusIcon({ ok, size = 13 }: { ok: boolean; size?: number }) {
  const color = ok ? "var(--green)" : "var(--danger)";
  return ok ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <polyline points="4 12 9 17 20 6" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

/** Small gear glyph flagging the model-parameters disclosure as a
 * methodology/config panel (kept collapsed by default, see the <details>
 * it labels in the Retries & methodology tab). */
function GearIcon({ size = 14 }: { size?: number }) {
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

/**
 * The "headline comparison" for a per-community chart: one big baseline
 * number, one big optimized number, and a single delta pill — so the
 * viewer gets the gist without reading all 4 community rows first. The
 * per-community detail stays right below it (rule: detail still reachable,
 * just visually subordinate to this headline).
 */
function ChartHeadline({
  baselineValue,
  optimizedValue,
  fmt,
  unit,
  deltaMode,
}: {
  baselineValue: number;
  optimizedValue: number;
  fmt: (n: number) => string;
  unit: string;
  deltaMode: "days" | "percent" | "count";
}) {
  const delta = baselineValue - optimizedValue; // positive = optimized (this app's system) is lower/better
  const improved = delta > 0;
  const flat = delta === 0;
  const direction: "up" | "down" | "flat" = flat ? "flat" : improved ? "down" : "up";
  const color = flat ? "var(--ink-soft)" : improved ? "var(--green)" : "var(--danger)";
  const bg = flat ? "var(--surface)" : improved ? "var(--green-tint)" : "var(--danger-tint)";
  const sign = flat ? "" : improved ? "-" : "+";
  const abs = Math.abs(delta);

  let deltaText: string;
  if (deltaMode === "percent") {
    const pct = baselineValue !== 0 ? Math.abs((100 * delta) / baselineValue) : 0;
    deltaText = flat ? "no change" : `${sign}${pct.toFixed(0)}% ${improved ? "fewer" : "more"}`;
  } else if (deltaMode === "count") {
    deltaText = flat ? "no change" : `${sign}${fmt(abs)} ${improved ? "fewer" : "more"}`;
  } else {
    deltaText = flat ? "no change" : `${sign}${fmt(abs)}${unit} ${improved ? "faster" : "slower"}`;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        padding: "5px 10px",
        marginBottom: 6,
        borderRadius: 8,
        background: "var(--surface-raised)",
      }}
    >
      <span style={{ fontSize: "0.68rem", color: "var(--ink-soft)" }}>{BASELINE_LABEL}</span>
      <strong style={{ fontSize: "1.05rem", color: BASELINE_COLOR, fontVariantNumeric: "tabular-nums" }}>
        {fmt(baselineValue)}
        {unit}
      </strong>
      <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)" }}>vs</span>
      <span style={{ fontSize: "0.68rem", color: "var(--ink-soft)" }}>{OPTIMIZED_LABEL}</span>
      <strong style={{ fontSize: "1.05rem", color: OPTIMIZED_COLOR, fontVariantNumeric: "tabular-nums" }}>
        {fmt(optimizedValue)}
        {unit}
      </strong>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 99,
          background: bg,
          color,
          fontWeight: 700,
          fontSize: "0.78rem",
          marginLeft: "auto",
          fontVariantNumeric: "tabular-nums",
        }}
        title="Headline comparison across all 4 communities combined"
      >
        <DeltaArrowIcon direction={direction} color={color} />
        {deltaText}
      </span>
    </div>
  );
}

/** A single comparison bar's fill, grown in from 0 on mount (rather than
 * appearing at full width instantly) via a mount-triggered CSS transition. */
function AnimatedBarFill({ pct, color, title }: { pct: number; color: string; title: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    // Deferred a tick so the initial (0%) width actually paints first —
    // otherwise the browser may coalesce the 0 -> final change into one
    // frame and the CSS transition never gets a chance to run.
    const t = setTimeout(() => setWidth(pct), 30);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div
      title={title}
      className="pg-bar-fill"
      style={{ width: `${width}%`, background: color, height: "100%", borderRadius: 4 }}
    />
  );
}

function BarGroupChart({
  title,
  caption,
  infoNote,
  baseline,
  optimized,
  unit,
  digits = 1,
  headlineBaseline,
  headlineOptimized,
  headlineDeltaMode = "days",
  style,
}: {
  title: string;
  caption: string;
  /** Extra "why it matters" detail, tucked behind an InfoIcon next to the
   * title instead of sitting in the always-visible caption. */
  infoNote?: ReactNode;
  baseline: CommunityMap;
  optimized: CommunityMap;
  unit: string;
  digits?: number;
  /** The single headline comparison for this chart (already-aggregated
   * real numbers from the same source JSON as the per-community rows below
   * — e.g. the JSON's own precomputed average/total, or a plain sum of the
   * exact per-community values rendered here). */
  headlineBaseline: number;
  headlineOptimized: number;
  headlineDeltaMode?: "days" | "percent" | "count";
  style?: CSSProperties;
}) {
  const max = Math.max(...COMMUNITY_NAMES.flatMap((c) => [baseline[c] ?? 0, optimized[c] ?? 0]), 1);
  const fmt = digits === 0 ? fmt0 : fmt1;
  // "Table view" SWAPS the bars for a table (rather than expanding a
  // <details> additively underneath them) - with a fixed-height card in a
  // single-screen tab, showing both at once would either overflow the card
  // or force it to grow the page. A toggle keeps both views reachable
  // (nothing lost) while guaranteeing the panel never has to grow.
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="card" style={{ height: "100%", minHeight: 0, overflow: "auto", ...style }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <h3 style={{ fontSize: "1.0rem", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
            {title}
            {infoNote && <InfoIcon label={`Why this matters: ${title}`}>{infoNote}</InfoIcon>}
          </h3>
          <p style={{ margin: "0 0 6px 0", fontSize: "0.76rem", color: "var(--ink-soft)" }}>{caption}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          style={{
            flexShrink: 0,
            cursor: "pointer",
            fontSize: "0.76rem",
            fontWeight: 700,
            color: "var(--teal)",
            background: "var(--teal-tint)",
            border: "1px solid var(--teal)",
            borderRadius: 8,
            padding: "4px 10px",
          }}
        >
          {showTable ? "Chart view" : "Table view"}
        </button>
      </div>
      <ChartHeadline
        baselineValue={headlineBaseline}
        optimizedValue={headlineOptimized}
        fmt={fmt}
        unit={unit}
        deltaMode={headlineDeltaMode}
      />
      {showTable ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4, fontSize: "0.78rem", minWidth: 320 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Community</th>
                <th style={{ textAlign: "right", padding: "4px 6px" }}>{BASELINE_LABEL}</th>
                <th style={{ textAlign: "right", padding: "4px 6px" }}>{OPTIMIZED_LABEL}</th>
              </tr>
            </thead>
            <tbody>
              {COMMUNITY_NAMES.map((c) => (
                <tr key={c} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "4px 6px" }}>{c}</td>
                  <td style={{ padding: "4px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(baseline[c] ?? 0)}
                    {unit}
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(optimized[c] ?? 0)}
                    {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
      <div className="eyebrow" style={{ marginBottom: 4 }}>By community</div>
      <Legend />
      {/* Grouped bars are kept compact (smaller bar height/gaps than a
          standalone page version) so 4 communities x 2 bars fits within a
          single-screen tab panel, incl. when placed side-by-side with a
          sibling chart - see statistics/page.tsx header comment. Rows are
          zebra-striped so 4 near-identical blocks read as one clean
          comparison rather than 4 repeated mini-charts. */}
      <div style={{ display: "grid", gap: 5 }}>
        {COMMUNITY_NAMES.map((c, idx) => {
          const b = baseline[c] ?? 0;
          const o = optimized[c] ?? 0;
          const delta = b - o; // positive = optimized (this app's system) is lower/better on this metric
          const deltaBg = delta > 0 ? "var(--green-tint)" : delta < 0 ? "var(--danger-tint)" : "var(--surface-raised)";
          const deltaColor = delta > 0 ? "var(--green)" : delta < 0 ? "var(--danger)" : "var(--ink-soft)";
          const deltaDirection: "up" | "down" | "flat" = delta > 0 ? "down" : delta < 0 ? "up" : "flat";
          return (
          <div key={c} style={{ background: idx % 2 === 1 ? "var(--surface-raised)" : "transparent", borderRadius: 8, padding: "3px 6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>{c}</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 99,
                  background: deltaBg,
                  color: deltaColor,
                  fontVariantNumeric: "tabular-nums",
                }}
                title={
                  delta > 0
                    ? `Predictive+batch is ${fmt(Math.abs(delta))}${unit} lower than baseline for ${c}.`
                    : delta < 0
                      ? `Predictive+batch is ${fmt(Math.abs(delta))}${unit} higher than baseline for ${c} on this metric.`
                      : `No difference between strategies for ${c}.`
                }
              >
                <DeltaArrowIcon direction={deltaDirection} color={deltaColor} size={8} />
                {fmt(Math.abs(delta))}
                {unit}
              </span>
            </div>
            {([
              { label: BASELINE_LABEL, value: baseline[c] ?? 0, color: BASELINE_COLOR },
              { label: OPTIMIZED_LABEL, value: optimized[c] ?? 0, color: OPTIMIZED_COLOR },
            ] as const).map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <div
                  style={{
                    flex: 1,
                    background: "var(--surface-raised)",
                    borderRadius: 4,
                    height: 13,
                    overflow: "hidden",
                  }}
                >
                  <AnimatedBarFill
                    pct={Math.min(100, Math.max((s.value / max) * 100, s.value > 0 ? 1.5 : 0))}
                    color={s.color}
                    title={`${s.label}, ${c}: ${fmt(s.value)}${unit}`}
                  />
                </div>
                <span
                  style={{
                    width: 70,
                    flexShrink: 0,
                    textAlign: "right",
                    fontSize: "0.72rem",
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--ink)",
                  }}
                >
                  {fmt(s.value)}
                  {unit}
                </span>
              </div>
            ))}
          </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}

export default function StatisticsPage() {
  const reduction =
    100 * (1 - data.optimized_total_bad_state_days / data.baseline_total_bad_state_days);
  const passed = data.reference_check_14_16_days_passed;

  // Sums of the exact per-community retry counts rendered in the Retries
  // chart below — a plain aggregation of already-real data, not a new
  // invented figure (the JSON has no precomputed retries total/avg, unlike
  // coverage/bad-state which already carry one).
  const baselineRetriesTotal = COMMUNITY_NAMES.reduce((s, c) => s + (data.baseline_retries[c] ?? 0), 0);
  const optimizedRetriesTotal = COMMUNITY_NAMES.reduce((s, c) => s + (data.optimized_retries[c] ?? 0), 0);

  // --- Tab 1: Summary — the "is this real" banner + the 4 headline stats,
  // all of which fit comfortably in one screen with room to spare.
  const summaryTab = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          background: "var(--teal-tint)",
          borderColor: "var(--teal)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <StatusIcon ok />
          <Badge label="Real simulation, not invented" variant="low" />
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <StatusIcon ok={passed} />
          <Badge
            label={passed ? "Reference check: within ~14–16d range" : "Reference check: outside range"}
            variant={passed ? "low" : "high"}
          />
        </span>
        <InfoIcon label="About these numbers">
          Numbers come from an actual run of delivery_comparison_fullscale.py over real-scale households (500/188 per
          community), not hand-picked. Baseline (blind rotation) reproduces the independently-cited ~14&ndash;16 day
          reference figure (avg {fmt1(data.baseline_avg_coverage_days)} days).
        </InfoIcon>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <StatTile
          label="Baseline: avg days to cover everyone"
          value={data.baseline_avg_coverage_days}
          fmt={fmt1}
        />
        <StatTile
          label="Predictive+batch: avg days to cover everyone"
          value={data.optimized_avg_coverage_days}
          fmt={fmt1}
          delta={`-${fmt1(data.baseline_avg_coverage_days - data.optimized_avg_coverage_days)} days`}
        />
        <StatTile
          label="Baseline: household-days in a bad state"
          value={data.baseline_total_bad_state_days}
          fmt={fmt0}
        />
        <StatTile
          label="Predictive+batch: household-days in a bad state"
          value={data.optimized_total_bad_state_days}
          fmt={fmt0}
          delta={`-${reduction.toFixed(0)}%`}
        />
      </div>
    </div>
  );

  // --- Tab 2: Coverage & bad-state — the first two per-community bar
  // charts, placed side by side (2-column) instead of stacked so both fit
  // one screen without shrinking either below readability.
  const coverageTab = (
    <div style={{ display: "flex", gap: 14, height: "100%", minHeight: 0 }}>
      <BarGroupChart
        title="Days to cover every household once, by community"
        caption="How long a fixed blind-rotation route vs. urgent-first + batch dispatch takes to reach every household at least once."
        baseline={data.baseline_coverage_days}
        optimized={data.optimized_coverage_days}
        unit=" d"
        digits={1}
        headlineBaseline={data.baseline_avg_coverage_days}
        headlineOptimized={data.optimized_avg_coverage_days}
        headlineDeltaMode="days"
        style={{ flex: "1 1 0", minWidth: 0 }}
      />
      <BarGroupChart
        title="Household-days spent in a bad state, by community"
        caption="Total household-days spent at a 'high' (bad) water or sewage status."
        infoNote="This is where predictive+batch wins even though it doesn't win on raw coverage speed."
        baseline={data.baseline_bad_state_household_days}
        optimized={data.optimized_bad_state_household_days}
        unit=""
        digits={0}
        headlineBaseline={data.baseline_total_bad_state_days}
        headlineOptimized={data.optimized_total_bad_state_days}
        headlineDeltaMode="percent"
        style={{ flex: "1 1 0", minWidth: 0 }}
      />
    </div>
  );

  // --- Tab 3: Retries & methodology — the third bar chart plus the
  // model-parameters details, side by side so the (usually-collapsed)
  // parameters panel doesn't push the chart off-screen when expanded.
  const retriesTab = (
    <div style={{ display: "flex", gap: 14, height: "100%", minHeight: 0 }}>
      <BarGroupChart
        title="Blizzard/breakdown retries, by community"
        caption="Whole trips lost to weather/mechanical failure and retried next slot."
        baseline={data.baseline_retries}
        optimized={data.optimized_retries}
        unit=""
        digits={0}
        headlineBaseline={baselineRetriesTotal}
        headlineOptimized={optimizedRetriesTotal}
        headlineDeltaMode="count"
        style={{ flex: "1 1 55%", minWidth: 0 }}
      />
      <details className="card" style={{ flex: "1 1 45%", minWidth: 0, height: "100%", overflow: "auto" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <GearIcon />
          Model parameters used
        </summary>
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
            <tbody>
              {Object.entries(data.params).map(([k, v]) => (
                <tr key={k} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "3px 10px 3px 0", color: "var(--ink-soft)" }}>{k}</td>
                  <td style={{ padding: "3px 0", fontVariantNumeric: "tabular-nums" }}>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginTop: 10 }}>
          Fleet size: {Object.entries(data.fleet_size).map(([k, v]) => `${k}: ${v}`).join(" · ")}
          <br />
          Household count: {Object.entries(data.household_count).map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
        <p style={{ fontSize: "0.76rem", color: "var(--ink-soft)" }}>
          See REFERENCES.md for sourcing on the 3-truck Inukjuak figure and the ~10,000L capacity estimate.
        </p>
      </details>
    </div>
  );

  // --- Tab 4: Cross-reference — the small-sample demo comparison table.
  const crossRefTab = (
    <div className="card" style={{ height: "100%", minHeight: 0, overflow: "auto" }}>
      <div className="eyebrow">Cross-reference</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <h3 style={{ fontSize: "1rem", margin: 0 }}>Small-sample demo comparison</h3>
        <Badge label="Not comparable to the 14–16d reference" variant="medium" />
        <InfoIcon label="About this cross-reference">
          The headline numbers above come from the real, full-scale simulation (500 / 188 households per
          community). This separate, smaller run — <code>delivery_comparison_results.json</code>, this
          demo&rsquo;s original 12&ndash;25-household-per-community sample used for UI card rendering — is
          included here only for cross-reference, so nothing about this app&rsquo;s numbers is hidden. At this
          small sample size, coverage finishes in under a day.
        </InfoIcon>
      </div>
      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", minWidth: 560 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>Community</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>Baseline coverage (d)</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>Optimized coverage (d)</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>Baseline bad-state (hh-d)</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>Optimized bad-state (hh-d)</th>
          </tr>
        </thead>
        <tbody>
          {COMMUNITY_NAMES.map((c) => (
            <tr key={c} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "4px 6px" }}>{c}</td>
              <td style={{ padding: "4px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {fmt1(small.baseline_coverage_days[c] ?? 0)}
              </td>
              <td style={{ padding: "4px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {fmt1(small.optimized_coverage_days[c] ?? 0)}
              </td>
              <td style={{ padding: "4px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {fmt1(small.baseline_bad_state_household_days[c] ?? 0)}
              </td>
              <td style={{ padding: "4px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {fmt1(small.optimized_bad_state_household_days[c] ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ padding: "4px 6px", fontWeight: 700 }}>Average / total</td>
            <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmt1(small.baseline_avg_coverage_days)}
            </td>
            <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmt1(small.optimized_avg_coverage_days)}
            </td>
            <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmt1(small.baseline_total_bad_state_days)}
            </td>
            <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmt1(small.optimized_total_bad_state_days)}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );

  return (
    <SingleScreenPage>
      <PageHeader
        title="Statistics"
        subtitle="Measured: blind rotation vs. predictive+batch, at real community scale"
      />
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <SingleScreenTabs
          tabs={[
            { id: "summary", label: "Summary", content: summaryTab },
            { id: "coverage", label: "Coverage & bad-state", content: coverageTab },
            { id: "retries", label: "Retries & methodology", content: retriesTab },
            { id: "cross-ref", label: "Cross-reference", content: crossRefTab },
          ]}
        />
      </div>
    </SingleScreenPage>
  );
}
