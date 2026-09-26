"""Communities page - map + aggregate water-use view across all communities
in the demo. Nunavik is a 14-community region; this demo covers 4 of them."""

import sys
import os
from datetime import datetime

import pandas as pd
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
from common import (  # noqa: E402
    COMMUNITIES, REGION_NAME, REGION_COMMUNITY_COUNT, get_households,
    fetch_current_temp_c, chlorine_residual_now, quality_status, sewage_status,
    current_sewage_pct, predicted_needs_truck,
    PER_CAPITA_LOW_LPD, PER_CAPITA_HIGH_LPD, apply_theme, page_header, tank_svg,
    _jittered_position, badge_tt,
    _flatten_html as flatten_html,
)

apply_theme()

st.markdown(
    page_header("Communities", f"{REGION_NAME} region has {REGION_COMMUNITY_COUNT} communities in total &mdash; this demo covers 4"),
    unsafe_allow_html=True,
)

RISK_COLOR = {
    "low": [62, 124, 89],
    "medium": [150, 115, 31],
    "high": [168, 70, 46],
}

now = datetime.now()
households = get_households()
rank = {"low": 0, "medium": 1, "high": 2}

community_temps = {name: fetch_current_temp_c(c["lat"], c["lon"]) for name, c in COMMUNITIES.items()}

rows = []
map_rows = []
for name, coords in COMMUNITIES.items():
    temp_c, temp_source = community_temps[name]
    hh_here = [h for h in households if h.community == name]
    worst_variant = "low"
    for h in hh_here:
        if h.has_auto_sensor:
            residual = chlorine_residual_now(h, temp_c, now)
            variant, _, _ = quality_status(residual)
        else:
            variant = {"All good": "low", "Tank getting low": "medium", "Something's wrong": "high", None: "medium"}[h.manual_alert]
        sew_variant, _, _ = sewage_status(current_sewage_pct(h, now))
        variant = variant if rank[variant] >= rank[sew_variant] else sew_variant
        if rank[variant] > rank[worst_variant]:
            worst_variant = variant

    population = coords["population"]
    est_daily_use_low = population * PER_CAPITA_LOW_LPD
    est_daily_use_high = population * PER_CAPITA_HIGH_LPD

    rows.append({
        "Community": name,
        "Population": population,
        "Households monitored": len(hh_here),
        "Worst status": worst_variant,
        "Temp (°C)": round(temp_c, 1),
        "Est. daily water use (L)": f"{est_daily_use_low:,}–{est_daily_use_high:,}",
    })
    map_rows.append({
        "lat": coords["lat"], "lon": coords["lon"], "size": max(population / 8, 120),
        "color": RISK_COLOR[worst_variant],
    })

df = pd.DataFrame(rows)
map_df = pd.DataFrame(map_rows)

st.subheader("Household prediction map — does the truck need to leave?")
st.markdown(
    flatten_html(f"""
    <div class="hfh-alert hfh-alert-warning">
      {badge_tt("Red = predicted (~1 day ahead)", "high", "Household predicted to need a truck within about 1 day, based on its current usage trend.")} {badge_tt("Already empty → Houses page", "info", "Households already out of water show as an empty tank on the Houses page, not as a red dot here.")}
      Positions are simulated within each community, not individually geotagged.
    </div>
    """),
    unsafe_allow_html=True,
)

RED = [192, 57, 43]
GREEN = [62, 124, 89]


household_map_rows = []
needs_truck_soon = []
for h in households:
    coords = COMMUNITIES[h.community]
    temp_c, _ = community_temps[h.community]
    predicted = predicted_needs_truck(h, temp_c, now)
    hlat, hlon = _jittered_position(h.id, coords["lat"], coords["lon"])
    household_map_rows.append({"lat": hlat, "lon": hlon, "size": 90, "color": RED if predicted else GREEN})
    if predicted:
        needs_truck_soon.append(h.id)

st.map(pd.DataFrame(household_map_rows), latitude="lat", longitude="lon", size="size", color="color")

if needs_truck_soon:
    preview = ", ".join(needs_truck_soon[:6])
    extra = len(needs_truck_soon) - 6
    more = f" &middot; +{extra} more" if extra > 0 else ""
    st.markdown(
        flatten_html(f"""
        <div style="margin:0.4rem 0; display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
          {badge_tt(f"{len(needs_truck_soon)} need the truck within ~1 day", "high", "Predicted from each household's current water-use and sewage-fill rate — see the Houses page for individual detail.")}
          <span style="color:var(--color-ink-soft); font-size:var(--font-size-sm);">{preview}{more}</span>
        </div>
        """),
        unsafe_allow_html=True,
    )
