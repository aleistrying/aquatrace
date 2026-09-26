"""Simulation page - a self-contained fast-forward demo. Time runs faster
than real time so you can watch households cycle green -> yellow -> red,
the predictive algorithm fire, and trucks get dispatched and return - 2
water-delivery trucks + 2 sewage-pump trucks per community (two physically
separate operations - see the Truck page's sensor table: "Household sewage
tank -> Sewage truck -> Wastewater disposal" is a separate leg from water
delivery), since each community runs its own fleet/facility.

Deliberately uses its OWN isolated household fleet (sim_households / sim_now)
- completely separate from the live households used on Houses/Plant/Truck/
Communities - so fast-forwarding time here can never corrupt those pages'
real-time state. Reuses the exact same shared math/components as every other
page (chlorine decay, sewage thresholds, tank_svg, badge, flatten_html) so it
stays connected to the rest of the app rather than feeling like a separate demo.
"""

import sys
import os
import random
import copy
from datetime import datetime, timedelta

import pydeck as pdk
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
from common import (  # noqa: E402
    COMMUNITIES, apply_theme, seed_households, fetch_current_temp_c,
    chlorine_residual_now, quality_status, current_sewage_pct, sewage_status,
    water_quantity_status, water_predicted_needs_truck,
    sewage_predicted_needs_truck, current_used_l, potability_pct, tank_svg, page_header, logger,
    _jittered_position, facility_position, PYDECK_RGB,
    _flatten_html as flatten_html,
)
from streamlit_theme import badge  # noqa: E402
from delivery_comparison import run_strategy as _dc_run_strategy  # noqa: E402
import delivery_comparison_fullscale as _dcf  # noqa: E402

apply_theme()

st.markdown(
    page_header("Simulation", "Fast-forward demo — 2 water-delivery trucks + 2 sewage-pump trucks per community, watch the algorithm work over simulated time"),
    unsafe_allow_html=True,
)

st.markdown(
    flatten_html(f"""
    <div class="hfh-alert hfh-alert-info">
      {badge("Isolated demo clock", "info")} Separate households from Houses/Communities &mdash; time moves
      fast so a full cycle takes minutes, not days. Same math and shared components as every other page.
    </div>
    """),
    unsafe_allow_html=True,
)

st.markdown(
    flatten_html(f"""
    <div class="hfh-alert hfh-alert-warning">
      <strong>Why a routine refill cycle is slow today:</strong> without per-house measurement, a
      truck has to visit on a blind rotation &mdash; for a ~1800-2000 person community that's roughly
      a 2-week cycle to reach everyone once, with occasional one-off emergency runs in between. That's
      the actual gap this tool closes: with real measurement, the same truck capacity can prioritize
      who genuinely needs it now instead of guessing.
    </div>
    """),
    unsafe_allow_html=True,
)

RANK = {"low": 0, "medium": 1, "high": 2}


@st.cache_data(show_spinner="Measuring baseline vs. predictive+batch dispatch over the seeded households…")
def _compute_dispatch_comparison():
    """Runs the two dispatch strategies (see delivery_comparison.py) over the
    SAME seeded household population, same one-truck-per-community, same
    45-min trip duration - the only difference is which household gets
    visited when. Cached so this doesn't re-run on every 2s sim tick."""
    base_hh = seed_households()
    start_now = datetime.now()
    temps = {c: fetch_current_temp_c(coords["lat"], coords["lon"])[0] for c, coords in COMMUNITIES.items()}
    baseline_coverage, baseline_bad = _dc_run_strategy("baseline", copy.deepcopy(base_hh), start_now, temps)
    optimized_coverage, optimized_bad = _dc_run_strategy("optimized", copy.deepcopy(base_hh), start_now, temps)
    return baseline_coverage, baseline_bad, optimized_coverage, optimized_bad


@st.cache_data(show_spinner="Measuring baseline vs. predictive+batch dispatch at REAL community scale (this can take a few seconds)…")
def _compute_fullscale_dispatch_comparison():
    """Same two dispatch strategies, but at REAL community population scale
    (~450-500 households for a ~1800-2000-person community, ~185-190 for a
    ~750-person one - see delivery_comparison_fullscale.py), with a
    mechanistic multi-truck round-trip cycle model (outbound + on-site +
    return + facility turnaround + occasional whole-trip blizzard/breakdown
    retries) instead of a flat 45-min one-way trip. Cached for the same
    reason as _compute_dispatch_comparison() above - this is a heavier run
    (hundreds of households/community) so it's worth caching even more."""
    fs_hh = _dcf.generate_fullscale_households()
    start_now = datetime.now()
    temps = {c: fetch_current_temp_c(coords["lat"], coords["lon"])[0] for c, coords in COMMUNITIES.items()}
    baseline_coverage, baseline_bad, baseline_retries = _dcf.run_strategy_fullscale(
        "baseline", copy.deepcopy(fs_hh), start_now, temps
    )
    optimized_coverage, optimized_bad, optimized_retries = _dcf.run_strategy_fullscale(
        "optimized", copy.deepcopy(fs_hh), start_now, temps
    )
    return baseline_coverage, baseline_bad, optimized_coverage, optimized_bad


