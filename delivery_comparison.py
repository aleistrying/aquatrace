"""Standalone analysis: baseline "blind rotation" vs. this app's predictive
+batch dispatch (pages/5_Simulation.py's sim_tick() logic), over the SAME
seeded household population (common.seed_households()), same one-truck-per-
community constraint, same 45-minute simulated trip duration.

Not a UI page - a plain Python loop that fast-forwards simulated time and
measures two things per community:

  1. Days until every household has been serviced at least once (a full
     "coverage cycle") - this is what the app's existing framing text on
     pages/5_Simulation.py calls out as the ~2-week blind-rotation baseline
     for a real ~1800-2000 person community. NOTE: seed_households() only
     generates a representative SAMPLE (12-25 households) standing in for
     that real population (see common._household_sample_size docstring) -
     so absolute day counts here are NOT directly comparable to the real
     2-week/500+-household figure. What IS a fair, apples-to-apples
     comparison is the two strategies running over the identical sample,
     identical starting conditions, identical truck constraints - so the
     RATIO/relative outcome between them is the real finding.

  2. Household-days spent in "high" urgency (already needing service - water
     empty/unsafe or sewage blocked) under each strategy - this is the
     metric the predictive+batch approach is actually designed to minimize.

Run directly: `python delivery_comparison.py`. No Streamlit/UI involved.
"""

from __future__ import annotations

import copy
import random
from datetime import datetime, timedelta

from common import (
    COMMUNITIES,
    seed_households,
    fetch_current_temp_c,
    chlorine_residual_now,
    quality_status,
    water_quantity_status,
    current_sewage_pct,
    sewage_status,
    current_used_l,
    predicted_needs_truck,
)

RANK = {"low": 0, "medium": 1, "high": 2}

# Same truck constraints for both strategies - only WHICH household gets
# visited when differs, not truck capacity/speed.
TRIP_DURATION = timedelta(minutes=45)
CLOSE_ENOUGH_VARIANT = {"medium", "high"}  # same batch-service rule as sim_tick()
TICK_MINUTES = 30  # matches the Simulation page's default "sim minutes / tick"
MAX_SIM_DAYS = 60  # safety cap so a strategy that never finishes doesn't hang forever

# Mirrors pages/5_Simulation.py's breakdown/delay backup exactly (same
# per-tick chance, same extension) - a truck constraint independent of
# dispatch strategy, so it applies identically to both. Seeded locally so
# the comparison is reproducible run to run.
BREAKDOWN_CHANCE_PER_TICK = 0.02
DELAY_EXTENSION = timedelta(minutes=75)
DELAY_SEED = 20260926


def worst_variant(h, temp_c: float, now: datetime) -> str:
    """Same worst-of(water quality, water quantity, sewage) status logic as
    pages/5_Simulation.py's _worst_variant(), reused here so "bad state"
    means the same thing in both places."""
    residual = chlorine_residual_now(h, temp_c, now)
    water_variant, _, _ = quality_status(residual)
    qty_variant, _, _ = water_quantity_status(100 * (1 - current_used_l(h, now) / h.tank_capacity_l))
    if RANK[qty_variant] > RANK[water_variant]:
        water_variant = qty_variant
    sew_variant, _, _ = sewage_status(current_sewage_pct(h, now))
    return water_variant if RANK[water_variant] >= RANK[sew_variant] else sew_variant


