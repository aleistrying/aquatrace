"use client";

/** Prominent alert banner, ported from streamlit_theme.py's crisis_banner()
 * usage in 1_Houses.py — an empty tank, blocked sewage tank, or a manual
 * "Something's wrong" report, named explicitly rather than buried in badges. */
export default function CrisisBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        background: "var(--danger-tint)",
        color: "var(--danger)",
        borderRadius: 12,
        padding: "14px 18px",
        fontWeight: 700,
        border: "2px solid var(--danger)",
        marginBottom: "1rem",
      }}
    >
      {message}
    </div>
  );
}
