"""Houses page - demonstrates the data a household water/sewage sensor (or,
where none exists yet, a simple manual backup button) would feed into the
centralized system. Residents themselves don't need this dashboard; this
page exists to show judges/the team what data arrives from each house."""

import sys
import os
from datetime import datetime

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
from common import (  # noqa: E402
    COMMUNITIES, REGION_NAME, REGION_COMMUNITY_COUNT,
    get_households, fetch_current_temp_c, chlorine_residual_now, quality_status,
    depletion_days_band, sewage_status, current_sewage_pct, current_used_l,
    water_quantity_status, potability_pct, apply_theme, logger, page_header, tank_svg,
    badge_tt, _flatten_html as flatten_html,
)
from streamlit_theme import crisis_banner  # noqa: E402
from ml_predictor import predict_days_until_service  # noqa: E402

apply_theme()

st.markdown(
    page_header("Houses", "What a household water tank, sewage tank, or backup button would report"),
    unsafe_allow_html=True,
)

st.markdown(
    flatten_html(f"""
    <div class="hfh-alert hfh-alert-info">
      {badge_tt("Demo only", "info", "Residents don't operate this page — it shows judges/the team what a sensor or backup button reports.")} Residents don't operate this page — it shows what a sensor
      (or, until installed, a simple wired backup button) reports. Try one below on a house
      marked "no sensor yet."
    </div>
    """),
    unsafe_allow_html=True,
)

community = st.selectbox("Community", list(COMMUNITIES.keys()), key="houses_community")
coords = COMMUNITIES[community]
temp_c, temp_source = fetch_current_temp_c(coords["lat"], coords["lon"])
st.caption(f"Ambient temperature: {temp_c:.1f}°C ({temp_source}) · {REGION_NAME} region, {REGION_COMMUNITY_COUNT} communities total — this demo covers 4")

now = datetime.now()
households = [h for h in get_households() if h.community == community]

def _water_qty_pct(h) -> float:
    return 100 * (1 - current_used_l(h, now) / h.tank_capacity_l)


any_wrong_button = any(h.manual_alert == "Something's wrong" for h in households)
any_sewage_blocked = any(current_sewage_pct(h, now) >= 90 for h in households)
any_tank_empty = any(h.has_auto_sensor and _water_qty_pct(h) <= 3 for h in households)
if any_wrong_button or any_sewage_blocked or any_tank_empty:
    msg = []
    if any_tank_empty:
        msg.append("a water tank is empty")
    if any_wrong_button:
        msg.append("a household backup button reported a possible problem")
    if any_sewage_blocked:
        msg.append("a sewage tank is full and blocking water use")
    st.markdown(crisis_banner(" — and — ".join(msg).capitalize() + ". See below."), unsafe_allow_html=True)

_RANK = {"low": 0, "medium": 1, "high": 2}


def _worst_variant(h) -> str:
    if h.has_auto_sensor:
        residual = chlorine_residual_now(h, temp_c, now)
        v, _, _ = quality_status(residual)
        qty_v, _, _ = water_quantity_status(_water_qty_pct(h))
        v = v if _RANK[v] >= _RANK[qty_v] else qty_v
    else:
        v = {"All good": "low", "Tank getting low": "medium", "Something's wrong": "high", None: "medium"}[h.manual_alert]
    sew_v, _, _ = sewage_status(current_sewage_pct(h, now))
    return v if _RANK[v] >= _RANK[sew_v] else sew_v


# A community is now dozens of households, not 1-3 - a "pick one" selector,
# sorted most-urgent-first, fits the scale far better than looping every
# household as a full card would.
households_sorted = sorted(households, key=lambda h: _RANK[_worst_variant(h)], reverse=True)
selected_id = st.selectbox(
    f"Household ({len(households)} in {community}, most urgent first)",
    [h.id for h in households_sorted],
    key=f"houses_pick_{community}",
)
h = next(hh for hh in households if hh.id == selected_id)

sewage_pct = current_sewage_pct(h, now)
sew_variant, sew_label, sew_action = sewage_status(sewage_pct)
col_sensor, col_action = st.columns([2, 1])

