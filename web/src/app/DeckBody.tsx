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
        // Challenges slide "i" buttons: click toggles the adjacent floating
        // popover open/closed (same idea as the live product pages' InfoIcon
        // component, reimplemented in plain DOM here since this markup is
        // static HTML, not React). Only one open at a time; clicking outside
        // or hitting Escape closes whatever's open.
        function closeAll() {
          document.querySelectorAll<HTMLElement>(".ch-info-pop.open").forEach((p) => p.classList.remove("open"));
          document.querySelectorAll<HTMLElement>(".ch-info-btn.open").forEach((b) => {
            b.classList.remove("open");
            b.setAttribute("aria-expanded", "false");
          });
        }
        document.addEventListener("click", function (e) {
          const target = e.target as HTMLElement;
          const btn = target.closest<HTMLElement>(".ch-info-btn");
          if (btn) {
            const pop = btn.nextElementSibling as HTMLElement | null;
            const wasOpen = btn.classList.contains("open");
            closeAll();
            if (!wasOpen && pop) {
              pop.classList.add("open");
              btn.classList.add("open");
              btn.setAttribute("aria-expanded", "true");
            }
            return;
          }
          if (!target.closest(".ch-info-pop")) closeAll();
        });
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape") closeAll();
        });
      })();

      (function () {
        // Household Reading slide: each tank's fill rect animates continuously
        // via its own SVG <animate> loop (declarative, always running, same
        // idiom as the "Can The Sensor Freeze" slide's tank). This block only
        // reads back the level that loop is CURRENTLY rendering (via getBBox,
        // which reflects the live SMIL-animated value, not the static base
        // attribute) and feeds it through the same real formulas the live
        // Houses page uses, so the on-slide percentage, days-remaining
        // caption, fill color, and recommended-action tags all stay
        // truthfully in sync with whatever the loop is showing at that
        // instant - and with whatever the settings panel below is currently
        // set to.
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
        const actionsEl = document.getElementById("hrActions");
        const houseMetaEl = document.getElementById("hrHouseMeta");

        // Mutable "current parameters" the settings panel below tunes live -
        // seeded from the named constants at the top of this file. tick()
        // always reads these (never the constants directly) so a panel change
        // is picked up by the very next tick.
        let paramHouseholdSize = HR_HOUSEHOLD_SIZE;
        let paramTankCapacityL = HR_TANK_CAPACITY_L;
        let paramSewageFillRate = HR_SEWAGE_FILL_RATE_PCT_PER_DAY;
        let paramTempC = FALLBACK_TEMP_C;

        function pctFromRect(rect: SVGRectElement): number {
          const h = rect.getBBox().height;
          return Math.max(0, Math.min(100, (h / HR_TANK_FULL_PX) * 100));
        }
        function badgeClass(variant: StatusResult["variant"]): string {
          return variant === "medium" ? "med" : variant;
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

          const remainingL = (waterPct / 100) * paramTankCapacityL;
          const waterFc = waterForecastFromRemainingL(remainingL, paramHouseholdSize, paramTempC);
          const sewageFc = sewageForecastFromPct(sewagePct, paramSewageFillRate);
          const potFc = potabilityForecastFromResidual(residualMgL, paramTempC);
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

          // Recommended-actions pills, replacing the old single worst-of-three
          // badge: derived from the SAME escalated variants already computed
          // above for each tank's own color/label (not a separately-invented
          // check), so the tags are always a truthful, non-redundant summary
          // of what a dispatcher would do next. Water+sewage collapse into one
          // "SEND DRIVER" catch-all only when BOTH are genuinely urgent at
          // once, rather than showing two overlapping tank-specific tags.
          const waterUrgent = qtyDisp.variant !== "low";
          const sewageUrgent = sewDisp.variant !== "low";
          const tags: { text: string; variant: StatusResult["variant"] }[] = [];
          if (waterUrgent && sewageUrgent) {
            tags.push({ text: "Send driver", variant: RANK[qtyDisp.variant] >= RANK[sewDisp.variant] ? qtyDisp.variant : sewDisp.variant });
          } else if (waterUrgent) {
            tags.push({ text: "Send water", variant: qtyDisp.variant });
          } else if (sewageUrgent) {
            tags.push({ text: "Send sewage", variant: sewDisp.variant });
          }
          if (qualityDisp.variant === "high") {
            tags.push({ text: "Boil water", variant: "high" });
          } else if (qualityDisp.variant === "medium") {
            tags.push({ text: "Potability check", variant: "medium" });
          }
          if (actionsEl) {
            actionsEl.innerHTML = tags.length
              ? tags.map((t) => `<span class="badge ${badgeClass(t.variant)}">${t.text}</span>`).join("")
              : `<span class="hr-actions-empty">No action needed</span>`;
          }
        }
        tick();
        const id = setInterval(tick, 200);
        // Not cleaned up on unmount: this deck body is mounted exactly once
        // per page load (guarded by ref.current.dataset.mounted above) and
        // lives for the life of the /deck page, same as the other IIFEs here.
        void id;

        // Settings panel: same open/close idiom as the Challenges slide's
        // info-icon popovers (the IIFE above this one) - a gear button toggles
        // a small panel; outside click or Escape closes it. Every input feeds
        // one of the paramX mutable variables tick() reads above, and calls
        // tick() immediately so the change is visible without waiting for the
        // next 200ms poll.
        const settingsBtn = document.getElementById("hrSettingsBtn") as HTMLButtonElement | null;
        const settingsPanel = document.getElementById("hrSettingsPanel");
        const sizeInput = document.getElementById("hrHouseholdSize") as HTMLInputElement | null;
        const sizeVal = document.getElementById("hrHouseholdSizeVal");
        const capInput = document.getElementById("hrTankCap") as HTMLInputElement | null;
        const capVal = document.getElementById("hrTankCapVal");
        const rateInput = document.getElementById("hrSewageRate") as HTMLInputElement | null;
        const rateVal = document.getElementById("hrSewageRateVal");
        const freezeToggle = document.getElementById("hrFreezeToggle") as HTMLInputElement | null;

        function closeSettings() {
          settingsPanel?.classList.remove("open");
          settingsBtn?.classList.remove("open");
          settingsBtn?.setAttribute("aria-expanded", "false");
        }
        if (settingsBtn && settingsPanel) {
          settingsBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            const wasOpen = settingsPanel.classList.contains("open");
            if (wasOpen) {
              closeSettings();
              return;
            }
            settingsPanel.classList.add("open");
            settingsBtn.classList.add("open");
            settingsBtn.setAttribute("aria-expanded", "true");
          });
        }
        document.addEventListener("click", function (e) {
          const target = e.target as HTMLElement;
          if (!target.closest("#hrSettingsPanel") && !target.closest("#hrSettingsBtn")) closeSettings();
        });
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape") closeSettings();
        });

        function updateHouseMeta() {
          if (houseMetaEl) houseMetaEl.textContent = `${paramHouseholdSize} people · ${paramTankCapacityL}L cistern`;
        }
        if (sizeInput) {
          sizeInput.addEventListener("input", function () {
            paramHouseholdSize = +sizeInput.value;
            if (sizeVal) sizeVal.textContent = `${paramHouseholdSize} people`;
            updateHouseMeta();
            tick();
          });
        }
        if (capInput) {
          capInput.addEventListener("input", function () {
            paramTankCapacityL = +capInput.value;
            if (capVal) capVal.textContent = `${paramTankCapacityL} L`;
            updateHouseMeta();
            tick();
          });
        }
        if (rateInput) {
          rateInput.addEventListener("input", function () {
            paramSewageFillRate = +rateInput.value;
            if (rateVal) rateVal.textContent = `${paramSewageFillRate}%/day`;
            tick();
          });
        }
        if (freezeToggle) {
          freezeToggle.addEventListener("change", function () {
            // FREEZE_DRIP_THRESHOLD_C is -30C (model.ts) - anything at/below it
            // engages the real FREEZE_DRIP_MULTIPLIER path in
            // waterForecastFromRemainingL (taps left dripping burns extra
            // water, so days-remaining drops) while also slowing the chlorine
            // decay rate in potabilityForecastFromResidual (colder = slower
            // reaction, via the same Q10 term chlorineRateConstant uses) - two
            // real, independently-verifiable effects from one toggle.
            paramTempC = freezeToggle.checked ? -32 : FALLBACK_TEMP_C;
            tick();
          });
        }
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
