"""Plant page - the treatment facility. This is one of only two points in
the whole system with reliable connectivity (the other being houses), per
the team's own clarification of the connectivity map."""

import sys
import os
import random
from datetime import datetime, timedelta

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
from common import COMMUNITIES, fetch_current_temp_c, apply_theme, logger, page_header, badge_tt, _flatten_html as flatten_html  # noqa: E402

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

with st.expander("Sensor list used at this stage"):
    st.markdown(
        """
        | Measurement | Sensor type | Notes |
        |---|---|---|
        | Chlorine dosing/residual | Continuous amperometric or colorimetric bench-style analyzer | Standard practice in comparable northern systems already — least new work needed here |
        | Coliform testing | Weekly lab/field test (existing practice per reference material) | The gap this system targets is *after* this point, not here |
        """
    )
