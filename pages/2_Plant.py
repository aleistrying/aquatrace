"""Plant page - the treatment facility. This is one of only two points in
the whole system with reliable connectivity (the other being houses), per
the team's own clarification of the connectivity map."""

import sys
import os
import math
import random
from datetime import datetime, timedelta

import pydeck as pdk
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
from common import (  # noqa: E402
    COMMUNITIES, fetch_current_temp_c, apply_theme, logger, page_header, badge_tt,
    get_households, _jittered_position, facility_position, PYDECK_RGB,
    chlorine_residual_now, quality_status, current_sewage_pct, sewage_status,
    _flatten_html as flatten_html,
)

apply_theme()

st.markdown(
    page_header("Treatment facility", "One of the two fixed points with reliable connectivity (the other is houses)"),
    unsafe_allow_html=True,
)

st.markdown(
    flatten_html(f"""
    <div class="hfh-alert hfh-alert-info">
      {badge_tt("Already monitored weekly", "verified", "Coliform testing at the plant is already standard practice in comparable northern systems.")} The gap this system targets is everything
      <em>after</em> water leaves here (truck &rarr; tank &rarr; tap), not the plant.
    </div>
    """),
    unsafe_allow_html=True,
)

community = st.selectbox("Facility serving", list(COMMUNITIES.keys()), key="plant_community")
coords = COMMUNITIES[community]
temp_c, temp_source = fetch_current_temp_c(coords["lat"], coords["lon"])

if "plant_last_test" not in st.session_state:
    st.session_state.plant_last_test = datetime.now() - timedelta(days=3)
    st.session_state.plant_last_result = "Clear — no coliforms detected"
    st.session_state.plant_dose_mgL = 1.5

col1, col2, col3 = st.columns(3)
with col1:
    st.metric("Connectivity", "Connected", help="Always-on connectivity at this location, per the team's connectivity map.")
with col2:
    st.metric("Current chlorine dose", f"{st.session_state.plant_dose_mgL:.1f} mg/L")
with col3:
    st.metric("Ambient temperature", f"{temp_c:.1f} °C", help=f"Source: {temp_source}")

st.markdown(
    flatten_html(f"""
    <div class="hfh-card" style="margin: 1rem 0;">
      <strong>Last weekly coliform test</strong> {badge_tt("Pass" if "Clear" in st.session_state.plant_last_result else "Fail", "low" if "Clear" in st.session_state.plant_last_result else "high", "No coliforms detected in the most recent weekly test." if "Clear" in st.session_state.plant_last_result else "Coliforms detected — a boil-water advisory is needed until retested clear.")}
      <p style="margin:0.4rem 0 0 0; color: var(--color-ink-soft);">
        {st.session_state.plant_last_result} &mdash; tested {(datetime.now() - st.session_state.plant_last_test).days} day(s) ago
      </p>
    </div>
    """),
    unsafe_allow_html=True,
)

st.subheader("Log a treated batch")
st.caption("Pre-made choices, not free text — fast to fill in while running the plant.")
with st.form("plant_batch_form"):
    dose = st.select_slider("Chlorine dose applied (mg/L)", options=[1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8], value=1.5)
    destination = st.selectbox("Destination community", list(COMMUNITIES.keys()))
    test_result = st.radio("Weekly coliform test result", ["Clear — no coliforms detected", "Detected — boil-water advisory needed"], horizontal=False)
    submitted = st.form_submit_button("Log batch")
    if submitted:
        st.session_state.plant_dose_mgL = dose
        st.session_state.plant_last_test = datetime.now()
        st.session_state.plant_last_result = test_result
        logger.info("Plant batch logged: dose=%.1f destination=%s result=%s", dose, destination, test_result)
        st.success(f"Logged: {dose} mg/L batch for {destination}. This dose is what the truck page will apply to new deliveries.")

st.divider()
st.subheader(f"Household network — {community}")
st.caption(
    "Operator-facing detail the community-wide maps don't show: every household this facility "
    "serves, its distance from the plant, which cluster it's in, and its current water/sewage "
    "status — for routing/logistics judgment calls, not the public overview."
)