else:
    st.caption("No households currently predicted to need the truck within the next day.")

st.subheader("Community overview map")
st.caption("Marker size = population, colour = worst current household status in that community.")
st.map(map_df, latitude="lat", longitude="lon", size="size", color="color")

st.subheader("Community summary")
for r in rows:
    variant = r["Worst status"]
    st.markdown(
        flatten_html(f"""
        <div class="hfh-card" style="margin-bottom:0.6rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size: var(--font-size-lg);">{r['Community']}</strong>
            {badge_tt(variant.title(), variant, {"high": "At least one household needs a truck now — see the list below.", "medium": "At least one household is approaching a threshold — worth checking soon.", "low": "No households in this community currently need urgent action."}[variant])}
          </div>
          <p style="margin:0.4rem 0 0 0; color: var(--color-ink-soft);">
            Population ~{r['Population']:,} &middot; {r['Households monitored']} household(s) monitored in this demo &middot;
            {r['Temp (°C)']}°C &middot; est. daily water use {r['Est. daily water use (L)']} L
          </p>
        </div>
        """),
        unsafe_allow_html=True,
    )

st.subheader("Household water & sewage levels, by community")
st.caption("Highest-risk households first — grouped so it's clear which community actually needs a truck, not just which single house.")

TOP_RISK_PER_COMMUNITY = 8

for name in COMMUNITIES:
    hh_here = [h for h in households if h.community == name]
    temp_c, _ = community_temps[name]
    community_needs_truck = any(predicted_needs_truck(h, temp_c, now) for h in hh_here) or any(
        current_sewage_pct(h, now) >= 90 for h in hh_here
    )
    with st.expander(f"{name} — {'\U0001F6A8 needs a truck soon' if community_needs_truck else 'no truck needed right now'}", expanded=community_needs_truck):
        detail_rows = []
        for h in hh_here:
            used_l = min(h.tank_capacity_l, h.consumption_lpd * max((now - h.last_delivery).total_seconds() / 86400.0, 0))
            water_remaining_pct = 100 * (1 - used_l / h.tank_capacity_l)
            if h.has_auto_sensor:
                residual = chlorine_residual_now(h, temp_c, now)
                water_variant, _, _ = quality_status(residual)
            else:
                water_variant = {"All good": "low", "Tank getting low": "medium", "Something's wrong": "high", None: "medium"}[h.manual_alert]
            sewage_pct = current_sewage_pct(h, now)
            sew_variant, _, _ = sewage_status(sewage_pct)
            urgency = max(rank[water_variant], rank[sew_variant]) * 1000 + (100 - water_remaining_pct) + sewage_pct
            detail_rows.append((urgency, h, water_remaining_pct, water_variant, sewage_pct, sew_variant))
        detail_rows.sort(key=lambda r: r[0], reverse=True)
        shown = detail_rows[:TOP_RISK_PER_COMMUNITY]

        if len(detail_rows) > len(shown):
            st.caption(f"Showing the {len(shown)} highest-risk households of {len(detail_rows)} in {name}.")

        cols = st.columns(min(len(shown), 4) or 1)
        for i, (_, h, water_remaining_pct, water_variant, sewage_pct, sew_variant) in enumerate(shown):
            with cols[i % len(cols)]:
                st.markdown(f"**{h.id}** ({h.household_size} people)", unsafe_allow_html=True)
                st.markdown(
                    f'<div style="display:flex; gap:0.4rem; justify-content:center;">'
                    f'{tank_svg(water_remaining_pct, water_variant, "Water", width=64, height=100)}'
                    f'{tank_svg(sewage_pct, sew_variant, "Sewage", width=64, height=100)}'
                    f"</div>",
                    unsafe_allow_html=True,
                )

with st.expander(f"About the other {REGION_COMMUNITY_COUNT - len(COMMUNITIES)} {REGION_NAME} communities"):
    st.markdown(
        f"""
        {REGION_NAME} is a region of {REGION_COMMUNITY_COUNT} communities across northern Quebec
        (e.g. Kuujjuaq, Salluit, Akulivik, Aupaluk, Kangiqsualujjuaq, and others), each a separate
        fly-in/sealift-only hamlet with its own treatment facility and truck-based delivery. This
        prototype demonstrates 4 of the 14 to keep the demo scope realistic for a 3-hour build —
        the same architecture (plant → truck/radio → house sensors → this dashboard) is
        designed to extend to all 14 without redesign, since nothing here is specific to any one
        community's geography.
        """
    )
