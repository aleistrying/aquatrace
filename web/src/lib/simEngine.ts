/**
 * Ported from pages/5_Simulation.py's live tick engine: _new_truck_state /
 * _new_fleets / _water_variant / _sewage_variant / _worst_variant /
 * _compute_snapshot / _water_urgent / _sewage_urgent / _water_close_enough /
 * _sewage_close_enough / _run_fleet / _advance_one_tick, plus the
 * "drivers needed right now" live computation from _render_sim_state.
 *
 * Deliberately isolated from any other page's household state — this file
 * only operates on whatever households/state the caller (the Simulation
 * page) hands it, generated fresh via model.ts's seedHouseholds(), exactly
 * like the Python page's own st.session_state.sim_households.
 *
 * State is mutated in place (mirrors the Python session_state mutation
 * model) rather than returning new immutable copies — callers hold this in
 * a ref and bump a render-version counter after each tick.
 */

import {
  COMMUNITIES,
  RANK,
  FALLBACK_TEMP_C,
  type Household,
  type Variant,
  chlorineResidualNow,
  qualityStatus,
  waterQuantityStatus,
  currentUsedL,
  currentSewagePct,
  sewageStatus,
  potabilityPct,
  waterPredictedNeedsTruck,
  sewagePredictedNeedsTruck,
} from "./model";

export type FleetKind = "water" | "sewage";
export type DelayReason = "mechanical" | "weather";
export type EventType = "dispatch" | "arrival" | "delay" | "sync";

export interface SimTruckState {
  status: "idle" | "en_route";
  target: string | null;
  tripStart: number | null; // sim epoch ms
  tripDuration: number | null; // ms
  batch: string[];
  delayed: boolean;
  delayReason: DelayReason | null;
}

export interface SimEvent {
  type: EventType;
  text: string;
  atMs: number;
}

export interface SnapshotEntry {
  residual: number;
  wPct: number;
  sPct: number;
  pPct: number;
  waterVariant: Variant;
  waterLabel: string;
  sewVariant: Variant;
  sewLabel: string;
  worstVariant: Variant;
}

export interface SimState {
  now: number;
  households: Household[];
  waterTrucks: Record<string, SimTruckState[]>;
  sewageTrucks: Record<string, SimTruckState[]>;
  events: SimEvent[];
  totalServiced: number;
  lastSync: number;
  syncedSnapshot: Record<string, SnapshotEntry>;
  justSynced: boolean;
}

export const TRIP_DURATION_MS = 45 * 60_000; // illustrative in-transit time within the ~50 km^2 area
export const CLOSE_ENOUGH_VARIANT: ReadonlySet<Variant> = new Set(["medium", "high"]);
// Batching uses a WIDER predictive horizon than the 1-day dispatch trigger -
// since the two-fleet split scopes batching to same-type-only, this wider
// horizon offsets that narrower per-type pool.
export const BATCH_HORIZON_DAYS = 1.5;

// Breakdown/delay backup: small per-tick chance of a mechanical/weather
// delay while en route, radioed in (matches the Truck page's "Delayed —
// mechanical" / "Delayed — weather" status codes).
export const BREAKDOWN_CHANCE_PER_TICK = 0.02;
export const DELAY_EXTENSION_MS = 75 * 60_000;
const DELAY_REASONS: DelayReason[] = ["mechanical", "weather"];

export const MAX_STEPS_PER_CLICK = 500;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// UTC accessors, not local-timezone ones: this renders in a server-rendered
// client component, so the SSR pass (Vercel's server, some fixed timezone)
// and the client's hydration pass (the visitor's browser, any timezone)
// must format the same instant identically - getHours()/getFullYear() etc.
// depend on the runtime's local timezone and silently differ between the
// two, causing a React hydration text-mismatch that only surfaces in a real
// deployment (server and a local dev machine often share one timezone).
export function formatSimTime(ms: number): string {
  const d = new Date(ms);
  const mon = MONTHS[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mon} ${day} ${hh}:${mm}`;
}

export function formatSimDateTime(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day} ${hh}:${mm}`;
}

