# References

All findings below came from reading this hackathon's own reference material
(`info/Reference Material/*.pdf`, `info/H4H Challenge Slides.pptx`) and targeted
research during the session. See `info/REFERENCE_NOTES.md` in the repo root for full
per-document notes.

## Official challenge framing
- **H4H Challenge Slides.pptx** (presented by Amenda Soucy, from Inukjuak, Nunavik) —
  slide 11 is the literal problem statement this app answers: *"How might we make
  water quality visible, understandable and accessible at the household level?"*
  (Detect / Communicate / Work / Last). Slide 8 confirms the truck-based system:
  *"Instead, homes rely on a truck-based system: Drinking Water: Treatment facility →
  Water truck → Household water tank."*

## Community's own documentation of the gap this fills
- **"Call for Immediate Unified Action Nunavik-wide.pdf"** (Northern Village of
  Inukjuak, Mayor Bobby Epoo) — *"No mandatory water-quality monitoring in trucks,
  household tanks, or at the tap; contamination risk especially with low chlorine
  residual."* Also documents the Puvirnituq blizzard crisis (March 2025, pipeline
  froze, 54 tonnes of water airlifted, medevac to Montreal) and the community's own
  pipeline commitment (Resolution #2025-29).
- **"Feasibilty study request for funding (PIPELINE).pdf"** and
  **"Request for Stratigic Partnership (NV&LHC).pdf"** — confirm the pipeline is a
  multi-year, not-yet-funded initiative (feasibility study first), and name *"the
  chronic unreliability of the trucked water system"* and *"the lack of qualified
  drivers"* as the community's own stated operational pain points.
- **"Inukjuak_Strategic_Plan_2025-2035_FINAL_April6.pdf"** — confirms Inukjuak
  "is situated on Hudson Bay at the northern bank of the Innuksuak River" (freshwater
  source, not saline) and gives the pipeline timeline: feasibility/funding study
  2026–27 → design/procurement 2027–28 → construction 2028–30.

## Existing related work (built on top of, not duplicated)
- **Institut nordique du Québec / Université Laval, "Monitoring Water Reservoirs"**
  (June 26, 2024; https://inq.ulaval.ca/en/Monitoring-water-reservoirs) — Benjamin
  Bouchard's PhD project (Sentinel Nord program), partnered with the Nunavik Housing
  Bureau and KRG. Ultrasonic level sensor giving low-water alerts on household
  reservoirs, piloted in Kuujjuaq. Prototype/pilot stage, reactive threshold alerting
  only — no quality sensing, no prediction, no multi-household aggregation. The
  project's own documentation states water quality is checked only weekly for
  coliforms at the treatment plant, never during distribution or in home reservoirs.

## Engineering basis for the models in `app.py`
- Chlorine residual decay: first-order exponential decay, rate roughly doubling per
  +10°C (Q10 ≈ 2) — consistent with documented haul/cistern-water decay literature
  (flagged in-session as training-knowledge pattern, recommend a live citation check
  before presenting as a specific numeric citation to judges).
- 0.2 mg/L residual threshold: cited in haul/cistern-water literature as the point
  below which biofilm regrowth resumes in storage tanks, and a boil-water advisory
  alone does not clear this.
- Per-capita consumption band (90–150 L/person/day): pattern found in northern/rural
  water-insecurity literature (vs. ~220 L/person/day for piped southern Canadian
  households) — presented as a band, not a single fabricated figure, and flagged for
  live verification before any public citation.
- Extreme-cold consumption bump (below −30°C): documented pattern of residents
  deliberately dripping taps to prevent pipe/fitting freezing in cold-climate homes —
  the one precise, defensible weather→consumption link found (as opposed to a general
  temperature→demand correlation, which research found to be weak/wrong).

## Truck fleet size & capacity (used in delivery_comparison_fullscale.py)
- **Fleet size:** Nunatsiaq News, "Nunavik villages lack reliable access to water,
  causing health centre and school closures" (May 27, 2024 — cited in the official
  Challenge Slides deck's own source list) reports **three water trucks total** for
  Inukjuak, per Mayor Pauloosie Kasudluak. This is the basis for the 3-truck figure
  used in the full-scale delivery comparison for Inukjuak/Puvirnituq (~2000 population).
  The smaller communities (~750 population) are scaled down proportionally (1 truck),
  not separately sourced.
- **Truck tank capacity (~10,000 L):** **not found in any reference document** —
  general Arctic/Nunavut-style insulated municipal water tanker trucks commonly run
  ~9,000–13,000 L per training-knowledge research this session; 10,000 L was used as
  a defensible midpoint estimate, explicitly flagged as unverified/estimated, not a
  Nunavik-specific cited figure. **Verify before quoting a specific liters number to
  judges** — cite it as "estimated, general Arctic tanker range" if asked.
- **Note:** this is a different, larger number than the "realistic 1-2 truck fleet"
  framing used elsewhere in this app's copy (e.g. the Truck page's dispatch-realism
  discussion) — that framing was a conservative simplification for the small demo
  household sample; the 3-truck figure is the real, cited number for Inukjuak
  specifically and is what the full-scale comparison uses. Reconcile which framing
  to lead with before presenting to judges — they are not contradictory (a real
  3-truck fleet can still mean "1-2 trucks realistically available for a single
  dispatch decision" if some are down for maintenance/driver shortage, which is
  itself a documented pain point above), but say so explicitly rather than leaving
  two different truck counts unexplained side by side.

## Sewage tank thresholds (70% / 90%)
- The 70% "filling up" / 90% "full — water use blocked" thresholds in `common.py`
  are **design thresholds, not directly cited numbers** — flagged here per an
  earlier review that found the code comments pointed to this file without an
  actual citation. They were chosen based on the general household-hygiene-impact
  pattern documented in rural Alaska haul-water/sewage-holding-tank research
  (residents restrict water use as a full tank approaches capacity; documented
  health literature ties reduced hygiene water use to higher skin/diarrheal
  infection rates), not a specific numeric source for the 70/90% cutoffs themselves.
  Present them as reasonable, defensible design thresholds, not as a cited statistic.

## Ideas researched and explicitly not built (with reasons)
- **Hyperscaler datacenter with waste-heat reuse** — real Arctic free-cooling and
  waste-heat-reuse precedent exists (Meta Luleå, Sweden; Stockholm Data Parks; Deep
  Green UK pool-heating), but no Arctic precedent heats a *water supply* specifically,
  and Nunavik's satellite-only connectivity makes hyperscaler-scale deployment
  a non-starter. Not buildable as a demoable prototype in 3 hours.
- **In-tank household heating** — research found household tanks are already
  installed indoors specifically to avoid freezing (already-solved practice); the
  real vulnerable point is the exterior fill port/hose fitting. Actively heating an
  already-indoor tank could accelerate chlorine decay/biofilm growth — the premise
  may be backwards.
- **Desalination / water ionization** — source water is freshwater (river/lake), not
  saline; desalination targets a contaminant profile that doesn't exist here.
  "Water ionization" in the consumer sense is not a real disinfection method.
  On-site electrochemical/mixed-oxidant chlorine generation is a real, legitimate
  related technology, but solves the bleach cold-chain/degradation logistics problem,
  not delivery, monitoring, or tank visibility — a possible future footnote, not a
  core feature.
- **Decentralizing to point-of-use treatment devices** — systems-level research found
  this would multiply maintenance burden across many devices instead of one plant +
  fleet, contradicting the "locally maintainable" requirement; documented real-world
  precedent (rural Alaska) shows communities moving toward centralization, not away.

Note: multiple research passes this session hit a shared web-search budget limit; where
findings could only be corroborated via training knowledge rather than a fresh live
source, this is flagged above and in the underlying research — recommend a quick live
re-check of any specific number before quoting it to judges as a citation.

## Arctic sensor practicality (cold-weather hardening)

Context: `Tanque_Agua_Potable.md` (the reference industrial-sensor spec doc this app is
built alongside) lists operating-temperature ratings for every sensor — hydrostatic
level (-10 to +80°C), EMF flow meters (0-60°C), pH (0-60°C), conductivity (-10 to
+60°C), turbidity (0-50°C), PT100 temperature (-10 to +60°C), amperometric chlorine
(0-50°C) — and **none** cover Nunavik's documented -49.4°C lows, let alone a -60°C
worst case. This section researches whether that's an actual deployment problem.
Session note: this research hit the same shared web-search budget limit as earlier
passes in this doc (WebSearch exhausted before these 5 queries could run); findings
below come from targeted WebFetch of specific reference pages plus training-knowledge
engineering practice, each flagged accordingly rather than presented as fresh citations.

### 1. Is unrated ambient exposure actually a problem, or already solved?

**Both** — it depends on where on the sensor the -49°C air actually touches.

- **Sourced (WebFetch, Wikipedia "Heat tracing" article, this session):** heat
  tracing/heat tape is a real, established freeze-protection technology — electrical
  heating cable + insulation, thermostatically switched (typically on below 3-5°C,
  off ~2°C above that) — explicitly used to protect "water service lines and tanks"
  and "instrument tubing," standard across utility, oil/gas, and chemical-industry
  cold-climate installations. This confirms the *mechanism* proposed below is a real,
  commercially normal pattern, not a hackathon invention.
- **Reasoned-estimate (training knowledge, high confidence — standard industrial
  instrumentation practice):** manufacturer "operating temperature" ratings on
  wetted/submersible sensors (hydrostatic level, pH/conductivity/turbidity/chlorine
  probes, PT100 in a thermowell) describe the **process-fluid** temperature the
  sensing element sees, not outside air — because these sensors are designed to be
  installed submerged or in a wetted bypass line. A Nunavik household cistern is kept
  indoors specifically to avoid freezing (already noted above in this file), so its
  water sits around 0-20°C year-round regardless of -49°C outside air; a submerged
  sensor in that tank is never actually exposed to the extreme low it's "unrated" for.
  The real exposure point is the **electronics** (transmitter head, PLC, terminal
  blocks, exposed cable) — and Arctic/northern water-treatment practice puts those
  inside a heated plant room or a small insulated/heat-traced enclosure with a
  low-wattage thermostatic heater, which is exactly the same category of solution the
  Wikipedia source confirms is real and widely deployed. **Conclusion: this is a
  well-established, "already solved" pattern for anything liquid-buffered or indoors —
  not a novel problem this project needs to invent new sensor hardware for.** It only
  remains a live problem for anything sitting in dry outdoor ambient air, which in
  this project's design is essentially just the sewage tank (see Q2).

### 2. The outdoor sewage tank specifically

**Reasoned-estimate (training knowledge — established wastewater/level-instrumentation
practice; live citation not obtained this session due to search-budget exhaustion):**

- This is the one point in the whole sensor set where the "liquid buffers the sensor"
  argument above doesn't fully apply, because a level reading (whether float or
  non-contact) inherently involves the air gap/headspace above the waste, which *is*
  at outside ambient in an uninsulated outdoor tank.