def run_strategy(strategy: str, households: list, start_now: datetime, temps: dict) -> tuple[dict, dict]:
    """Advance simulated time in fixed ticks, dispatching one truck per
    community, until every household in every community has been serviced
    at least once (or MAX_SIM_DAYS is hit).

    strategy: "baseline" (fixed round-robin by household id, ignores need)
              or "optimized" (reuses sim_tick()'s urgent-first + batch logic
              exactly: dispatch to the first urgent/predicted-needs-truck
              household, batch-service any other already medium/high in the
              same trip).

    Returns (coverage_day, bad_state_household_days), both dicts keyed by
    community.
    """
    by_community: dict[str, list] = {}
    for h in households:
        by_community.setdefault(h.community, []).append(h)

    trucks = {
        c: {"status": "idle", "target": None, "trip_start": None, "trip_duration": None, "batch": [], "delayed": False}
        for c in by_community
    }
    serviced_ever = {c: set() for c in by_community}
    coverage_day = {c: None for c in by_community}
    bad_state_days = {c: 0.0 for c in by_community}
    rr_index = {c: 0 for c in by_community}
    rr_order = {c: sorted(hh, key=lambda x: x.id) for c, hh in by_community.items()}

    # Same seed for every strategy run -> same breakdown/delay draw
    # sequence per community, independent of which strategy is being scored.
    delay_rng = random.Random(DELAY_SEED)

    tick = timedelta(minutes=TICK_MINUTES)
    max_ticks = int(MAX_SIM_DAYS * 24 * 60 / TICK_MINUTES)
    now = start_now

    for _ in range(max_ticks):
        prev_now = now
        now = now + tick
        dt_days = (now - prev_now).total_seconds() / 86400.0

        for community, hh_here in by_community.items():
            truck = trucks[community]
            temp_c = temps[community]

            # --- accrue household-days spent in "high" (bad) state ---
            for h in hh_here:
                if worst_variant(h, temp_c, now) == "high":
                    bad_state_days[community] += dt_days

            # --- truck arrival (with same breakdown/delay backup as sim_tick()) ---
            if truck["status"] == "en_route" and truck["trip_start"] is not None:
                if not truck["delayed"] and delay_rng.random() < BREAKDOWN_CHANCE_PER_TICK:
                    truck["trip_duration"] = truck["trip_duration"] + DELAY_EXTENSION
                    truck["delayed"] = True

                frac = (now - truck["trip_start"]) / truck["trip_duration"]
                if frac >= 1.0:
                    serviced_ids = {truck["target"], *truck["batch"]}
                    for h in hh_here:
                        if h.id in serviced_ids:
                            h.last_delivery = now
                            h.initial_chlorine_mgL = 1.5
                            h.sewage_baseline_pct = 10.0
                            h.record_start = now
                            serviced_ever[community].add(h.id)
                    truck.update(status="idle", target=None, trip_start=None, trip_duration=None, batch=[], delayed=False)

            # --- dispatch ---
            if truck["status"] == "idle":
                if strategy == "optimized":
                    urgent = [
                        h for h in hh_here
                        if worst_variant(h, temp_c, now) == "high" or predicted_needs_truck(h, temp_c, now)
                    ]
                    if urgent:
                        primary = urgent[0]
                        nearby = [
                            h.id for h in hh_here
                            if h.id != primary.id and worst_variant(h, temp_c, now) in CLOSE_ENOUGH_VARIANT
                        ]
                        truck.update(status="en_route", target=primary.id, trip_start=now,
                                     trip_duration=TRIP_DURATION, batch=nearby)
                elif strategy == "baseline":
                    # Blind rotation: always dispatch to the next household in
                    # fixed id order, no urgency check, no batching (a real
                    # fixed-route truck doesn't reshuffle its stop list based
                    # on measurement it doesn't have).
                    order = rr_order[community]
                    primary = order[rr_index[community] % len(order)]
                    rr_index[community] += 1
                    truck.update(status="en_route", target=primary.id, trip_start=now,
                                 trip_duration=TRIP_DURATION, batch=[])
                else:
                    raise ValueError(strategy)

            if coverage_day[community] is None and len(serviced_ever[community]) >= len(hh_here):
                coverage_day[community] = (now - start_now).total_seconds() / 86400.0

        if all(v is not None for v in coverage_day.values()):
            break

    return coverage_day, bad_state_days


def sanity_check(households: list) -> None:
    print("\n--- Sanity check: household model (from common.py) ---")
    for community in COMMUNITIES:
        hh = [h for h in households if h.community == community]
        depletion_days = [h.tank_capacity_l / max(h.consumption_lpd, 1) for h in hh]
        print(
            f"{community:15s} n={len(hh):2d}  "
            f"tank-depletion-from-full days: min={min(depletion_days):.1f} "
            f"max={max(depletion_days):.1f} avg={sum(depletion_days)/len(depletion_days):.1f}"
        )


