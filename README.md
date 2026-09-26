# AquaTrace

Household water quality & delivery visibility for trucked-water Inuit communities,
starting from Inukjuak, Nunavik. Built for Hack for Humanity: Ottawa 2026, challenge
track "Designing for the North — Water Safety, Remoteness & the Reality of Inuit
Communities."

## The problem, in the organizers' own words

From the official Challenge Slides deck (presented by Amenda Soucy, from Inukjuak,
Nunavik):

> "The water is treated — but visibility is limited after it leaves the facility."
>
> **How might we make water quality visible, understandable and accessible at the
> household level?** Design something that can: **Detect** (meaningful info about
> household water quality) · **Communicate** (turn complex info into a simple,
> immediate status) · **Work** (limited/no connectivity) · **Last** (maintained,
> repaired and supported within a remote northern community).

## Why this scope, not a truck-fleet dispatch system

Reference material research (see `REFERENCES.md`) found the community's own advocacy
documents state plainly: *"no mandatory water-quality monitoring in trucks, household
tanks, or at the tap; contamination risk especially with low chlorine residual"* — a
true blank space with no existing tooling anywhere. Delivery/logistics unreliability is
also real and documented, but already has a slow, multi-year fix in motion (Inukjuak's
pipeline initiative, Resolution #2025-29, feasibility study 2026–27 → construction
2028–30). This prototype targets the gap that has *no* fix in motion: quality
visibility, not truck logistics.

It builds **on top of**, not in competition with, **Benjamin Bouchard's Sentinel Nord /
Université Laval tank-level sensor pilot** (Kuujjuaq, partnered with the Nunavik Housing
Bureau and KRG) — that project does reactive tank-*level* alerting only, and its own
write-up names the exact gap this fills: *"water quality is only checked weekly for
coliforms at the treatment plant, never during distribution or in home reservoirs."*

Two other directions were researched and deliberately **not** built:
- **Truck-fleet GPS tracking/auto-dispatch** — dropped as the headline feature. A
  realistic fleet is 1–2 trucks (no idle spares to "dispatch"), and a 3-hour hackathon
  can't credibly fake real fleet telemetry. Delivery time is used only as an *input
  signal* (time-since-last-fill) to the quality model.
- **Desalination / water ionization** — the community's water source is freshwater
  (Innuksuak River mouth), not saline; desalination is the wrong technology for the
  actual contaminant profile. "Water ionization" in the consumer sense is not a real
  disinfection method. On-site electrochemical disinfection (a related, legitimate
  technology) solves a different problem (avoiding bleach cold-chain degradation) and
  doesn't address monitoring or delivery — noted as a possible future footnote, not
  built here.

## Run it

```bash
pip install -r requirements.txt
streamlit run app.py
```

No API keys required. Ambient temperature is fetched live from Open-Meteo (free,
no-auth, global coverage); a documented fallback value is used if the network call
fails, so the app still runs end-to-end offline.

## What's real vs. illustrative

- **Real:** live ambient temperature (Open-Meteo — Environment Canada's MSC GeoMet is
  the official Canadian equivalent and a straightforward swap for a production,
  government-hosted deployment). The chlorine-decay relationship (first-order decay,
  rate roughly doubling per +10°C) and the 0.2 mg/L biofilm-regrowth floor are real,
  documented engineering/public-health findings, not invented or AI-predicted.
- **Illustrative, clearly labeled in-app:** the household list, tank capacities,
  delivery history, and initial chlorine dose are seeded placeholders — there is no
  public household-level metering data for trucked-water Nunavik communities to pull
  from. Per-capita consumption is shown as a **band** (90–150 L/person/day), sourced
  from northern/rural water-insecurity literature patterns, not a fabricated point
  estimate — and explicitly flagged as needing live citation-check before any public
  claim.
- **Real, working feature, not a mockup:** the "Use my current location" button calls
  the browser's actual `navigator.geolocation` API — zero hardware, zero cost, works
  live in the demo.

## Design & data model

- Physics-based chlorine decay model (`chlorine_rate_constant`,
  `chlorine_residual_now`) — not an ML claim. Thresholds and the Q10≈2 temperature
  scaling are cited engineering relationships (see `REFERENCES.md`).
- Depletion band model (`depletion_days_band`) — plain arithmetic
  (`tank_capacity − used) / (per_capita_rate × household_size × freeze_multiplier)`),
  shown as a low/mid/high range, not a false-precision single number. The
  `freeze_multiplier` only activates below −30°C, modeling the specific, documented
  anti-freeze tap-dripping behavior in extreme cold — not a general "cold → more
  water use" claim.
- Triage ordering is **worst-residual-first, for a human dispatcher/community health
  rep to act on** — not an automatic truck-dispatch system, matching the realistic
  1–2-truck fleet size documented in reference material.

Follows the design tokens and Streamlit theming helper (`streamlit_theme.py`, vendored
into this repo) originally developed for the wider hack-for-humanity portfolio.

## What to do next

- Wire in Environment Canada's MSC GeoMet for the official Canadian data source.
- Replace seeded households with a real community-submitted log (the delivery
  check-in form here is the seed of that).
- Add the Bouchard/Sentinel Nord tank-level sensor as a second real input signal
  once/if its data becomes available, alongside the delivery-timestamp signal used now.
