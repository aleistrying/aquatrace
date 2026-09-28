"use client";

import { useId, useState } from "react";

/**
 * A small "ⓘ" affordance for supplementary explanation that shouldn't be
 * on-screen by default. Click/tap toggles a popover (works on touch, unlike
 * a bare `title` attribute); hover shows it on pointer devices too. Use this
 * to move "why"/background prose out of the default view, while the
 * important fact itself stays visible as a real UI component (badge, stat,
 * icon) rather than a sentence.
 */
export default function InfoIcon({ children, label = "More info" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px solid var(--border)",
          background: "var(--surface-raised)",
          color: "var(--ink-soft)",
          fontSize: "0.62rem",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 40,
            bottom: "calc(100% + 6px)",
            left: 0,
            width: 260,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: "0.78rem",
            lineHeight: 1.45,
            color: "var(--ink-soft)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
