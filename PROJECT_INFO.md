# AquaTrace: Project Information (submission draft)

**Event:** Hack for Humanity: Ottawa 2026 (The AI Collective)
**Challenge track:** Designing for the North: Water Safety, Remoteness & the Reality of Inuit Communities
**One-line pitch:** AquaTrace makes drinking-water quality visible at the household level in trucked-water Inuit communities. It tracks the chain of custody after water leaves the treatment plant (truck, household tank, tap), a stretch the community's own documents say has no mandatory monitoring today.

> This is a long-form draft. Trim it to fit each field on the submission form. Every claim below is drawn from the repo (`README.md`, `REFERENCES.md`, `info/REFERENCE_NOTES.md`, and the app source). Items marked **[verify]** are ones the team's own notes flag as needing a live citation check before being quoted to judges.

---

## 0. Team details (fill in)

- Team name: _______
- Members (name, role, contact): _______
- Public repo (MIT or Apache 2.0, per event rules): _______
- Live prototype link / how judges open it: _______

---

## 1. Problem statement

### The official challenge
The official Challenge Slides were presented by Amenda Soucy, from Inukjuak, Nunavik, who speaks from lived experience of water delivery and household storage. They describe how water works in Inukjuak. Rock and permafrost rule out an underground sewer system, so homes rely on trucks: **Treatment facility → Water truck → Household water tank** for drinking water, and **Household sewage tank → Sewage truck → Wastewater disposal** for waste. Slide 10 names the constraint:

> *"The water is treated — but visibility is limited after it leaves the facility."* (Source → Treatment → Truck → Household Tank → Tap)

Slide 11 poses the challenge: **"How might we make water quality visible, understandable and accessible at the household level?"** The answer should **Detect** (give meaningful information about household water quality), **Communicate** (turn it into a simple, immediate status), **Work** (with limited or no connectivity) and **Last** (be maintained, repaired and supported within a remote northern community).

### The community's own words: a documented monitoring gap
Inukjuak's joint advocacy letter, *"Call for Immediate Unified Action Nunavik-wide"* (Northern Village of Inukjuak, Mayor Bobby Epoo), is addressed to CIRNAC, Infrastructure Canada, MAMH, KRG and Makivvik. It states:

> *"No mandatory water-quality monitoring in trucks, household tanks, or at the tap; contamination risk especially with low chlorine residual."*

The existing Université Laval / Sentinel Nord reservoir project makes the same point from the research side: *"water quality is only checked weekly for coliforms at the treatment plant, never during distribution or in home reservoirs."*

### Real incidents that show the stakes
- **Puvirnituq blizzard crisis (March 2025).** The main pipeline froze and the letter calls it a "complete crisis." Schools closed, gastroenteritis cases spiked, patients were **medically evacuated to Montreal**, and emergency response **airlifted over 54 tonnes of water**. KRG's June 6, 2025 release (cited in the challenge deck) describes a roughly 10-week crisis: a state of emergency on May 17, 2025, a damaged raw-water pipeline, and blizzard-driven disruption to tanker delivery.
- **Inukjuak E. coli boil-water advisory (June 2026).** Nunatsiaq News reported on June 11, 2026: *"Inukjuak under boil-water advisory after E. coli detected at water plant."* The challenge deck cites this story, and it happened months before this event.
- **Operational strain the community names itself.** The strategic-partnership request (NV&LHC) cites *"the chronic unreliability of the trucked water system, and the severe operational strain caused by the lack of qualified drivers."*

### Blind-rotation refills
Without per-house measurement, a water truck has to visit homes on a blind rotation. The app's Simulation page states the working estimate: for a community of about 1,800–2,000 people, that is **roughly a 2-week cycle** to reach every house once, with occasional one-off emergency runs in between. Nobody knows which tank is low, which has lost its chlorine residual, or which sewage tank is about to block water use until a resident calls or the truck arrives. *(This 2-week figure is the team's operating estimate as written in the app. It is not a cited statistic. **[verify]** before quoting it.)*