_b_cov, _b_bad, _o_cov, _o_bad = _compute_dispatch_comparison()
_b_finite = [v for v in _b_cov.values() if v is not None]
_o_finite = [v for v in _o_cov.values() if v is not None]
_b_avg_days = sum(_b_finite) / len(_b_finite) if _b_finite else float("nan")
_o_avg_days = sum(_o_finite) / len(_o_finite) if _o_finite else float("nan")
_b_total_bad = sum(_b_bad.values())
_o_total_bad = sum(_o_bad.values())

_fb_cov, _fb_bad, _fo_cov, _fo_bad = _compute_fullscale_dispatch_comparison()
_fb_finite = [v for v in _fb_cov.values() if v is not None]
_fo_finite = [v for v in _fo_cov.values() if v is not None]
_fb_avg_days = sum(_fb_finite) / len(_fb_finite) if _fb_finite else float("nan")
_fo_avg_days = sum(_fo_finite) / len(_fo_finite) if _fo_finite else float("nan")
_fb_total_bad = sum(_fb_bad.values())
_fo_total_bad = sum(_fo_bad.values())
# Reference check specifically for the ~1800-2000-population communities -
# same check delivery_comparison_fullscale.py prints when run standalone.
_fb_big = [_fb_cov[c] for c, coords in COMMUNITIES.items() if coords["population"] >= 1500 and _fb_cov[c] is not None]
_fb_big_avg = sum(_fb_big) / len(_fb_big) if _fb_big else float("nan")

with st.expander("\U0001F4CA Measured: blind rotation vs. predictive+batch (this demo's seeded households)", expanded=False):
    st.caption(
        "Same seeded households, same one-truck-per-community, same 45-min trip duration for both strategies - "
        "only WHICH household gets visited when differs. Run over this demo's household SAMPLE (12-25 per "
        "community standing in for the real ~750-2000 population), not the full population - so use the "
        "comparison between the two numbers, not the absolute day counts, as the evidence."
    )
    m1, m2 = st.columns(2)
    with m1:
        st.metric("Baseline (blind rotation) — avg days to cover everyone", f"{_b_avg_days:.2f}")
        st.metric("Baseline — total household-days in a bad state", f"{_b_total_bad:.1f}")
    with m2:
        st.metric("Predictive + batch (this system) — avg days to cover everyone", f"{_o_avg_days:.2f}")
        st.metric("Predictive + batch — total household-days in a bad state", f"{_o_total_bad:.1f}")
    if _o_avg_days <= _b_avg_days:
        st.write("Full-coverage speed: predictive+batch is faster on this run.")
    else:
        st.write(
            "Full-coverage speed: blind rotation actually finishes touching every household sooner here - "
            "it never idles, so it works through its fixed route non-stop. Predictive+batch waits for real "
            "need, so covering the LAST unremarkable household can take longer."
        )
    if _o_total_bad <= _b_total_bad:
        st.write(
            "Where predictive+batch wins: far fewer household-days spent already in a bad state "
            "(tank empty/unsafe or sewage blocked) - it prioritizes preventing that, not blind coverage."
        )
    else:
        st.write("Household-days in a bad state were not lower for predictive+batch on this run.")

    st.divider()
    st.markdown("##### \U0001F310 Separate, larger-scale run: REAL population + realistic round-trip logistics")
    st.caption(
        "Everything above uses this demo's capped household SAMPLE (12-25/community) and a flat 45-min "
        "one-way trip. This section is a DIFFERENT, standalone run (see delivery_comparison_fullscale.py) "
        "over the REAL household count (~450-500 for a ~1800-2000-person community, ~185-190 for a "
        "~750-person one - same per-household consumption/tank/sewage model as the seeded sample, just "
        "not capped), a population-scaled multi-truck fleet (anchored on Inukjuak's documented 3 trucks), "
        "and a mechanistic trip-cycle time: outbound travel + on-site service + return travel + facility "
        "turnaround, plus an ~8% per-trip chance a blizzard/breakdown costs a whole trip with no delivery."
    )
    fm1, fm2 = st.columns(2)
    with fm1:
        st.metric("Baseline (blind rotation) — avg days to cover everyone", f"{_fb_avg_days:.2f}")
        st.metric("Baseline — total household-days in a bad state", f"{_fb_total_bad:.0f}")
    with fm2:
        st.metric("Predictive + batch (this system) — avg days to cover everyone", f"{_fo_avg_days:.2f}")
        st.metric("Predictive + batch — total household-days in a bad state", f"{_fo_total_bad:.0f}")
    if 14.0 <= _fb_big_avg <= 16.0:
        st.write(
            f"✅ Reference check: baseline blind-rotation for the ~1800-2000-population communities "
            f"averages **{_fb_big_avg:.2f} days** to reach every household once - lands inside the "
            f"independently-cited ~14-16 day full-cycle figure this app's problem framing is built on."
        )
    else:
        st.write(
            f"⚠️ Reference check: baseline blind-rotation for the ~1800-2000-population communities "
            f"averages {_fb_big_avg:.2f} days here - outside the cited ~14-16 day range on this particular run "
            f"(live-weather variance can shift chlorine-decay-driven urgency slightly run to run)."
        )
    if _fo_avg_days <= _fb_avg_days:
        st.write(
            f"At real scale, predictive+batch also reaches full coverage faster on this run "
            f"({_fo_avg_days:.2f}d vs {_fb_avg_days:.2f}d) - batching sweeps up many urgent households per "
            f"trip, and that advantage compounds with population size in a way it didn't at the small "
            f"12-25-household sample above."
        )
    else:
        st.write(
            f"At real scale, blind rotation still reaches full coverage faster on this run "
            f"({_fb_avg_days:.2f}d vs {_fo_avg_days:.2f}d) - same qualitative finding as the small sample."
        )
    st.write(
        f"Household-days in a bad state at real scale: {_fo_total_bad:.0f} (predictive+batch) vs "
        f"{_fb_total_bad:.0f} (baseline) - "
        + ("predictive+batch still spends far fewer household-days in a bad state at this scale."
           if _fo_total_bad <= _fb_total_bad else
           "predictive+batch does NOT reduce household-days in a bad state at this scale on this run.")
    )


