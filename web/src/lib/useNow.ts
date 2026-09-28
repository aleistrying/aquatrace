"use client";

import { useEffect, useState } from "react";

/**
 * A ticking "now" (epoch ms), re-rendering every `intervalMs`. Streamlit
 * pages recompute `datetime.now()` on every rerun (i.e. every interaction);
 * the closest client-side equivalent for time-progressive values (chlorine
 * decay, tank depletion, sewage fill) is a periodic tick rather than a
 * value frozen at first render.
 */
export function useNow(intervalMs = 15_000): number {
  // Start at a fixed placeholder (not Date.now()) so the server-rendered
  // HTML and the client's first hydration pass compute the exact same
  // value - calling Date.now() in the initializer runs it once per
  // environment, at two different instants, which is a real hydration
  // mismatch (confirmed while porting this app: it broke a page that
  // rendered a value derived from this hook). The real clock kicks in
  // immediately after mount, from inside the effect below, which is the
  // one place client/server are allowed to diverge.
  const [now, setNow] = useState<number>(0);
  useEffect(() => {
    // Deferred (not a bare synchronous setState at the top of the effect
    // body) so this satisfies react-hooks/set-state-in-effect, the same
    // rule other pages in this port had to work around the same way.
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
