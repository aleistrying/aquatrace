"""Truck page - the one segment of the system with NO fixed connectivity.
Trucks move around within the community's ~50 km^2 area between the plant
and houses; there is no cell/internet signal in that space, only two-way
radio. This page is deliberately honest about what that means technically."""

import sys
import os
from datetime import datetime

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
from common import COMMUNITIES, get_households, get_radio_log, apply_theme, logger, page_header, badge_tt, _flatten_html as flatten_html  # noqa: E402

apply_theme()

st.markdown(
    page_header("Truck", "No cell/internet signal in transit &mdash; radio only"),
    unsafe_allow_html=True,
)

with st.expander("Why radio, and would GPS trackers even work here?", expanded=False):
    st.markdown(
        f"""
        {badge_tt("~50 km² coverage area", "info", "Approximate area a truck must cover between the plant and households within one community.")} {badge_tt("Signal only at plant + houses", "info", "The truck itself has no cell/internet signal while in transit — only two-way radio.")} {badge_tt("40+ yr precedent: APRS", "verified", "Automatic Packet Reporting System — GPS-over-radio relay technology in amateur/emergency use since the 1980s.")}

        - **GPS itself needs no signal** — it just listens to satellites. Only *sending* the
          position needs a channel, and here that channel is two-way radio, not data.
        - **Built now (3-hr, no new hardware):** driver reads a short status code over the
          existing voice radio; dispatcher logs it below.
        - **Future phase 2 (not built):** an automatic APRS-style relay — truck GPS keys the
          same radio automatically. Needs new radio-modem hardware.
        """,
        unsafe_allow_html=True,
    )

st.subheader("Radio check-in log")
st.caption("Pre-made dropdowns, not free text — fast for a dispatcher to log while on the radio.")

households = get_households()
community = st.selectbox("Community", list(COMMUNITIES.keys()), key="truck_community")
hh_ids = [h.id for h in households if h.community == community]

with st.form("radio_checkin_form"):
    truck_id = st.selectbox("Truck", ["Truck 1", "Truck 2"])
    status = st.selectbox("Status code", ["En route", "Delivered", "Delayed — mechanical", "Delayed — weather", "Returning to facility"])
    household_id = st.selectbox("Household (if Delivered)", ["—"] + hh_ids)
    submitted = st.form_submit_button("Log radio check-in")
    if submitted:
        entry = (datetime.now(), truck_id, community, status, household_id)
        get_radio_log().append(entry)
        logger.info("Radio check-in: %s %s %s %s", truck_id, community, status, household_id)
        if status == "Delivered" and household_id != "—":
            for h in households:
                if h.id == household_id:
                    h.last_delivery = datetime.now()  # resets the water-usage clock (see current_used_l)
                    h.initial_chlorine_mgL = st.session_state.get("plant_dose_mgL", 1.5)
                    logger.info("Delivery applied to %s (dose from plant log: %.1f mg/L)", h.id, h.initial_chlorine_mgL)
        st.success(f"Logged: {truck_id} — {status}" + (f" at {household_id}" if household_id != "—" else ""))

st.subheader("Recent check-ins")
log = get_radio_log()
if not log:
    st.caption("No check-ins logged yet.")
else:
    for ts, truck_id, comm, status, hh in reversed(log[-10:]):
        st.markdown(
            flatten_html(f"""
            <div class="hfh-card" style="margin-bottom:0.5rem; padding: 0.85rem 1.1rem;">
              <strong>{ts.strftime('%H:%M')}</strong> &middot; {truck_id} &middot; {comm}
              &middot; {status}{f" &middot; {hh}" if hh != "—" else ""}
            </div>
            """),
            unsafe_allow_html=True,
        )

with st.expander("Sensor list used at this stage"):
    st.markdown(
        """
        | Measurement | Sensor type | Connectivity need | Maintenance note | Cold-weather note |
        |---|---|---|---|---|
        | In-truck tank level | Capacitive or ultrasonic tank-level sender (same category as RV/marine tanks) | Standalone dash readout; becomes system data only via radio relay | Robust vehicle-grade sensor | Vehicle-grade senders are commonly rated to -40°C (automotive standard) — spec explicitly for -49°C+ lows; heated cab readout, insulated tank compartment |
        | Water actually dispensed | Inline flow meter (paddlewheel/turbine) on the delivery hose | Same as above | The real differentiator vs. just mirroring house sensors — confirms what left the truck, not just what's in the house tank | Hose/meter only sees flowing (self-warming) water during active transfer — main risk is the hose freezing between deliveries, not the meter's static rating; drain/blow out hose after each delivery |
        """
    )