def main() -> None:
    households_master = seed_households()
    start_now = datetime.now()

    sanity_check(households_master)

    temps = {c: fetch_current_temp_c(coords["lat"], coords["lon"])[0] for c, coords in COMMUNITIES.items()}
    print("\n--- Ambient temps used (°C) ---")
    for c, t in temps.items():
        print(f"{c:15s} {t:.1f}")

    baseline_hh = copy.deepcopy(households_master)
    optimized_hh = copy.deepcopy(households_master)

    baseline_coverage, baseline_bad = run_strategy("baseline", baseline_hh, start_now, temps)
    optimized_coverage, optimized_bad = run_strategy("optimized", optimized_hh, start_now, temps)

    print("\n--- Results: days to full coverage (every household serviced >=1x) ---")
    print(f"{'community':15s} {'baseline':>10s} {'optimized':>10s}")
    for c in COMMUNITIES:
        b = baseline_coverage[c]
        o = optimized_coverage[c]
        b_s = f"{b:.2f}" if b is not None else f">{MAX_SIM_DAYS} (DNF)"
        o_s = f"{o:.2f}" if o is not None else f">{MAX_SIM_DAYS} (DNF)"
        print(f"{c:15s} {b_s:>10s} {o_s:>10s}")

    finite_b = [v for v in baseline_coverage.values() if v is not None]
    finite_o = [v for v in optimized_coverage.values() if v is not None]
    avg_b = sum(finite_b) / len(finite_b) if finite_b else float("nan")
    avg_o = sum(finite_o) / len(finite_o) if finite_o else float("nan")
    print(f"{'AVERAGE':15s} {avg_b:>10.2f} {avg_o:>10.2f}")

    print("\n--- Results: household-days spent in a HIGH (bad) state ---")
    print(f"{'community':15s} {'baseline':>10s} {'optimized':>10s}")
    for c in COMMUNITIES:
        print(f"{c:15s} {baseline_bad[c]:>10.2f} {optimized_bad[c]:>10.2f}")
    total_b = sum(baseline_bad.values())
    total_o = sum(optimized_bad.values())
    print(f"{'TOTAL':15s} {total_b:>10.2f} {total_o:>10.2f}")

    print("\n--- Summary ---")
    if avg_o < avg_b:
        print(f"Optimized reaches full coverage FASTER on average ({avg_o:.2f}d vs {avg_b:.2f}d).")
    else:
        print(f"Optimized does NOT reach full coverage faster on average "
              f"({avg_o:.2f}d vs {avg_b:.2f}d baseline) - predictive/batch dispatch "
              f"optimizes for who's most urgent, not for fastest total coverage.")
    if total_o < total_b:
        print(f"Optimized spends FEWER household-days in a bad state "
              f"({total_o:.2f} vs {total_b:.2f}) - this is where predictive+batch actually wins.")
    else:
        print(f"Optimized does NOT reduce household-days in a bad state "
              f"({total_o:.2f} vs {total_b:.2f}).")

    # Stash results for the Simulation page to render, so we don't recompute
    # this (and re-run a minutes-long simulation) on every Streamlit rerun.
    import json
    out = {
        "generated_at": datetime.now().isoformat(),
        "tick_minutes": TICK_MINUTES,
        "trip_minutes": TRIP_DURATION.total_seconds() / 60,
        "baseline_coverage_days": baseline_coverage,
        "optimized_coverage_days": optimized_coverage,
        "baseline_bad_state_household_days": baseline_bad,
        "optimized_bad_state_household_days": optimized_bad,
        "baseline_avg_coverage_days": avg_b,
        "optimized_avg_coverage_days": avg_o,
        "baseline_total_bad_state_days": total_b,
        "optimized_total_bad_state_days": total_o,
    }
    out_path = __file__.replace("delivery_comparison.py", "delivery_comparison_results.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote results to {out_path}")


if __name__ == "__main__":
    main()
