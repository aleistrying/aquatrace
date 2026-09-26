"""AquaTrace shared domain model, math, and design helpers.

Imported by app.py (Home) and every page under pages/. Keeping this in one
module means the decay/depletion math and the seeded demo data are defined
exactly once and can't drift between pages.
"""

from __future__ import annotations

import logging
import math
import os
import random
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from logging.handlers import RotatingFileHandler

import requests
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streamlit_theme import inject_theme, badge, crisis_banner  # noqa: E402

# ---------- Logging ----------
_LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(_LOG_DIR, exist_ok=True)
logger = logging.getLogger("aquatrace")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _fmt = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    _console = logging.StreamHandler()
    _console.setFormatter(_fmt)
    _file = RotatingFileHandler(os.path.join(_LOG_DIR, "aquatrace.log"), maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    _file.setFormatter(_fmt)
    logger.addHandler(_console)
    logger.addHandler(_file)
    logger.propagate = False

# =============================================================================
# Region / communities
# =============================================================================

REGION_NAME = "Nunavik"
REGION_COMMUNITY_COUNT = 14  # per 2021 census framing in the challenge deck; this demo covers 4 of the 14

# Approx coordinates, Nunavik, Quebec, Canada - used only to fetch real ambient
# temperature and to place a demonstration pin on the map; not surveyed
# household/facility locations.
COMMUNITIES = {
    "Inukjuak":       {"lat": 58.4708, "lon": -78.1064, "population": 2000},
    "Kuujjuaraapik":  {"lat": 55.2813, "lon": -77.7644, "population": 750},
    "Puvirnituq":     {"lat": 60.0500, "lon": -77.2833, "population": 2000},
    "Kangiqsujuaq":   {"lat": 61.5833, "lon": -71.9833, "population": 750},
}

# =============================================================================
# Water-quality / depletion constants (see REFERENCES.md for sourcing)
# =============================================================================

def _jittered_position(seed_id: str, lat: float, lon: float) -> tuple[float, float]:
    """Stable per-entity jitter around a community center - keeps a household
    (or any other seeded id) at the SAME simulated position every time this
    is called, since random.Random on a str seed is reproducible across
    runs/processes (unlike Python's built-in hash()). Used to spread
    illustrative household pins within a ~50 km^2 community area for both
    the Communities prediction map and the Simulation truck map - one
    helper, reused, so the two pages can't drift apart on where a given
    household id "lives"."""
    rng = random.Random(seed_id)
    # Tightened from an earlier 0.5-4.0 km range: household pins were landing
    # visibly over water on the map at the wider radius. A smaller radius
    # keeps them clustered closer to the community's own marked (on-land)
    # coordinate instead of drifting out into the bay - still spreads them
    # out, just more conservatively, since we don't have real coastline data
    # to jitter against precisely.
    radius_km = rng.uniform(0.3, 1.5)
    angle = rng.uniform(0, 2 * math.pi)
    dlat = (radius_km / 111.0) * math.cos(angle)
    dlon = (radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.1))) * math.sin(angle)
    return lat + dlat, lon + dlon


# Fabricated demo facility offset: the water-treatment plant/depot is placed
# a fixed distance south of each community's real center coordinate, purely
# so the Simulation truck map has a plant marker distinct from the household
# cluster. This is NOT a surveyed facility location - like the rest of this
# demo's household/truck geometry, it's an illustrative stand-in.
FACILITY_LAT_OFFSET_DEG = 0.07  # ~7.8 km south at these latitudes


def facility_position(community: str) -> tuple[float, float]:
    coords = COMMUNITIES[community]
    return coords["lat"] - FACILITY_LAT_OFFSET_DEG, coords["lon"]


# RGB triples (pydeck/deck.gl layers need raw RGB, not CSS custom properties)
# matching THEME_CSS's hex palette exactly, so the truck map on the
# Simulation page uses the SAME brand colors as every badge/tank_svg on the
# rest of the app instead of inventing new ones.
#   --color-pine  #3E7C59 -> (62,124,89)   --color-maple #A8462E -> (168,70,46)
#   --color-gold  #96731F -> (150,115,31)  --color-slate #2E6E86 -> (46,110,134)
#   --color-ink-soft #45525A -> (69,82,90)
PYDECK_RGB = {
    "pine": [62, 124, 89],
    "maple": [168, 70, 46],
    "gold": [150, 115, 31],
    "slate": [46, 110, 134],
    "ink_soft": [69, 82, 90],
}