def _facility_distance_km(h_lat: float, h_lon: float, f_lat: float, f_lon: float) -> float:
    """Distance from a household's jittered position to the facility, using
    the SAME flat-earth km-per-degree approximation _jittered_position
    already uses (111 km/deg latitude, 111*cos(lat) km/deg longitude) -
    kept consistent with how these positions were generated instead of
    introducing a haversine that would (very slightly) disagree with them."""
    dlat_km = (h_lat - f_lat) * 111.0
    dlon_km = (h_lon - f_lon) * 111.0 * math.cos(math.radians(f_lat))
    return math.hypot(dlat_km, dlon_km)


# Distance BANDS, not compass-direction sectors from the facility: the
# facility sits a fixed ~7.8 km due south of every community center (see
# common.FACILITY_LAT_OFFSET_DEG), so every household's bearing FROM the
# facility is always "roughly north" regardless of community - a compass
# sector grouping would put ~100% of households in one sector. Distance
# bands actually split the population usefully; the thresholds below are
# recalibrated to this app's real ~6-9 km facility-to-household range (the
# raw "<2km / 2-4km / 4km+" example range would, for the same geometry
# reason, land every household in one "far" bucket).
NEAR_BAND_KM = 7.0
MID_BAND_KM = 8.0
_CLUSTER_LABELS = [f"Near (<{NEAR_BAND_KM:.0f}km)", f"Mid ({NEAR_BAND_KM:.0f}-{MID_BAND_KM:.0f}km)", f"Far ({MID_BAND_KM:.0f}km+)"]


def _distance_cluster(dist_km: float) -> str:
    if dist_km < NEAR_BAND_KM:
        return _CLUSTER_LABELS[0]
    if dist_km < MID_BAND_KM:
        return _CLUSTER_LABELS[1]
    return _CLUSTER_LABELS[2]


_STATUS_RANK = {"low": 0, "medium": 1, "high": 2}
_MANUAL_VARIANT = {"All good": "low", "Tank getting low": "medium", "Something's wrong": "high", None: "medium"}


def _household_water_status(h, temp_c: float, now: datetime) -> tuple[str, str, str]:
    """Same water-status logic pages/4_Communities.py already uses per
    household (auto-sensor chlorine reading, or manual backup-button report
    for the ~30% of households without a sensor) - reused here rather than
    reinvented so this page agrees with the rest of the app."""
    if h.has_auto_sensor:
        residual = chlorine_residual_now(h, temp_c, now)
        return quality_status(residual)
    variant = _MANUAL_VARIANT[h.manual_alert]
    label = h.manual_alert or "Awaiting manual check-in"
    return variant, label, "Reported via the household's backup button — no auto-sensor at this address."


plant_now = datetime.now()
f_lat, f_lon = facility_position(community)
hh_here = [h for h in get_households() if h.community == community]

network_rows = []
for h in hh_here:
    h_lat, h_lon = _jittered_position(h.id, coords["lat"], coords["lon"])
    dist_km = _facility_distance_km(h_lat, h_lon, f_lat, f_lon)
    water_variant, water_label, water_tip = _household_water_status(h, temp_c, plant_now)
    sewage_pct = current_sewage_pct(h, plant_now)
    sew_variant, sew_label, sew_tip = sewage_status(sewage_pct)
    worst_variant = water_variant if _STATUS_RANK[water_variant] >= _STATUS_RANK[sew_variant] else sew_variant
    network_rows.append({
        "id": h.id, "size": h.household_size, "lat": h_lat, "lon": h_lon,
        "dist_km": dist_km, "cluster": _distance_cluster(dist_km),
        "water_variant": water_variant, "water_label": water_label, "water_tip": water_tip,
        "sew_variant": sew_variant, "sew_label": sew_label, "sew_tip": sew_tip,
        "worst_variant": worst_variant,
    })

