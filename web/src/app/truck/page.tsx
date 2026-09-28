"use client";

/**
 * Ported from pages/3_Truck.py — the one segment of the system with NO
 * fixed connectivity. Trucks move around within the community's ~50 km²
 * area between the plant and houses; there is no cell/internet signal in
 * that space, only two-way radio.
 */

import { useState, type FormEvent, type ReactNode } from "react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import TruckIcon from "@/components/TruckIcon";
import InfoIcon from "@/components/InfoIcon";
import { SingleScreenPage } from "@/components/SingleScreenTabs";
import { useHouseholds, applyDelivery } from "@/lib/householdStore";
import { getPlantState } from "@/lib/plantStore";
import { COMMUNITIES } from "@/lib/model";

const COMMUNITY_NAMES = Object.keys(COMMUNITIES);

// Mirrors the real fleet composition established on the Simulation page and
// the Sensor Network deck slide: 2 water-delivery + 2 sewage-pump trucks per
// community (simEngine.ts's waterTrucks/sewageTrucks, 2 each). The original
// Streamlit Truck page used generic "Truck 1"/"Truck 2" with no kind — this
// distinguishes them since the rest of the app already tracks that split.
type TruckKind = "water" | "sewage";
interface TruckOption {
  id: string;
  kind: TruckKind;
}
const TRUCK_FLEET: TruckOption[] = [
  { id: "Water Truck 1", kind: "water" },
  { id: "Water Truck 2", kind: "water" },
  { id: "Sewage Truck 1", kind: "sewage" },
  { id: "Sewage Truck 2", kind: "sewage" },
];
const TRUCK_KIND: Record<string, TruckKind> = Object.fromEntries(TRUCK_FLEET.map((t) => [t.id, t.kind]));
const FLEET_COLOR: Record<TruckKind, string> = { water: "var(--teal)", sewage: "var(--gold)" };

const STATUS_CODES = ["En route", "Delivered", "Delayed — mechanical", "Delayed — weather", "Returning to facility"];

interface StatusMeta {
  color: string;
  tint: string;
}
const STATUS_META: Record<string, StatusMeta> = {
  "En route": { color: "var(--teal)", tint: "var(--teal-tint)" },
  Delivered: { color: "var(--green)", tint: "var(--green-tint)" },
  "Delayed — mechanical": { color: "var(--gold)", tint: "var(--gold-tint)" },
  "Delayed — weather": { color: "var(--gold)", tint: "var(--gold-tint)" },
  "Returning to facility": { color: "var(--ink-soft)", tint: "var(--surface-raised)" },
};

interface RadioLogEntry {
  ts: number;
  truckId: string;
  community: string;
  status: string;
  householdId: string; // "—" when not applicable
}

