"""
Hack for Humanity: Ottawa — shared design system for Streamlit apps.

USAGE (3 lines):

    from streamlit_theme import inject_theme
    import streamlit as st
    inject_theme()

Call `inject_theme()` once, near the top of your `app.py`, right after
`st.set_page_config(...)`. It injects the shared color/type/spacing tokens
as CSS custom properties plus a handful of styled helper classes
(`.hfh-card`, `.hfh-badge-*`, `.hfh-alert-*`, `.hfh-crisis-banner`) that you
can drop into `st.markdown(..., unsafe_allow_html=True)` blocks.

Streamlit's own widgets (buttons, inputs, sliders, metrics, etc.) are
skinned natively via `.streamlit/config.toml` — see the bottom of this file
for the exact values to paste in. CSS variables alone cannot restyle native
Streamlit widgets because Streamlit renders them from its own compiled
theme, not from your page's stylesheet.
"""

from __future__ import annotations

TOKENS_CSS = """
:root {
  --color-bg: #FAF6EE;
  --color-surface: #FFFFFF;
  --color-surface-raised: #FFFDF9;
  --color-ink: #2B2420;
  --color-ink-soft: #5C5347;
  --color-border: #E6DFCF;

  --color-maple: #C1584C;
  --color-pine: #3F6B57;
  --color-slate: #5B7A99;
  --color-gold: #C99A3E;

  --color-maple-text: #A8473C;
  --color-pine-text: #3F6B57;
  --color-slate-text: #4E6A87;
  --color-gold-text: #8C6A22;

  --color-maple-tint: #F5E1DD;
  --color-pine-tint: #DDEAE3;
  --color-slate-tint: #DFE7EF;
  --color-gold-tint: #F3E7C9;

  --color-safety: #B3261E;
  --color-safety-ink: #FFFFFF;

  --color-success: var(--color-pine);
  --color-success-tint: var(--color-pine-tint);
  --color-warning: var(--color-gold);
  --color-warning-tint: var(--color-gold-tint);
  --color-info: var(--color-slate);
  --color-info-tint: var(--color-slate-tint);
  --color-danger: var(--color-safety);
  --color-danger-tint: #F7DAD8;

  --font-heading: "Fraunces", Georgia, "Times New Roman", serif;
  --font-body: "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-md: 1.125rem;
  --font-size-lg: 1.375rem;
  --font-size-xl: 1.75rem;
  --font-size-2xl: 2.25rem;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 999px;

  --shadow-sm: 0 1px 2px rgba(43, 36, 32, 0.06);
  --shadow-md: 0 4px 12px rgba(43, 36, 32, 0.08);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #1E1B17;
    --color-surface: #2A2621;
    --color-surface-raised: #322D27;
    --color-ink: #F3ECE0;
    --color-ink-soft: #C7BEAE;
    --color-border: #453F36;

    --color-maple: #E08A7E;
    --color-pine: #7FAE95;
    --color-slate: #93B4D1;
    --color-gold: #E3B966;

    --color-maple-text: #E08A7E;
    --color-pine-text: #7FAE95;
    --color-slate-text: #93B4D1;
    --color-gold-text: #E3B966;

    --color-maple-tint: #3B2A26;
    --color-pine-tint: #223530;
    --color-slate-tint: #24313C;
    --color-gold-tint: #3A311E;

    --color-safety: #FF6B5E;
    --color-safety-ink: #1E1B17;

    --color-danger: var(--color-safety);
    --color-danger-tint: #3E2321;
  }
}

/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Nunito+Sans:ital,opsz,wght@0,6..12,400;0,6..12,500;0,6..12,600;0,6..12,700;1,6..12,400&display=swap');

/* Apply body font + background to the Streamlit app shell */
html, body, [class*="css"] {
  font-family: var(--font-body);
}
.stApp {
  background-color: var(--color-bg);
  color: var(--color-ink);
}
h1, h2, h3 {
  font-family: var(--font-heading) !important;
  color: var(--color-ink) !important;
}

/* ---- Helper component classes for use inside st.markdown(...) ---- */

.hfh-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  color: var(--color-ink);
}

.hfh-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.hfh-badge-low      { background: var(--color-pine-tint);  color: var(--color-pine-text); }
.hfh-badge-medium   { background: var(--color-gold-tint);  color: var(--color-gold-text); }
.hfh-badge-high     { background: var(--color-maple-tint); color: var(--color-maple-text); }
.hfh-badge-info     { background: var(--color-slate-tint); color: var(--color-slate-text); }
.hfh-badge-verified { background: var(--color-pine-tint);  color: var(--color-pine-text); }

.hfh-alert {
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  padding: var(--space-4);
  font-size: var(--font-size-sm);
  margin: var(--space-3) 0;
}
.hfh-alert-info    { background: var(--color-slate-tint); border-color: var(--color-slate);  color: var(--color-ink); }
.hfh-alert-success { background: var(--color-pine-tint);  border-color: var(--color-pine);   color: var(--color-ink); }
.hfh-alert-warning { background: var(--color-gold-tint);  border-color: var(--color-gold);   color: var(--color-ink); }
.hfh-alert-error   { background: var(--color-maple-tint); border-color: var(--color-maple);  color: var(--color-ink); }

/* Crisis / safety banner — intentionally OUTSIDE the pastel system.
   Do not soften this. See components.md. */
.hfh-crisis-banner {
  background: var(--color-safety);
  color: var(--color-safety-ink);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
  font-weight: 700;
  font-size: var(--font-size-md);
  border: 2px solid var(--color-safety);
  box-shadow: var(--shadow-md);
}
"""