### Scope: visibility, not water-source scarcity
**AquaTrace does not address water-source scarcity, and it does not replace the pipeline.** That was a deliberate, evidence-based scoping choice:
- **Source water is freshwater.** Inukjuak's Strategic Plan 2025–2035 places the community "on Hudson Bay at the northern bank of the Innuksuak River." The reference material does not describe source availability as the problem. It describes what happens to treated water after it leaves the plant.
- **Delivery reliability already has a fix in motion.** It is a real problem, but it is slow and not yet funded. Inukjuak's water/wastewater pipeline is its top infrastructure priority (Resolution #2025-29). The timeline is a feasibility/funding study in 2026–27, design and procurement in 2027–28, construction and a phased move off trucked water in 2028–30, and the wastewater pipeline around 2032. The feasibility request says the engineering approach is still undetermined. The advocacy letter states that *"no level of government has a dedicated, active, specifically budgeted line item"* for a project like this.
- **Nothing addresses quality monitoring.** Trucked water will remain the reality for years whatever happens with the pipeline, and no tooling anywhere covers quality after the plant. AquaTrace is a **bridge solution** for that gap. It does not compete with the pipeline.

---

## 2. Solution: what we built

AquaTrace is a working **six-page Streamlit app**: Home, Plant, Truck, Houses, Communities and Simulation. The pages follow the physical chain of custody, from treatment facility to truck to household tank to the regional view. All pages share one domain module (`common.py`), so the decay math, thresholds and demo data are defined once and cannot drift between pages. It covers **4 of Nunavik's 14 communities**: Inukjuak, Kuujjuaraapik, Puvirnituq and Kangiqsujuaq.

### Home
- Explains the project and labels the data honestly up front. Badges read **"Temperature — live"**, **"Chlorine math — real"** and **"Household data — placeholder"**, with a plain note that no public household-level metering data exists for Nunavik.
- Carries an explicit callout: *"Not solving the water source or the pipeline… The gap is visibility after the water leaves the plant."*
- Has a "Why this scope, and what we deliberately didn't build" expander summarizing the rejected directions (see Section 3).

### Plant (treatment facility)
- Shows connectivity status. The plant is one of two fixed points with reliable connectivity; houses are the other. It also shows the current chlorine dose and the **live ambient temperature** for the selected community.
- Shows the last weekly coliform test with a Pass/Fail badge and how many days ago it ran.
- Has a **"Log a treated batch"** form built from preset choices, not free text: a dose slider from 1.2 to 1.8 mg/L, the destination community, and the coliform result ("Clear" or "Detected — boil-water advisory needed"). **The logged dose carries downstream.** The Truck page applies it as the starting chlorine level for every new delivery.
- Includes a sensor-list expander. It notes that continuous chlorine analysis is already standard practice at comparable northern plants, so the new work belongs after the plant.

### Truck: honest about radio and GPS
- The page states the constraint plainly: **no cell or internet signal in transit, only two-way radio**, across a community area of roughly 50 km².
- An explainer, **"Why radio, and would GPS trackers even work here?"**, makes three points. GPS needs no signal to find a position; only *sending* the position needs a channel, and here that channel is voice radio. What is built now needs no new hardware: the driver reads a short status code over the existing radio and the dispatcher logs it. A future phase 2, **not built**, would be an automatic APRS-style relay that keys the same radio from truck GPS. APRS has more than 40 years of precedent, but this would need new radio-modem hardware.
- The **Radio check-in log** uses preset dropdowns (Truck 1 or 2; En route, Delivered, Delayed — mechanical, Delayed — weather, Returning to facility; household). Logging **"Delivered"** at a household resets that household's water-use clock and sets its starting chlorine to the dose last logged at the Plant. The last 10 check-ins are shown.
- A sensor-list expander covers an in-truck tank-level sender and an **inline flow meter on the delivery hose**. The flow meter would confirm what actually left the truck rather than mirroring the house sensor.