RESIDUAL_LOW_THRESHOLD = 0.2
RESIDUAL_MED_THRESHOLD = 0.5

K_REF_20C = math.log(1.5 / RESIDUAL_LOW_THRESHOLD) / 72.0
Q10 = 2.0

PER_CAPITA_LOW_LPD = 90
PER_CAPITA_HIGH_LPD = 150

FREEZE_DRIP_THRESHOLD_C = -30.0
FREEZE_DRIP_MULTIPLIER = 1.10


@dataclass
class Household:
    id: str
    community: str
    household_size: int
    tank_capacity_l: int
    last_delivery: datetime
    initial_chlorine_mgL: float = 1.5
    has_auto_sensor: bool = field(default=True)
    manual_alert: str | None = field(default=None)  # set by the household backup button

    # Time-progressive simulation state (see current_used_l / current_sewage_pct
    # below). Randomized ONCE per household at seed time - real elapsed time
    # then drives how each household's numbers evolve, rather than a fixed
    # snapshot or per-rerun random flicker. This is what makes the predictive
    # map (pages/4_Communities.py) show different households crossing into
    # "needs a truck soon" at different, believable times.
    consumption_lpd: float = field(default=0.0)
    sewage_fill_rate_pct_per_day: float = field(default=0.0)
    sewage_baseline_pct: float = field(default=20.0)
    record_start: datetime = field(default_factory=datetime.now)


def _days_since(then: datetime, now: datetime) -> float:
    return max((now - then).total_seconds() / 86400.0, 0.0)


def current_used_l(h: Household, now: datetime) -> float:
    return min(h.tank_capacity_l, h.consumption_lpd * _days_since(h.last_delivery, now))


def current_sewage_pct(h: Household, now: datetime) -> float:
    return min(100.0, h.sewage_baseline_pct + h.sewage_fill_rate_pct_per_day * _days_since(h.record_start, now))


def chlorine_rate_constant(temp_c: float) -> float:
    return K_REF_20C * (Q10 ** ((temp_c - 20.0) / 10.0))


def chlorine_residual_now(household: Household, temp_c: float, now: datetime) -> float:
    hours_elapsed = max((now - household.last_delivery).total_seconds() / 3600.0, 0.0)
    k = chlorine_rate_constant(temp_c)
    return household.initial_chlorine_mgL * math.exp(-k * hours_elapsed)


POTABILITY_REFERENCE_MGL = 1.8  # max possible initial dose in this model (see _procedural_households) - the "100%" reference point for the visual bar, not a new safety threshold


def potability_pct(residual_mgL: float) -> float:
    """Chlorine residual expressed as a 0-100% visual 'potability' bar, using
    the SAME math/thresholds as quality_status - just rescaled for a tank_svg
    bar instead of a text badge. Not a new measurement, a new view of the
    existing one."""
    return max(0.0, min(100.0, (residual_mgL / POTABILITY_REFERENCE_MGL) * 100.0))


def quality_status(residual_mgL: float) -> tuple[str, str, str]:
    if residual_mgL < RESIDUAL_LOW_THRESHOLD:
        return "high", "Retest recommended", "Below the safe floor — retest or boil before drinking."
    if residual_mgL < RESIDUAL_MED_THRESHOLD:
        return "medium", "Approaching the floor", "Still likely safe, but nearing retest threshold."
    return "low", "Likely safe", "No action needed."


WATER_QUANTITY_LOW_PCT = 15
WATER_QUANTITY_EMPTY_PCT = 3


def water_quantity_status(pct_remaining: float) -> tuple[str, str, str]:
    """Water VOLUME remaining, independent of chlorine quality - this is the
    piece that was missing before: quality_status() only tells you whether
    whatever water is left is still chemically safe, not whether there's
    any water left at all. A tank at 0% is a "high" emergency regardless of
    how fresh its last delivery was."""
    if pct_remaining <= WATER_QUANTITY_EMPTY_PCT:
        return "high", "Tank empty", "Little to no water left in the tank — needs a delivery now, independent of chlorine quality."
    if pct_remaining <= WATER_QUANTITY_LOW_PCT:
        return "medium", "Tank getting low", "Water volume is running low — schedule a delivery soon."
    return "low", "Tank OK", "Water volume has room to spare."


