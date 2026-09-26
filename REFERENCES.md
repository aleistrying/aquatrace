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