### Houses: what each household reports
- A caveat says residents don't operate this page. It demonstrates what a household sensor, or a backup button where no sensor exists yet, would report into the system.
- The household selector is **sorted most-urgent-first**. A community sample has 12 to 25 households, too many to show as full cards.
- For **sensor-equipped homes**, three live SVG tank gauges show **Water** (percent remaining), **Sewage** (percent full) and **Potability**. They come with a water-quality badge and a separate sewage badge. Details show the residual in mg/L, hours since the last fill, a **days-of-water-left band** (low to high, not a single number), tank size, the household's average use, and its sewage fill rate.
- **Sewage capacity blocks water use.** Sewage is modeled as a hard physical constraint, not just another metric. Without a sewer connection, a full sewage tank leaves nowhere for used water to go, so dishes, laundry, flushing and bathing stop even if the water tank holds plenty of safe water. At **≥90% full** the status becomes *"Sewage full — water use blocked"* and overrides the water caption. It is always shown as its own badge and never merged silently into water status. A community-level **crisis banner** fires when any sewage tank is blocked.
- **Backup button.** About 30% of demo households have no sensor yet. For those, three large buttons act as the only signal: **"All good"**, **"Tank getting low"** and **"Something's wrong."** Pressing **"Something's wrong"** raises the community crisis banner. The sensor table describes the physical version: a **wired, doorbell-style button on house power**, with no battery to fail and near-zero maintenance.
- A sensor-list expander covers an ultrasonic tank-level sensor, the same category piloted by Université Laval / Sentinel Nord in Kuujjuaq. It also covers turbidity plus an **amperometric chlorine probe** (no reagents to freeze or expire) and a float switch for the sewage tank (more failure-tolerant than ultrasonic in a corrosive-gas tank). The table notes for each whether it needs connectivity.

### Communities: regional and predictive view
- The **Household prediction map** asks "does the truck need to leave?" Each household is a pin: **red** if it is *predicted* to cross into trouble within about a day, **green** otherwise. The prediction flags a household whose water is expected to run out within the horizon, or whose sewage is expected to cross the 90% blocked line. Households that are *already* empty or full are left to the Houses page's status badges. This view is the early warning, not the alarm. A badge counts how many households need the truck within about a day. Pin positions are labeled as simulated jitter within each community, not geotagged homes.
- The **Community overview map** sizes markers by population and colors them by the worst current household status.
- **Community summary cards** show population, households monitored, live temperature, and an estimated daily water-use band (population × 90–150 L/person/day).
- The **Water & sewage by community** section groups households by community, ranks them highest-risk first, and shows the top 8 per community as tank gauges. A community's expander opens automatically and is flagged "needs a truck soon" when any household is predicted to need service or is sewage-blocked.
- An expander explains that the same architecture (plant → truck/radio → house sensors → dashboard) is designed to extend to all 14 Nunavik communities without redesign.

### Simulation: multi-truck predictive dispatch
- This is a **fast-forward demo on an isolated clock**. It uses its own household set, separate from the live pages, so fast-forwarding can never corrupt their state. It reuses the same shared math and components.
- Controls: a run/pause toggle, simulated minutes per tick (5 to 120; the view refreshes every 2 s), a view switch between Households and Community summary, and reset.
- **One truck per community**, since each community runs its own facility and fleet. An idle truck dispatches to a household that is already high-risk or is predicted to need service within about a day.
- **Batch servicing.** Since the truck is going out anyway, it also takes on every other household in that community already at medium or high urgency. This avoids a second trip for homes that were close to needing one. Trips take an illustrative 45 simulated minutes. On arrival, every house on the manifest has its water and chlorine clock reset and its sewage tank pumped down.
- There is a live **truck manifest** per truck showing water, sewage and potability for each assigned house. The household grid shows the three gauges plus an "En route" badge, and the community summary counts houses "approaching sewer need" and "approaching water need." An **event log** records dispatch and servicing events.
- The page names the problem it answers: blind-rotation refills take about 2 weeks. *"with real measurement, the same truck capacity can prioritize who genuinely needs it now instead of guessing."*

### Potability bar
The potability gauge on Houses and Simulation is **a different view of the same measurement, not a new one**. It is the chlorine residual rescaled to 0–100% against the model's maximum starting dose of 1.8 mg/L, and it is colored with the same 0.2 / 0.5 mg/L thresholds as the text status. The code comments state that it introduces no new safety threshold.

