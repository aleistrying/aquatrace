export const DECK_MARKUP = `
<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden;" focusable="false">
  <defs>
    <symbol id="icon-plant" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 10.5 L12 4 L20 10.5 V20 H4 Z"/>
      <rect x="9" y="13" width="6" height="5" rx="1"/>
      <path d="M12 4 V1.4" stroke-width="1.4"/>
      <circle cx="12" cy="1.1" r="1" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-truck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.2" y="8" width="12.3" height="8" rx="1.2"/>
      <path d="M14.5 11 H18.3 L21 14.6 V16 H14.5 Z"/>
      <path d="M16.2 12 H18.6" stroke-width="1.3"/>
      <circle cx="7" cy="17.1" r="1.9" fill="currentColor" stroke="none"/>
      <circle cx="17.6" cy="17.1" r="1.9" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-house" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 11 L12 4 L20 11 V20 H4 Z"/>
      <path d="M9.6 20 V14.2 H14.4 V20"/>
    </symbol>
    <symbol id="icon-snowflake" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12,3.8 L12,20.2 M19.1,16.1 L4.9,7.9 M4.9,16.1 L19.1,7.9
               M12,20.2 L13.1,17.84 M12,20.2 L10.9,17.84
               M12,3.8 L10.9,6.16 M12,3.8 L13.1,6.16
               M4.9,7.9 L6.39,10.03 M4.9,7.9 L7.49,8.13
               M19.1,16.1 L17.61,13.97 M19.1,16.1 L16.51,15.87
               M19.1,7.9 L16.51,8.13 M19.1,7.9 L17.61,10.03
               M4.9,16.1 L7.49,15.87 M4.9,16.1 L6.39,13.97"/>
    </symbol>
    <symbol id="icon-signal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="5" cy="16" r="1.7" fill="currentColor" stroke="none"/>
      <path d="M9 12.3 A5.3 5.3 0 0 1 9 19.7"/>
      <path d="M13 8.6 A9.6 9.6 0 0 1 13 23.4"/>
    </symbol>
    <symbol id="icon-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3.6 L21 19.8 H3 Z"/>
      <path d="M12 9.6 V14.2" stroke-width="1.7"/>
      <circle cx="12" cy="16.9" r="1" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-tank" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="6.2" rx="6" ry="2.2"/>
      <path d="M6 6.2 V17.8 A6 2.2 0 0 0 18 17.8 V6.2"/>
      <circle cx="12" cy="4.3" r="0.9" fill="currentColor" stroke="none"/>
    </symbol>
    <symbol id="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4.5 12.5 L9.5 17.5 L19.5 6.5"/>
    </symbol>
    <symbol id="icon-dispatcher" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4.5" width="18" height="12" rx="1.4"/>
      <path d="M9 20 H15 M12 16.5 V20"/>
      <path d="M6.5 9.8 L10 12.8 L13.5 8.8 L17.5 11.8" stroke-width="1.5"/>
    </symbol>
  </defs>
</svg>
<div class="progress"><div class="progress-bar" id="pbar"></div></div>
<div class="slidenum" id="slidenum"></div>
<button class="navbtn prev" id="btnPrev" aria-label="Previous">&#8592;</button>
<button class="navbtn next" id="btnNext" aria-label="Next">&#8594;</button>
<div class="dots" id="dots"></div>
<div class="launch-transition" id="launchTransition" aria-hidden="true"></div>

<div class="deck" id="deck">

  <div class="slide" data-title="AquaTrace">
    <div class="inner" style="text-align:center;">
      <div class="eyebrow reveal" style="justify-content:center;">Hack for Humanity — Ottawa 2026 · Designing for the North</div>
      <h1 class="reveal d1" style="font-size:clamp(2.6rem,7vw,4.4rem);font-weight:600;">AquaTrace</h1>
      <p class="lede reveal d2" style="margin:16px auto 0;">Household-level water &amp; sewage visibility for trucked-water Inuit communities.</p>
      <div class="stat-row reveal d3" style="justify-content:center;">
        <div class="stat"><div class="n">14</div><div class="l">communities on trucked water</div></div>
        <div class="stat"><div class="n">0</div><div class="l">monitoring points after the plant</div></div>
        <div class="stat"><div class="n">~90%</div><div class="l">fewer bad-state days, measured</div></div>
      </div>
      <p class="reveal d3" style="font-size:0.82rem;color:var(--ink-soft);margin-top:14px;">A &ldquo;bad-state day&rdquo; = one day a household's water sat empty or unsafe to drink.</p>
    </div>
  </div>


  <div class="slide" data-title="The Problem">
    <div class="inner">
      <div class="eyebrow reveal">01 &middot; The problem</div>
      <h2 class="reveal d1" style="font-size:clamp(1.6rem,4vw,2.2rem);">Nobody can see the water after it leaves the plant.</h2>
      <p class="lede reveal d2">Inukjuak's own letter to Ottawa: <em>&ldquo;no mandatory water-quality monitoring in trucks, household tanks, or at the tap.&rdquo;</em></p>
      <div class="stat-row reveal d3">
        <div class="stat"><div class="n">~2 wks</div><div class="l">blind-rotation refill cycle, today</div></div>
      </div>
      <p class="reveal d3" style="font-size:0.86rem;color:var(--ink-soft);margin-top:18px;margin-bottom:8px;">Not hypothetical — two real incidents already happened:</p>
      <div class="incident-row reveal d4">
        <div class="incident"><div class="incident-marker"><svg viewBox="0 0 24 24"><use href="#icon-warning"/></svg></div><div><span class="incident-year">2025</span><b>Puvirnituq blizzard crisis</b><span>Medevac needed</span></div></div>
        <div class="incident"><div class="incident-marker"><svg viewBox="0 0 24 24"><use href="#icon-warning"/></svg></div><div><span class="incident-year">2026</span><b>Inukjuak E. coli advisory</b><span>Boil-water order</span></div></div>
      </div>
    </div>
  </div>


  <div class="slide" data-title="The Solution">
    <div class="inner">
      <div class="eyebrow reveal">02 &middot; The solution</div>
      <h2 class="reveal d1" style="font-size:clamp(1.6rem,4vw,2.2rem);">Detect. Communicate. Work. Last.</h2>
      <div class="pillars reveal d2">
        <div class="pillar">
          <div class="sol-vignette"><svg viewBox="0 0 170 64" aria-hidden="true" role="img" aria-label="Three household tank icons, each independently cycling green, gold, and red as their status changes">
            <defs>
              <clipPath id="solMiniClip1"><path d="M8,10 A16,5 0 0 1 40,10 V54 A16,5 0 0 1 8,54 Z"/></clipPath>
              <clipPath id="solMiniClip2"><path d="M65,10 A16,5 0 0 1 97,10 V54 A16,5 0 0 1 65,54 Z"/></clipPath>
              <clipPath id="solMiniClip3"><path d="M122,10 A16,5 0 0 1 154,10 V54 A16,5 0 0 1 122,54 Z"/></clipPath>
            </defs>
            <path class="sol-mini-outline" d="M8,10 A16,5 0 0 1 40,10 V54 A16,5 0 0 1 8,54 Z"/>
            <path class="sol-mini-outline" d="M65,10 A16,5 0 0 1 97,10 V54 A16,5 0 0 1 65,54 Z"/>
            <path class="sol-mini-outline" d="M122,10 A16,5 0 0 1 154,10 V54 A16,5 0 0 1 122,54 Z"/>
            <g clip-path="url(#solMiniClip1)"><rect class="sol-mini-fill h1" x="8" y="10" width="32" height="44"/></g>
            <g clip-path="url(#solMiniClip2)"><rect class="sol-mini-fill h2" x="65" y="10" width="32" height="44"/></g>
            <g clip-path="url(#solMiniClip3)"><rect class="sol-mini-fill h3" x="122" y="10" width="32" height="44"/></g>
            <path class="sol-mini-stroke" d="M8,10 A16,5 0 0 1 40,10 V54 A16,5 0 0 1 8,54 Z"/>
            <path class="sol-mini-stroke" d="M65,10 A16,5 0 0 1 97,10 V54 A16,5 0 0 1 65,54 Z"/>
            <path class="sol-mini-stroke" d="M122,10 A16,5 0 0 1 154,10 V54 A16,5 0 0 1 122,54 Z"/>
          </svg></div>
          <div class="glyph">Detect</div><h3>Real measurement</h3><p>Chlorine decay + tank volume + sewage capacity, per household.</p>
        </div>
        <div class="pillar">
          <div class="sol-vignette"><svg viewBox="0 0 160 64" aria-hidden="true">
            <circle class="sol-status-dot" cx="80" cy="32" r="11"/>
            <circle class="sol-status-ring" cx="80" cy="32" r="17"/>
          </svg></div>
          <div class="glyph">Communicate</div><h3>One glance</h3><p>Chemistry becomes green / yellow / red.</p>
        </div>
        <div class="pillar">
          <div class="sol-vignette"><svg viewBox="0 0 160 64" aria-hidden="true">
            <circle cx="46" cy="32" r="2.6" fill="var(--teal)"/>
            <path class="sol-arc a" d="M52 26 A8 8 0 0 1 52 38" fill="none" stroke="var(--teal)" stroke-width="2.4" stroke-linecap="round"/>
            <path class="sol-arc b" d="M60 20 A15 15 0 0 1 60 44" fill="none" stroke="var(--teal)" stroke-width="2.4" stroke-linecap="round"/>
            <path class="sol-arc c" d="M68 14 A22 22 0 0 1 68 50" fill="none" stroke="var(--teal)" stroke-width="2.4" stroke-linecap="round"/>
            <use href="#icon-truck" x="96" y="18" width="28" height="28" color="var(--ink-soft)"/>
          </svg></div>
          <div class="glyph">Work</div><h3>No signal needed</h3><p>Trucks check in by radio — the only channel that works in transit.</p>
        </div>
        <div class="pillar">
          <div class="sol-vignette"><svg viewBox="0 0 160 64" aria-hidden="true">
            <use class="sol-check" href="#icon-check" x="40" y="20" width="24" height="24" color="var(--green)"/>
            <use class="sol-truck-move" href="#icon-truck" x="86" y="18" width="28" height="28" color="var(--teal)"/>
          </svg></div>
          <div class="glyph">Last</div><h3>Human decides</h3><p>We flag; a dispatcher sends the truck.</p>
        </div>
      </div>
    </div>
  </div>


  <div class="slide" data-title="The Sensor Network">
    <div class="inner">
      <div class="eyebrow reveal">03 &middot; Every sensor, where it lives</div>
      <h2 class="reveal d1" style="font-size:clamp(1.5rem,3.6vw,2rem);">Three tiers, matched to real connectivity.</h2>
      <div class="sn-network reveal d2">

        <div class="sn-tier">
          <div class="sn-tier-head"><div class="sn-tier-icon sn-tier-icon-plant"><svg viewBox="0 0 24 24"><use href="#icon-plant"/></svg></div><h3>Plant</h3><span class="sn-conn">always connected</span></div>
          <div class="sn-sensor-list">

            <div class="sn-sensor">
              <div class="sn-viz"><svg viewBox="0 0 64 44" aria-hidden="true">
                <path d="M10 34 A22 22 0 0 1 54 34" fill="none" stroke="var(--border)" stroke-width="2"/>
                <circle cx="10" cy="34" r="1.6" fill="var(--ink-soft)"/>
                <circle cx="32" cy="8" r="1.6" fill="var(--ink-soft)"/>
                <circle cx="54" cy="34" r="1.6" fill="var(--ink-soft)"/>
                <circle class="sn-cl-live" cx="58" cy="6" r="2.4"/>
                <g class="sn-cl-needle" style="transform-origin:32px 34px;">
                  <line x1="32" y1="34" x2="32" y2="14" stroke="var(--teal)" stroke-width="2.4" stroke-linecap="round"/>
                </g>
                <circle cx="32" cy="34" r="3" fill="var(--teal)"/>
              </svg></div>
              <div class="sn-text"><b>Chlorine analyzer</b><span>Amperometric, continuous</span></div>
            </div>

            <div class="sn-sensor">
              <div class="sn-viz"><svg viewBox="0 0 64 44" aria-hidden="true">
                <rect class="sn-cal-day d0" x="4"  y="8" width="6" height="6" rx="1.4"/>
                <rect class="sn-cal-day d1" x="12" y="8" width="6" height="6" rx="1.4"/>
                <rect class="sn-cal-day d2" x="20" y="8" width="6" height="6" rx="1.4"/>
                <rect class="sn-cal-day d3" x="28" y="8" width="6" height="6" rx="1.4"/>
                <rect class="sn-cal-day d4" x="36" y="8" width="6" height="6" rx="1.4"/>
                <rect class="sn-cal-day d5" x="44" y="8" width="6" height="6" rx="1.4"/>
                <rect class="sn-cal-day d6" x="52" y="8" width="6" height="6" rx="1.4"/>
                <g class="sn-cal-check">
                  <circle cx="32" cy="30" r="9" fill="var(--green-tint)"/>
                  <use href="#icon-check" x="27" y="25" width="10" height="10" color="var(--green)"/>
                </g>
              </svg></div>
              <div class="sn-text"><b>Coliform test</b><span>Weekly, existing practice</span><span class="sn2-alarm-badge">Positive &rarr; plant-wide boil-water advisory</span></div>
            </div>

          </div>
        </div>

        <div class="sn-tier">
          <div class="sn-tier-head"><div class="sn-tier-icon sn-tier-icon-truck"><svg viewBox="0 0 24 24"><use href="#icon-truck"/></svg></div><h3>Truck</h3><span class="sn-conn">radio only, in transit</span></div>
          <div class="sn-sensor-list">

            <div class="sn-sensor">
              <div class="sn-viz"><svg viewBox="0 0 64 44" aria-hidden="true">
                <line x1="4" x2="60" y1="40" y2="40" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>
                <g class="sn-tank-rattle">
                  <rect x="20" y="4" width="24" height="32" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>
                  <clipPath id="snTankClip"><rect x="20" y="4" width="24" height="32" rx="4"/></clipPath>
                  <g clip-path="url(#snTankClip)">
                    <rect class="sn-tank-liquid" x="20" y="18" width="24" height="18" fill="var(--gold)"/>
                  </g>
                  <line class="sn-tank-levelline" x1="20" x2="44" y1="18" y2="18" stroke="var(--ink)" stroke-width="1.6"/>
                  <rect x="20" y="4" width="24" height="32" rx="4" fill="none" stroke="var(--border)" stroke-width="2"/>
                </g>
              </svg></div>
              <div class="sn-text"><b>Tank level sender</b><span>Vehicle-grade</span></div>
            </div>

            <div class="sn-sensor">
              <div class="sn-viz"><svg viewBox="0 0 64 44" aria-hidden="true">
                <line x1="4" x2="60" y1="26" y2="26" stroke="var(--border)" stroke-width="3" stroke-linecap="round"/>
                <circle class="sn-flow-drop a" cx="4" cy="26" r="2.6" fill="var(--teal)"/>
                <circle class="sn-flow-drop b" cx="4" cy="26" r="2.6" fill="var(--teal)"/>
                <circle class="sn-flow-drop c" cx="4" cy="26" r="2.6" fill="var(--teal)"/>
                <circle cx="32" cy="26" r="12" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>
                <g class="sn-flow-dial" style="transform-origin:32px 26px;">
                  <line x1="32" y1="26" x2="32" y2="17" stroke="var(--teal)" stroke-width="2.2" stroke-linecap="round"/>
                </g>
                <circle cx="32" cy="26" r="2" fill="var(--teal)"/>
              </svg></div>
              <div class="sn-text"><b>Flow meter</b><span>Confirms litres dispensed</span></div>
            </div>

          </div>
          <div class="sn2-fleet-row">
            <span class="sn2-fleet-fact"><b>10,000 L</b> tank capacity</span>
            <span class="sn2-fleet-fact"><b>3 trucks</b> &mdash; Inukjuak&rsquo;s documented fleet</span>
            <span class="sn2-fleet-fact">Water delivery &amp; sewage pump-out are separate vehicles</span>
          </div>
        </div>

        <div class="sn-tier">
          <div class="sn-tier-head"><div class="sn-tier-icon sn-tier-icon-house"><svg viewBox="0 0 24 24"><use href="#icon-house"/></svg></div><h3>Household</h3><span class="sn-conn">connected at the house</span></div>
          <div class="sn-sensor-list">

            <div class="sn-sensor">
              <div class="sn-viz"><svg viewBox="0 0 64 44" aria-hidden="true">
                <rect x="26" y="2" width="12" height="6" rx="2" fill="var(--ink-soft)"/>
                <path d="M27,8 L37,8 L32,15 Z" fill="var(--ink-soft)"/>
                <path d="M22 9 L32 32 L42 9" fill="none" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="2 2" opacity="0.5"/>
                <line x1="10" x2="54" y1="34" y2="34" stroke="var(--teal)" stroke-width="2" opacity="0.55"/>
                <ellipse class="sn-son-ripple" cx="32" cy="34" rx="4" ry="1.4"/>
                <rect class="sn-son-ping p1" x="29" y="10" width="6" height="8" rx="2"/>
                <rect class="sn-son-ping p2" x="29" y="10" width="6" height="8" rx="2"/>
                <rect class="sn-son-ping p3" x="29" y="10" width="6" height="8" rx="2"/>
              </svg></div>
              <div class="sn-text"><b>Ultrasonic level</b><span>Same class as the real Kuujjuaq pilot</span></div>
            </div>

            <div class="sn-sensor">
              <div class="sn-viz"><svg viewBox="0 0 64 44" aria-hidden="true">
                <defs><clipPath id="snDropClip"><path d="M32,4 C40,16 46,24 46,31 A14,14 0 0 1 18,31 C18,24 24,16 32,4 Z"/></clipPath></defs>
                <path d="M32,4 C40,16 46,24 46,31 A14,14 0 0 1 18,31 C18,24 24,16 32,4 Z" fill="var(--surface-raised)" stroke="var(--border)" stroke-width="2"/>
                <g clip-path="url(#snDropClip)">
                  <rect class="sn-vial-fill" x="16" y="10" width="32" height="28"/>
                </g>
                <path d="M32,4 C40,16 46,24 46,31 A14,14 0 0 1 18,31 C18,24 24,16 32,4 Z" fill="none" stroke="var(--border)" stroke-width="2"/>
              </svg></div>
              <div class="sn-text"><b>Chlorine + turbidity</b><span>No reagents to freeze</span></div>
            </div>

            <div class="sn-sensor">
              <div class="sn-viz"><svg viewBox="0 0 64 44" aria-hidden="true">
                <rect x="28" y="2" width="12" height="8" rx="2" fill="var(--surface)" stroke="var(--border)" stroke-width="1.6"/>
                <circle class="sn-float-contact" cx="34" cy="6" r="1.8"/>
                <line x1="6" x2="62" y1="38" y2="38" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/>
                <g class="sn-float-arm" style="transform-origin:34px 10px;">
                  <line x1="34" y1="10" x2="34" y2="30" stroke="var(--ink-soft)" stroke-width="2" stroke-linecap="round"/>
                  <circle class="sn-float-ball" cx="34" cy="30" r="6"/>
                </g>
              </svg></div>
              <div class="sn-text"><b>Sewage float switch</b><span>Handles an outdoor tank</span></div>
            </div>

            <div class="sn-sensor">
              <div class="sn-viz"><svg viewBox="0 0 64 44" aria-hidden="true">
                <path d="M4,38 H26 Q30,38 30,34 V27" stroke="var(--ink-soft)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="4" cy="38" r="2.4" fill="var(--ink-soft)"/>
                <circle class="sn-btn-ripple" cx="40" cy="20" r="10"/>
                <circle cx="40" cy="20" r="11" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>
                <circle class="sn-btn-cap" cx="40" cy="20" r="7" stroke="var(--teal)" stroke-width="1.6"/>
              </svg></div>
              <div class="sn-text"><b>Backup button</b><span>No sensor yet? Wired, no battery</span></div>
            </div>

          </div>
        </div>

      </div>
      <a class="deck-live-link reveal d3" href="/houses">See real per-household sensor data &rarr;</a>
    </div>
  </div>


  <div class="slide" data-title="Challenges &amp; Solutions">
    <div class="inner">
      <div class="eyebrow reveal">04 &middot; Challenges &amp; how we address them</div>
      <h2 class="reveal d1" style="font-size:clamp(1.5rem,3.6vw,2rem);">Real problems, real fixes — not hand-waved.</h2>
      <div class="ch-list reveal d2">

        <div class="ch-item">
          <div class="ch-head"><div class="ch-icon teal"><svg viewBox="0 0 24 24"><use href="#icon-snowflake"/></svg></div><h3>−49°C to −60°C ambient</h3></div>
          <div class="ch-row">
            <div class="ch-vis">
              <svg viewBox="0 0 200 100" role="img" aria-label="An indoor buffer tank stays warm and steady while, across a wall, the outside air sits far below freezing and frost forms on the panel.">
                <rect x="2" y="6" width="88" height="88" rx="10" fill="var(--teal-tint)" stroke="var(--border)" stroke-width="1.5"/>
                <rect x="92" y="2" width="14" height="96" rx="3" fill="var(--surface-raised)" stroke="var(--border)" stroke-width="1.5"/>
                <line x1="95" y1="14" x2="103" y2="22" stroke="var(--border)" stroke-width="1.2"/>
                <line x1="95" y1="30" x2="103" y2="38" stroke="var(--border)" stroke-width="1.2"/>
                <line x1="95" y1="46" x2="103" y2="54" stroke="var(--border)" stroke-width="1.2"/>
                <rect x="108" y="6" width="90" height="88" rx="10" fill="var(--green-tint)" stroke="var(--border)" stroke-width="1.5"/>
                <text x="46" y="18" text-anchor="middle" class="ch-label" fill="var(--ink-soft)">OUTSIDE</text>
                <text x="153" y="18" text-anchor="middle" class="ch-label" fill="var(--ink-soft)">INSIDE</text>
                <use class="ch-frost f1" href="#icon-snowflake" x="10" y="50" width="17" height="17" color="var(--teal)"/>
                <use class="ch-frost f2" href="#icon-snowflake" x="58" y="58" width="14" height="14" color="var(--teal)"/>
                <use class="ch-frost f3" href="#icon-snowflake" x="28" y="74" width="13" height="13" color="var(--teal)"/>
                <text x="46" y="44" text-anchor="middle" class="ch-temp" fill="var(--danger)">&minus;55&deg;C</text>
                <circle class="ch-warm-glow" cx="153" cy="55" r="32" fill="var(--gold)"/>
                <rect x="138" y="34" width="30" height="42" rx="7" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>
                <rect x="141" y="52" width="24" height="21" rx="4" fill="var(--teal)" opacity="0.85"/>
                <circle class="ch-steady-dot" cx="184" cy="16" r="3.5"/>
                <text x="153" y="90" text-anchor="middle" class="ch-temp" fill="var(--green)">+15&deg;C</text>
              </svg>
            </div>
            <p class="ch-fact">Wetted sensors stay indoors, heated — they never see outside air.<span class="ch-info-wrap"><button type="button" class="ch-info-btn" aria-label="Why this works">i</button><span class="ch-info-pop" role="tooltip">Specs rate to −10°C, but that's <em>process fluid</em>, not outside air — wetted sensors sit in an indoor, liquid-buffered tank and never see it. Electronics get a heated enclosure — a standard cold-climate instrumentation practice.</span></span></p>
          </div>
        </div>

        <div class="ch-item">
          <div class="ch-head"><div class="ch-icon gold"><svg viewBox="0 0 24 24"><use href="#icon-tank"/></svg></div><h3>The sewage tank is outside, and plastic</h3></div>
          <div class="ch-row">
            <div class="ch-vis">
              <svg viewBox="0 0 200 100" role="img" aria-label="An outdoor plastic tank shown with dashed, exposed walls; a heat-traced cable runs down its side with a warm glowing pulse traveling along it on a loop, plus a static manual sight-gauge as backup.">
                <use href="#icon-snowflake" x="4" y="76" width="14" height="14" color="var(--ink-soft)" opacity="0.55"/>
                <text x="21" y="87" text-anchor="start" class="ch-label" fill="var(--ink-soft)">&minus;55&deg;C AMBIENT</text>
                <ellipse cx="118" cy="18" rx="26" ry="8" fill="var(--surface-raised)" stroke="var(--border)" stroke-width="2" stroke-dasharray="4 3"/>
                <path d="M92,18 V78 A26,8 0 0 0 144,78 V18" fill="var(--surface-raised)" stroke="var(--border)" stroke-width="2" stroke-dasharray="4 3"/>
                <rect x="60" y="4" width="20" height="10" rx="2" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
                <path id="chHeatPath" d="M70,14 C58,14 58,26 70,26 C82,26 82,38 70,38 C58,38 58,50 70,50 C82,50 82,62 70,62 C58,62 58,74 70,74 C82,74 82,84 74,86"
                  fill="none" stroke="var(--border)" stroke-width="2.6" stroke-linecap="round"/>
                <path class="ch-heat-flow" d="M70,14 C58,14 58,26 70,26 C82,26 82,38 70,38 C58,38 58,50 70,50 C82,50 82,62 70,62 C58,62 58,74 70,74 C82,74 82,84 74,86"/>
                <circle class="ch-heat-halo" r="8">
                  <animateMotion dur="2.8s" repeatCount="indefinite"><mpath href="#chHeatPath"/></animateMotion>
                </circle>
                <circle class="ch-heat-dot" r="3.6">
                  <animateMotion dur="2.8s" repeatCount="indefinite"><mpath href="#chHeatPath"/></animateMotion>
                </circle>
                <rect x="150" y="28" width="7" height="52" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
                <line x1="150" y1="54" x2="157" y2="54" stroke="var(--ink-soft)" stroke-width="2"/>
                <text x="153" y="92" text-anchor="middle" class="ch-label" fill="var(--ink-soft)">SIGHT GAUGE</text>
              </svg>
            </div>
            <p class="ch-fact">Heat-traced cable, plus a zero-electronics backup gauge.<span class="ch-info-wrap"><button type="button" class="ch-info-btn" aria-label="Why this works">i</button><span class="ch-info-pop" role="tooltip">The one real cold-exposure gap — its headspace air is truly ambient. Fix: heat-traced cable, an insulated junction box, plus a mechanical sight-gauge as zero-electronics manual backup.</span></span></p>
          </div>
        </div>

        <div class="ch-item">
          <div class="ch-head"><div class="ch-icon green"><svg viewBox="0 0 24 24"><use href="#icon-signal"/></svg></div><h3>No signal in transit — so batch, don't stream</h3></div>
          <div class="ch-row">
            <div class="ch-vis">
              <svg viewBox="0 0 200 100" role="img" aria-label="A truck in transit with radio signal waves that flicker on then cut to nothing on repeat, while a local queue box on the right accumulates readings instead of streaming them.">
                <line x1="6" y1="88" x2="112" y2="88" stroke="var(--border)" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round"/>
                <g class="ch-truck-drift"><use href="#icon-truck" x="12" y="52" width="34" height="34" color="var(--ink-soft)"/></g>
                <use class="ch-radio-flicker" href="#icon-signal" x="24" y="8" width="32" height="32" color="var(--teal)"/>
                <text x="59" y="98" text-anchor="middle" class="ch-label" fill="var(--ink-soft)">NO SIGNAL IN TRANSIT</text>
                <line x1="120" y1="4" x2="120" y2="94" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="3 4"/>
                <rect x="132" y="28" width="58" height="50" rx="8" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>
                <rect class="ch-queue-item q1" x="140" y="60" width="15" height="15" rx="3"/>
                <rect class="ch-queue-item q2" x="140" y="41" width="15" height="15" rx="3"/>
                <rect class="ch-queue-item q3" x="161" y="51" width="15" height="15" rx="3"/>
                <text x="161" y="90" text-anchor="middle" class="ch-label" fill="var(--ink-soft)">QUEUED LOCALLY</text>
              </svg>
            </div>
            <p class="ch-fact">Queue locally, sync in a batch once connected.<span class="ch-info-wrap"><button type="button" class="ch-info-btn" aria-label="How this works">i</button><span class="ch-info-pop" role="tooltip">No signal in transit, so readings queue locally and sync in a batch once a connection exists — walked through step by step next.</span></span></p>
          </div>
        </div>

        <div class="ch-item">
          <div class="ch-head"><div class="ch-icon teal"><svg viewBox="0 0 24 24"><use href="#icon-warning"/></svg></div><h3>A sensor can go dark</h3></div>
          <div class="ch-row">
            <div class="ch-vis">
              <svg viewBox="0 0 200 90" role="img" aria-label="A live sensor signal trace like a heart-rate monitor, which periodically flatlines; the moment it flatlines, a warning flag pops up flagging it, rather than the system silently showing nothing.">
                <text x="4" y="10" class="ch-label" fill="var(--ink-soft)">SENSOR SIGNAL</text>
                <path class="ch-ecg-base" d="M0,45 L10,45 L13,52 L17,15 L21,58 L25,45 L45,45 L48,52 L52,15 L56,58 L60,45 L150,45 L153,52 L157,15 L161,58 L165,45 L200,45"/>
                <path class="ch-ecg-highlight" d="M60,45 L150,45"/>
                <circle class="ch-ecg-dot" r="4">
                  <animate attributeName="cx" values="0;200" keyTimes="0;1" dur="7s" calcMode="linear" repeatCount="indefinite"/>
                  <animate attributeName="cy" values="45;45;52;15;58;45;45;52;15;58;45;45;52;15;58;45;45"
                    keyTimes="0;.05;.065;.085;.105;.125;.225;.24;.26;.28;.30;.75;.765;.785;.805;.825;1"
                    dur="7s" calcMode="linear" repeatCount="indefinite"/>
                </circle>
                <g class="ch-flatline-alert">
                  <circle cx="100" cy="26" r="12" fill="var(--danger-tint)"/>
                  <use href="#icon-warning" x="91" y="17" width="18" height="18" color="var(--danger)"/>
                  <text x="100" y="76" text-anchor="middle" font-family="var(--font-mono)" font-size="8" font-weight="700" fill="var(--danger)">FLATLINE FLAGGED</text>
                </g>
              </svg>
            </div>
            <p class="ch-fact">A broken sensor is flagged — never silently frozen.<span class="ch-info-wrap"><button type="button" class="ch-info-btn" aria-label="How this is detected">i</button><span class="ch-info-pop" role="tooltip">4-20mA "live zero" wiring tells a broken loop from a real zero — stale data gets flagged, never silently frozen. Manual fallback: the wired backup button, or a radio call-in.</span></span></p>
          </div>
        </div>

      </div>
    </div>
  </div>


  <div class="slide" data-title="Can The Sensor Freeze">
    <div class="inner">
      <div class="eyebrow reveal">04 &middot; Freeze risk, examined</div>
      <h2 class="reveal d1" style="font-size:clamp(1.5rem,3.6vw,2rem);">Can the sensor freeze as the tank empties?</h2>
      <div class="network reveal d2">
        <div class="tier tf-freeze-tier">
          <div class="tier-head"><div class="tier-icon house"><svg viewBox="0 0 24 24"><use href="#icon-snowflake"/></svg></div><h3>Can the sensor freeze?</h3></div>
          <div class="tf-wrap">
            <div class="tf-visual">
              <svg class="tf-svg" viewBox="0 0 240 300" role="img"
                   aria-label="Animated cross-section of a household water tank: an ultrasonic sensor at the top pings downward through the air headspace as the water level drains past a marked minimum safe fill line toward near-empty, then refills.">
                <defs>
                  <clipPath id="tfTankClip">
                    <rect x="35" y="57" width="130" height="190" rx="12"/>
                  </clipPath>
                  <linearGradient id="tfWaterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop class="tf-water-surface-a" offset="0" stop-opacity="0.95"/>
                    <stop class="tf-water-surface-b" offset="0.12" stop-opacity="0.5"/>
                    <stop class="tf-water-surface-c" offset="1" stop-opacity="0.78"/>
                  </linearGradient>
                </defs>
                <rect x="30" y="50" width="140" height="205" rx="18" fill="var(--surface-raised)" stroke="var(--border)" stroke-width="3"/>
                <g clip-path="url(#tfTankClip)">
                  <rect x="37" width="126" fill="url(#tfWaterGrad)">
                    <animate attributeName="y"
                      values="65;65;130;195;195;225;225;65"
                      keyTimes="0;0.25;0.45;0.60;0.68;0.82;0.93;1"
                      dur="14s" repeatCount="indefinite"/>
                    <animate attributeName="height"
                      values="180;180;115;50;50;20;20;180"
                      keyTimes="0;0.25;0.45;0.60;0.68;0.82;0.93;1"
                      dur="14s" repeatCount="indefinite"/>
                  </rect>
                </g>
                <line class="tf-minline" x1="34" x2="166" y1="195" y2="195" stroke-width="2" stroke-dasharray="4 3"/>
                <text class="tf-minline-label" x="169" y="198" font-size="7" font-family="var(--font-mono,monospace)">MIN SAFE FILL</text>
                <use class="tf-ice" href="#icon-snowflake" x="79" y="223" width="18" height="18" color="var(--gold)"/>
                <rect x="90" y="46" width="20" height="8" rx="2" fill="var(--ink-soft)"/>
                <path d="M92,54 L108,54 L100,66 Z" fill="var(--ink-soft)"/>
                <circle class="tf-safe-check" cx="188" cy="66" r="10" fill="var(--green-tint)"/>
                <use class="tf-safe-check" href="#icon-check" x="182" y="60" width="12" height="12" color="var(--green)"/>
                <g class="tf-cone">
                  <rect class="tf-ping p1" x="97" y="70" width="6" height="10" rx="2"/>
                  <rect class="tf-ping p2" x="97" y="70" width="6" height="10" rx="2"/>
                  <rect class="tf-ping p3" x="97" y="70" width="6" height="10" rx="2"/>
                </g>
                <text x="100" y="272" font-size="7" fill="var(--ink-soft)" font-family="var(--font-mono,monospace)" text-anchor="middle">HOUSEHOLD CISTERN &middot; INDOORS</text>
              </svg>
            </div>
            <div class="tf-caption">
              <p class="tf-line tf-line-safe">Reads <b>headspace air</b>, not the liquid — safe as the tank drains.<span class="ch-info-wrap"><button type="button" class="ch-info-btn" aria-label="Why this stays safe">i</button><span class="ch-info-pop" role="tooltip">Ultrasonic sensor reads the tank's headspace air, not the liquid — its exposure doesn't change as the tank drains, only if room heating fails.</span></span></p>
              <p class="tf-line tf-line-risk">Real risk only below the <b>min safe fill line</b>, during a heating outage.<span class="ch-info-wrap"><button type="button" class="ch-info-btn" aria-label="Why this is designed for">i</button><span class="ch-info-pop" role="tooltip">Less thermal mass below the min safe fill line means real risk of a thin ice skin during a heating outage — already discouraged by our tank-empty alert. Heat tracing is a real, established freeze-protection standard for cold-climate tanks and water lines, why this failure mode gets designed for, not ignored.</span></span></p>
            </div>
          </div>
          <div class="tf-badge-row">
            <span class="tf-badge tf-badge-safe"><svg viewBox="0 0 24 24"><use href="#icon-house"/></svg> Indoors &middot; stable air</span>
            <span class="tf-badge tf-badge-risk"><svg viewBox="0 0 24 24"><use href="#icon-snowflake"/></svg> Heating-failure ice risk</span>
          </div>
        </div>
      </div>
    </div>
  </div>


  <div class="slide" data-title="How Data Reaches The Dispatcher">
    <div class="inner">
      <div class="eyebrow reveal">04 &middot; How data reaches the dispatcher</div>
      <h2 class="reveal d1" style="font-size:clamp(1.5rem,3.6vw,2rem);">No live signal in transit — so it batches, not streams.</h2>
      <div class="bq-visual reveal d2">
        <svg class="bq-svg" viewBox="0 0 1240 340" role="img" aria-label="A household sensor takes a reading, queues it locally with other readings, syncs the batch to the cloud, then the dispatcher sees the count and locations of households needing service.">

          <!-- ===== static connector tracks (desktop: single row) ===== -->
          <path class="bq-line bq-desktop-only" d="M162,225 L336,225" style="fill:none;stroke:var(--border);stroke-width:2;" />
          <path class="bq-line bq-line-flow bq-desktop-only" d="M162,225 L336,225" style="fill:none;stroke:var(--teal);stroke-width:2;stroke-dasharray:5 7;opacity:.55;" />

          <path id="bq-path" class="bq-line bq-desktop-only" d="M380,201 Q560,38 740,116 Q920,194 1040,201" style="fill:none;stroke:var(--border);stroke-width:2;" />
          <path class="bq-line bq-line-flow bq-desktop-only" d="M380,201 Q560,38 740,116 Q920,194 1040,201" style="fill:none;stroke:var(--gold);stroke-width:2;stroke-dasharray:5 8;opacity:.5;" />

          <!-- ===== static connector tracks (mobile: stacked column, same stages top-to-bottom) ===== -->
          <path class="bq-line bq-mobile-only" d="M160,164 L160,286" style="fill:none;stroke:var(--border);stroke-width:2;" />
          <path class="bq-line bq-line-flow bq-mobile-only" d="M160,164 L160,286" style="fill:none;stroke:var(--teal);stroke-width:2;stroke-dasharray:5 7;opacity:.55;" />

          <path id="bq-path-mobile" class="bq-line bq-mobile-only" d="M160,314 L160,610" style="fill:none;stroke:var(--border);stroke-width:2;" />
          <path class="bq-line bq-line-flow bq-mobile-only" d="M160,314 L160,610" style="fill:none;stroke:var(--gold);stroke-width:2;stroke-dasharray:5 8;opacity:.5;" />

          <!-- ===== CLOUD (drawn early so the traveling batch renders in front of it, not hidden behind it) ===== -->
          <g id="bq-cloud-g">
            <path d="M655,110 C640,110 630,98 630,85 C630,72 642,62 655,64
                     C658,48 675,38 692,42 C700,30 720,28 732,38
                     C748,36 762,48 760,64 C775,66 782,80 774,92
                     C778,104 768,114 755,112 L662,112 C660,112 657,111 655,110 Z"
              style="fill:var(--surface);stroke:var(--ink-soft);stroke-width:2;stroke-linejoin:round;" />
            <text x="740" y="140" text-anchor="middle" class="bq-cap-sub" style="fill:var(--ink-soft);">syncs as one batch</text>
          </g>

          <!-- ===== 1. SENSOR ===== -->
          <g id="bq-sensor-g">
            <!-- sonar ping rings (the "detecting" pulse) -->
            <circle id="bq-ring-a" cx="120" cy="176" r="6" style="fill:none;stroke:var(--teal);stroke-width:2;opacity:0;">
              <animate id="bq-ring-a-r" attributeName="r" values="6;30" dur="0.7s" begin="0s;bq-ring-a-r.end+3.9s" repeatCount="3" />
              <animate attributeName="opacity" values="0.85;0" dur="0.7s" begin="0s;bq-ring-a-r.end+3.9s" repeatCount="3" />
            </circle>
            <circle id="bq-ring-b" cx="120" cy="176" r="6" style="fill:none;stroke:var(--teal);stroke-width:1.5;opacity:0;">
              <animate id="bq-ring-b-r" attributeName="r" values="6;24" dur="0.7s" begin="0.25s;bq-ring-b-r.end+3.9s" repeatCount="3" />
              <animate attributeName="opacity" values="0.6;0" dur="0.7s" begin="0.25s;bq-ring-b-r.end+3.9s" repeatCount="3" />
            </circle>

            <!-- tank body -->
            <rect x="88" y="182" width="64" height="78" rx="10" style="fill:var(--surface);stroke:var(--border);stroke-width:2;" />
            <rect x="93" y="223" width="54" height="33" rx="6" style="fill:var(--teal);opacity:0.28;" />
            <line x1="88" y1="222" x2="152" y2="222" style="stroke:var(--border);stroke-width:1.5;" />
            <!-- sensor probe node -->
            <line x1="120" y1="182" x2="120" y2="176" style="stroke:var(--teal);stroke-width:2;" />
            <circle cx="120" cy="176" r="5" style="fill:var(--teal);" />

            <text x="120" y="292" text-anchor="middle" class="bq-cap" style="fill:var(--ink);">1 &middot; Sensor reads</text>
            <text x="120" y="306" text-anchor="middle" class="bq-cap-sub" style="fill:var(--ink-soft);">tank level, on a timer</text>
          </g>

          <!-- traveling "reading" dots, sensor -> queue (desktop: sideways) -->
          <g class="bq-desktop-only">
          <circle r="4.5" style="fill:var(--teal);opacity:0;">
            <animate attributeName="cx" values="150;362" dur="0.5s" begin="0.15s;bq-r1.end+5.5s" id="bq-r1" />
            <animate attributeName="cy" values="222;207" dur="0.5s" begin="0.15s;bq-r1b.end+5.5s" id="bq-r1b" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.5s" begin="0.15s;bq-r1c.end+5.5s" id="bq-r1c" />
          </circle>
          <circle r="4.5" style="fill:var(--teal);opacity:0;">
            <animate attributeName="cx" values="150;380" dur="0.5s" begin="0.7s;bq-r2.end+5.5s" id="bq-r2" />
            <animate attributeName="cy" values="222;207" dur="0.5s" begin="0.7s;bq-r2b.end+5.5s" id="bq-r2b" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.5s" begin="0.7s;bq-r2c.end+5.5s" id="bq-r2c" />
          </circle>
          <circle r="4.5" style="fill:var(--teal);opacity:0;">
            <animate attributeName="cx" values="150;398" dur="0.45s" begin="1.2s;bq-r3.end+5.55s" id="bq-r3" />
            <animate attributeName="cy" values="222;207" dur="0.45s" begin="1.2s;bq-r3b.end+5.55s" id="bq-r3b" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.45s" begin="1.2s;bq-r3c.end+5.55s" id="bq-r3c" />
          </circle>
          </g>

          <!-- traveling "reading" dots, sensor -> queue (mobile: straight down) -->
          <g class="bq-mobile-only">
          <circle r="4.5" style="fill:var(--teal);opacity:0;">
            <animate attributeName="cx" values="160;142" dur="0.5s" begin="0.15s;bq-r1-m.end+5.5s" id="bq-r1-m" />
            <animate attributeName="cy" values="164;258" dur="0.5s" begin="0.15s;bq-r1b-m.end+5.5s" id="bq-r1b-m" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.5s" begin="0.15s;bq-r1c-m.end+5.5s" id="bq-r1c-m" />
          </circle>
          <circle r="4.5" style="fill:var(--teal);opacity:0;">
            <animate attributeName="cx" values="160;160" dur="0.5s" begin="0.7s;bq-r2-m.end+5.5s" id="bq-r2-m" />
            <animate attributeName="cy" values="164;258" dur="0.5s" begin="0.7s;bq-r2b-m.end+5.5s" id="bq-r2b-m" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.5s" begin="0.7s;bq-r2c-m.end+5.5s" id="bq-r2c-m" />
          </circle>
          <circle r="4.5" style="fill:var(--teal);opacity:0;">
            <animate attributeName="cx" values="160;178" dur="0.45s" begin="1.2s;bq-r3-m.end+5.55s" id="bq-r3-m" />
            <animate attributeName="cy" values="164;258" dur="0.45s" begin="1.2s;bq-r3b-m.end+5.55s" id="bq-r3b-m" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.45s" begin="1.2s;bq-r3c-m.end+5.55s" id="bq-r3c-m" />
          </circle>
          </g>

          <!-- ===== 2. LOCAL QUEUE ===== -->
          <g id="bq-queue-g">
            <rect x="345" y="228" width="70" height="28" rx="8" style="fill:var(--surface);stroke:var(--border);stroke-width:2;" />
            <line x1="355" y1="242" x2="405" y2="242" style="stroke:var(--border);stroke-width:1.5;stroke-dasharray:3 3;" />

            <rect x="355.5" y="198.5" width="13" height="13" rx="3" style="fill:var(--gold);opacity:0;">
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="1.5s" begin="0.8s;bq-q1.end+4.5s" id="bq-q1" />
            </rect>
            <rect x="373.5" y="198.5" width="13" height="13" rx="3" style="fill:var(--gold);opacity:0;">
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="1.0s" begin="1.3s;bq-q2.end+5.0s" id="bq-q2" />
            </rect>
            <rect x="391.5" y="198.5" width="13" height="13" rx="3" style="fill:var(--gold);opacity:0;">
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="0.5s" begin="1.8s;bq-q3.end+5.5s" id="bq-q3" />
            </rect>

            <text x="380" y="292" text-anchor="middle" class="bq-cap" style="fill:var(--ink);">2 &middot; Queues locally</text>
            <text x="380" y="306" text-anchor="middle" class="bq-cap-sub" style="fill:var(--ink-soft);">no live signal in transit</text>
          </g>

          <!-- ===== batch: bundles at queue, travels up to cloud, then down to dispatcher (desktop) ===== -->
          <g class="bq-desktop-only" style="opacity:0;">
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.087;0.913;1" dur="2.3s" begin="2.3s;bq-batch-op.end+3.7s" id="bq-batch-op" />
            <animateMotion dur="1.9s" begin="2.5s;bq-batch-motion.end+4.1s" id="bq-batch-motion"
              keyPoints="0;0.5;0.5;1" keyTimes="0;0.421;0.579;1" calcMode="linear">
              <mpath href="#bq-path" />
            </animateMotion>
            <rect x="-9" y="-9" width="18" height="18" rx="4" style="fill:var(--surface);stroke:var(--gold);stroke-width:2;" />
            <circle cx="-4" cy="-3" r="2" style="fill:var(--gold);" />
            <circle cx="4" cy="-3" r="2" style="fill:var(--gold);" />
            <circle cx="0" cy="4" r="2" style="fill:var(--gold);" />
          </g>

          <!-- ===== batch: bundles at queue, travels down through cloud to dispatcher (mobile) ===== -->
          <g class="bq-mobile-only" style="opacity:0;">
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.087;0.913;1" dur="2.3s" begin="2.3s;bq-batch-op-m.end+3.7s" id="bq-batch-op-m" />
            <animateMotion dur="1.9s" begin="2.5s;bq-batch-motion-m.end+4.1s" id="bq-batch-motion-m"
              keyPoints="0;0.5;0.5;1" keyTimes="0;0.421;0.579;1" calcMode="linear">
              <mpath href="#bq-path-mobile" />
            </animateMotion>
            <rect x="-9" y="-9" width="18" height="18" rx="4" style="fill:var(--surface);stroke:var(--gold);stroke-width:2;" />
            <circle cx="-4" cy="-3" r="2" style="fill:var(--gold);" />
            <circle cx="4" cy="-3" r="2" style="fill:var(--gold);" />
            <circle cx="0" cy="4" r="2" style="fill:var(--gold);" />
          </g>

          <!-- cloud arrival glow -->
          <circle class="bq-desktop-only" cx="740" cy="100" r="46" style="fill:var(--teal);opacity:0;">
            <animate attributeName="opacity" values="0;0.22;0" dur="0.3s" begin="3.3s;bq-cloud-glow.end+5.7s" id="bq-cloud-glow" />
          </circle>
          <circle class="bq-mobile-only" cx="113" cy="470" r="38" style="fill:var(--teal);opacity:0;">
            <animate attributeName="opacity" values="0;0.22;0" dur="0.3s" begin="3.3s;bq-cloud-glow-m.end+5.7s" id="bq-cloud-glow-m" />
          </circle>

          <!-- ===== 3 &amp; 4. DISPATCHER ===== -->
          <g id="bq-dispatcher-g">
            <rect x="950" y="170" width="180" height="110" rx="12" style="fill:var(--surface);stroke:var(--border);stroke-width:2;" />
            <rect x="1010" y="280" width="20" height="10" style="fill:var(--border);" />
            <rect x="995" y="290" width="90" height="7" rx="3" style="fill:var(--border);" />

            <rect x="962" y="182" width="156" height="86" rx="6" style="fill:var(--surface-raised);stroke:var(--border);stroke-width:1;" />

            <g id="bq-count" style="opacity:0;">
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1875;0.875;1" dur="1.6s" begin="4.4s;bq-count-op.end+4.4s" id="bq-count-op" />
              <text x="974" y="207" class="bq-num" style="fill:var(--teal);">3</text>
              <text x="1000" y="199" class="bq-mini" style="fill:var(--ink-soft);">households</text>
              <text x="1000" y="210" class="bq-mini" style="fill:var(--ink-soft);">need service</text>
              <line x1="974" y1="217" x2="1104" y2="217" style="stroke:var(--border);stroke-width:1;" />
            </g>

            <g style="opacity:0;">
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.85;1" dur="1.3s" begin="4.7s;bq-pin1.end+4.7s" id="bq-pin1" />
              <g transform="translate(985,238)">
                <circle cy="-5" r="4.5" style="fill:var(--teal);" />
                <path d="M-4.5,-2 L4.5,-2 L0,6 Z" style="fill:var(--teal);" />
                <text y="18" text-anchor="middle" class="bq-pin-label" style="fill:var(--ink-soft);">INU-041</text>
              </g>
            </g>

            <g style="opacity:0;">
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur="1.0s" begin="5.0s;bq-pin2.end+5.0s" id="bq-pin2" />
              <g transform="translate(1040,238)">
                <circle cy="-5" r="4.5" style="fill:var(--teal);" />
                <path d="M-4.5,-2 L4.5,-2 L0,6 Z" style="fill:var(--teal);" />
                <text y="18" text-anchor="middle" class="bq-pin-label" style="fill:var(--ink-soft);">INU-102</text>
              </g>
            </g>

            <g style="opacity:0;">
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.7;1" dur="0.7s" begin="5.3s;bq-pin3.end+5.3s" id="bq-pin3" />
              <g transform="translate(1095,238)">
                <circle cy="-5" r="4.5" style="fill:var(--teal);" />
                <path d="M-4.5,-2 L4.5,-2 L0,6 Z" style="fill:var(--teal);" />
                <text y="18" text-anchor="middle" class="bq-pin-label" style="fill:var(--ink-soft);">INU-118</text>
              </g>
            </g>

            <text x="1040" y="306" text-anchor="middle" class="bq-cap" style="fill:var(--ink);">3 &middot; Dispatcher decides</text>
            <text x="1040" y="320" text-anchor="middle" class="bq-cap-sub" style="fill:var(--ink-soft);">amount, then exact places</text>
          </g>
        </svg>

        <p class="bq-note">Readings queue on-device and sync in periodic batches, not a continuous stream &mdash; built for zero-connectivity stretches.</p>
      </div>
      <a class="deck-live-link reveal d3" href="/simulation">Watch real dispatch happen &rarr;</a>
    </div>
  </div>


  <div class="slide" data-title="Household Reading">
    <div class="inner">
      <div class="eyebrow reveal">05 &middot; What a household reports</div>
      <h2 class="reveal d1" style="font-size:clamp(1.5rem,3.6vw,2rem);">One house, three tanks, one glance.</h2>
      <div class="house-card reveal d2">
        <div class="top">
          <div><h3 style="font-size:1.2rem;">INU-102</h3><div class="house-meta">7 people &middot; 1800L cistern</div></div>
          <span class="badge low" id="hrBadge">Tank OK</span>
        </div>
        <div class="tank-row" id="tankrow">
          <div class="tank">
            <svg class="tank-svg" viewBox="0 0 120 160" aria-hidden="true">
              <defs><clipPath id="tankClipWater"><path d="M12,32 A48,16 0 0 1 108,32 V144 A48,16 0 0 1 12,144 Z"/></clipPath></defs>
              <path class="tank-shape-outline" d="M12,32 A48,16 0 0 1 108,32 V144 A48,16 0 0 1 12,144 Z"/>
              <g clip-path="url(#tankClipWater)">
                <rect class="tank-fill-rect" data-tank="water" data-h="100" x="12" y="32" width="96" height="112" fill="var(--green)">
                  <animate attributeName="y" values="32;32;82.4;116;140.64;32" keyTimes="0;0.28;0.52;0.72;0.88;1" dur="16s" repeatCount="indefinite"/>
                  <animate attributeName="height" values="112;112;61.6;28;3.36;112" keyTimes="0;0.28;0.52;0.72;0.88;1" dur="16s" repeatCount="indefinite"/>
                </rect>
              </g>
              <path class="tank-shape-outline-stroke" d="M12,32 A48,16 0 0 1 108,32 V144 A48,16 0 0 1 12,144 Z"/>
            </svg>
            <div class="pct" id="hrWaterPct">100%</div><div class="label">Water</div><div class="tank-loc">Indoors</div>
            <div class="tank-forecast" id="hrWaterForecast">~1.7 days&ndash;2.9 days until empty</div>
          </div>
          <div class="tank outdoor">
            <svg class="tank-svg" viewBox="0 0 120 160" aria-hidden="true">
              <defs><clipPath id="tankClipSewage"><path d="M12,32 A48,16 0 0 1 108,32 V144 A48,16 0 0 1 12,144 Z"/></clipPath></defs>
              <path class="tank-shape-outline" d="M12,32 A48,16 0 0 1 108,32 V144 A48,16 0 0 1 12,144 Z"/>
              <g clip-path="url(#tankClipSewage)">
                <rect class="tank-fill-rect" data-tank="sewage" data-h="0" x="12" y="144" width="96" height="0" fill="var(--green)">
                  <animate attributeName="y" values="144;144;104.8;71.2;43.2;144" keyTimes="0;0.25;0.50;0.72;0.90;1" dur="13s" repeatCount="indefinite"/>
                  <animate attributeName="height" values="0;0;39.2;72.8;100.8;0" keyTimes="0;0.25;0.50;0.72;0.90;1" dur="13s" repeatCount="indefinite"/>
                </rect>
              </g>
              <path class="tank-shape-outline-stroke" d="M12,32 A48,16 0 0 1 108,32 V144 A48,16 0 0 1 12,144 Z"/>
              <use href="#icon-snowflake" x="90" y="6" width="20" height="20" color="var(--gold)"/>
            </svg>
            <div class="pct" id="hrSewagePct">0%</div><div class="label">Sewage</div><div class="tank-loc">Outside</div>
            <div class="tank-forecast" id="hrSewageForecast">~13 days until full &mdash; pump-out needed</div>
          </div>
          <div class="tank">
            <svg class="tank-svg" viewBox="0 0 120 160" aria-hidden="true">
              <defs><clipPath id="tankClipPotability"><path d="M12,32 A48,16 0 0 1 108,32 V144 A48,16 0 0 1 12,144 Z"/></clipPath></defs>
              <path class="tank-shape-outline" d="M12,32 A48,16 0 0 1 108,32 V144 A48,16 0 0 1 12,144 Z"/>
              <g clip-path="url(#tankClipPotability)">
                <rect class="tank-fill-rect" data-tank="potability" data-h="86" x="12" y="47.68" width="96" height="96.32" fill="var(--green)">
                  <animate attributeName="y" values="47.68;47.68;82.4;110.4;131.68;47.68" keyTimes="0;0.30;0.55;0.78;0.92;1" dur="19s" repeatCount="indefinite"/>
                  <animate attributeName="height" values="96.32;96.32;61.6;33.6;12.32;96.32" keyTimes="0;0.30;0.55;0.78;0.92;1" dur="19s" repeatCount="indefinite"/>
                </rect>
              </g>
              <path class="tank-shape-outline-stroke" d="M12,32 A48,16 0 0 1 108,32 V144 A48,16 0 0 1 12,144 Z"/>
            </svg>
            <div class="pct" id="hrPotPct">86%</div><div class="label">Potability</div><div class="tank-loc">Indoors</div>
            <div class="tank-forecast" id="hrPotForecast">~23 days until retest recommended</div>
          </div>
        </div>
        <p style="font-size:0.8rem;color:var(--ink-soft);margin-top:14px;">A full sewage tank blocks water use on its own — never hidden inside the water badge. Days-left estimates use this household&apos;s own consumption, sewage fill rate, and chlorine decay &mdash; the same formulas as the live view.</p>
      </div>
      <a class="deck-live-link reveal d3" href="/houses">See this household live &rarr;</a>
    </div>
  </div>


  <div class="slide" data-title="Plant Reading">
    <div class="inner">
      <div class="eyebrow reveal">06 &middot; What the plant reports</div>
      <h2 class="reveal d1" style="font-size:clamp(1.5rem,3.6vw,2rem);">One stage is already solved. This is it.</h2>
      <p class="lede reveal d2" style="margin-top:8px;">The plant already tests weekly and doses every batch — that dose becomes the starting point for every household's decay clock downstream. This is the one measurement we didn't have to invent.</p>
      <div class="readout reveal d3">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <b>Inukjuak treatment facility — right now</b><span class="badge low">Connected</span>
        </div>
        <div class="readout-grid">
          <div class="readout-item"><div class="k">Chlorine dose applied</div><div class="v">1.5 mg/L</div></div>
          <div class="readout-item"><div class="k">Outside air (live)</div><div class="v">8.6°C <span class="live-dot"></span></div></div>
          <div class="readout-item"><div class="k">Weekly coliform test</div><div class="v" style="color:var(--green);">Pass</div></div>
          <div class="readout-item"><div class="k">Last tested</div><div class="v">3 days ago</div></div>
        </div>
        <div class="plant-flow reveal d4">
          <svg viewBox="0 0 340 60" aria-hidden="true">
            <g transform="translate(20,30)">
              <circle r="16" fill="none" stroke="var(--teal)" stroke-width="2"/>
              <line x1="0" y1="0" x2="0" y2="-10" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" class="pf-clock-hand"/>
              <line x1="0" y1="0" x2="6" y2="0" stroke="var(--teal)" stroke-width="2" stroke-linecap="round"/>
            </g>
            <line x1="44" y1="30" x2="300" y2="30" stroke="var(--border)" stroke-width="2" stroke-dasharray="3 4"/>
            <circle class="pf-drop a" cx="44" cy="30" r="4" fill="var(--teal)"/>
            <circle class="pf-drop b" cx="44" cy="30" r="4" fill="var(--teal)"/>
            <circle class="pf-drop c" cx="44" cy="30" r="4" fill="var(--teal)"/>
            <use href="#icon-house" x="298" y="12" width="30" height="30" color="var(--ink-soft)"/>
          </svg>
          <p style="font-size:0.78rem;color:var(--ink-soft);margin-top:2px;">The dose applied here starts the decay clock every household downstream inherits.</p>
        </div>
      </div>
      <a class="deck-live-link reveal d4" href="/plant">See the live plant reading &rarr;</a>
    </div>
  </div>


  <div class="slide" data-title="How It Joins Together">
    <div class="inner">
      <div class="eyebrow reveal">07 &middot; How it joins together</div>
      <h2 class="reveal d1" style="font-size:clamp(1.5rem,3.6vw,2rem);">Same trucks, same trips — different targeting.</h2>
      <div class="fj-wrap reveal d2">
        <svg class="fj-track" viewBox="0 0 1400 46" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
          <path id="fjPath" d="M175,23 Q350,8 525,23 Q700,38 875,23 Q1050,8 1225,23" style="fill:none;stroke:var(--border);stroke-width:2;"/>
          <path class="fj-route-flow" d="M175,23 Q350,8 525,23 Q700,38 875,23 Q1050,8 1225,23"/>

          <circle class="fj-ping fj-ping-plant" cx="175" cy="23" r="3" style="stroke:var(--teal);"/>
          <circle class="fj-ping fj-ping-truck" cx="525" cy="23" r="3" style="stroke:var(--gold);"/>
          <circle class="fj-ping fj-ping-house" cx="875" cy="23" r="3" style="stroke:var(--green);"/>
          <circle class="fj-ping fj-ping-dispatcher" cx="1225" cy="23" r="3" style="stroke:var(--teal);"/>

          <circle class="fj-packet-halo" r="9">
            <animateMotion dur="6s" repeatCount="indefinite" calcMode="linear"><mpath href="#fjPath"/></animateMotion>
          </circle>
          <circle class="fj-packet-dot" r="4.5">
            <animateMotion dur="6s" repeatCount="indefinite" calcMode="linear"><mpath href="#fjPath"/></animateMotion>
          </circle>
        </svg>
        <div class="fj-row" role="img" aria-label="A reading traveling in a continuous loop from the plant, to the truck, to the household, to the dispatcher">
          <div class="fj-node"><div class="fj-icon tier-icon plant"><svg viewBox="0 0 24 24"><use href="#icon-plant"/></svg></div><b>Plant</b><span>doses</span></div>
          <div class="fj-node"><div class="fj-icon tier-icon truck"><svg viewBox="0 0 24 24"><use href="#icon-truck"/></svg></div><b>Truck</b><span>radio</span></div>
          <div class="fj-node"><div class="fj-icon tier-icon house"><svg viewBox="0 0 24 24"><use href="#icon-house"/></svg></div><b>House</b><span>tanks</span></div>
          <div class="fj-node"><div class="fj-icon tier-icon dispatcher"><svg viewBox="0 0 24 24"><use href="#icon-dispatcher"/></svg></div><b>Dispatcher</b><span>decides</span></div>
        </div>
      </div>
      <div class="compare reveal d3">
        <div class="c base"><div class="h">Blind rotation, today</div><div class="big" data-target="__BASELINE_BAD_DAYS__">0</div><div style="font-size:0.82rem;">bad-state household-days</div></div>
        <div class="c opt"><div class="h">Predictive + batch</div><div class="big" data-target="__OPTIMIZED_BAD_DAYS__">0</div><div style="font-size:0.82rem;">same trucks, same trips</div></div>
      </div>
      <p class="reveal d3" style="font-size:0.74rem;color:var(--ink-soft);margin-top:10px;">Full-scale simulation &middot; Inukjuak's real household count (500) and documented 3-truck fleet.</p>
    </div>
  </div>


  <div class="slide" data-title="How It Joins Together — Trucks">
    <div class="inner">
      <div class="eyebrow reveal">08 &middot; Same trucks, watch them move</div>
      <h2 class="reveal d1" style="font-size:clamp(1.5rem,3.6vw,2rem);">Same trucks, same trips &mdash; different targeting.</h2>
      <p class="lede reveal d2">Both trucks run the identical plant&rarr;household route. One drives it blind. The other radios in, skips what's fine, and batches what isn't.</p>

      <div class="tc-wrap reveal d3">

        <!-- LANE 1 : BLIND ROTATION -->
        <div class="tc-lane" data-lane="1">
          <div class="tc-lane-head">
            <span class="tc-lane-title">Lane 1 &middot; Blind rotation</span>
            <span class="tc-lane-desc">Fixed schedule &mdash; stops at every household, regardless of state</span>
          </div>
          <svg class="tc-track" viewBox="0 0 860 120" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Blind rotation truck stopping at every household on a fixed schedule">
            <line x1="24" y1="92" x2="846" y2="92" stroke="var(--border)" stroke-width="3" stroke-linecap="round"/>

            <!-- plant / dispatcher (silo + antenna) -->
            <g transform="translate(30,92)">
              <path d="M -13 -16 L 13 -40 L 39 -16 Z" fill="var(--teal)" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>
              <rect x="-11" y="-16" width="48" height="16" rx="2" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>
              <rect x="6" y="-9" width="9" height="9" fill="var(--teal)" opacity="0.5"/>
              <line x1="13" y1="-40" x2="13" y2="-54" stroke="var(--ink-soft)" stroke-width="1.6"/>
              <circle cx="13" cy="-54" r="2.4" fill="var(--gold)"/>
              <text x="13" y="14" text-anchor="middle" class="tc-label">PLANT</text>
            </g>
            <g class="tc-radio" data-l1-plant transform="translate(43,38)">
              <circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/>
            </g>

            <!-- households: mixed states, visited regardless -->
            <g transform="translate(230,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--green)"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--green)" stroke-width="2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>
            <g class="tc-radio" data-l1-h1 transform="translate(230,80)"><circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/></g>

            <g transform="translate(350,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--gold)"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--gold)" stroke-width="2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>
            <g class="tc-radio" data-l1-h2 transform="translate(350,80)"><circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/></g>

            <g transform="translate(470,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--danger)"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--danger)" stroke-width="2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>
            <g class="tc-radio" data-l1-h3 transform="translate(470,80)"><circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/></g>

            <g transform="translate(590,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--gold)"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--gold)" stroke-width="2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>
            <g class="tc-radio" data-l1-h4 transform="translate(590,80)"><circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/></g>

            <g transform="translate(710,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--green)"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--green)" stroke-width="2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>
            <g class="tc-radio" data-l1-h5 transform="translate(710,80)"><circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/></g>

            <!-- truck (animated) -->
            <g transform="translate(0,92)">
              <g class="tc-truck-1">
                <rect x="0" y="-28" width="44" height="18" rx="2" fill="currentColor" stroke="var(--ink)" stroke-width="1.6"/>
                <path d="M44,-10 L44,-24 L56,-24 L64,-10 Z" fill="currentColor" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/>
                <polygon points="56,-22 62,-10 56,-10" fill="var(--bg)"/>
                <circle cx="12" cy="-6" r="6" fill="var(--ink)"/><circle cx="12" cy="-6" r="2.2" fill="var(--surface)"/>
                <circle cx="52" cy="-6" r="6" fill="var(--ink)"/><circle cx="52" cy="-6" r="2.2" fill="var(--surface)"/>
              </g>
            </g>
          </svg>
        </div>

        <!-- LANE 2 : PREDICTIVE + BATCH -->
        <div class="tc-lane" data-lane="2">
          <div class="tc-lane-head">
            <span class="tc-lane-title">Lane 2 &middot; Predictive + batch</span>
            <span class="tc-lane-desc">Predicts who's about to run dry or fill up, and clusters the whole group into one proactive trip &mdash; not just reacting once someone's already in trouble</span>
          </div>
          <svg class="tc-track" viewBox="0 0 860 120" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Predictive truck skipping neutral households, visiting two households the model forecasts will need service soon, and batching them with two adjacent already-urgent households into one proactive sweep">
            <line x1="24" y1="92" x2="846" y2="92" stroke="var(--border)" stroke-width="3" stroke-linecap="round"/>

            <!-- batching bracket spans the whole predicted+urgent cluster, not just the two already-urgent stops -->
            <path d="M230,104 Q410,118 590,104" stroke="var(--teal)" stroke-width="1.5" stroke-dasharray="3 4" fill="none" opacity="0.55"/>

            <!-- plant / dispatcher -->
            <g transform="translate(30,92)">
              <path d="M -13 -16 L 13 -40 L 39 -16 Z" fill="var(--teal)" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>
              <rect x="-11" y="-16" width="48" height="16" rx="2" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>
              <rect x="6" y="-9" width="9" height="9" fill="var(--teal)" opacity="0.5"/>
              <line x1="13" y1="-40" x2="13" y2="-54" stroke="var(--ink-soft)" stroke-width="1.6"/>
              <circle cx="13" cy="-54" r="2.4" fill="var(--gold)"/>
              <text x="13" y="14" text-anchor="middle" class="tc-label">PLANT</text>
            </g>
            <g class="tc-radio" data-l2-plant transform="translate(43,38)">
              <circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/>
            </g>

            <!-- households: one neutral (safely skipped), two predicted/trending (forecast to need
                 service soon, visited proactively) bookending two already-urgent ones (batched together) -->
            <g transform="translate(230,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--gold)"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--gold)" stroke-width="2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>
            <g class="tc-radio" data-l2-h1 transform="translate(230,80)"><circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/></g>

            <g transform="translate(350,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--danger)"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--danger)" stroke-width="2.2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>
            <g class="tc-radio" data-l2-h2 transform="translate(350,80)"><circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/></g>

            <g transform="translate(470,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--danger)"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--danger)" stroke-width="2.2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>
            <g class="tc-radio" data-l2-h3 transform="translate(470,80)"><circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/></g>

            <g transform="translate(590,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--gold)"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--gold)" stroke-width="2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>
            <g class="tc-radio" data-l2-h4 transform="translate(590,80)"><circle class="tc-ring-a" r="3"/><circle class="tc-ring-b" r="3"/></g>

            <g transform="translate(710,92)">
              <polygon points="-14,-16 0,-30 14,-16" fill="var(--ink-soft)" fill-opacity="0.4"/>
              <rect x="-11" y="-16" width="22" height="16" rx="1.5" fill="var(--surface)" stroke="var(--ink-soft)" stroke-opacity="0.8" stroke-width="2"/>
              <rect x="-3" y="-8" width="6" height="8" fill="var(--bg)"/>
            </g>

            <!-- truck (animated, faster cycle) -->
            <g transform="translate(0,92)">
              <g class="tc-truck-2">
                <rect x="0" y="-28" width="44" height="18" rx="2" fill="currentColor" stroke="var(--ink)" stroke-width="1.6"/>
                <path d="M44,-10 L44,-24 L56,-24 L64,-10 Z" fill="currentColor" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/>
                <polygon points="56,-22 62,-10 56,-10" fill="var(--bg)"/>
                <circle cx="12" cy="-6" r="6" fill="var(--ink)"/><circle cx="12" cy="-6" r="2.2" fill="var(--surface)"/>
                <circle cx="52" cy="-6" r="6" fill="var(--ink)"/><circle cx="52" cy="-6" r="2.2" fill="var(--surface)"/>
              </g>
            </g>
          </svg>
        </div>

        <div class="tc-legend">
          <span class="tc-legend-item"><i class="tc-dot" style="background:var(--danger);"></i>Urgent &mdash; needs a visit</span>
          <span class="tc-legend-item"><i class="tc-dot" style="background:var(--gold);"></i>Predicted &mdash; visited before it's urgent</span>
          <span class="tc-legend-item"><i class="tc-dot" style="background:var(--ink-soft);opacity:.55;"></i>Neutral &mdash; safely skipped</span>
          <span class="tc-legend-item"><i class="tc-dot" style="background:var(--teal);"></i>Radio check-in (at stops only, never in transit)</span>
        </div>

      </div>
      <a class="deck-live-link reveal d4" href="/simulation">See real trucks batch live &rarr;</a>
    </div>
  </div>


  <div class="slide" data-title="See It Running">
    <div class="finale">
      <div class="curtain">
        <div class="card">
          <h2>See it running</h2>
          <p>A working seven-page prototype — live data, real math, honestly labeled. This is the actual product, not a mockup.</p>
          <div class="cta-links">
            <a class="btn" href="/houses" id="deckLaunchBtn">Open the product</a>
            <a class="btn ghost" href="https://github.com/aleistrying/aquatrace/blob/main/PROJECT_INFO.md" target="_blank" rel="noopener">Full project brief</a>
          </div>
        </div>
      </div>
      <small>Built on Universit&eacute; Laval / Sentinel Nord's real Kuujjuaq sensor pilot. Every number is sourced and labeled real vs. illustrative in the project docs.</small>
    </div>
  </div>


</div>
`;