export default function TruckPage() {
  const households = useHouseholds();

  const [community, setCommunity] = useState(COMMUNITY_NAMES[0]);
  const hhIds = households.filter((h) => h.community === community).map((h) => h.id);

  const [truckId, setTruckId] = useState(TRUCK_FLEET[0].id);
  const [status, setStatus] = useState(STATUS_CODES[0]);
  const [householdId, setHouseholdId] = useState("—");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [log, setLog] = useState<RadioLogEntry[]>([]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const entry: RadioLogEntry = { ts: Date.now(), truckId, community, status, householdId };
    setLog((prev) => [...prev, entry]);

    if (status === "Delivered" && householdId !== "—") {
      const dose = getPlantState().doseMgL;
      applyDelivery(householdId, dose);
    }

    setSuccessMsg(`Logged: ${truckId} — ${status}${householdId !== "—" ? ` at ${householdId}` : ""}`);
  }

  const recent = [...log].slice(-10).reverse();

  return (
    <SingleScreenPage>
      <PageHeader title="Truck" subtitle="No cell/internet signal in transit — radio only" />

      {/* Two columns instead of the original stacked layout: the log-entry
          form (left, fixed width) and the recent check-ins rail (right,
          fills the remainder) sit side by side so both are visible without
          any page scroll. Each column scrolls internally (not the page) if
          its own content — e.g. an expanded "why radio" explainer — would
          otherwise outgrow the available height. */}
      <div style={{ display: "flex", gap: "1.1rem", flex: "1 1 auto", minHeight: 0 }}>
        <div style={{ flex: "0 0 350px", display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
          <details style={{ marginBottom: "0.85rem", flexShrink: 0 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <SignalWaveIcon />
              Why radio, and would GPS trackers even work here?
            </summary>
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                <Badge label="~50 km² coverage area" variant="medium" title="Approximate area a truck must cover between the plant and households within one community." />
                <Badge label="Signal only at plant + houses" variant="medium" title="The truck itself has no cell/internet signal while in transit — only two-way radio." />
                <Badge label="40+ yr precedent: APRS" variant="low" title="Automatic Packet Reporting System — GPS-over-radio relay technology in amateur/emergency use since the 1980s." />
              </div>
              <GpsVsRadioDiagrams />
              <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--ink-soft)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                <li>
                  <strong>GPS itself needs no signal</strong> — it just listens to satellites. Only <em>sending</em>{" "}
                  the position needs a channel, and here that channel is two-way radio, not data.
                </li>
                <li>
                  <strong>Built now (3-hr, no new hardware):</strong> driver reads a short status code over the
                  existing voice radio; dispatcher logs it below.
                </li>
                <li>
                  <strong>Future phase 2 (not built):</strong> an automatic APRS-style relay — truck GPS keys the
                  same radio automatically. Needs new radio-modem hardware.
                </li>
              </ul>
            </div>
          </details>

          <h2 style={{ fontSize: "1.15rem", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            Radio check-in log
            <InfoIcon label="Why dropdowns, not free text">
              Pre-made dropdowns, not free text — fast for a dispatcher to log while on the radio.
            </InfoIcon>
          </h2>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, margin: "0.6rem 0", flexShrink: 0 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Community</span>
            <select
              value={community}
              onChange={(e) => {
                setCommunity(e.target.value);
                setHouseholdId("—");
              }}
              style={selectStyle}
            >
              {COMMUNITY_NAMES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "14px 16px", flexShrink: 0 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                Truck
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 700, color: FLEET_COLOR[TRUCK_KIND[truckId]] }}>
                  <span
                    style={{ width: 7, height: 7, borderRadius: "50%", background: FLEET_COLOR[TRUCK_KIND[truckId]], display: "inline-block" }}
                  />
                  {TRUCK_KIND[truckId] === "sewage" ? "Sewage-pump fleet" : "Water-delivery fleet"}
                </span>
              </span>
              <select value={truckId} onChange={(e) => setTruckId(e.target.value)} style={selectStyle}>
                <optgroup label="Water-delivery">
                  {TRUCK_FLEET.filter((t) => t.kind === "water").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Sewage-pump">
                  {TRUCK_FLEET.filter((t) => t.kind === "sewage").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Status code</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
                {STATUS_CODES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Household (if Delivered)</span>
              <select value={householdId} onChange={(e) => setHouseholdId(e.target.value)} style={selectStyle}>
                <option>—</option>
                {hhIds.map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              style={{
                alignSelf: "flex-start",
                fontSize: "1rem",
                fontWeight: 700,
                padding: "0.65rem 1.2rem",
                borderRadius: 12,
                border: "2px solid var(--teal)",
                background: "var(--teal-tint)",
                color: "var(--teal)",
                cursor: "pointer",
              }}
            >
              Log radio check-in
            </button>
            {successMsg && <p style={{ color: "var(--green)", fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>{successMsg}</p>}
          </form>
        </div>

        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <h2 style={{ fontSize: "1.15rem", flexShrink: 0 }}>Recent check-ins</h2>
          {recent.length === 0 ? (
            <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem", flexShrink: 0 }}>No check-ins logged yet.</p>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 0.9rem", margin: "0.4rem 0 0.6rem", fontSize: "0.74rem", color: "var(--ink-soft)", flexShrink: 0 }}>
                {STATUS_CODES.map((s) => (
                  <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_META[s].color, display: "inline-block" }} />
                    {s}
                  </span>
                ))}
              </div>
              {/* Already capped to the 10 most recent entries (see `recent`
                  above) since this is explicitly a "recent" list — plus an
                  internal, contained scroll here as a safety net so a full
                  10-entry rail can never grow the page itself. */}
              <div className="aq-checkin-rail" style={{ flex: "1 1 auto", overflowY: "auto", minHeight: 0, paddingRight: 4 }}>
                {recent.map((entry) => {
                  const meta = STATUS_META[entry.status];
                  const kind = TRUCK_KIND[entry.truckId];
                  return (
                    <div key={entry.ts} className="aq-checkin-item">
                      <div className="aq-checkin-marker" style={{ background: meta.tint }}>
                        <StatusGlyph status={entry.status} color={meta.color} />
                      </div>
                      <div className="card" style={{ flex: 1, minWidth: 0, padding: "0.6rem 0.85rem" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.5rem" }}>
                          <strong style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                            {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                          </strong>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.85rem", fontWeight: 600 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: FLEET_COLOR[kind], display: "inline-block" }} />
                            {entry.truckId}
                          </span>
                          <span style={{ fontWeight: 700, color: meta.color, fontSize: "0.85rem" }}>{entry.status}</span>
                        </div>
                        <div style={{ color: "var(--ink-soft)", fontSize: "0.8rem", marginTop: 2 }}>
                          {entry.community}
                          {entry.householdId !== "—" && <> &middot; {entry.householdId}</>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <details style={{ marginTop: "0.6rem", flexShrink: 0 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Sensor list used at this stage</summary>
            <div style={{ overflow: "auto", marginTop: "0.6rem", maxHeight: 160 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.82rem" }}>
                <thead>
                  <tr>
                    {["Measurement", "Sensor type", "Connectivity need", "Maintenance note", "Cold-weather note"].map((hd) => (
                      <th key={hd} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid var(--border)", whiteSpace: "nowrap" }}>
                        {hd}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdStyle}>In-truck tank level</td>
                    <td style={tdStyle}>Capacitive or ultrasonic tank-level sender (same category as RV/marine tanks)</td>
                    <td style={tdStyle}>Standalone dash readout; becomes system data only via radio relay</td>
                    <td style={tdStyle}>Robust vehicle-grade sensor</td>
                    <td style={tdStyle}>
                      Vehicle-grade senders are commonly rated to -40°C (automotive standard) — spec explicitly for
                      -49°C+ lows; heated cab readout, insulated tank compartment
                    </td>
                  </tr>
                  <tr>
                    <td style={tdStyle}>Water actually dispensed</td>
                    <td style={tdStyle}>Inline flow meter (paddlewheel/turbine) on the delivery hose</td>
                    <td style={tdStyle}>Same as above</td>
                    <td style={tdStyle}>
                      The real differentiator vs. just mirroring house sensors — confirms what left the truck, not
                      just what&apos;s in the house tank
                    </td>
                    <td style={tdStyle}>
                      Hose/meter only sees flowing (self-warming) water during active transfer — main risk is the
                      hose freezing between deliveries, not the meter&apos;s static rating; drain/blow out hose after
                      each delivery
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>

      <style>{`
        @keyframes aq-log-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes aq-signal-wave { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
        /* Check-in timeline: a rail + node per entry (same idiom as the
           deck's Problem-slide incident timeline) so status codes read as a
           sequence of events, not a flat list of text rows. */
        .aq-checkin-rail { position: relative; padding-left: 2px; }
        .aq-checkin-rail::before { content: ""; position: absolute; left: 15px; top: 6px; bottom: 6px; width: 1px; background: var(--border); }
        .aq-checkin-item { position: relative; display: flex; gap: 12px; align-items: flex-start; margin-bottom: 0.6rem; animation: aq-log-in 380ms cubic-bezier(0.16,1,0.3,1) both; }
        .aq-checkin-marker { position: relative; z-index: 1; width: 31px; height: 31px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      `}</style>
    </SingleScreenPage>
  );
}

/**
 * Small radio-signal-wave glyph, matching the icon-signal idiom used for
 * "radio"/"signal" concepts in the pitch deck (a dot with two concentric
 * arcs) — animated here as a gentle alternating pulse rather than the deck's
 * signal-loss flicker, since this page is explaining why radio *works*, not
 * illustrating a dropout.
 */
function SignalWaveIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="5" cy="16" r="1.7" fill="var(--teal)" stroke="none" />
      <path d="M9 12.3 A5.3 5.3 0 0 1 9 19.7" style={{ animation: "aq-signal-wave 1.8s ease-in-out infinite" }} />
      <path d="M13 8.6 A9.6 9.6 0 0 1 13 23.4" style={{ animation: "aq-signal-wave 1.8s ease-in-out infinite 0.3s" }} />
    </svg>
  );
}

/** Small per-status glyph for the check-in timeline's rail marker. */
function StatusGlyph({ status, color }: { status: string; color: string }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2.1, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (status === "Delivered") {
    return (
      <svg {...common}>
        <path d="M4.5 12.5 L9.5 17.5 L19.5 6" />
      </svg>
    );
  }
  if (status === "En route") {
    return (
      <svg {...common}>
        <path d="M3 12 H17" />
        <path d="M12 6 L18 12 L12 18" />
      </svg>
    );
  }
  if (status === "Returning to facility") {
    return (
      <svg {...common}>
        <path d="M21 12 H7" />
        <path d="M12 6 L6 12 L12 18" />
      </svg>
    );
  }
  if (status === "Delayed — mechanical") {
    return (
      <svg {...common}>
        <path d="M14.5 4.5 a4 4 0 0 0 -5.4 4.9 L4 14.5 V18 h3.5 l5.1 -5.1 a4 4 0 0 0 4.9 -5.4 l-2.6 2.6 -1.9 -1.9 z" />
      </svg>
    );
  }
  // Delayed — weather
  return (
    <svg {...common}>
      <path d="M12 3 V21 M5.5 6.5 L18.5 17.5 M18.5 6.5 L5.5 17.5" />
    </svg>
  );
}

/**
 * The two-panel visual answer to "why radio, not GPS": GPS reception into
 * the truck works fine (down arrow, solid), but the truck has no channel to
 * send that position back out (broken/crossed-out up path) — versus radio,
 * where the truck-to-dispatcher link actually completes (animated up
 * arrow, reusing the same "marching ants" active-route idiom the
 * Simulation map uses for a truck currently driving). Purely illustrative
 * of the real distinction described in the bullets below it, not new data.
 */
function GpsVsRadioDiagrams() {
  return (
    <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
      <MiniDiagram
        title="GPS trackers alone"
        accent="var(--danger)"
        caption="Satellite → truck works (GPS just listens). Truck → anyone has no channel — that's the missing half."
      >
        <svg width={128} height={104} viewBox="0 0 120 96" aria-hidden="true">
          <g stroke="var(--ink-soft)" strokeWidth={1.4} fill="none">
            <rect x={54} y={8} width={12} height={9} rx={1.5} />
            <rect x={39} y={10.5} width={13} height={4} />
            <rect x={69} y={10.5} width={13} height={4} />
          </g>
          <line x1={60} y1={19} x2={60} y2={54} stroke="var(--ink-soft)" strokeWidth={1.6} strokeDasharray="4 3" />
          <path d="M60,54 L56,46 M60,54 L64,46" stroke="var(--ink-soft)" strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <line x1={72} y1={58} x2={90} y2={32} stroke="var(--danger)" strokeWidth={1.6} strokeDasharray="3 3" />
          <g stroke="var(--danger)" strokeWidth={2.2} strokeLinecap="round">
            <line x1={84} y1={28} x2={92} y2={36} />
            <line x1={92} y1={28} x2={84} y2={36} />
          </g>
          <TruckIcon x={58} y={72} scale={1.4} color="var(--ink-soft)" />
        </svg>
      </MiniDiagram>
      <MiniDiagram
        title="Two-way radio (built now)"
        accent="var(--teal)"
        caption="Truck → dispatcher over voice radio actually completes the loop — no new hardware needed."
      >
        <svg width={128} height={104} viewBox="0 0 120 96" aria-hidden="true">
          <g stroke="var(--teal)" strokeWidth={1.6} fill="none" strokeLinecap="round">
            <line x1={60} y1={9} x2={60} y2={24} />
            <path d="M52 21 A8 8 0 0 1 68 21" />
            <path d="M47 15 A14 14 0 0 1 73 15" />
          </g>
          <circle cx={60} cy={8} r={2.2} fill="var(--teal)" />
          <line x1={60} y1={58} x2={60} y2={28} stroke="var(--teal)" strokeWidth={2.2} className="pg-route-active" />
          <path d="M60,28 L56,36 M60,28 L64,36" stroke="var(--teal)" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <TruckIcon x={58} y={72} scale={1.4} color="var(--teal)" />
        </svg>
      </MiniDiagram>
    </div>
  );
}

function MiniDiagram({ title, accent, caption, children }: { title: string; accent: string; caption: string; children: ReactNode }) {
  return (
    <div style={{ flex: "1 1 170px", minWidth: 160, border: "1px solid var(--border)", borderRadius: 12, padding: "0.65rem 0.75rem", background: "var(--surface-raised)" }}>
      <div style={{ fontSize: "0.76rem", fontWeight: 700, color: accent, marginBottom: 2 }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "center" }}>{children}</div>
      <p style={{ fontSize: "0.73rem", color: "var(--ink-soft)", margin: "4px 0 0 0", lineHeight: 1.4 }}>{caption}</p>
    </div>
  );
}

const selectStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
} as const;

const tdStyle = { padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--ink-soft)", verticalAlign: "top" } as const;