### Real versus illustrative data
- **Real:** ambient temperature is fetched **live from Open-Meteo** per community (cached for 30 minutes). If the call fails, a documented fallback of −18 °C is used and labeled "fallback (offline demo value)", so the app still runs end to end offline. The shape of the chlorine-decay model and the 0.2 mg/L floor come from documented literature.
- **Illustrative, labeled in the app:** household list, tank sizes (1,200–2,500 L), delivery history, starting chlorine dose, family-size distribution, sewage baselines, and the roughly 70/30 split between sensor and button-only homes. They use a fixed random seed, so a demo run is reproducible. Community populations are approximate. Map pin positions are simulated.
- **Why simulated:** there is **no public household-level metering data** for trucked-water Nunavik communities to pull from.

---

## 3. What makes it different

### It builds on existing research instead of duplicating it
AquaTrace builds **on top of** Benjamin Bouchard's PhD project at **Université Laval / Institut nordique du Québec (Sentinel Nord program)**, "Monitoring Water Reservoirs" (June 26, 2024), run with the Nunavik Housing Bureau and KRG. That pilot puts an **ultrasonic level sensor** in household reservoirs in **Kuujjuaq** and sends low-water alerts. It is at prototype/pilot stage and does **reactive tank-level alerting only**: no quality sensing, no prediction, no view across households. Its own write-up names the gap AquaTrace fills (quality never checked during distribution or in home reservoirs). AquaTrace adds three things on top of level sensing:
1. A **quality layer**: temperature-scaled chlorine-residual status.
2. **Prediction**: a days-of-water-left band and roughly one-day-ahead "needs a truck" flags for both water and sewage.
3. **Community and multi-community aggregation**, with triage for a human dispatcher.

The Houses sensor table deliberately specifies the **same ultrasonic sensor category** the pilot uses, so the pilot's hardware could become an input signal for AquaTrace.

### Other distinctive choices
- **Sewage is treated as a blocking constraint on water use.** A full sewage tank stops water use even when the water is safe. Water-only monitoring misses that.
- **It works with the connectivity that actually exists.** Connectivity is mapped per segment: plant and houses connected, trucks radio-only. Truck data enters the system over the voice radio drivers already use, not through a hypothetical data link.
- **Graceful degradation.** Homes without sensors get a wired backup button, and the app runs offline with a labeled temperature fallback.
- **A human stays in the loop.** Urgent-first ordering is for a human dispatcher or community health rep to act on. The Simulation shows what better information could do for truck prioritization, but the realistic fleet of 1–2 trucks does not justify a fully automatic dispatch system.

### What we researched and deliberately did not build
| Direction | Why not |
|---|---|
| **Truck-fleet GPS tracking / auto-dispatch as the headline** | A realistic fleet is 1–2 trucks with no idle spares to dispatch, and trucks have no data signal in transit. We couldn't credibly fake real fleet telemetry in 3 hours. Delivery time is used only as an *input* (time since last fill), and APRS-style GPS relay is listed as a future phase 2. |
| **Hyperscaler datacenter with waste-heat reuse** | The physics and precedent are real (Meta Luleå, Stockholm Data Parks, Deep Green UK), but no Arctic precedent heats a *water supply*. Nunavik's satellite-only connectivity rules out hyperscale deployment. |
| **In-tank household heating** | Tanks are already installed indoors to avoid freezing; the vulnerable point is the exterior fill port and hose fitting. Heating the tank further could speed chlorine decay and biofilm growth, so the premise may be backwards. |
| **Desalination / "water ionization"** | The source is freshwater (Innuksuak River), not saline, so desalination targets a contaminant profile that isn't there. Consumer "water ionization" is not a real disinfection method. On-site electrochemical chlorine generation is legitimate, but it solves bleach cold-chain logistics, not monitoring. |
| **Decentralized point-of-use treatment devices** | They would multiply the maintenance burden across many devices, which contradicts the "Last / locally maintainable" requirement. Rural Alaska precedent shows communities moving toward centralization. |

