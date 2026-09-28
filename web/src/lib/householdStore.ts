"use client";

/**
 * Shared, process-wide (well, browser-tab-wide) household list — the JS
 * equivalent of the real Python app's `get_households()` singleton
 * (common.py: `st.session_state.households`, seeded once via
 * `seed_households()` and read/mutated by every page).
 *
 * A plain module-level array + minimal pub-sub, exposed to components via
 * `useHouseholds()` (React's `useSyncExternalStore`, since this is genuinely
 * external mutable state shared across routes/components rather than
 * per-component state). Other pages (Communities, Simulation, ...) porting
 * the rest of the Streamlit app should import from THIS file rather than
 * calling `seedHouseholds()` themselves, so every route shares one list.
 */

import { useSyncExternalStore } from "react";
import { seedHouseholds, type Household } from "@/lib/model";

// A FIXED baseline, not Date.now(): this module is evaluated independently
// on the server (during SSR) and in the browser (client bundle), at two
// different instants - seeding off a live clock there means every
// household's lastDelivery/recordStart timestamp differs slightly between
// what the server rendered and what the client hydrates, which is a real
// hydration mismatch (confirmed while porting this app - it broke a page
// that derived aggregate numbers straight from these fields). The seeded
// data is illustrative "started at some plausible recent offset" data, not
// tied to the literal present moment, so a fixed baseline is if anything
// more correct, not a workaround.
const SEED_BASELINE_MS = Date.parse("2026-09-26T00:00:00Z");

let households: Household[] = seedHouseholds(SEED_BASELINE_MS);
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Non-reactive read (fine for one-off reads e.g. inside an event handler). */
export function getHouseholds(): Household[] {
  return households;
}

export function subscribeHouseholds(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Truck page effect (see 3_Truck.py): a "Delivered" radio check-in resets
 * the water-usage clock and applies whatever dose the plant most recently
 * logged.
 */
export function applyDelivery(householdId: string, doseMgL: number): void {
  const now = Date.now();
  households = households.map((h) =>
    h.id === householdId ? { ...h, lastDelivery: now, initialChlorineMgL: doseMgL } : h,
  );
  emit();
}

/** Houses page backup-button effect (see 1_Houses.py). */
export function setManualAlert(householdId: string, alert: string): void {
  households = households.map((h) => (h.id === householdId ? { ...h, manualAlert: alert } : h));
  emit();
}

/** Reactive read — subscribes the calling component to every mutation above. */
export function useHouseholds(): Household[] {
  return useSyncExternalStore(subscribeHouseholds, getHouseholds, getHouseholds);
}