def _new_truck_state() -> dict:
    return {"status": "idle", "target": None, "trip_start": None, "trip_duration": None, "batch": [], "delayed": False, "delay_reason": None}


def _new_fleets() -> dict:
    """Two independent trucks per community per truck TYPE - water delivery
    and sewage pump-out are two different physical operations (see the
    Truck page's sensor table: 'Household sewage tank -> Sewage truck ->
    Wastewater disposal' is a separate leg from water delivery), so each
    gets its own fleet rather than one truck doing both at once."""
    return {name: [_new_truck_state(), _new_truck_state()] for name in COMMUNITIES}


# ---------- Isolated simulation state ----------
if "sim_now" not in st.session_state:
    st.session_state.sim_now = datetime.now()
if "sim_households" not in st.session_state:
    st.session_state.sim_households = seed_households()
if "sim_water_trucks" not in st.session_state:
    st.session_state.sim_water_trucks = _new_fleets()
if "sim_sewage_trucks" not in st.session_state:
    st.session_state.sim_sewage_trucks = _new_fleets()
if "sim_events" not in st.session_state:
    st.session_state.sim_events = []
if "sim_running" not in st.session_state:
    st.session_state.sim_running = True
if "sim_total_serviced" not in st.session_state:
    st.session_state.sim_total_serviced = 0  # cumulative count of household water-fill/sewage-pump events

col_a, col_b, col_c, col_d = st.columns([1, 1, 1, 1.4])
with col_a:
    st.session_state.sim_running = st.toggle("▶ Running", value=st.session_state.sim_running)
with col_b:
    # Lower default/range than before (was 5-120, default 30) - a smaller
    # per-tick jump makes tank levels/truck position visibly glide between
    # the fragment's periodic reruns instead of visibly jumping, while still
    # letting the slider be pushed up for a faster-forward demo.
    minutes_per_tick = st.slider("Sim minutes / tick", 2, 90, 10)
with col_c:
    view_mode = st.radio("View", ["Households", "Community summary"], horizontal=True)
with col_d:
    if st.button("\U0001F504 Reset simulation"):
        st.session_state.sim_now = datetime.now()
        st.session_state.sim_households = seed_households()
        st.session_state.sim_water_trucks = _new_fleets()
        st.session_state.sim_sewage_trucks = _new_fleets()
        st.session_state.sim_events = []
        st.session_state.sim_total_serviced = 0
        st.rerun()

map_community = st.selectbox(
    "Truck map — community", list(COMMUNITIES), key="sim_map_community",
    help="Camera is fixed per community once chosen — it will not pan/zoom on its own between ticks.",
)

TRIP_DURATION = timedelta(minutes=45)  # illustrative in-transit time within the ~50 km^2 area
CLOSE_ENOUGH_VARIANT = {"medium", "high"}  # batch-service anyone already this urgent while the truck is out
# Batching uses a WIDER predictive horizon than the 1-day dispatch trigger -
# since the two-fleet split (below) scopes batching to same-type-only
# (a water truck can't scoop up a sewage-urgent household anymore), this
# wider horizon offsets that narrower per-type pool, so a dispatched trip
# reads as "servicing a cluster of houses" rather than one house at a time.
BATCH_HORIZON_DAYS = 1.5

