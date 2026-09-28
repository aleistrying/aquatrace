"use client";

/**
 * Ported from common.py's boil_water_banner(): a maximally-visible, animated
 * plant-wide advisory banner, distinct from per-household status badges.
 * Rendered on Houses/Plant whenever plantStore's boilWaterAdvisoryActive()
 * is true.
 */
export default function BoilWaterBanner() {
  return (
    <>
      <style>{`
        @keyframes aq-boil-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.18); opacity: 0.75; } }
        @keyframes aq-boil-enter {
          0% { opacity: 0; transform: translateY(-16px) scale(0.97); }
          60% { opacity: 1; transform: translateY(2px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        role="alert"
        style={{
          background: "var(--danger)",
          color: "#FFFFFF",
          borderRadius: 12,
          padding: "16px 20px",
          fontWeight: 700,
          fontSize: "0.95rem",
          border: "2px solid var(--danger)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          marginBottom: "1rem",
          animation: "aq-boil-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ width: 26, height: 26, flexShrink: 0, animation: "aq-boil-pulse 1.4s ease-in-out infinite" }}
        >
          <path d="M12 3.6 L21 19.8 H3 Z" />
          <path d="M12 9.6 V14.2" />
          <circle cx="12" cy="16.9" r="1" fill="currentColor" stroke="none" />
        </svg>
        <div>
          <strong>BOIL WATER ADVISORY IN EFFECT</strong> — coliforms detected at the treatment plant. Boil
          water at least 1 minute before drinking, even where a household tank below reads &ldquo;Likely
          safe&rdquo; — this overrides the per-household chlorine reading until the plant retests clear.
        </div>
      </div>
    </>
  );
}
