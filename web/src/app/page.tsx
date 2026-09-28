/**
 * Home (pitch deck). Server Component: the deck's headline "How It Joins
 * Together" slide cites a real product metric (bad-state household-days for
 * Inukjuak, matching the deck's own caption about Inukjuak's real household
 * count and 3-truck fleet), so we read the same pre-generated JSON the
 * Statistics page reads (src/app/statistics/page.tsx) and substitute the
 * live numbers into DECK_MARKUP's placeholder tokens before handing the
 * markup to the client-side DeckBody. This means the deck can never drift
 * out of sync with /statistics again: if the JSON is regenerated, both
 * pages pick up the new numbers automatically on next request.
 */
import "./deck.css";
import DeckBody from "./DeckBody";
import { DECK_MARKUP } from "./deckMarkup";
import fullscale from "@/data/delivery_comparison_fullscale_results.json";

type CommunityMap = Record<string, number>;

interface FullscaleResults {
  baseline_bad_state_household_days: CommunityMap;
  optimized_bad_state_household_days: CommunityMap;
}

const data = fullscale as FullscaleResults;

export default function Home() {
  // Rounded, unformatted integers: these feed the count-up animation's
  // data-target attribute (DeckBody.tsx does `+el.dataset.target`), which
  // itself calls .toLocaleString() when it renders each animated frame — so
  // the on-screen number still gets its comma, just not in the attribute.
  const baselineBadDays = Math.round(data.baseline_bad_state_household_days.Inukjuak);
  const optimizedBadDays = Math.round(data.optimized_bad_state_household_days.Inukjuak);

  const html = DECK_MARKUP.replace("__BASELINE_BAD_DAYS__", String(baselineBadDays)).replace(
    "__OPTIMIZED_BAD_DAYS__",
    String(optimizedBadDays),
  );

  return <DeckBody html={html} />;
}