# Sewage tank fill thresholds. This is a hard physical constraint, not just
# another metric: with no sewer connection, a full sewage tank means there is
# nowhere for used water to go - residents are practically forced to stop
# water use (dishes, laundry, flushing, bathing) regardless of whether the
# water tank itself still holds plenty of safe water. See REFERENCES.md for
# the household-hygiene-impact sourcing behind these thresholds.
SEWAGE_WARNING_PCT = 70
SEWAGE_BLOCKED_PCT = 90


def sewage_status(pct_full: int) -> tuple[str, str, str]:
    if pct_full >= SEWAGE_BLOCKED_PCT:
        return "high", "Sewage full — water use blocked", "No space for used water — blocks dishes, laundry, flushing, bathing until pumped out."
    if pct_full >= SEWAGE_WARNING_PCT:
        return "medium", "Filling up", "Schedule a pump-out soon."
    return "low", "OK", "Sewage tank has space."


def depletion_days_band(household: Household, temp_c: float, now: datetime) -> tuple[float, float]:
    freeze_mult = FREEZE_DRIP_MULTIPLIER if temp_c <= FREEZE_DRIP_THRESHOLD_C else 1.0
    remaining_l = max(household.tank_capacity_l - current_used_l(household, now), 0)
    high_use_days = remaining_l / max(PER_CAPITA_HIGH_LPD * household.household_size * freeze_mult, 1)
    low_use_days = remaining_l / max(PER_CAPITA_LOW_LPD * household.household_size * freeze_mult, 1)
    return (high_use_days, low_use_days)


def water_predicted_needs_truck(household: Household, temp_c: float, now: datetime, horizon_days: float = 1.0) -> bool:
    """Water-only half of predicted_needs_truck() below - split out so a
    caller that runs separate water-delivery vs. sewage-pump-out fleets
    (see pages/5_Simulation.py's two-fleet dispatch) can check "is this
    household about to run short on WATER" without also pulling in the
    sewage condition. Same math as before, just factored out; behavior of
    predicted_needs_truck() itself is unchanged.

    Uses the household's own actual consumption_lpd (the rate already driving
    current_used_l), not the population-wide worst-case band used for the
    display range on the Houses page - otherwise a large household with a
    small tank gets flagged as "needs a truck" even while sitting at 90%+
    full, just because the worst-case population rate would theoretically
    drain it fast. The household's real, already-tracked rate is the correct
    basis for an actionable dispatch trigger."""
    freeze_mult = FREEZE_DRIP_MULTIPLIER if temp_c <= FREEZE_DRIP_THRESHOLD_C else 1.0
    remaining_l = max(household.tank_capacity_l - current_used_l(household, now), 0)
    actual_days_remaining = remaining_l / max(household.consumption_lpd * freeze_mult, 1)
    return 0 < actual_days_remaining <= horizon_days


def sewage_predicted_needs_truck(household: Household, now: datetime, horizon_days: float = 1.0) -> bool:
    """Sewage-only half of predicted_needs_truck() below - see
    water_predicted_needs_truck's docstring for why this is split out."""
    current_sewage = current_sewage_pct(household, now)
    projected_sewage = min(100.0, current_sewage + household.sewage_fill_rate_pct_per_day * horizon_days)
    return current_sewage < SEWAGE_BLOCKED_PCT <= projected_sewage


def predicted_needs_truck(household: Household, temp_c: float, now: datetime, horizon_days: float = 1.0) -> bool:
    """Proactive warning: predicted to cross into trouble within `horizon_days`,
    but hasn't ALREADY - i.e. this is the "send the truck soon" signal, not a
    report that the tank is already empty or the sewage tank already full
    (those are separately visible as the existing high/blocked status).

    Combines the water and sewage halves (see water_predicted_needs_truck /
    sewage_predicted_needs_truck) - kept here, unchanged in signature and
    behavior, since other pages (e.g. pages/4_Communities.py) call this
    combined form directly."""
    water_warning = water_predicted_needs_truck(household, temp_c, now, horizon_days)
    sewage_warning = sewage_predicted_needs_truck(household, now, horizon_days)
    return water_warning or sewage_warning