# Breakdown/delay backup: a truck that should arrive in ~45 min but doesn't
# check in isn't just assumed fine - in reality the driver has no data
# signal in transit (see the Truck page's radio explainer), so a delay is
# only known once it's radioed in. This simulates that: a small per-tick
# chance of a mechanical/weather delay while en route, which extends the
# trip and is logged as a radio call, matching the real Truck page's
# "Delayed — mechanical" / "Delayed — weather" status codes exactly.
BREAKDOWN_CHANCE_PER_TICK = 0.02
DELAY_EXTENSION = timedelta(minutes=75)
DELAY_REASONS = ["mechanical", "weather"]


# ---------- Truck map (pydeck) ----------
# st.map() auto-centers/auto-zooms on every redraw, which makes an animated
# marker look like the whole map is jumping every tick. pydeck instead lets
# us build the ViewState (camera position) ONCE per community and cache it
# in session_state, then only recompute the data layers each tick - so the
# truck dot moves but the camera never resets.
if "sim_map_view_states" not in st.session_state:
    st.session_state.sim_map_view_states = {}


def _get_view_state(community: str) -> pdk.ViewState:
    if community not in st.session_state.sim_map_view_states:
        coords = COMMUNITIES[community]
        f_lat, f_lon = facility_position(community)
        # Centered between the community and its (fabricated) facility, zoom
        # fixed to comfortably frame both the facility and the ~50 km^2
        # household jitter radius - built once, then reused verbatim.
        st.session_state.sim_map_view_states[community] = pdk.ViewState(
            latitude=(coords["lat"] + f_lat) / 2, longitude=f_lon, zoom=10.3, pitch=0, bearing=0,
        )
    return st.session_state.sim_map_view_states[community]


def _truck_position(community: str, truck: dict, now: datetime) -> tuple[float, float, float, tuple[float, float] | None]:
    """Straight-line interpolation between the facility and the target
    household, driven by elapsed simulated time -> a 0.0-1.0 progress
    fraction (same frac the existing progress bar uses)."""
    f_lat, f_lon = facility_position(community)
    if truck["status"] == "en_route" and truck["trip_start"] is not None:
        frac = max(0.0, min(1.0, (now - truck["trip_start"]) / truck["trip_duration"]))
        coords = COMMUNITIES[community]
        t_lat, t_lon = _jittered_position(truck["target"], coords["lat"], coords["lon"])
        lat = f_lat + (t_lat - f_lat) * frac
        lon = f_lon + (t_lon - f_lon) * frac
        return lat, lon, frac, (t_lat, t_lon)
    return f_lat, f_lon, 0.0, None


def _water_variant(h, temp_c, now) -> tuple[str, str]:
    """Worst-of(chlorine quality, tank volume) — the WATER side only, no
    sewage mixed in. Used to decide water-truck dispatch/batching so a
    water truck is never routed by a sewage condition."""
    residual = chlorine_residual_now(h, temp_c, now)
    water_variant, water_label, _ = quality_status(residual)
    qty_variant, qty_label, _ = water_quantity_status(100 * (1 - current_used_l(h, now) / h.tank_capacity_l))
    if RANK[qty_variant] > RANK[water_variant]:
        water_variant, water_label = qty_variant, qty_label
    return water_variant, water_label


def _sewage_variant(h, now) -> tuple[str, str]:
    """Sewage tank fill status only — independent of water quality/volume.
    Used to decide sewage-truck dispatch/batching."""
    sew_variant, sew_label, _ = sewage_status(current_sewage_pct(h, now))
    return sew_variant, sew_label


def _worst_variant(h, temp_c, now) -> tuple[str, str, str]:
    """Worst-of(water, sewage) — used only for the overall household status
    badge/map dot color (a single "how bad is this household right now"
    summary). NOT used for truck dispatch — dispatch uses the water/sewage
    checks above separately so a water truck can't be routed by a sewage
    condition, or vice versa."""
    water_variant, water_label = _water_variant(h, temp_c, now)
    sew_variant, sew_label = _sewage_variant(h, now)
    worst = water_variant if RANK[water_variant] >= RANK[sew_variant] else sew_variant
    return worst, water_label, sew_label


def _water_urgent(h, temp_c, now) -> bool:
    """Dispatch trigger for a WATER-delivery truck: already high (empty tank
    or unsafe chlorine) OR predicted to cross into trouble soon — water-only
    (see common.water_predicted_needs_truck)."""
    return _water_variant(h, temp_c, now)[0] == "high" or water_predicted_needs_truck(h, temp_c, now)


def _sewage_urgent(h, now) -> bool:
    """Dispatch trigger for a SEWAGE-pump truck: already high (tank full,
    water use blocked) OR predicted to cross the blocked threshold soon —
    sewage-only (see common.sewage_predicted_needs_truck)."""
    return _sewage_variant(h, now)[0] == "high" or sewage_predicted_needs_truck(h, now)


def _water_close_enough(h, temp_c, now) -> bool:
    """Batch-eligibility for a WATER truck already heading out: already
    medium/high, OR predicted to need water within BATCH_HORIZON_DAYS (wider
    than the 1-day dispatch-trigger horizon - see BATCH_HORIZON_DAYS)."""
    variant, _ = _water_variant(h, temp_c, now)
    return variant in CLOSE_ENOUGH_VARIANT or water_predicted_needs_truck(h, temp_c, now, horizon_days=BATCH_HORIZON_DAYS)