---

## 4. Fit with the judging criteria (25% each)

**Social impact.** AquaTrace targets the specific gap that Inukjuak's mayor documented: *"no mandatory water-quality monitoring in trucks, household tanks, or at the tap."* This is the stretch where the Puvirnituq crisis (medevacs, 54 tonnes of water airlifted) and the June 2026 E. coli advisory hit people. The Houses page gives each household a plain status ("Likely safe" / "Approaching the floor" / "Retest recommended") and flags when a full sewage tank has stopped basic hygiene. The Simulation shows how the same trucks could reach the homes that need them now instead of running a roughly 2-week blind rotation. Because trucked water will remain in place until the pipeline arrives around 2028–2032, this helps in the years before any pipeline.

**Technology.** The core is a physics-based model, not an AI claim. Chlorine decay is first-order with Q10 ≈ 2 temperature scaling and is fed by live per-community weather. Depletion is a low-to-high band, and sewage is modeled as a hard constraint. All of it lives in one shared module, which drives both real-time pages and an isolated fast-forward simulation with per-community predictive dispatch and batch servicing. Data flows through the chain: the Plant dose becomes the Truck delivery, which resets the House decay clock, which feeds the Communities prediction. It is designed to scale plausibly. Adding a community is one entry in `COMMUNITIES`, sensor choices are spelled out per stage, and a FastAPI port of the same math already exists.

**Polish & accessibility.** Accessibility is built into the CSS (`BIG_UI_CSS`), not just claimed. It uses enlarged type, touch targets of at least about 3.2 rem, an extra-large backup button, and bigger nav tap targets, sized for elders, phones and gloved hands. Status appears as text badges plus colored gauges, and the SVG gauges have `aria-label`s, so meaning never depends on color alone. Forms use preset dropdowns instead of free text so a plant operator or radio dispatcher can log quickly. The theme is deliberately locked to light mode because Streamlit's native widgets can't follow OS dark mode, and mixing the two made text unreadable. The data-honesty badges appear on every relevant page.

**Innovation.** Existing work does reactive tank-*level* alerts (Sentinel Nord pilot). AquaTrace adds quality, prediction, sewage-as-constraint and community-wide triage on top. It also works within real connectivity limits (voice-radio check-ins, wired backup buttons, offline fallback) instead of assuming data links. The documented list of rejected ideas shows the team followed the evidence, not the flashiest technology.

---

## 5. Technical summary

**Stack**
- **Python + Streamlit** (`streamlit>=1.32`, `requests>=2.31`). The app is a six-page `st.navigation` app, and the Simulation uses `st.fragment(run_every="2s")` for its live clock. No API keys are needed. Run it with `pip install -r requirements.txt && streamlit run app.py`.
- It uses the shared portfolio **design system** (`design-system/` tokens plus the `streamlit_theme` helper: `inject_theme`, `badge`, `crisis_banner`). An app-only Nunavik palette override and the big-UI CSS are layered on top without modifying the shared files. The palette comes from environment and precedent (SmartICE/SIKU/ITK-style plain heavy sans-serif). It is not an official brand palette and is flagged for community review.
- The shared `tank_svg` component renders every gauge from computed values, never static graphics. Logging goes to a rotating file under `logs/`.

**Real data sources**
- **Open-Meteo** (free, no auth) supplies live `temperature_2m` per community.
- **Environment Canada MSC GeoMet** is the official Canadian government equivalent and is documented as the production swap target.

**Simulated or illustrative data, and why**
- Households, tank sizes, delivery history, starting doses, consumption draws, sewage baselines, the sensor/button split and map pin positions are all seeded placeholders under a fixed seed. **No public household-level metering data exists** for trucked-water Nunavik communities. Each community sample has 12 to 25 households, scaled by population; the real population figure is still used for aggregate water-use estimates.