# =============================================================================
# Real weather (Open-Meteo, free/no-auth). MSC GeoMet is the official
# Canadian-government equivalent - documented as the production swap target.
# =============================================================================

FALLBACK_TEMP_C = -18.0


@st.cache_data(ttl=1800, show_spinner=False)
def fetch_current_temp_c(lat: float, lon: float) -> tuple[float, str]:
    try:
        resp = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": lat, "longitude": lon, "current": "temperature_2m"},
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json()
        temp = float(data["current"]["temperature_2m"])
        logger.info("Fetched live temperature %.1fC for (%.4f, %.4f)", temp, lat, lon)
        return temp, "live (Open-Meteo)"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Live weather fetch failed (%s) - using documented fallback %.1fC", exc, FALLBACK_TEMP_C)
        return FALLBACK_TEMP_C, "fallback (offline demo value)"


# =============================================================================
# Seeded demo fleet (illustrative - no public household-level metering data
# exists for trucked-water Nunavik communities to pull from instead)
# =============================================================================

def _make_household(id_, community, household_size, tank_capacity_l, hours_since_delivery,
                     initial_chlorine_mgL, sewage_baseline_pct, has_auto_sensor, now, rng) -> Household:
    # Per-capita consumption band is a real-literature-derived range (see
    # REFERENCES.md); each household gets one randomized draw from it, once,
    # so different households evolve at different, believable rates.
    per_capita = rng.uniform(PER_CAPITA_LOW_LPD, PER_CAPITA_HIGH_LPD)
    consumption_lpd = per_capita * household_size
    # Sewage fills at a "comparable or slightly faster" rate than water use,
    # per haul-water literature (see REFERENCES.md) - modeled as consumption
    # relative to tank capacity, times a 1.0-1.3x household-specific factor.
    sewage_fill_rate_pct_per_day = (consumption_lpd / tank_capacity_l) * 100.0 * rng.uniform(1.0, 1.3)
    return Household(
        id_, community, household_size=household_size, tank_capacity_l=tank_capacity_l,
        last_delivery=now - timedelta(hours=hours_since_delivery), initial_chlorine_mgL=initial_chlorine_mgL,
        has_auto_sensor=has_auto_sensor, consumption_lpd=consumption_lpd,
        sewage_fill_rate_pct_per_day=sewage_fill_rate_pct_per_day, sewage_baseline_pct=sewage_baseline_pct,
        record_start=now,
    )


_COMMUNITY_PREFIX = {"Inukjuak": "INU", "Kuujjuaraapik": "KUJ", "Puvirnituq": "PUV", "Kangiqsujuaq": "KAN"}

# Realistic family-size distribution (weighted toward 2-6 people, occasional
# 1 or 7+) used to procedurally generate each community's demo household
# SAMPLE. Illustrative distribution shape, not a surveyed figure (see
# REFERENCES.md caveats on all seeded demo data).
_FAMILY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8]
_FAMILY_SIZE_WEIGHTS = [0.08, 0.18, 0.20, 0.20, 0.16, 0.11, 0.05, 0.02]

TANK_SIZES_L = [1200, 1500, 1800, 2000, 2200, 2500]
AUTO_SENSOR_RATIO = 0.7  # ~70% auto-sensor / 30% backup-button-only, illustrative


def _household_sample_size(population: int) -> int:
    """A community of ~2000 real people is ~500+ households at realistic
    family sizes - far too many to render as individual cards (Houses page
    selector, Simulation page household grid). Instead we generate a small
    representative SAMPLE, gently scaled by population (~12 households for
    a ~750-population community, ~25 for ~2000). The real population figure
    itself is untouched and still used as-is for aggregate stats (est.
    daily water use, etc.) elsewhere on the Communities page - only the
    number of individual Household objects generated here is capped."""
    return min(25, max(12, round(population / 80)))