def _sewage_close_enough(h, now) -> bool:
    """Batch-eligibility for a SEWAGE truck already heading out - same idea
    as _water_close_enough, sewage-only."""
    variant, _ = _sewage_variant(h, now)
    return variant in CLOSE_ENOUGH_VARIANT or sewage_predicted_needs_truck(h, now, horizon_days=BATCH_HORIZON_DAYS)


# Water trucks: slate (the color the single truck already used) · Sewage
# trucks: gold — both pulled from the SAME PYDECK_RGB palette already used
# for badges/status dots elsewhere in this app, not new colors.
_FLEET_MAP_STYLE = {
    "water": {"rgb": PYDECK_RGB["slate"], "icon": "\U0001F69A"},
    "sewage": {"rgb": PYDECK_RGB["gold"], "icon": "\U0001F69B"},
}


def render_truck_map(community: str, water_trucks: list, sewage_trucks: list, hh_here: list, temp_c: float, now: datetime) -> None:
    f_lat, f_lon = facility_position(community)

    facility_layer = pdk.Layer(
        "ScatterplotLayer",
        data=[{"lat": f_lat, "lon": f_lon, "label": "Water treatment facility (illustrative position)"}],
        get_position="[lon, lat]",
        get_fill_color=PYDECK_RGB["ink_soft"] + [220],
        get_line_color=[255, 255, 255, 230],
        line_width_min_pixels=2,
        stroked=True,
        get_radius=220,
        radius_min_pixels=9,
        pickable=True,
    )

    assigned_ids = set()
    for t in (*water_trucks, *sewage_trucks):
        if t.get("target"):
            assigned_ids.add(t["target"])
            assigned_ids.update(t["batch"])

    household_points = []
    highlight_points = []
    for h in hh_here:
        h_lat, h_lon = _jittered_position(h.id, COMMUNITIES[community]["lat"], COMMUNITIES[community]["lon"])
        worst, _, _ = _worst_variant(h, temp_c, now)
        color = {"low": PYDECK_RGB["pine"], "medium": PYDECK_RGB["gold"], "high": PYDECK_RGB["maple"]}[worst]
        point = {"lat": h_lat, "lon": h_lon, "label": f"{h.id} ({worst})", "color": color}
        household_points.append(point)
        # Whichever household(s) a truck (either type) is actually heading
        # to get a distinct highlighted ring on top of their normal status
        # color, so it's visually obvious which dot a route line connects
        # to - not just "some colored dot near a truck."
        if h.id in assigned_ids:
            highlight_points.append({"lat": h_lat, "lon": h_lon, "label": f"{h.id} — truck assigned"})

    household_layer = pdk.Layer(
        "ScatterplotLayer",
        data=household_points,
        get_position="[lon, lat]",
        get_fill_color="color",
        get_radius=90,
        radius_min_pixels=4,
        pickable=True,
    )

    layers = [facility_layer, household_layer]

    if highlight_points:
        highlight_layer = pdk.Layer(
            "ScatterplotLayer",
            data=highlight_points,
            get_position="[lon, lat]",
            get_fill_color=[0, 0, 0, 0],
            get_line_color=PYDECK_RGB["slate"] + [255],
            line_width_min_pixels=3,
            stroked=True,
            filled=False,
            get_radius=210,
            radius_min_pixels=10,
            pickable=False,
        )
        layers.append(highlight_layer)

    # Draw each fleet (water, then sewage) - up to 2 trucks per fleet - each
    # with its own route line + marker, colored/iconed per _FLEET_MAP_STYLE
    # so the two truck TYPES are visually distinguishable on the same map.
    n_active = {"water": 0, "sewage": 0}
    for kind, fleet in (("water", water_trucks), ("sewage", sewage_trucks)):
        style = _FLEET_MAP_STYLE[kind]
        for idx, truck in enumerate(fleet, start=1):
            truck_lat, truck_lon, frac, target_latlon = _truck_position(community, truck, now)
            if truck["status"] == "en_route":
                n_active[kind] += 1
            if target_latlon is not None:
                route_layer = pdk.Layer(
                    "PathLayer",
                    data=[{"path": [[f_lon, f_lat], [target_latlon[1], target_latlon[0]]]}],
                    get_path="path",
                    get_color=style["rgb"] + [140],
                    get_width=3,
                    width_min_pixels=2,
                )
                layers.append(route_layer)

            truck_status_label = (
                f"En route to {truck['target']} ({frac:.0%})" if truck["status"] == "en_route" else "Idle at facility"
            )
            truck_layer = pdk.Layer(
                "ScatterplotLayer",
                data=[{
                    "lat": truck_lat, "lon": truck_lon,
                    "label": f"{style['icon']} {kind.title()} truck {idx}: {truck_status_label}",
                }],
                get_position="[lon, lat]",
                get_fill_color=style["rgb"] + [255],
                get_line_color=[255, 255, 255, 255],
                line_width_min_pixels=2,
                stroked=True,
                get_radius=140,
                radius_min_pixels=8,
                pickable=True,
            )
            layers.append(truck_layer)

    deck = pdk.Deck(
        map_style=None,
        initial_view_state=_get_view_state(community),
        layers=layers,
        tooltip={"text": "{label}"},
    )
    st.pydeck_chart(deck, use_container_width=True, height=420)
    st.caption(
        "\U0001F3ED grey = facility (fabricated demo position, not surveyed) &middot; "
        f"\U0001F69A slate = water truck ({n_active['water']}/{len(water_trucks)} en route) &middot; "
        f"\U0001F69B gold = sewage truck ({n_active['sewage']}/{len(sewage_trucks)} en route) &middot; "
        "colored dots = households by worst status. Straight-line path shown, not real road routing."
    )


