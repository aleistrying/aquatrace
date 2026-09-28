# AquaTrace design rules

Accumulated over many rounds of live review on the deployed app. Apply these to every
page/slide in this project — deck (`/`) and all six product pages (Houses, Plant, Truck,
Communities, Simulation, Statistics). Not every rule fits every page equally; use judgment,
but check each one seriously before deciding it doesn't apply, and say so explicitly if you
skip one.

1. **One screen, zero scroll.** Every page (and every tab within it, if tabbed) must fit at
   1366×768 with no page-level vertical scroll. A small, deliberate internal scroll region
   within one tab's own content is acceptable only as a last resort for a genuinely long list
   (e.g. 25 households) — never a page-level scrollbar. Verify with Playwright:
   `document.documentElement.scrollHeight <= window.innerHeight`, and also check
   `scrollWidth <= innerWidth` explicitly — a horizontal clip inside a narrow grid column
   won't show up in a page-level vertical-scroll check alone.

2. **Components, not summaries.** Don't shorten prose to make it fit — replace
   prose-communicated facts with real UI components (badges, pills, big-number KPIs, icons).
   Move "why"/background explanation behind a small "i" `InfoIcon` popover
   (`src/components/InfoIcon.tsx`) rather than leaving it as an always-visible sentence.

3. **Big-number KPIs over walls of small stats.** For the single most important operational
   question a page/tab answers (e.g. "how many drivers do we need vs. have," "is this
   household's water OK, and for how long"), show ONE big, bold number/state as the visual
   anchor — not a dense grid of small-caps labels and numbers competing for attention.

4. **Icons over text where an icon reads faster.** Status/category info should lean on
   icon+color, with text reserved for what can't be conveyed visually.

5. **Guided structure, not scattered controls.** If a page has tabs, they are the primary way
   to explore it — the tab bar should read as an inviting, ordered path through the
   information (sensible order, clear labels), not one control among many equally-weighted
   competing controls.

6. **Hide developer/testing-only parameters.** Anything that exists for internal
   testing/tuning rather than for a demo viewer (timing knobs, sim-speed controls, debug
   toggles) belongs behind a small hidden "dev panel" — a small gear-icon button that reveals
   a floating panel (see the deck's Household Reading slide for the reference
   implementation, in `DeckBody.tsx`/`deckMarkup.ts`/`deck.css`) — not exposed inline in the
   main UI.

7. **Reduce repetitive/duplicated chrome.** Don't repeat a long, near-identical bordered
   card/badge per item when a compact indicator (dot/chip + short label) would do just as
   well. Reserve full text/full card treatment for genuinely distinct content.

8. **Never fabricate data.** Every number must trace to the real formulas/data already in
   `src/lib/*.ts` or the real result JSON files (`src/data/*.json`), or be clearly labeled
   illustrative. If you add a new KPI, compute it from data that's already real in this
   codebase — never invent a placeholder number to fill a slot.

9. **Nothing deleted.** Every control, stat, and piece of information that exists today must
   remain reachable after a redesign — this is about presentation and organization, not
   cutting capability.

10. **Correct status escalation.** A badge's color/label must never contradict a more
    specific forecast/detail shown right next to it (see `src/lib/tankForecast.ts`'s
    `displayStatusForForecast` for the established pattern).

11. **Light and dark mode both.** Use the CSS custom properties (`var(--teal)`, `var(--gold)`,
    `var(--danger)`, `var(--green)`, `var(--ink)`, `var(--ink-soft)`, etc.) — never hardcode
    colors — and verify both render well.

## Process that goes with these rules

- Work is done via parallel subagents, one page/file per agent, with strict file-ownership
  (never let two agents edit the same file at once).
- Every subagent must verify its own work with Playwright (screenshots, scroll checks,
  functional exercise of every control it touched) before reporting done — visual claims
  need a screenshot, not just a description.
- The orchestrating session independently re-verifies every subagent's report with its own
  Playwright pass before committing/shipping — never trust a subagent's self-report alone.
- Gate before shipping: `npx tsc --noEmit` and `npx eslint .` clean, a real
  `next build` + `next start` production-mode check (dev-mode alone has missed real bugs,
  e.g. a hydration mismatch that only appeared in production and only across a real
  cross-timezone client/server split), then commit, push, `vercel deploy --prod`, and a final
  check against the live URL.