def _procedural_households(community: str, count: int, start_index: int, now: datetime, rng: random.Random) -> list[Household]:
    prefix = _COMMUNITY_PREFIX[community]
    out = []
    for i in range(count):
        household_size = rng.choices(_FAMILY_SIZES, weights=_FAMILY_SIZE_WEIGHTS, k=1)[0]
        tank_capacity_l = rng.choice(TANK_SIZES_L)
        hours_since_delivery = rng.uniform(2, 140)
        initial_chlorine_mgL = rng.uniform(1.3, 1.8)
        sewage_baseline_pct = rng.uniform(10, 90)
        has_auto_sensor = rng.random() < AUTO_SENSOR_RATIO
        out.append(_make_household(
            f"{prefix}-{start_index + i:03d}", community, household_size, tank_capacity_l,
            hours_since_delivery, initial_chlorine_mgL, sewage_baseline_pct, has_auto_sensor, now, rng,
        ))
    return out


def seed_households() -> list[Household]:
    now = datetime.now()
    rng = random.Random(20260926)  # fixed seed: reproducible within a demo run, still varies household-to-household

    # Six hand-tuned households, kept exactly as originally authored (IDs,
    # sizes, tank capacities, timings) so nothing already-tuned changes.
    hand_tuned = [
        _make_household("INU-014", "Inukjuak", 4, 1800, 68, 1.5, 55, True, now, rng),
        _make_household("INU-027", "Inukjuak", 6, 2200, 14, 1.6, 20, True, now, rng),
        _make_household("INU-041", "Inukjuak", 3, 1500, 95, 1.4, 80, False, now, rng),
        _make_household("KUJ-003", "Kuujjuaraapik", 5, 2000, 40, 1.5, 35, True, now, rng),
        _make_household("PUV-009", "Puvirnituq", 7, 2500, 120, 1.5, 90, False, now, rng),
        _make_household("KAN-002", "Kangiqsujuaq", 2, 1200, 6, 1.7, 15, True, now, rng),
    ]
    hand_tuned_counts = {"Inukjuak": 3, "Kuujjuaraapik": 1, "Puvirnituq": 1, "Kangiqsujuaq": 1}

    # Fill the rest of each community's demo sample procedurally, drawing
    # household sizes from a realistic family-size distribution, up to the
    # per-community cap from _household_sample_size().
    procedural = []
    for community, coords in COMMUNITIES.items():
        target = _household_sample_size(coords["population"])
        remaining = max(target - hand_tuned_counts.get(community, 0), 0)
        procedural.extend(_procedural_households(community, remaining, 100, now, rng))

    return hand_tuned + procedural


def get_households() -> list[Household]:
    if "households" not in st.session_state:
        st.session_state.households = seed_households()
    return st.session_state.households


def get_delivery_log() -> list:
    if "delivery_log" not in st.session_state:
        st.session_state.delivery_log = []
    return st.session_state.delivery_log


def get_radio_log() -> list:
    if "radio_log" not in st.session_state:
        st.session_state.radio_log = []
    return st.session_state.radio_log


# =============================================================================
# Big-button / high-legibility UI overrides, layered on top of the shared
# design system. Audience: residents (incl. elders), often on a phone, often
# in gloves, sometimes low connectivity/low data-literacy context - so touch
# targets and type size are pushed well past the shared system's defaults.
# =============================================================================

BIG_UI_CSS = """
html, body, [class*="css"] { font-size: 1.08rem; }
h1 { font-size: 2.4rem !important; }
h2 { font-size: 1.9rem !important; }
h3 { font-size: 1.5rem !important; }
p, li, .stMarkdown { font-size: 1.05rem !important; line-height: 1.55 !important; }

/* Big, obviously-tappable buttons everywhere */
.stButton > button, .stFormSubmitButton > button, .stDownloadButton > button {
  font-size: 1.15rem !important;
  font-weight: 700 !important;
  padding: 0.85rem 1.4rem !important;
  border-radius: var(--radius-lg) !important;
  min-height: 3.2rem;
}

/* Bigger selectbox/input text and touch height */
.stSelectbox div[data-baseweb="select"] > div, .stTextInput input, .stNumberInput input {
  font-size: 1.05rem !important;
  min-height: 2.9rem !important;
}

/* Sidebar nav: bigger tap targets for phone use */
[data-testid="stSidebarNav"] a { font-size: 1.1rem !important; padding: 0.6rem 0.8rem !important; }

/* Extra-large status badges */
.hfh-badge { font-size: 0.95rem !important; padding: 0.5rem 1rem !important; }

/* Big physical-style backup button */
.aq-big-button button {
  font-size: 1.6rem !important;
  min-height: 4.5rem !important;
  width: 100%;
}
"""