def _run_fleet(community: str, kind: str, fleet: list, hh_here: list, temp_c: float, now: datetime) -> None:
    """Advances every truck in ONE fleet (kind='water' or 'sewage') for ONE
    community by a tick: breakdown/delay check + arrival for any en-route
    truck, then a dispatch check for any IDLE truck.

    Trucks in the SAME fleet are processed in list order, so if truck 1 is
    already busy, truck 2 (if idle) is the one that picks up the next
    urgent household - "pick the first idle truck" falls out of this
    ordering rather than needing separate bookkeeping. `already_assigned`
    is recomputed fresh before each truck's dispatch check, so it reflects
    any truck earlier in this SAME fleet that was just dispatched this same
    tick (dicts are mutated in place) - two trucks of the same type can
    never double-book one household."""
    is_water = kind == "water"
    icon = "\U0001F69A" if is_water else "\U0001F69B"
    verb = "delivered water to" if is_water else "pumped out sewage at"
    urgent_fn = (lambda h: _water_urgent(h, temp_c, now)) if is_water else (lambda h: _sewage_urgent(h, now))
    close_fn = (lambda h: _water_close_enough(h, temp_c, now)) if is_water else (lambda h: _sewage_close_enough(h, now))

    for truck in fleet:
        if truck["status"] == "en_route" and truck["trip_start"] is not None:
            # Backup: random chance of a breakdown/weather delay while en
            # route, radioed in immediately (no silent "unknown" state - the
            # driver has no data signal, but voice radio still works, per
            # the Truck page's connectivity model).
            if not truck["delayed"] and random.random() < BREAKDOWN_CHANCE_PER_TICK:
                reason = random.choice(DELAY_REASONS)
                truck["trip_duration"] = truck["trip_duration"] + DELAY_EXTENSION
                truck["delayed"] = True
                truck["delay_reason"] = reason
                st.session_state.sim_events.append(
                    f"{now.strftime('%b %d %H:%M')} — {community}: {icon} {kind} truck radioed in a delay ({reason}) en route to {truck['target']}, ETA pushed back"
                )
                logger.info("[sim] %s %s truck delayed (%s) en route to %s at %s", community, kind, reason, truck["target"], now)

            frac = (now - truck["trip_start"]) / truck["trip_duration"]
            if frac >= 1.0:
                serviced_ids = {truck["target"], *truck["batch"]}
                for h in hh_here:
                    if h.id in serviced_ids:
                        # Core correctness fix: a water truck ONLY resets the
                        # water/chlorine clock; a sewage truck ONLY resets the
                        # sewage clock - one truck's visit no longer silently
                        # "fixes" the other measurement.
                        if is_water:
                            h.last_delivery = now
                            h.initial_chlorine_mgL = 1.5
                        else:
                            h.sewage_baseline_pct = 10.0
                            h.record_start = now
                st.session_state.sim_total_serviced += len(serviced_ids)
                extra = f" (+{len(truck['batch'])} nearby while out)" if truck["batch"] else ""
                st.session_state.sim_events.append(f"{now.strftime('%b %d %H:%M')} — {community}: {icon} {kind} truck {verb} {truck['target']}{extra}")
                logger.info("[sim] %s %s truck %s %s%s at %s", community, kind, verb, truck["target"], extra, now)
                truck.update(status="idle", target=None, trip_start=None, trip_duration=None, batch=[], delayed=False, delay_reason=None)

        if truck["status"] == "idle":
            already_assigned = set()
            for t in fleet:
                if t["status"] == "en_route" and t.get("target"):
                    already_assigned.add(t["target"])
                    already_assigned.update(t["batch"])

            urgent = [h for h in hh_here if h.id not in already_assigned and urgent_fn(h)]
            if urgent:
                # Oldest-serviced-first tiebreak, NOT first-in-list-order:
                # picking urgent[0] would always favor whichever household
                # happens to sort first (effectively low-id households),
                # since a household that cycles back into "urgent" quickly
                # would keep out-ranking one that's been waiting since day 1.
                # last_delivery / record_start already ARE each household's
                # "last serviced" timestamp for water / sewage respectively
                # (reset on arrival - see below), so picking the minimum
                # directly prioritizes whoever has gone longest without
                # service among the currently-urgent households.
                primary = min(urgent, key=lambda h: h.last_delivery if is_water else h.record_start)
                # Batch-service: the truck is going anyway, so also swing by
                # anyone else in the community close enough to this SAME
                # need type (medium/high, or predicted within the wider
                # BATCH_HORIZON_DAYS window) - biased toward larger, more
                # visible trips rather than one house at a time.
                nearby = [h.id for h in hh_here if h.id != primary.id and h.id not in already_assigned and close_fn(h)]
                truck.update(status="en_route", target=primary.id, trip_start=now, trip_duration=TRIP_DURATION, batch=nearby)
                extra = f" (+{len(nearby)} nearby)" if nearby else ""
                st.session_state.sim_events.append(f"{now.strftime('%b %d %H:%M')} — {community}: {icon} {kind} truck dispatched to {primary.id}{extra}")
                logger.info("[sim] %s %s truck dispatched to %s%s at %s", community, kind, primary.id, extra, now)