present_clusters = [c for c in _CLUSTER_LABELS if any(r["cluster"] == c for r in network_rows)]
filt_col, sort_col = st.columns(2)
with filt_col:
    cluster_filter = st.selectbox("Filter by cluster", ["All clusters"] + present_clusters, key="plant_cluster_filter")
with sort_col:
    sort_choice = st.selectbox(
        "Sort by",
        ["Urgency (highest first)", "Distance (near → far)", "Distance (far → near)", "Household ID"],
        key="plant_sort_choice",
    )

filtered_rows = network_rows if cluster_filter == "All clusters" else [r for r in network_rows if r["cluster"] == cluster_filter]
if sort_choice == "Distance (near → far)":
    filtered_rows = sorted(filtered_rows, key=lambda r: r["dist_km"])
elif sort_choice == "Distance (far → near)":
    filtered_rows = sorted(filtered_rows, key=lambda r: -r["dist_km"])
elif sort_choice == "Household ID":
    filtered_rows = sorted(filtered_rows, key=lambda r: r["id"])
else:
    filtered_rows = sorted(filtered_rows, key=lambda r: (-_STATUS_RANK[r["worst_variant"]], -r["dist_km"]))

st.caption(f"Showing {len(filtered_rows)} of {len(network_rows)} households monitored in {community}.")

for r in filtered_rows:
    st.markdown(
        flatten_html(f"""
        <div class="hfh-card" style="margin-bottom:0.5rem; padding:0.6rem 0.9rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <strong>{r['id']}</strong>
              <span style="color:var(--color-ink-soft); font-size:var(--font-size-sm);">
                &middot; {r['size']} people &middot; {r['dist_km']:.1f} km from facility &middot; {r['cluster']}
              </span>
            </div>
            <div style="display:flex; gap:0.4rem;">
              {badge_tt(r['water_label'], r['water_variant'], r['water_tip'])}
              {badge_tt(r['sew_label'], r['sew_variant'], r['sew_tip'])}
            </div>
          </div>
        </div>
        """),
        unsafe_allow_html=True,
    )

if not filtered_rows:
    st.caption("No households match this filter.")

st.markdown("##### Facility ↔ household map")
st.caption(
    "Grey = facility (fixed reference point; a fabricated demo position, not surveyed) &middot; "
    "colored dots = households, positioned by their actual distance/bearing from the facility, "
    "coloured by worst current status (water or sewage)."
)

_STATUS_RGB = {"low": PYDECK_RGB["pine"], "medium": PYDECK_RGB["gold"], "high": PYDECK_RGB["maple"]}

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
household_layer = pdk.Layer(
    "ScatterplotLayer",
    data=[
        {"lat": r["lat"], "lon": r["lon"], "label": f"{r['id']} ({r['worst_variant']}, {r['dist_km']:.1f} km)", "color": _STATUS_RGB[r["worst_variant"]]}
        for r in network_rows
    ],
    get_position="[lon, lat]",
    get_fill_color="color",
    get_radius=90,
    radius_min_pixels=4,
    pickable=True,
)
plant_view_state = pdk.ViewState(latitude=(coords["lat"] + f_lat) / 2, longitude=f_lon, zoom=10.3, pitch=0, bearing=0)
st.pydeck_chart(
    pdk.Deck(map_style=None, initial_view_state=plant_view_state, layers=[facility_layer, household_layer], tooltip={"text": "{label}"}),
    use_container_width=True, height=380,
)

with st.expander("Sensor list used at this stage"):
    st.markdown(
        """
        | Measurement | Sensor type | Notes | Cold-weather note |
        |---|---|---|---|
        | Chlorine dosing/residual | Continuous amperometric or colorimetric bench-style analyzer | Standard practice in comparable northern systems already — least new work needed here | Housed inside the heated plant building — no direct cold exposure |
        | Coliform testing | Weekly lab/field test (existing practice per reference material) | The gap this system targets is *after* this point, not here | Performed indoors at the plant — no cold-weather hardening needed |
        """
    )