# =============================================================================
# App-scoped Nunavik theme override (does NOT touch the shared design-system/
# files used by the other 46 starters in this repo - this is layered on top,
# for this app only). Palette researched from real precedent - see
# REFERENCES.md "Theme" section for sourcing and cultural-sensitivity caveats
# (not an official Nunavik/ITK/GN brand palette - environment/precedent-
# derived approximations, flagged for real community review before any
# beyond-hackathon use).
# =============================================================================

THEME_CSS = """
:root {
  --color-bg: #F5F8FA;
  --color-surface: #FFFFFF;
  --color-surface-raised: #FBFDFE;
  --color-ink: #16232B;
  --color-ink-soft: #45525A;
  --color-border: #D7E1E5;

  --color-maple: #A8462E;
  --color-pine: #3E7C59;
  --color-slate: #2E6E86;
  --color-gold: #96731F;

  --color-maple-text: #8C3A26;
  --color-pine-text: #3E7C59;
  --color-slate-text: #2E6E86;
  --color-gold-text: #7A5C18;

  --color-maple-tint: #F3E1DB;
  --color-pine-tint: #DFEEE5;
  --color-slate-tint: #DCEAF0;
  --color-gold-tint: #F1E6C9;

  --color-safety: #C0392B;
  --color-safety-ink: #FFFFFF;
}
/* NOTE: intentionally NOT following @media (prefers-color-scheme: dark) here.
   .streamlit/config.toml pins Streamlit's NATIVE widgets (buttons, sliders,
   st.metric, the sidebar chrome) to a single static light theme - Streamlit
   only supports one static config.toml theme, it cannot follow OS dark mode.
   A CSS-only dark reskin of the custom .hfh-* elements (cards/badges/alerts)
   while native widget text/labels stay fixed to their light-theme color
   produces exactly the bug reported: native labels/buttons/st.metric text
   rendering in their light-mode dark-brown ink directly on a now near-black
   custom background - unreadable, not a screenshot/rerun artifact. Since we
   can't make native widgets follow dark mode, this app stays visually
   consistent by staying light end-to-end instead. (The shared design-system/
   file still has its own dark block for apps that DO ship a dark
   config.toml - untouched, per the "don't touch shared files" rule; this is
   our own override, layered on top, opting THIS app only out of that switch.)
*/
:root:not([data-theme="light"]) {
  --color-bg: #F5F8FA;
  --color-surface: #FFFFFF;
  --color-surface-raised: #FBFDFE;
  --color-ink: #16232B;
  --color-ink-soft: #45525A;
  --color-border: #D7E1E5;

  --color-maple: #A8462E;
  --color-pine: #3E7C59;
  --color-slate: #2E6E86;
  --color-gold: #96731F;

  --color-maple-text: #8C3A26;
  --color-pine-text: #3E7C59;
  --color-slate-text: #2E6E86;
  --color-gold-text: #7A5C18;

  --color-maple-tint: #F3E1DB;
  --color-pine-tint: #DFEEE5;
  --color-slate-tint: #DCEAF0;
  --color-gold-tint: #F1E6C9;

  --color-safety: #C0392B;
  --color-safety-ink: #FFFFFF;
}
/* Precedent: SmartICE/SIKU/ITK all use plain, heavy-weight sans for body AND
   headings (no decorative serif) - dropping Fraunces for legibility. */
h1, h2, h3 {
  font-family: var(--font-body) !important;
  font-weight: 800 !important;
}
"""


def _flatten_html(html: str) -> str:
    """Strip all leading whitespace/newlines from a multi-line HTML string.

    Why this exists: st.markdown(..., unsafe_allow_html=True) still runs
    CommonMark markdown parsing first — and CommonMark treats any line
    indented 4+ spaces as a literal code block, not HTML. A multi-line HTML
    f-string that preserves Python's own source indentation (e.g. built at 8
    or 16 spaces deep inside a for/with/if chain) can trip that rule
    inconsistently line-by-line, causing fragments like a stray "</div>" to
    render as visible text instead of being parsed as a tag. Flattening to
    one line with no leading whitespace sidesteps the whole class of bug,
    regardless of how deeply nested the call site is."""
    return " ".join(line.strip() for line in html.strip().splitlines())