export function newTruckState(): SimTruckState {
  return { status: "idle", target: null, tripStart: null, tripDuration: null, batch: [], delayed: false, delayReason: null };
}

/** Two independent trucks per community per truck TYPE - water delivery and
 * sewage pump-out are two different physical operations, so each gets its
 * own fleet rather than one truck doing both at once. */
export function newFleets(): Record<string, SimTruckState[]> {
  const out: Record<string, SimTruckState[]> = {};
  for (const name of Object.keys(COMMUNITIES)) out[name] = [newTruckState(), newTruckState()];
  return out;
}

/** Worst-of(chlorine quality, tank volume) — the WATER side only, no sewage
 * mixed in. Used to decide water-truck dispatch/batching so a water truck
 * is never routed by a sewage condition. */
function waterVariant(h: Household, tempC: number, now: number): [Variant, string] {
  const residual = chlorineResidualNow(h, tempC, now);
  const q = qualityStatus(residual);
  let variant: Variant = q.variant;
  let label = q.label;
  const qty = waterQuantityStatus(100 * (1 - currentUsedL(h, now) / h.tankCapacityL));
  if (RANK[qty.variant] > RANK[variant]) {
    variant = qty.variant;
    label = qty.label;
  }
  return [variant, label];
}

/** Sewage tank fill status only — independent of water quality/volume. */
function sewageVariant(h: Household, now: number): [Variant, string] {
  const s = sewageStatus(currentSewagePct(h, now));
  return [s.variant, s.label];
}

