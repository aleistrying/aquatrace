# UX review profile — AquaTrace (web/)

**Run:** dev server usually already running at `http://localhost:3210` (`npm run dev` if not).
Playwright isn't installed in this project — use system Chrome:
```
NODE_PATH=/tmp/pw_node_modules/node_modules node your_script.js
# chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] })
```
Use `page.goto(url, { waitUntil: "load" })`, not `"networkidle"` — the dev server's HMR
websocket keeps the network busy indefinitely and that wait condition times out.

**Gate:** from `web/`, `npx tsc --noEmit` and `npx eslint .` must be clean. Before declaring a
fix done, also run a real production check: `npx next build`, then
`TZ=UTC npx next start -p <port>` and hit it with a Playwright context whose `timezoneId` is
something far from UTC (e.g. `Pacific/Kiritimati`) — this project has twice shipped bugs (a
seeded-state hydration mismatch, a locale-dependent date format) that only reproduced under a
genuine server/client timezone split, never in dev mode or a same-machine prod check.

**Routes + target viewport:** `/` (pitch deck, slide-based, no page scroll by design),
`/houses`, `/plant`, `/truck`, `/communities`, `/simulation`, `/statistics` — all six product
pages are tab-based (`src/components/SingleScreenTabs.tsx`) and must fit **1366×768 with zero
page-level scroll** in every tab, light and dark. Check both `scrollHeight<=innerHeight` AND
`scrollWidth<=innerWidth` (a horizontal clip inside a narrow grid column won't show up in a
vertical-only check — this has been the actual root cause of at least two real bugs found this
way). Also check every `.card`'s own `scrollHeight<=clientHeight` — a card can silently overflow
its own box while the page itself still passes the top-level check.

**Design rules:** see `web/DESIGN_RULES.md` (loaded automatically via `CLAUDE.md`) — the
accumulated rule set (one focal point per screen, components not summaries, big-number KPIs,
hide dev-only params, minimal persistent/global chrome, never fabricate data, nothing deleted).
When a UX review's finding is "too much going on," look first for **accumulated persistent
header/banner chrome** — this project's biggest real instance was the Simulation page growing a
title card + 5-stat strip + conditional surge banner + a dismissible hint banner, all stacked
*above the tabs on every single tab*, because each round of feedback added one more element
without ever removing an earlier one. The fix was cutting the persistent strip to one number and
moving the rest into the tab where they're actually relevant — not touching the individual
components, which were each already fine on their own.

**Seeded data:** households are deterministically seeded (`src/lib/model.ts`'s `seedHouseholds`,
fixed baseline instant, not live `Date.now()` — required for SSR/hydration consistency).
Communities: Inukjuak, Kuujjuaraapik, Puvirnituq, Kangiqsujuaq. Household ids like `INU-001`.

**Deferred / won't-fix:** none currently tracked — this repo doesn't yet have a formal deferred
list; if a finding surfaces something that looks intentionally out of scope, ask before building it.

**Process:** work is done via one subagent per page/file (strict file ownership, never two
agents on the same file at once); every subagent verifies its own work with Playwright before
reporting; the orchestrating session independently re-verifies every report with its own
Playwright pass — never ship on a subagent's self-report alone.
