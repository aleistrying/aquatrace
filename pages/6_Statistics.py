"""Statistics page - the measured baseline-vs-optimized delivery comparison,
as charts. Reads the JSON already produced by delivery_comparison_fullscale.py
(a real, run, verified simulation - not invented numbers) rather than
recomputing anything here."""

import json
import os
import sys

import pandas as pd
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
from common import apply_theme, page_header, badge_tt  # noqa: E402

apply_theme()

st.markdown(
    page_header("Statistics", "Measured: blind rotation vs. predictive+batch, at real community scale"),
    unsafe_allow_html=True,
)

RESULTS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "delivery_comparison_fullscale_results.json")

try:
    with open(RESULTS_PATH) as f:
        data = json.load(f)
except FileNotFoundError:
    st.warning("Run delivery_comparison_fullscale.py first to generate the results file.")
    st.stop()

st.markdown(
    f"""
    <div class="hfh-alert hfh-alert-info">
      {badge_tt("Real simulation, not invented", "info", "Numbers come from an actual run of delivery_comparison_fullscale.py over real-scale households (500/188 per community), not hand-picked.")}
      Baseline (blind rotation) reproduces the independently-cited ~14&ndash;16 day reference figure
      (avg {data['baseline_avg_coverage_days']:.1f} days) &mdash; {"✅ within range" if data.get("reference_check_14_16_days_passed") else "⚠️ outside range"}.
    </div>
    """,
    unsafe_allow_html=True,
)

col1, col2 = st.columns(2)
with col1:
    st.metric("Baseline: avg days to cover everyone", f"{data['baseline_avg_coverage_days']:.1f}")
with col2:
    st.metric("Predictive+batch: avg days to cover everyone", f"{data['optimized_avg_coverage_days']:.1f}",
              delta=f"-{data['baseline_avg_coverage_days'] - data['optimized_avg_coverage_days']:.1f} days", delta_color="normal")

col3, col4 = st.columns(2)
with col3:
    st.metric("Baseline: household-days in a bad state", f"{data['baseline_total_bad_state_days']:.0f}")
with col4:
    reduction = 100 * (1 - data['optimized_total_bad_state_days'] / data['baseline_total_bad_state_days'])
    st.metric("Predictive+batch: household-days in a bad state", f"{data['optimized_total_bad_state_days']:.0f}",
              delta=f"-{reduction:.0f}%", delta_color="normal")

st.markdown("#### Days to cover every household once, by community")
df_coverage = pd.DataFrame({
    "Baseline (blind rotation)": data["baseline_coverage_days"],
    "Predictive + batch": data["optimized_coverage_days"],
})
st.bar_chart(df_coverage)

st.markdown("#### Household-days spent in a bad state, by community")
df_bad = pd.DataFrame({
    "Baseline (blind rotation)": data["baseline_bad_state_household_days"],
    "Predictive + batch": data["optimized_bad_state_household_days"],
})
st.bar_chart(df_bad)

st.markdown("#### Blizzard/breakdown retries, by community")
df_retries = pd.DataFrame({
    "Baseline (blind rotation)": data["baseline_retries"],
    "Predictive + batch": data["optimized_retries"],
})
st.bar_chart(df_retries)

with st.expander("Model parameters used"):
    st.json(data["params"])
    st.caption(
        "Fleet size: " + ", ".join(f"{k}: {v}" for k, v in data["fleet_size"].items())
        + " · Household count: " + ", ".join(f"{k}: {v}" for k, v in data["household_count"].items())
    )
    st.caption("See REFERENCES.md for sourcing on the 3-truck Inukjuak figure and the ~10,000L capacity estimate.")