- Real, purchasable solutions exist for exactly this case: heated-faceplate ultrasonic
  or radar level transmitters and heat-traced standpipes are an established product
  category for outdoor wastewater lift stations and holding tanks in cold-climate
  regions (Canada/northern US) — not speculative, but a known line item in cold-climate
  wastewater engineering.
- However, for this project's actual proposed sensor (a float/reed switch, not a
  continuous non-contact sensor), the simpler and arguably more robust fix is
  **placement, not new hardware**: mount the float low enough that the float body and
  reed contact stay submerged/liquid-buffered rather than sitting in the dry headspace,
  and keep the switch's junction/terminal point in a small insulated or lightly heated
  deck box rather than bare-exposed. The genuinely fragile part is then the **signal
  cable run** through the tank wall to the (heated, indoor) relay — a wiring-freeze/
  conduit-crack risk, solved with standard heat-traced or direct-bury conduit practice,
  not an exotic sensor spec.
- As true belt-and-suspenders backup, a **zero-electronics mechanical sight-gauge or
  dipstick/float-rod indicator** (the same category used on remote septic/holding
  tanks for decades, precisely because nothing in it can fail from cold — no battery,
  no electronics) is a practical, low-cost manual-fallback addition, philosophically
  identical to this project's own backup-button pattern applied to level instead of
  self-reported status.