_THEME_INJECTED_KEY = "_aquatrace_theme_injected"


def apply_theme() -> None:
    """Inject the theme CSS. Safe to call from every page (st.navigation runs
    each st.Page's script as its own entrypoint, so page config is set once
    in app.py, but the CSS still needs (re-)injecting per page)."""
    inject_theme(extra_css=THEME_CSS + BIG_UI_CSS)


def badge_tt(label: str, variant: str, tooltip: str) -> str:
    """Same visual badge as the shared streamlit_theme.badge(), but with a
    native HTML title attribute so hovering explains what the tag means
    (e.g. "OK" -> "Sewage tank has space." ). Built locally instead of
    modifying the shared design-system/streamlit_theme.py (used by 46 other
    starters) - same CSS classes, so it looks identical, just adds `title`."""
    return f'<span class="hfh-badge hfh-badge-{variant}" title="{tooltip}">{label}</span>'


def page_header(title: str, subtitle: str) -> str:
    """Shared page-title card: a big heading + one-line subtitle in an
    `hfh-card`. Every page (Home, Plant, Truck, Houses, Communities) opened
    with this exact HTML block inline before extraction here — now defined
    once so the five copies can't drift."""
    return _flatten_html(f"""
    <div class="hfh-card" style="margin-bottom: 1rem;">
      <h1 style="margin:0;">{title}</h1>
      <p style="color: var(--color-ink-soft); margin: 0.25rem 0 0 0; font-size: var(--font-size-md);">
        {subtitle}
      </p>
    </div>
    """)


_LEVEL_BAR_COLOR = {"low": "var(--color-pine)", "medium": "var(--color-gold)", "high": "var(--color-maple)"}


def tank_svg(pct_full: float, variant: str, label: str, width: int = 84, height: int = 128) -> str:
    """Shared tank-gauge graphic: a vertical rounded-rect tank outline with a
    fill rising to `pct_full`. Renders at ANY percentage passed in — always
    driven by real computed values (current_used_l/tank_capacity for water,
    current_sewage_pct() for sewage), never a static/hardcoded graphic.

    Used on pages/1_Houses.py (live data) and pages/5_Simulation.py
    (simulated-clock data) so both pages visualize tank levels with the same
    component instead of two copies of hand-rolled HTML."""
    pct = max(0.0, min(100.0, pct_full))
    color_var = _LEVEL_BAR_COLOR[variant]
    pad = 6
    label_h = 20
    body_w = width - 2 * pad
    body_h = height - 2 * pad - label_h
    fill_h = body_h * (pct / 100.0)
    fill_y = pad + label_h + (body_h - fill_h)
    clip_id = f"tank-{uuid.uuid4().hex[:8]}"
    return _flatten_html(f"""
    <div style="display:flex; flex-direction:column; align-items:center; margin:0.2rem 0.4rem;">
      <div style="font-size:var(--font-size-xs); color:var(--color-ink-soft); margin-bottom:0.15rem;">{label}</div>
      <svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{label}: {pct:.0f}% full">
        <defs>
          <clipPath id="{clip_id}">
            <rect x="{pad}" y="{pad + label_h}" width="{body_w}" height="{body_h}" rx="12" ry="12" />
          </clipPath>
        </defs>
        <rect x="{pad}" y="{pad + label_h}" width="{body_w}" height="{body_h}" rx="12" ry="12"
              style="fill: var(--color-surface-raised); stroke: var(--color-border); stroke-width: 2;" />
        <rect x="{pad}" y="{fill_y:.1f}" width="{body_w}" height="{fill_h:.1f}"
              style="fill: {color_var};" clip-path="url(#{clip_id})" />
      </svg>
      <div style="font-size:var(--font-size-sm); font-weight:700; color:var(--color-ink); margin-top:0.15rem;">{pct:.0f}%</div>
    </div>
    """)


def setup_page(title: str, icon: str = "\U0001F4A7") -> None:
    """Back-compat helper: sets page config + injects theme. Only safe to
    call from a script Streamlit is running as the top-level entrypoint
    (i.e. not from a page registered via st.navigation, which sets config
    once in app.py instead - those pages should call apply_theme() only)."""
    st.set_page_config(page_title=f"AquaTrace — {title}", layout="wide", page_icon=icon)
    apply_theme()