@st.fragment(run_every="1s")
def sim_tick():
    if st.session_state.sim_running:
        st.session_state.sim_now += timedelta(minutes=minutes_per_tick)
    now = st.session_state.sim_now
    households = st.session_state.sim_households
    water_trucks = st.session_state.sim_water_trucks
    sewage_trucks = st.session_state.sim_sewage_trucks

    # --- per-community truck logic - water fleet and sewage fleet advance
    # independently, each scoped to its own need type only ---
    for community in COMMUNITIES:
        temp_c, _ = fetch_current_temp_c(COMMUNITIES[community]["lat"], COMMUNITIES[community]["lon"])
        hh_here = [h for h in households if h.community == community]
        _run_fleet(community, "water", water_trucks[community], hh_here, temp_c, now)
        _run_fleet(community, "sewage", sewage_trucks[community], hh_here, temp_c, now)

    # --- render ---
    time_col, serviced_col = st.columns(2)
    with time_col:
        st.metric("Simulated time", now.strftime("%Y-%m-%d %H:%M"))
    with serviced_col:
        st.metric("Households filled/emptied so far", st.session_state.sim_total_serviced)

    st.markdown("#### Trucks right now")
    st.caption(
        "\U0001F69A slate = water-delivery truck &middot; \U0001F69B gold = sewage-pump truck &middot; "
        "2 of each per community, grouped below."
    )
    for community in COMMUNITIES:
        hh_here = [h for h in households if h.community == community]
        temp_c, _ = fetch_current_temp_c(COMMUNITIES[community]["lat"], COMMUNITIES[community]["lon"])
        n_water_active = sum(1 for t in water_trucks[community] if t["status"] == "en_route")
        n_sewage_active = sum(1 for t in sewage_trucks[community] if t["status"] == "en_route")
        st.markdown(f"**{community}** — \U0001F69A {n_water_active}/2 out &middot; \U0001F69B {n_sewage_active}/2 out")
        # A bordered container (not an expander) - the per-truck manifest
        # below IS an expander, and Streamlit disallows nesting an expander
        # inside another expander, so the community-level grouping has to
        # be a plain container instead.
        with st.container(border=True):
            w_col, s_col = st.columns(2)
            for kind, col, fleet, icon in (
                ("water", w_col, water_trucks[community], "\U0001F69A"),
                ("sewage", s_col, sewage_trucks[community], "\U0001F69B"),
            ):
                with col:
                    st.markdown(f"{icon} **{kind.title()} trucks**")
                    for idx, truck in enumerate(fleet, start=1):
                        if truck["status"] == "en_route":
                            frac = min((now - truck["trip_start"]) / truck["trip_duration"], 1.0)
                            if truck["delayed"]:
                                st.warning(f"#{idx}: delayed ({truck['delay_reason']}, radioed in) — {truck['target']} {frac:.0%}", icon="\U0001F4FB")
                            else:
                                st.progress(frac, text=f"#{idx}: {truck['target']} {frac:.0%}")
                            assigned_ids = [truck["target"], *truck["batch"]]
                            # Explicit stable `key` (not derived from the
                            # label, which changes every tick as the house
                            # count/progress changes) so Streamlit remembers
                            # the user's open/closed choice across the
                            # fragment's auto-reruns instead of resetting shut.
                            with st.expander(
                                f"Manifest #{idx} ({len(assigned_ids)} house{'s' if len(assigned_ids) != 1 else ''})",
                                key=f"sim_manifest_{community}_{kind}_{idx}",
                            ):
                                for hid in assigned_ids:
                                    hh = next((x for x in hh_here if x.id == hid), None)
                                    if hh is None:
                                        continue
                                    residual = chlorine_residual_now(hh, temp_c, now)
                                    w_pct = 100 * (1 - current_used_l(hh, now) / hh.tank_capacity_l)
                                    s_pct = current_sewage_pct(hh, now)
                                    p_pct = potability_pct(residual)
                                    st.caption(f"**{hh.id}** ({hh.tank_capacity_l}L) — water {w_pct:.0f}% · sewage {s_pct:.0f}% · potability {p_pct:.0f}%")
                        else:
                            st.caption(f"#{idx}: idle at plant")

    st.markdown(f"#### Live truck map — {map_community}")
    _map_hh_here = [h for h in households if h.community == map_community]
    _map_temp_c, _ = fetch_current_temp_c(COMMUNITIES[map_community]["lat"], COMMUNITIES[map_community]["lon"])
    render_truck_map(map_community, water_trucks[map_community], sewage_trucks[map_community], _map_hh_here, _map_temp_c, now)

    if view_mode == "Households":
        st.markdown("#### Household status")
        cols = st.columns(3)
        for i, h in enumerate(households):
            temp_c, _ = fetch_current_temp_c(COMMUNITIES[h.community]["lat"], COMMUNITIES[h.community]["lon"])
            worst_variant, water_label, sew_label = _worst_variant(h, temp_c, now)
            residual = chlorine_residual_now(h, temp_c, now)
            water_remaining_pct = 100 * (1 - current_used_l(h, now) / h.tank_capacity_l)
            sewage_pct = current_sewage_pct(h, now)
            pot_pct = potability_pct(residual)
            being_served_water = any(
                t["status"] == "en_route" and (t["target"] == h.id or h.id in t["batch"])
                for t in water_trucks[h.community]
            )
            being_served_sewage = any(
                t["status"] == "en_route" and (t["target"] == h.id or h.id in t["batch"])
                for t in sewage_trucks[h.community]
            )
            if being_served_water and being_served_sewage:
                status_label, status_variant = "\U0001F69A\U0001F69B En route (water+sewage)", "info"
            elif being_served_water:
                status_label, status_variant = "\U0001F69A En route (water)", "info"
            elif being_served_sewage:
                status_label, status_variant = "\U0001F69B En route (sewage)", "info"
            else:
                status_label, status_variant = worst_variant.title(), worst_variant
            with cols[i % 3]:
                st.markdown(
                    flatten_html(f"""
                    <div class="hfh-card" style="margin-bottom:0.6rem;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>{h.id}</strong> {badge(status_label, status_variant)}
                      </div>
                      <div style="font-size:var(--font-size-xs); color:var(--color-ink-soft); margin:0.15rem 0;">{h.tank_capacity_l}L tank &middot; {h.consumption_lpd:.0f} L/day &middot; sewage +{h.sewage_fill_rate_pct_per_day:.1f}%/day</div>
                      <div style="display:flex; gap:0.3rem; justify-content:center;">
                        {tank_svg(water_remaining_pct, quality_status(residual)[0], "Water", width=58, height=92)}
                        {tank_svg(sewage_pct, sewage_status(sewage_pct)[0], "Sewage", width=58, height=92)}
                        {tank_svg(pot_pct, quality_status(residual)[0], "Potable", width=58, height=92)}
                      </div>
                    </div>
                    """),
                    unsafe_allow_html=True,
                )
    else:
        st.markdown("#### Community summary")
        summary_cols = st.columns(len(COMMUNITIES))
        for i, community in enumerate(COMMUNITIES):
            hh_here = [h for h in households if h.community == community]
            temp_c, _ = fetch_current_temp_c(COMMUNITIES[community]["lat"], COMMUNITIES[community]["lon"])
            approaching_sewage = sum(1 for h in hh_here if sewage_status(current_sewage_pct(h, now))[0] in CLOSE_ENOUGH_VARIANT)
            approaching_water = sum(1 for h in hh_here if quality_status(chlorine_residual_now(h, temp_c, now))[0] in CLOSE_ENOUGH_VARIANT)
            avg_consumption = sum(h.consumption_lpd for h in hh_here) / max(len(hh_here), 1)
            avg_sewage_rate = sum(h.sewage_fill_rate_pct_per_day for h in hh_here) / max(len(hh_here), 1)
            with summary_cols[i]:
                st.markdown(
                    flatten_html(f"""
                    <div class="hfh-card">
                      <strong>{community}</strong>
                      <p style="margin:0.4rem 0 0 0; font-size:var(--font-size-sm); color:var(--color-ink-soft);">
                        {len(hh_here)} households<br/>
                        {badge(f"{approaching_sewage} approaching sewer need", "medium" if approaching_sewage else "low")}<br/>
                        {badge(f"{approaching_water} approaching water need", "medium" if approaching_water else "low")}<br/>
                        Avg consumption: {avg_consumption:.0f} L/day<br/>
                        Avg sewage fill rate: {avg_sewage_rate:.1f} %/day
                      </p>
                    </div>
                    """),
                    unsafe_allow_html=True,
                )

    with st.expander(f"Event log ({len(st.session_state.sim_events)})", key="sim_event_log"):
        for event in reversed(st.session_state.sim_events[-20:]):
            st.write(event)


sim_tick()
