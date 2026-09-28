"use client";

import { useEffect, useRef, useState } from "react";
import type { Variant } from "@/lib/model";

/**
 * A status pill. Detects its own variant/label transitions (e.g. a
 * household flipping "low" -> "medium" after a backup-button press, or a
 * plant test flipping Pass -> Fail) and gives itself a brief "just changed"
 * pulse so the swap reads as an event, not a silent value replace. `justChanged`
 * is an optional escape hatch for a caller that wants to force the same pulse
 * for some other reason (kept separate from the auto-detected case above).
 */
export default function Badge({
  label,
  variant,
  title,
  justChanged,
  pulse = true,
}: {
  label: string;
  variant: Variant;
  title?: string;
  justChanged?: boolean;
  /** Set false when a caller already wraps this Badge in its own
   * change-detection indicator (e.g. simulation's FlashBadge glow ring) —
   * otherwise both fire on the same state change, and this pulse's
   * transform:scale(1.22) visually balloons over tightly-packed neighbors
   * since a transform doesn't reflow the layout around it. */
  pulse?: boolean;
}) {
  const prev = useRef<{ variant: Variant; label: string } | null>(null);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    const last = prev.current;
    const changed = last !== null && (last.variant !== variant || last.label !== label);
    prev.current = { variant, label };
    if (!pulse || (!changed && !justChanged)) return;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 750);
    return () => clearTimeout(t);
  }, [variant, label, justChanged, pulse]);

  return (
    <span className={`badge ${variant}${pulsing ? " badge-changed" : ""}`} title={title}>
      {label}
    </span>
  );
}
