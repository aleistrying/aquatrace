"use client";
import { useEffect, useRef } from "react";
import {
  FALLBACK_TEMP_C,
  POTABILITY_REFERENCE_MGL,
  RANK,
  qualityStatus,
  sewageStatus,
  waterQuantityStatus,
  type StatusResult,
} from "@/lib/model";
import {
  displayStatusForForecast,
  potabilityForecastFromResidual,
  sewageForecastFromPct,
  waterForecastFromRemainingL,
} from "@/lib/tankForecast";
import { LEVEL_BAR_COLOR } from "@/components/TankSvg";

// Plausible, fixed inputs for the "Household Reading" slide's illustrative
// INU-102 example (7 people, 1800L cistern, per the slide's own caption) -
// only the fill LEVEL is animated (via each tank's own SVG <animate> loop);
// every number derived from it below runs through the same real formulas
// as the live Houses page (src/lib/model.ts, src/lib/tankForecast.ts).
const HR_HOUSEHOLD_SIZE = 7;
const HR_TANK_CAPACITY_L = 1800;
const HR_SEWAGE_FILL_RATE_PCT_PER_DAY = 7;
const HR_TANK_FULL_PX = 112;

export default function DeckBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && !ref.current.dataset.mounted) {
      ref.current.innerHTML = html;
      ref.current.dataset.mounted = "1";

      (function () {
        const slides = [...document.querySelectorAll<HTMLElement>(".slide")];
        const n = slides.length;
        let cur = 0;
        const dotsWrap = document.getElementById("dots");
        slides.forEach(function (_, i) {
          const b = document.createElement("button");
          b.addEventListener("click", function () {
            go(i);
          });
          dotsWrap?.appendChild(b);
        });
        const dots = [...(dotsWrap?.children ?? [])];
        const pbar = document.getElementById("pbar");
        const numEl = document.getElementById("slidenum");
        const btnPrev = document.getElementById("btnPrev") as HTMLButtonElement | null;
        const btnNext = document.getElementById("btnNext") as HTMLButtonElement | null;

        function render() {
          slides.forEach(function (s, i) {
            s.classList.toggle("active", i === cur);
            s.classList.toggle("prev", i < cur);
          });
          dots.forEach(function (d, i) {
            d.classList.toggle("active", i === cur);
          });
          if (pbar) pbar.style.width = ((cur + 1) / n) * 100 + "%";
          if (numEl) numEl.textContent = cur + 1 + " / " + n;
          if (btnPrev) btnPrev.disabled = cur === 0;
          if (btnNext) btnNext.disabled = cur === n - 1;
        }
        function go(i: number) {
          if (i < 0 || i >= n) return;
          cur = i;
          render();
          if (slides[cur].querySelector("#tankrow")) {
            setTimeout(function () {
              slides[cur].querySelectorAll<HTMLElement>(".tank-fill-rect").forEach(function (r) {
                const p = +(r.dataset.h ?? "0");
                const full = 112;
                const bottom = 144;
                const h = (full * p) / 100;
                r.setAttribute("height", String(h));
                r.setAttribute("y", String(bottom - h));
              });
            }, 250);
          }
          const bigNums = slides[cur].querySelectorAll<HTMLElement>(".compare .big[data-target]");
          if (bigNums.length) {
            bigNums.forEach(function (el) {
              const target = +(el.dataset.target ?? "0");
              const dur = 1100;
              let start: number | null = null;
              el.textContent = "0";
              function step(ts: number) {
                if (!start) start = ts;
                const p = Math.min((ts - start) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(target * eased).toLocaleString();
                if (p < 1) requestAnimationFrame(step);
              }
              setTimeout(function () {
                requestAnimationFrame(step);
              }, 200);
            });
          }
        }
        btnPrev?.addEventListener("click", function () {
          go(cur - 1);
        });
        btnNext?.addEventListener("click", function () {
          go(cur + 1);
        });
        window.addEventListener("keydown", function (e) {
          if (e.key === "ArrowRight" || e.key === " ") go(cur + 1);
          if (e.key === "ArrowLeft") go(cur - 1);
        });
        let touchX: number | null = null;
        document.addEventListener("touchstart", function (e) {
          touchX = e.touches[0].clientX;
        });
        document.addEventListener("touchend", function (e) {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (dx > 50) go(cur - 1);
          else if (dx < -50) go(cur + 1);
          touchX = null;
        });
        render();
      })();

      (function () {
        // batch-queue diagram: swap the SVG viewBox between the wide desktop row
        // layout and the narrow mobile stacked-column layout (CSS handles which
        // group of elements is visible; this just matches the coordinate space).
        const bqSvg = document.querySelector(".bq-svg");
        if (!bqSvg) return;
        const svg = bqSvg;
        const mq = window.matchMedia("(max-width:640px)");
        function setViewBox() {
          svg.setAttribute("viewBox", mq.matches ? "0 0 320 780" : "0 0 1240 340");
        }
        setViewBox();
        mq.addEventListener("change", setViewBox);
      })();

      (function () {
        // Household Reading slide: each tank's fill rect animates continuously
        // via its own SVG <animate> loop (declarative, always running, same
        // idiom as the "Can The Sensor Freeze" slide's tank). This block only
        // reads back the level that loop is CURRENTLY rendering (via getBBox,
        // which reflects the live SMIL-animated value, not the static base
        // attribute) and feeds it through the same real formulas the live
        // Houses page uses, so the on-slide percentage, days-remaining
        // caption, fill color, and headline badge all stay truthfully in
        // sync with whatever the loop is showing at that instant.
        const waterRectMaybe = document.querySelector<SVGRectElement>('.tank-fill-rect[data-tank="water"]');
        const sewageRectMaybe = document.querySelector<SVGRectElement>('.tank-fill-rect[data-tank="sewage"]');
        const potRectMaybe = document.querySelector<SVGRectElement>('.tank-fill-rect[data-tank="potability"]');
        if (!waterRectMaybe || !sewageRectMaybe || !potRectMaybe) return;
        const waterRect = waterRectMaybe;
        const sewageRect = sewageRectMaybe;
        const potRect = potRectMaybe;
        const waterPctEl = document.getElementById("hrWaterPct");
        const waterForecastEl = document.getElementById("hrWaterForecast");
        const sewagePctEl = document.getElementById("hrSewagePct");
        const sewageForecastEl = document.getElementById("hrSewageForecast");
        const potPctEl = document.getElementById("hrPotPct");
        const potForecastEl = document.getElementById("hrPotForecast");
        const badgeEl = document.getElementById("hrBadge") as HTMLElement | null;

        function pctFromRect(rect: SVGRectElement): number {
          const h = rect.getBBox().height;
          return Math.max(0, Math.min(100, (h / HR_TANK_FULL_PX) * 100));
        }
        function badgeClass(variant: StatusResult["variant"]): string {
          return variant === "medium" ? "med" : variant;
        }
        function worstOf(...results: StatusResult[]): StatusResult {
          let best = results[0];
          for (const r of results) if (RANK[r.variant] > RANK[best.variant]) best = r;
          return best;
        }

        function tick() {
          const waterPct = pctFromRect(waterRect);
          const sewagePct = pctFromRect(sewageRect);
          const potPct = pctFromRect(potRect);
          const residualMgL = (potPct / 100) * POTABILITY_REFERENCE_MGL;

          const qty = waterQuantityStatus(waterPct);
          const sew = sewageStatus(sewagePct);
          const quality = qualityStatus(residualMgL);

          if (waterPctEl) waterPctEl.textContent = `${Math.round(waterPct)}%`;
          if (sewagePctEl) sewagePctEl.textContent = `${Math.round(sewagePct)}%`;
          if (potPctEl) potPctEl.textContent = `${Math.round(potPct)}%`;

          const remainingL = (waterPct / 100) * HR_TANK_CAPACITY_L;
          const waterFc = waterForecastFromRemainingL(remainingL, HR_HOUSEHOLD_SIZE, FALLBACK_TEMP_C);
          const sewageFc = sewageForecastFromPct(sewagePct, HR_SEWAGE_FILL_RATE_PCT_PER_DAY);
          const potFc = potabilityForecastFromResidual(residualMgL, FALLBACK_TEMP_C);
          if (waterForecastEl) waterForecastEl.textContent = waterFc.text;
          if (sewageForecastEl) sewageForecastEl.textContent = sewageFc.text;
          if (potForecastEl) potForecastEl.textContent = potFc.text;

          // Escalate the displayed color AND label (not the underlying %
          // status) when the days-remaining caption is itself urgent, so a
          // tank never shows a reassuring green "Tank OK" right next to an
          // alarming "~9 hrs until empty" - see tankForecast.ts's
          // displayStatusForForecast. Only swaps wording in when the days
          // check actually makes things worse than the % status already
          // says, so a household's own more-specific real label is never
          // needlessly overwritten.
          const qtyDisp = displayStatusForForecast("water", qty.variant, qty.label, waterFc.soonestDays);
          const sewDisp = displayStatusForForecast("sewage", sew.variant, sew.label, sewageFc.days);
          const qualityDisp = displayStatusForForecast("potability", quality.variant, quality.label, potFc.days);

          waterRect.style.fill = LEVEL_BAR_COLOR[qtyDisp.variant];
          sewageRect.style.fill = LEVEL_BAR_COLOR[sewDisp.variant];
          potRect.style.fill = LEVEL_BAR_COLOR[qualityDisp.variant];

          if (badgeEl) {
            const worst = worstOf(
              { ...qty, ...qtyDisp },
              { ...sew, ...sewDisp },
              { ...quality, ...qualityDisp },
            );
            badgeEl.textContent = worst.label;
            badgeEl.className = `badge ${badgeClass(worst.variant)}`;
          }
        }
        tick();
        const id = setInterval(tick, 200);
        // Not cleaned up on unmount: this deck body is mounted exactly once
        // per page load (guarded by ref.current.dataset.mounted above) and
        // lives for the life of the /deck page, same as the other IIFEs here.
        void id;
      })();

      (function () {
        // Finale -> live product hand-off: play a brief full-screen "opening"
        // transition before navigating, instead of an instant page swap.
        // Scoped to this one CTA only (by id, not by href/class) so every
        // other link in the deck - including the other /houses links, the
        // ghost "Full project brief" link, and all arrow-key/dot navigation -
        // is completely unaffected.
        const launchLink = document.getElementById("deckLaunchBtn") as HTMLAnchorElement | null;
        const overlay = document.getElementById("launchTransition");
        if (!launchLink || !overlay) return;
        const TRANSITION_MS = 400;
        let navigating = false;
        launchLink.addEventListener("click", function (e) {
          e.preventDefault();
          if (navigating) return;
          navigating = true;
          const href = launchLink.getAttribute("href") || "/houses";
          const rect = launchLink.getBoundingClientRect();
          const hasClientCoords = e.clientX !== 0 || e.clientY !== 0;
          const x = hasClientCoords ? e.clientX : rect.left + rect.width / 2;
          const y = hasClientCoords ? e.clientY : rect.top + rect.height / 2;
          overlay.style.setProperty("--fj-launch-x", `${x}px`);
          overlay.style.setProperty("--fj-launch-y", `${y}px`);
          overlay.classList.add("active");
          setTimeout(function () {
            window.location.href = href;
          }, TRANSITION_MS);
        });
      })();
    }
  }, [html]);

  return <div ref={ref} style={{ height: "100%" }} />;
}