def inject_theme(extra_css: str = "") -> None:
    """Inject the shared Hack for Humanity design tokens + helper classes.

    Call once per page, after `st.set_page_config(...)`:

        from streamlit_theme import inject_theme
        inject_theme()

    Args:
        extra_css: optional additional raw CSS string to append (e.g. a
            project-specific tweak) so you don't need a second st.markdown
            call.
    """
    import streamlit as st

    st.markdown(f"<style>{TOKENS_CSS}\n{extra_css}</style>", unsafe_allow_html=True)


def badge(label: str, variant: str = "info") -> str:
    """Return an HTML snippet for a status badge/pill.

    variant: one of "low", "medium", "high", "info", "verified".
    Use with: st.markdown(badge("High risk", "high"), unsafe_allow_html=True)
    """
    return f'<span class="hfh-badge hfh-badge-{variant}">{label}</span>'


def crisis_banner(message: str) -> str:
    """Return an HTML snippet for a high-contrast crisis/safety banner.

    This intentionally does NOT use the pastel palette — safety-critical
    messaging (e.g. crisis line numbers, self-harm warnings, emergency
    contacts) must stay maximally visible. See components.md.
    """
    return f'<div class="hfh-crisis-banner">{message}</div>'


# ---------------------------------------------------------------------------
# .streamlit/config.toml — closest NATIVE Streamlit approximation
# ---------------------------------------------------------------------------
#
# CSS injection (above) cannot restyle Streamlit's native widgets (buttons,
# sliders, st.metric, the sidebar chrome, etc.) — those are controlled by
# Streamlit's own theme engine. Add a `.streamlit/config.toml` file next to
# your `app.py` with:
#
#   [theme]
#   base = "light"
#   primaryColor = "#C1584C"            # Maple Blush — primary buttons, active widgets
#   backgroundColor = "#FAF6EE"         # Birch Cream — main page background
#   secondaryBackgroundColor = "#FFFFFF"# Snowbank — sidebar / widget backgrounds
#   textColor = "#2B2420"               # Ink
#   font = "sans serif"                 # Streamlit only accepts a font family keyword;
#                                        # inject_theme() layers Nunito Sans/Fraunces on top via CSS.
#
# For a dark-mode variant, ship a second config (Streamlit supports only one
# static config.toml per app, so dark mode there means either: a user-toggle
# that swaps CSS variables via `data-theme`, or documenting these values for
# apps that want a manual "dark" config:
#
#   [theme]
#   base = "dark"
#   primaryColor = "#E08A7E"
#   backgroundColor = "#1E1B17"
#   secondaryBackgroundColor = "#2A2621"
#   textColor = "#F3ECE0"
