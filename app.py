"""AquaTrace - router. Defines the tab/section labels explicitly (Home,
Plant, Truck, Houses, Communities) via st.navigation, matching the real
system's structure: plant / truck / houses / communities."""

import streamlit as st

st.set_page_config(page_title="AquaTrace", layout="wide", page_icon="\U0001F4A7")

pg = st.navigation(
    [
        st.Page("home_content.py", title="Home", icon="\U0001F4A7", default=True),
        st.Page("pages/2_Plant.py", title="Plant", icon="\U0001F6B0"),
        st.Page("pages/3_Truck.py", title="Truck", icon="\U0001F69A"),
        st.Page("pages/1_Houses.py", title="Houses", icon="\U0001F3E0"),
        st.Page("pages/4_Communities.py", title="Communities", icon="\U0001F5FA️"),
        st.Page("pages/5_Simulation.py", title="Simulation", icon="⏩"),
        st.Page("pages/6_Statistics.py", title="Statistics", icon="\U0001F4CA"),
    ]
)
pg.run()