### 3. Sensor failure mode: fault detection and manual fallback

**Reasoned-estimate (training knowledge — standard, textbook industrial-controls
practice; ISA-18.2 alarm management and the 4-20 mA "live zero" convention are
established industry standards, but a fresh single-URL citation was not obtained this
session due to the exhausted search budget):**

- The 4-20 mA "live zero" convention that `Tanque_Agua_Potable.md`'s own wiring already
  uses exists **specifically** to make this distinction: 4 mA = 0% of range (a valid
  reading), while a broken loop reads 0 mA or drifts out of the 4-20 mA envelope
  entirely — competent PLC logic flags anything below ~3.6 mA or above ~20.5 mA as
  **sensor fault**, not as a valid low/high reading. This is exactly the "don't
  silently report 0 as normal" behavior the research question describes, and it's a
  decades-old standard convention, not something this project would need to invent.
- SCADA/HMI best practice (ISA-18.2 alarm management) further separates "last known
  good reading, with a staleness/age indicator" from an explicit FAULT/OFFLINE flag,
  rather than ever displaying a frozen or default value as if it were current.
- Manual fallback when telemetry fails — operators reverting to a manually-read gauge,
  radio/phone call-in, or paper log — is a real and common operational pattern in
  small/rural water utilities specifically *because* many of them run with partial or
  intermittent SCADA coverage already. This project's "backup button" concept (a
  human-reported status channel that exists independent of automated sensors) is
  consistent with, not a simplification of, real remote-utility operational practice.
