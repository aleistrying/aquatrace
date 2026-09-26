"""AquaTrace - Home / overview page. See pages/ for Plant, Truck, Houses,
and Communities - each a separate section, navigable from the sidebar like
tabs, matching the plant / truck / houses / communities structure of the
real system this demonstrates."""

import sys
import os

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import REGION_NAME, REGION_COMMUNITY_COUNT, apply_theme, page_header, badge_tt, _flatten_html as flatten_html  # noqa: E402

apply_theme()

st.markdown(
    page_header("AquaTrace", f"Water quality visibility for trucked-water communities &mdash; Inukjuak &amp; {REGION_NAME}"),
    unsafe_allow_html=True,
)

st.markdown(
    flatten_html(f"""
    <div class="hfh-alert hfh-alert-info">
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.4rem;">
        {badge_tt("🌡️ Temperature — live", "verified", "Ambient temperature is fetched live from Open-Meteo, not mocked.")}
        {badge_tt("🧪 Chlorine math — real", "verified", "First-order chlorine decay model — a documented public-health engineering relationship, not AI-predicted.")}
        {badge_tt("🏠 Household data — placeholder", "info", "No public household-level metering data exists yet for Nunavik — tank sizes and delivery history are seeded demo data.")}
      </div>
      No public household-level metering data exists for Nunavik yet, so tank levels and delivery
      history are clearly-labeled demo data — the decay math and the 0.2&nbsp;mg/L safety floor are not.
    </div>
    """),
    unsafe_allow_html=True,
)

st.markdown(
    flatten_html("""
    <div class="hfh-alert hfh-alert-warning">
      <strong>Not solving the water source or the pipeline.</strong> These communities sit on
      real freshwater rivers — source availability isn't the documented problem. The gap is
      <strong>visibility after the water leaves the plant</strong>: no monitoring in the truck,
      the tank, or at the tap. That's the chain of custody every page here tracks.
    </div>
    """),
    unsafe_allow_html=True,
)

st.subheader("Sections")
col1, col2 = st.columns(2)
with col1:
    st.markdown(
        flatten_html("""
        <div class="hfh-card" style="margin-bottom:0.75rem;">
          <h3 style="margin:0 0 0.3rem 0;">\U0001F6B0 Plant</h3>
          <p style="margin:0; color: var(--color-ink-soft);">
            Treatment facility &mdash; always connected. Chlorine dose, weekly coliform test.
          </p>
        </div>
        <div class="hfh-card">
          <h3 style="margin:0 0 0.3rem 0;">\U0001F69A Truck</h3>
          <p style="margin:0; color: var(--color-ink-soft);">
            No signal in transit, radio only. Honest radio check-in log, GPS/radio explainer.
          </p>
        </div>
        """),
        unsafe_allow_html=True,
    )
with col2:
    st.markdown(
        flatten_html(
            """
            <div class="hfh-card" style="margin-bottom:0.75rem;">
              <h3 style="margin:0 0 0.3rem 0;">\U0001F3E0 Houses</h3>
              <p style="margin:0; color: var(--color-ink-soft);">
                What a household sensor (or backup button) reports: water quality, tank level, sewage.
              </p>
            </div>
            <div class="hfh-card">
              <h3 style="margin:0 0 0.3rem 0;">\U0001F5FA️ Communities</h3>
              <p style="margin:0; color: var(--color-ink-soft);">
                Map + aggregate water use across communities, {region} region context.
              </p>
            </div>
            """.format(region=REGION_NAME)
        ),
        unsafe_allow_html=True,
    )

with st.expander("Why this scope, and what we deliberately didn't build", expanded=False):
    st.markdown(
        """
        Delivery/logistics unreliability (driver shortages, broken trucks, weather) is real and
        documented, but already has a slow, multi-year fix in motion (Inukjuak's own pipeline
        initiative, Resolution #2025-29). **Water quality visibility after the water leaves the
        treatment plant has no existing tooling anywhere** &mdash; the community's own advocacy
        documents state plainly: *"no mandatory water-quality monitoring in trucks, household
        tanks, or at the tap."* The official challenge deck scopes the ask the same way.

        This builds on top of, not in competition with, **Benjamin Bouchard's Sentinel Nord /
        Université Laval tank-level sensor pilot** (Kuujjuaq) &mdash; that project does reactive
        tank-*level* alerting only. This adds the quality layer, a community-wide view, and a
        depletion projection.

        Explicitly researched and **not built**: a truck-fleet GPS/auto-dispatch system (unrealistic
        with a 1&ndash;2 truck fleet), a hyperscaler datacenter with waste-heat reuse (real physics,
        but Nunavik's satellite-only connectivity makes it a non-starter at that scale), in-tank
        household heating (tanks are already indoors; heating one further could worsen chlorine
        decay, not help it), and desalination/water ionization (the source water is freshwater, not
        saline &mdash; wrong technology for the actual problem). See `REFERENCES.md` for the full
        reasoning and sources behind every one of these calls.
        """
    )

st.caption(
    "AquaTrace — Hack for Humanity: Ottawa 2026 prototype. Use the sidebar to move between "
    "Plant, Truck, Houses, and Communities."
)