**Math basis** (constants in `common.py`; sourcing in `REFERENCES.md`)
- **Chlorine decay:** `C(t) = C₀ · e^(−k·t)`, with `k(T) = k₂₀ · Q10^((T−20)/10)` and **Q10 = 2** (the rate roughly doubles per +10 °C). This is consistent with documented haul/cistern-water decay literature. **[verify]**: `REFERENCES.md` flags this as needing a live citation check before being quoted as a specific numeric source. `k₂₀` is a *model calibration* chosen so a 1.5 mg/L dose reaches 0.2 mg/L in 72 h at 20 °C. It is not a cited constant.
- **Quality thresholds:** below **0.2 mg/L** is "Retest recommended". The literature cites this level as the point below which biofilm regrowth resumes in storage tanks. From 0.2 to **0.5 mg/L** is "Approaching the floor", and 0.5 mg/L or above is "Likely safe".
- **Sewage thresholds:** **70%** is "Filling up" (schedule a pump-out) and **90%** is "Sewage full — water use blocked". Each household's sewage fill rate is its consumption relative to tank capacity × a 1.0–1.3 factor ("comparable or slightly faster" than water use, per haul-water literature). *Note for the team: the code comments point to `REFERENCES.md` for the sewage-threshold sourcing, but `REFERENCES.md` has no entry for the 70/90% thresholds yet. Add a source or describe them as design thresholds before claiming a citation.*
- **Consumption:** a band of **90–150 L/person/day**, from northern/rural water-insecurity literature (versus about 220 L/person/day for piped southern Canadian homes). **[verify]**
- **Depletion:** remaining litres ÷ (per-capita rate × household size × freeze multiplier), shown as a band. The **×1.10 freeze multiplier applies only at or below −30 °C**. It models the documented practice of dripping taps to prevent freezing, not a general "colder means more water" claim; research found that general correlation weak.
- **Prediction:** a household is flagged if the high-use depletion estimate falls within the next day, or if projected sewage crosses 90% within the next day, and neither has happened yet.

**Known limitation to state openly**
- The decay model is driven by *outdoor* ambient temperature, but household tanks are indoors, per the in-tank-heating research. Real indoor tank temperature would be a better input. It is a natural addition alongside a real sensor.
- The README mentions a "Use my current location" browser-geolocation button. **It is not in the current app code**, so do not list it as a feature unless it is re-added.

---

## 6. What's next

1. **Swap Open-Meteo for Environment Canada's MSC GeoMet** as the official Canadian government-hosted data source for production.
2. **Integrate real sensors, building on the Sentinel Nord pilot.** Add the Bouchard/Université Laval ultrasonic tank-level signal as a second real input next to the delivery timestamp, if and when its data becomes available. Then add in-tank chlorine (amperometric), turbidity and a sewage float switch as specified on the Houses page.
3. **Replace seeded households with a real community-submitted log.** The Plant batch form and Truck radio check-in form are the seed of this. Add the wired backup button in homes not yet instrumented.
4. **Automatic truck position via an APRS-style radio relay** (phase 2 on the Truck page): truck GPS keys the existing radio automatically. This needs radio-modem hardware.
5. **A production framework.** A **FastAPI + plain HTML/JS prototype** of the Houses page already exists in `starters/aquatrace-alt/`. It ports the same math and thresholds 1:1 and exposes `GET /api/houses` and `POST /api/houses/{id}/manual_alert`. It was built to test whether custom SVG gauges are easier outside Streamlit, and it is a possible direction for a lighter, lower-bandwidth production front end.
6. **Scale to all 14 Nunavik communities.** The architecture is community-agnostic; each new community is one config entry.
7. **Community review.** Validate the palette, the wording and the whole workflow with Inukjuak residents, operators and drivers, following the challenge's *"Design with the North — not just for the North."*
8. **Citation pass.** Live-verify every **[verify]** number above before public use.

---

## 7. Working prototype confirmation

**Yes. There is a working prototype that judges can open and use.** It is a six-page Streamlit app with live weather, working forms (Plant batch log, Truck radio check-in, household backup buttons) whose inputs flow across pages, two live maps, and a running fast-forward dispatch simulation. It runs with `pip install -r requirements.txt && streamlit run app.py`, needs no API keys, and falls back to a labeled offline temperature if the network is unavailable.
