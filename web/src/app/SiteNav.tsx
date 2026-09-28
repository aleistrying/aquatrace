"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Pitch" },
  { href: "/houses", label: "Houses" },
  { href: "/plant", label: "Plant" },
  { href: "/truck", label: "Truck" },
  { href: "/communities", label: "Communities" },
  { href: "/simulation", label: "Simulation" },
  { href: "/statistics", label: "Statistics" },
];

export default function SiteNav() {
  const pathname = usePathname();
  // The pitch deck (/) owns its own full-bleed, fixed-nav slide chrome —
  // showing this bar on top of it would collide with the deck's own
  // progress bar / arrow buttons, so it only renders on the product pages.
  if (pathname === "/") return null;

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        display: "flex",
        gap: 4,
        alignItems: "center",
        padding: "10px 20px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
      }}
    >
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, marginRight: 14, whiteSpace: "nowrap" }}>
        AquaTrace
      </span>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              padding: "6px 12px",
              borderRadius: 99,
              fontSize: "0.85rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              background: active ? "var(--teal-tint)" : "transparent",
              color: active ? "var(--teal)" : "var(--ink-soft)",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
