"use client";

/**
 * Treatment-plant shared state — ported from common.py's
 * `st.session_state.plant_dose_mgL` / `plant_last_test` / `plant_last_result`,
 * plus `boil_water_advisory_active()` / `boil_water_banner()`.
 *
 * This is DELIBERATELY separate from householdStore.ts: it's plant-wide
 * state (one dose, one most-recent coliform result), not per-household
 * state, and it's what the boil-water banner on Houses/Plant reads —
 * distinct from any individual household's chlorine-decay status.
 */

import { useSyncExternalStore } from "react";

export const CLEAR_RESULT = "Clear — no coliforms detected";
export const DETECTED_RESULT = "Detected — boil-water advisory needed";

export interface PlantState {
  doseMgL: number;
  lastTestDate: number; // epoch ms
  lastTestResult: string;
}

let state: PlantState = {
  doseMgL: 1.5,
  lastTestDate: Date.now() - 3 * 86_400_000,
  lastTestResult: CLEAR_RESULT,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getPlantState(): PlantState {
  return state;
}

export function subscribePlant(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Plant page "Log a treated batch" form submit. */
export function logBatch(doseMgL: number, testResult: string): void {
  state = { doseMgL, lastTestDate: Date.now(), lastTestResult: testResult };
  emit();
}

/**
 * A plant-wide flag, distinct from any per-household chlorine-decay status —
 * see common.py's boil_water_advisory_active() docstring. True whenever the
 * most recently logged coliform test came back "Detected"; overrides/adds to
 * every household's own reading until the plant retests clear.
 */
export function boilWaterAdvisoryActive(): boolean {
  return state.lastTestResult.includes("Detected");
}

export function usePlantState(): PlantState {
  return useSyncExternalStore(subscribePlant, getPlantState, getPlantState);
}