- Redundancy is also real practice for the highest public-health-stakes measurement
  here (chlorine residual): amperometric probes are known to drift/foul, so periodic
  manual grab-sample verification is standard regardless of whether telemetry is
  healthy — cold-related sensor failure is just one more reason this manual check
  channel needs to exist, not a new requirement it creates.

### 4. Per-sensor Arctic-hardening recommendation (the 4 sensors this project proposes)

| Sensor | Needs heated enclosure? | Why | Realistic maintenance burden |
|---|---|---|---|
| Ultrasonic tank level (water cistern) | No | Tank is indoors/insulated by design (already noted elsewhere in this file); sensor sees heated indoor air, never -49°C outside air | Near-zero — no wetted parts; occasional wipe for condensation/frost on the transducer face after the tank lid is opened in winter |
| Turbidity + amperometric chlorine probe | No (probe); yes for any outdoor wiring/relay run | Probe is submerged in tank water that stays above freezing indoors; only exposed cable runs would need heat-trace/insulated conduit if the relay isn't indoors | Electrode fouling/replacement (6-12 month life, per `Tanque_Agua_Potable.md`) dominates — unchanged by being in the Arctic specifically |
| Sewage float switch (outdoor tank) | Partially — insulated/lightly heated deck box for the switch junction, not the whole tank | The one sensor with real dry-ambient exposure risk (headspace above the waste); mount low to stay liquid-buffered, heat-trace/direct-bury the signal cable | Low if placement is right; winter check that the cable entry hasn't frozen/cracked; mechanical sight-gauge as zero-electronics manual backup recommended |
| Wired backup button (house power) | No | Entirely indoors on house power — never touches outside ambient at all | Near-zero — no battery, simple mechanical switch (as already noted in the sensor table) |
