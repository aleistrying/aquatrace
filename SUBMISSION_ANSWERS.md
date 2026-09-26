Briefly explain your intended solution. (250 char max)
----------------------------------------------------
AquaTrace shows household-level water/sewage status for trucked-water Inuit communities, predicts who needs a delivery before they run out, and lets dispatchers batch nearby urgent homes into one trip — turning invisible risk into an actionable view.
[250/250 chars]


How does your solution address your chosen problem area(s)? (700 char max)
----------------------------------------------------------------------------
Inukjuak's own advocacy letter states there is "no mandatory water-quality monitoring in trucks, household tanks, or at the tap" — that's the exact gap AquaTrace closes. It runs a physics-based chlorine-decay model, fed by live weather, plus sewage-capacity tracking for every household, flags who needs a truck before they run dry or get blocked, and lets one dispatcher batch nearby urgent homes into the same trip instead of guessing on a blind rotation. It builds on Université Laval's real Kuujjuaq tank-sensor pilot by adding the quality layer, prediction, and multi-household triage that pilot's own team says is still missing.


Briefly describe the social impact your solution could have if implemented. (700 char max)
----------------------------------------------------------------------------------------------
For communities relying on trucked water, this means fewer households ever reaching an unsafe or empty tank. Our full-scale simulation (500 real households, grounded in a documented 3-truck Inukjuak fleet) shows predictive, batched dispatch cuts household-days spent in a bad state by ~90% versus today's blind rotation, while the baseline still matches the real ~2-week refill cycle communities experience today. Practically: fewer boil-water surprises like Inukjuak's 2026 E. coli advisory, fewer sewage-blocked households unable to do dishes or bathe, and a dispatcher who can finally see who needs help instead of guessing — dignity and basic parity, using the trucks already on the road.
[692/700 chars]


What makes your solution different from what is currently available? (700 char max)
-------------------------------------------------------------------------------------
The only existing related work is Université Laval's Sentinel Nord tank-level sensor pilot (Kuujjuaq) — real, but reactive level-alerts only: no quality sensing, no prediction, no multi-household view. We add all three, and honestly rejected what doesn't fit: no truck-fleet GPS fantasy (real fleets have no data signal in transit — we use the existing voice radio instead), no desalination (the source is freshwater, not saline), no in-tank heating (could worsen chlorine decay, not help it). Sewage capacity is modeled as a hard block on water use, not an afterthought. Every number is labeled real vs. simulated — nothing pretends to be data that doesn't exist yet.
