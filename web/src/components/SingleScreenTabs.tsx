"use client";

import { useState, type ReactNode } from "react";

export interface ScreenTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * The shared "fit on one screen, no page scroll" shell for a product page.
 * A page using this renders NOTHING else at its own top level besides this -
 * `SingleScreenPage` (below) supplies the fixed-height frame (viewport minus
 * the site nav), this supplies the tab bar + the active tab's panel filling
 * the rest of that frame. Switching tabs swaps content instead of the page
 * growing taller, so nothing here ever needs a page-level scrollbar.
 *
 * A tab's own `content` MAY still scroll internally (e.g. a long household
 * list) - that's a deliberate, visible, contained scroll region the user
 * opts into, not a growing page. Prefer pagination/"show N of M" over even
 * that where it's easy; keep internal scroll for the cases where it's the
 * more honest option (e.g. a live growing event log).
 */
export default function SingleScreenTabs({ tabs, defaultTabId }: { tabs: ScreenTab[]; defaultTabId?: string }) {
  const [active, setActive] = useState(defaultTabId ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 6,
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
          marginBottom: 10,
          paddingBottom: 8,
        }}
      >
        {tabs.map((t) => {
          const isActive = t.id === activeTab?.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid " + (isActive ? "var(--teal)" : "var(--border)"),
                background: isActive ? "var(--teal-tint)" : "var(--surface)",
                color: isActive ? "var(--teal)" : "var(--ink-soft)",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>{activeTab?.content}</div>
    </div>
  );
}

/**
 * The fixed-height page frame every single-screen product page mounts as
 * its top-level element - fills exactly (100vh - the sticky site nav's own
 * height), so combined with SiteNav the page never exceeds one viewport.
 * NAV_HEIGHT_PX is measured from SiteNav.tsx's actual rendered height at
 * 1366x768 (the reference demo viewport) - if SiteNav's own padding/font
 * size ever changes, remeasure and update this constant.
 */
const NAV_HEIGHT_PX = 54;

export function SingleScreenPage({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        height: `calc(100vh - ${NAV_HEIGHT_PX}px)`,
        maxWidth: 1320,
        margin: "0 auto",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {children}
    </main>
  );
}