with col_sensor:
    if h.has_auto_sensor:
        residual = chlorine_residual_now(h, temp_c, now)
        variant, label, action = quality_status(residual)
        soonest, latest = depletion_days_band(h, temp_c, now)
        hours_since = (now - h.last_delivery).total_seconds() / 3600.0
        water_remaining_pct = _water_qty_pct(h)

        # Water quality (chlorine freshness) and water QUANTITY (is there any
        # left at all) are two different failure modes - a tank can be 0%
        # full with perfectly fresh chlorine. Show whichever is worse as the
        # headline water badge; a tank at 0% must never read as merely
        # "approaching the floor" just because the chlorine happens to still
        # be within range.
        qty_variant, qty_label, qty_action = water_quantity_status(water_remaining_pct)
        if _RANK[qty_variant] > _RANK[variant]:
            water_badge_variant, water_badge_label, water_headline_action = qty_variant, qty_label, qty_action
        else:
            water_badge_variant, water_badge_label, water_headline_action = variant, label, action

        # Sewage-full is a hard blocking constraint, independent of and
        # potentially more urgent than water quality/quantity - shown as
        # its own badge, never silently merged into the water status. Only
        # surfaced as a separate lead sentence when it says something the
        # quality/quantity lines below don't already say - otherwise the
        # detail caption ends up repeating the same sentence twice (e.g.
        # "quantity: X" right after a lead sentence that IS X).
        sewage_lead = "Sewage full — water use blocked regardless of tank quality." if sew_variant == "high" else None

        pot_pct = potability_pct(residual)
        st.markdown(
            flatten_html(f"""
            <div class="hfh-card">
              <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:0.4rem 0.6rem; margin-bottom:0.4rem;">
                <div style="flex:1 1 auto; min-width:160px;">
                  <strong style="font-size:var(--font-size-lg);">{h.id}</strong> ({h.household_size} people, {h.tank_capacity_l}L tank)
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
                  {badge_tt(water_badge_label, water_badge_variant, water_headline_action)} {badge_tt(sew_label, sew_variant, sew_action)}
                </div>
              </div>
              <div style="display:flex; gap:1.2rem; justify-content:center;">
                {tank_svg(water_remaining_pct, qty_variant, "Water", width=100, height=150)}
                {tank_svg(sewage_pct, sew_variant, "Sewage", width=100, height=150)}
                {tank_svg(pot_pct, variant, "Potability", width=100, height=150)}
              </div>
            </div>
            """),
            unsafe_allow_html=True,
        )
        with st.expander("Show details"):
            lead = f"{sewage_lead} &middot; " if sewage_lead else ""
            st.caption(
                f"{lead}quality: {action} &middot; quantity: {qty_action} &middot; "
                f"{residual:.2f} mg/L residual (potability {pot_pct:.0f}%) &middot; "
                f"last fill {hours_since:.0f}h ago &middot; ~{soonest:.1f}&ndash;{latest:.1f} days of water left &middot; "
                f"tank: {h.tank_capacity_l}L plastic cistern (varies house to house, not standardized) &middot; "
                f"this house's avg use: {h.consumption_lpd:.0f} L/day &middot; sewage fill rate: {h.sewage_fill_rate_pct_per_day:.1f} %/day"
            )
            try:
                ml_days = predict_days_until_service(h, temp_c, now)
                st.caption(
                    f"ML estimate: needs service in ~{ml_days:.1f} days "
                    f"(trained on simulated data — see ml_predictor.py for methodology and its limitation)"
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("ML predictor unavailable for %s (%s)", h.id, exc)
    else:
        st.markdown(
            flatten_html(f"""
            <div class="hfh-card">
              <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:0.4rem 0.6rem; margin-bottom:0.4rem;">
                <div style="flex:1 1 auto; min-width:160px;">
                  <strong style="font-size:var(--font-size-lg);">{h.id}</strong> ({h.household_size} people, {h.tank_capacity_l}L tank)
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
                  {badge_tt("No sensor yet", "medium", "This household has no automatic sensor installed yet — status comes from the resident's own backup button.")}
                  {badge_tt(h.manual_alert, {"All good": "low", "Tank getting low": "medium", "Something's wrong": "high"}[h.manual_alert], {"All good": "Resident pressed the backup button to report no problems.", "Tank getting low": "Resident pressed the backup button to flag the water tank getting low.", "Something's wrong": "Resident pressed the backup button to flag a possible problem — needs follow-up."}[h.manual_alert]) if h.manual_alert else ""}
                  {badge_tt(sew_label, sew_variant, sew_action)}
                </div>
              </div>
              <div style="display:flex; gap:1.2rem; justify-content:center;">
                {tank_svg(sewage_pct, sew_variant, "Sewage", width=110, height=160)}
              </div>
            </div>
            """),
            unsafe_allow_html=True,
        )
        with st.expander("Show details"):
            st.caption(
                f"Backup button is the only signal from {h.id}. {sew_action} &middot; "
                f"tank: {h.tank_capacity_l}L plastic cistern (varies house to house) &middot; "
                f"this house's avg use: {h.consumption_lpd:.0f} L/day &middot; sewage fill rate: {h.sewage_fill_rate_pct_per_day:.1f} %/day"
            )
            try:
                ml_days = predict_days_until_service(h, temp_c, now)
                st.caption(
                    f"ML estimate: needs service in ~{ml_days:.1f} days "
                    f"(trained on simulated data — see ml_predictor.py for methodology and its limitation)"
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("ML predictor unavailable for %s (%s)", h.id, exc)

with col_action:
    if not h.has_auto_sensor:
        st.markdown('<div class="aq-big-button">', unsafe_allow_html=True)
        if st.button("✅ All good", key=f"good_{h.id}", use_container_width=True):
            h.manual_alert = "All good"
            logger.info("Manual backup button: %s -> All good", h.id)
            st.rerun()
        if st.button("\U0001F4A7 Tank getting low", key=f"low_{h.id}", use_container_width=True):
            h.manual_alert = "Tank getting low"
            logger.info("Manual backup button: %s -> Tank getting low", h.id)
            st.rerun()
        if st.button("⚠️ Something's wrong", key=f"bad_{h.id}", use_container_width=True):
            h.manual_alert = "Something's wrong"
            logger.info("Manual backup button: %s -> Something's wrong", h.id)
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

with st.expander("Sensor list used at the household stage"):
    st.markdown(
        """
        | Measurement | Sensor type | Needs connectivity? | Maintenance note |
        |---|---|---|---|
        | Water tank level | Ultrasonic (non-contact) — same category piloted by Université Laval / Sentinel Nord in Kuujjuaq | No (local readout); relay for remote view | No wetted parts, freeze-tolerant |
        | Water tank quality | Turbidity (optical/IR) + amperometric chlorine residual probe | No (local readout); relay for remote view | Amperometric preferred — no reagents to freeze or expire |
        | Sewage tank level | Float switch (mechanical/magnetic reed) | No (local readout); relay for remote view | More failure-tolerant than ultrasonic in a corrosive-gas tank (no false readings from foam/condensation) |
        | Backup button | Wired doorbell-style button, house power | Uses house's existing connectivity | No battery to fail, near-zero maintenance |
        """
    )
