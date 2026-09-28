"use client";

/**
 * Small, dependency-free motion helpers shared by the Simulation and
 * Statistics pages — purely presentational (no data/math changes), matching
 * the deck's own `.big[data-target]` count-up idiom (DeckBody.tsx): a
 * requestAnimationFrame loop with a cubic ease-out, ~800-1100ms.
 */

import { useEffect, useRef, useState } from "react";

const EASE_DURATION_MS = 900;

function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

/**
 * Animates a numeric display value toward `target` whenever it changes,
 * easing from whatever it previously was (not always from 0) — e.g. moving
 * a driver-count slider eases the resulting day-count from its old value to
 * the new one rather than swapping instantly. `null` (no data yet / did not
 * finish) passes through untouched, no animation.
 */
export function useCountUp(target: number | null, duration: number = EASE_DURATION_MS): number | null {
  const [display, setDisplay] = useState<number | null>(target);
  const [prevTarget, setPrevTarget] = useState<number | null>(target);
  const fromRef = useRef<number | null>(target);
  const rafRef = useRef<number | null>(null);

  // Adjusting state during render when a prop changes (React's documented
  // pattern for this — see "You Might Not Need an Effect"): the trivial
  // cases (no real change, or a transition to/from `null`) are resolved
  // here so the effect below only ever has to do one thing — run the RAF
  // loop — rather than also synchronously setting state on every path.
  if (target !== prevTarget) {
    setPrevTarget(target);
    if (target === null || prevTarget === null) {
      setDisplay(target);
    }
  }

  useEffect(() => {
    if (target === null || fromRef.current === target) {
      fromRef.current = target;
      return;
    }
    const from = fromRef.current ?? target;
    const to = target;
    fromRef.current = target;
    const start = performance.now();
    function step(ts: number) {
      const p = Math.min((ts - start) / duration, 1);
      const eased = easeOutCubic(p);
      setDisplay(from + (to - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

/**
 * Counts up from 0 to `target` once, on mount only (the deck's headline
 * count-up idiom) — for Statistics page tiles/bars that should animate in
 * as the page loads rather than appearing at full size instantly.
 */
export function useCountUpOnMount(target: number, duration: number = 1100): number {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    function step(ts: number) {
      const p = Math.min((ts - start) / duration, 1);
      setDisplay(target * easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

/**
 * Returns true for a brief window whenever `key` changes (a value/state
 * signature string) — used to trigger a highlight-flash class so a viewer
 * notices a metric/badge changed, not just the new content. No flash on
 * initial mount.
 */
export function useFlashOnChange(key: string, flashMs = 900): boolean {
  const prevRef = useRef(key);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (prevRef.current === key) return;
    prevRef.current = key;
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), flashMs);
    return () => clearTimeout(t);
  }, [key, flashMs]);

  return flashing;
}