function worstOf(a: Variant, b: Variant): Variant {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Batch-sync snapshot: freezes every household's DISPLAYED sensor reading
 * as of `now`. Called only at session start and at each batch-sync boundary
 * - NOT every tick - so the numbers shown jump once per sync instead of
 * continuously gliding (honest version of "smooth" given this project's
 * no-continuous-signal connectivity model). Dispatch logic deliberately
 * does NOT use this snapshot - it keeps reading live truth every tick. */
export function computeSnapshot(households: Household[], temps: Record<string, number>, now: number): Record<string, SnapshotEntry> {
  const snap: Record<string, SnapshotEntry> = {};
  for (const h of households) {
    const tempC = temps[h.community] ?? FALLBACK_TEMP_C;
    const residual = chlorineResidualNow(h, tempC, now);
    const wPct = 100 * (1 - currentUsedL(h, now) / h.tankCapacityL);
    const sPct = currentSewagePct(h, now);
    const pPct = potabilityPct(residual);
    const [waterVar, waterLabel] = waterVariant(h, tempC, now);
    const [sewVar, sewLabel] = sewageVariant(h, now);
    const worst = worstOf(waterVar, sewVar);
    snap[h.id] = { residual, wPct, sPct, pPct, waterVariant: waterVar, waterLabel, sewVariant: sewVar, sewLabel, worstVariant: worst };
  }
  return snap;
}

function waterUrgent(h: Household, tempC: number, now: number): boolean {
  return waterVariant(h, tempC, now)[0] === "high" || waterPredictedNeedsTruck(h, tempC, now);
}
function sewageUrgent(h: Household, now: number): boolean {
  return sewageVariant(h, now)[0] === "high" || sewagePredictedNeedsTruck(h, now);
}
function waterCloseEnough(h: Household, tempC: number, now: number): boolean {
  const [v] = waterVariant(h, tempC, now);
  return CLOSE_ENOUGH_VARIANT.has(v) || waterPredictedNeedsTruck(h, tempC, now, BATCH_HORIZON_DAYS);
}
function sewageCloseEnough(h: Household, now: number): boolean {
  const [v] = sewageVariant(h, now);
  return CLOSE_ENOUGH_VARIANT.has(v) || sewagePredictedNeedsTruck(h, now, BATCH_HORIZON_DAYS);
}

const FLEET_ICON: Record<FleetKind, string> = { water: "\u{1F69A}", sewage: "\u{1F69B}" };

/** Advances every truck in ONE fleet (kind='water' or 'sewage') for ONE
 * community by a tick: breakdown/delay check + arrival for any en-route
 * truck, then a dispatch check for any IDLE truck (which can fire in the
 * SAME tick a truck just arrived, matching the Python source's non-elif
 * structure). Returns the count of households serviced this tick. */
function runFleet(
  community: string,
  kind: FleetKind,
  fleet: SimTruckState[],
  hhHere: Household[],
  tempC: number,
  now: number,
  events: SimEvent[],
): number {
  let servicedCount = 0;
  const isWater = kind === "water";
  const icon = FLEET_ICON[kind];
  const verb = isWater ? "delivered water to" : "pumped out sewage at";
  const urgentFn = (h: Household) => (isWater ? waterUrgent(h, tempC, now) : sewageUrgent(h, now));
  const closeFn = (h: Household) => (isWater ? waterCloseEnough(h, tempC, now) : sewageCloseEnough(h, now));

  for (const truck of fleet) {
    if (truck.status === "en_route" && truck.tripStart !== null) {
      if (!truck.delayed && Math.random() < BREAKDOWN_CHANCE_PER_TICK) {
        const reason = DELAY_REASONS[Math.floor(Math.random() * DELAY_REASONS.length)];
        truck.tripDuration = (truck.tripDuration as number) + DELAY_EXTENSION_MS;
        truck.delayed = true;
        truck.delayReason = reason;
        events.push({
          type: "delay",
          atMs: now,
          text: `${formatSimTime(now)} — ${community}: ${icon} ${kind} truck radioed in a delay (${reason}) en route to ${truck.target}, ETA pushed back`,
        });
      }

      const frac = (now - truck.tripStart) / (truck.tripDuration as number);
      if (frac >= 1.0) {
        const servicedIds = new Set([truck.target as string, ...truck.batch]);
        for (const h of hhHere) {
          if (servicedIds.has(h.id)) {
            // A water truck ONLY resets the water/chlorine clock; a sewage
            // truck ONLY resets the sewage clock.
            if (isWater) {
              h.lastDelivery = now;
              h.initialChlorineMgL = 1.5;
            } else {
              h.sewageBaselinePct = 10.0;
              h.recordStart = now;
            }
          }
        }
        servicedCount += servicedIds.size;
        const extra = truck.batch.length ? ` (+${truck.batch.length} nearby while out)` : "";
        events.push({
          type: "arrival",
          atMs: now,
          text: `${formatSimTime(now)} — ${community}: ${icon} ${kind} truck ${verb} ${truck.target}${extra}`,
        });
        truck.status = "idle";
        truck.target = null;
        truck.tripStart = null;
        truck.tripDuration = null;
        truck.batch = [];
        truck.delayed = false;
        truck.delayReason = null;
      }
    }

    if (truck.status === "idle") {
      const alreadyAssigned = new Set<string>();
      for (const t of fleet) {
        if (t.status === "en_route" && t.target) {
          alreadyAssigned.add(t.target);
          t.batch.forEach((b) => alreadyAssigned.add(b));
        }
      }

      const urgent = hhHere.filter((h) => !alreadyAssigned.has(h.id) && urgentFn(h));
      if (urgent.length) {
        // Oldest-serviced-first tiebreak: last_delivery/record_start already
        // ARE each household's "last serviced" timestamp for water/sewage
        // respectively, so picking the minimum prioritizes whoever has gone
        // longest without service among the currently-urgent households.
        const primary = urgent.reduce((best, h) => {
          const bestKey = isWater ? best.lastDelivery : best.recordStart;
          const hKey = isWater ? h.lastDelivery : h.recordStart;
          return hKey < bestKey ? h : best;
        });
        const nearby = hhHere.filter((h) => h.id !== primary.id && !alreadyAssigned.has(h.id) && closeFn(h)).map((h) => h.id);
        truck.status = "en_route";
        truck.target = primary.id;
        truck.tripStart = now;
        truck.tripDuration = TRIP_DURATION_MS;
        truck.batch = nearby;
        const extra = nearby.length ? ` (+${nearby.length} nearby)` : "";
        events.push({
          type: "dispatch",
          atMs: now,
          text: `${formatSimTime(now)} — ${community}: ${icon} ${kind} truck dispatched to ${primary.id}${extra}`,
        });
      }
    }
  }
  return servicedCount;
}

/** Advances simulated time by one tick and runs the dispatch logic for
 * every fleet — pure state mutation, no rendering. Shared by Auto mode
 * (ticks itself every 1s) and Manual mode's step-through buttons (tick only
 * when pressed), so both modes run the exact same simulation logic, just
 * under different pacing. Returns the events generated this tick. */
export function advanceOneTick(
  state: SimState,
  minutesPerTick: number,
  batchSyncMinutes: number,
  temps: Record<string, number>,
): SimEvent[] {
  state.now += minutesPerTick * 60_000;
  const now = state.now;
  const newEvents: SimEvent[] = [];

  for (const community of Object.keys(COMMUNITIES)) {
    const tempC = temps[community] ?? FALLBACK_TEMP_C;
    const hhHere = state.households.filter((h) => h.community === community);
    const servicedWater = runFleet(community, "water", state.waterTrucks[community], hhHere, tempC, now, newEvents);
    const servicedSewage = runFleet(community, "sewage", state.sewageTrucks[community], hhHere, tempC, now, newEvents);
    state.totalServiced += servicedWater + servicedSewage;
  }

  // Batch sync boundary: household sensor readings only refresh here, not
  // every tick. Dispatch logic above already ran on live truth this tick
  // regardless - this only gates what gets DISPLAYED.
  const nextSyncAt = state.lastSync + batchSyncMinutes * 60_000;
  let justSynced = false;
  if (Object.keys(state.syncedSnapshot).length === 0 || now >= nextSyncAt) {
    state.lastSync = now;
    state.syncedSnapshot = computeSnapshot(state.households, temps, now);
    justSynced = true;
    newEvents.push({ type: "sync", atMs: now, text: `${formatSimTime(now)} — \u{1F4E1} Batch sync completed — household readings refreshed` });
  }
  state.justSynced = justSynced;

  state.events.push(...newEvents);
  if (state.events.length > 400) state.events.splice(0, state.events.length - 400);

  return newEvents;
}

export interface DriverNeed {
  urgent: number;
  active: number;
  idle: number;
  fleetSize: number;
  backlog: number;
}

/** Live driver-need computation: for each community/type, who is currently
 * urgent right now vs. who already has a truck coming, so the UI can say
 * "N drivers needed right now" / "currently no drivers needed" as an
 * honest, live number - not just "trucks out of 2". */
export function computeDriverNeed(state: SimState, temps: Record<string, number>): Record<string, Record<FleetKind, DriverNeed>> {
  const now = state.now;
  const out: Record<string, Record<FleetKind, DriverNeed>> = {};
  for (const community of Object.keys(COMMUNITIES)) {
    const hhHere = state.households.filter((h) => h.community === community);
    const tempC = temps[community] ?? FALLBACK_TEMP_C;
    const entry = {} as Record<FleetKind, DriverNeed>;
    const fleets: [FleetKind, SimTruckState[]][] = [
      ["water", state.waterTrucks[community]],
      ["sewage", state.sewageTrucks[community]],
    ];
    for (const [kind, fleet] of fleets) {
      const urgentIds = new Set(hhHere.filter((h) => (kind === "water" ? waterUrgent(h, tempC, now) : sewageUrgent(h, now))).map((h) => h.id));
      const assignedIds = new Set<string>();
      for (const t of fleet) {
        if (t.target) assignedIds.add(t.target);
        t.batch.forEach((b) => assignedIds.add(b));
      }
      const active = fleet.filter((t) => t.status === "en_route").length;
      const idle = fleet.length - active;
      let backlog = 0;
      urgentIds.forEach((id) => {
        if (!assignedIds.has(id)) backlog += 1;
      });
      entry[kind] = { urgent: urgentIds.size, active, idle, fleetSize: fleet.length, backlog };
    }
    out[community] = entry;
  }
  return out;
}
