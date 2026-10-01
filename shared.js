/**
 * Field Inspector - shared runtime constants and URL helpers
 *
 * Loaded by BOTH the popup (via a <script> tag) and the service worker
 * (via importScripts), so the list of files that must be injected lives in
 * exactly one place. Duplicating that list is how a release ZIP silently
 * ships without a feature: popup.js once listed 5 content files while the
 * repo actually had 8, and the packaged extension lost the Domain Builder
 * and Chatter Manager. tests/shared.test.cjs fails if an entry is missing
 * or if the manifest stops referencing a file.
 *
 * Also holds the pure URL/origin helpers used by the per-origin
 * "remember this site" auto-enable flow. They are pure and side-effect
 * free so they can be unit-tested without a browser (see tests/).
 */
(function (scope) {
  "use strict";

  /**
   * Content scripts, in load order. Each file is an IIFE with an
   * idempotency guard that attaches to one shared isolated-world namespace
   * (window.__FI__), so load order is a real dependency, not a style
   * choice. domain-builder.js and chatter.js destructure that namespace
   * at parse time and therefore must come after everything they use.
   *
   * shared.js leads the list because it is this list's own source of truth:
   * injecting it into the page too is what lets a content script call the
   * same `debugFlagForUrl` the popup and worker use, instead of keeping a
   * second copy of that rule. It is a plain IIFE with no chrome API calls
   * at load time, so it is safe in a page's isolated world.
   */
  const CONTENT_FILES = [
    "shared.js",
    "content/utils.js",
    "content/odoo.js",
    "content/detector.js",
    "content/ui.js",
    "content/domain.js",
    "content/domain-builder.js",
    "content/chatter.js",
    "content/technical.js",
    "content/model-name.js",
    "content/content.js",
  ];

  const CONTENT_CSS = ["content.css"];


  /** Schemes the extension can never be injected into by Chrome. */
  const NON_INJECTABLE_SCHEMES = new Set([
    "chrome:",
    "chrome-untrusted:",
    "chrome-search:",
    "chrome-devtools:",
    "devtools:",
    "edge:",
    "about:",
    "brave:",
    "opera:",
    "vivaldi:",
    "view-source:",
    "moz-extension:",
    "chrome-extension:",
  ]);

  /** Hosts where Chrome blocks all extension injection, including the Web Store. */
  const NON_INJECTABLE_HOSTS = new Set([
    "chrome.google.com",
    "chromewebstore.google.com",
  ]);

  /**
   * True if the extension could be injected into this URL at all.
   * Mirrors popup.js's restricted-page list. `file:` is allowed here (and
   * was allowed before this helper existed) so a user who has enabled
   * "Allow access to file URLs" can still inspect a local HTML form —
   * but see autoEnableOriginForUrl, which deliberately excludes it.
   */
  function isInjectableUrl(url) {
    if (!url || typeof url !== "string") return false;
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      return false;
    }
    if (NON_INJECTABLE_SCHEMES.has(parsed.protocol)) return false;
    if (NON_INJECTABLE_HOSTS.has(parsed.hostname)) return false;
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "file:";
  }

  /**
   * The exact origin ("https://erp.example.com") a remembered-site entry is
   * keyed by, or "" when this page can't be remembered. Only http/https
   * qualify: an optional host permission cannot be requested for file://,
   * and a "remembered" entry that silently never fires would be worse than
   * not offering the option.
   */
  function autoEnableOriginForUrl(url) {
    if (!isInjectableUrl(url)) return "";
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.origin;
    } catch (err) {
      return "";
    }
  }

  /**
   * True when this URL's origin is in the user's remembered-site list.
   * Matching is exact-origin by design: "https://erp.example.com" does not
   * imply "https://intranet.example.com" or "http://erp.example.com",
   * because the granted host permission is equally narrow and silently
   * widening it would be a privacy surprise.
   */
  function isRememberedOrigin(url, remembered) {
    const origin = autoEnableOriginForUrl(url);
    if (!origin) return false;
    if (!Array.isArray(remembered)) return false;
    return remembered.includes(origin);
  }

  /** True when the current site is already covered by a granted host permission. */
  function isOriginGranted(origin) {
    if (!origin) return Promise.resolve(false);
    return chrome.permissions
      .contains({ origins: [`${origin}/*`] })
      .then((granted) => !!granted)
      .catch(() => false);
  }

  /**
   * Reads a `debug` query parameter off a URL: `?debug=1` forces debug mode on
   * for that page load, `?debug=0` (or `false`/`off`/`no`) forces it off, and
   * anything else — including a missing parameter or an unparseable URL —
   * returns null so the saved setting decides. Returns a real boolean or null
   * (never undefined) so callers can use a plain `=== null` test.
   *
   * Deliberately read-only and deliberately not persisted: a shared link with
   * `?debug=1` can make the extension log more to the console on that page,
   * but it can never flip a stored preference for every other page, and it
   * never enables the inspector by itself.
   */
  function debugFlagForUrl(url) {
    if (!url || typeof url !== "string") return null;
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      return null;
    }
    let raw;
    try {
      raw = parsed.searchParams.get("debug");
    } catch (err) {
      return null;
    }
    if (raw === null) return null;
    const value = raw.trim().toLowerCase();
    if (value === "" || value === "1" || value === "true" || value === "on" || value === "yes") return true;
    if (value === "0" || value === "false" || value === "off" || value === "no") return false;
    return null;
  }

  /**
   * Turns something a user typed into the exact origin string a remembered-site
   * entry is keyed by, or "" when it cannot be one. The full-page settings let
   * a site be added by hand (you may not be on that site right now), so this
   * input is untrusted: it accepts http/https URLs, bare hosts and host:port
   * pairs, rejects everything else, and deliberately refuses to carry a path,
   * query, fragment, credentials or wildcard through — the stored value is an
   * origin, and a remembered entry that looked like "https://erp.example.com/"
   * would simply never match a real page.
   */
  /**
   * Resolves the saved "system" theme against the OS preference. Returns
   * "light" or "dark" — never "system" — because everything downstream paints
   * from one of two palettes. Falls back to light when matchMedia is missing.
   */
  function resolveTheme(theme) {
    if (theme === "light" || theme === "dark") return theme;
    try {
      if (typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    } catch (err) {
      /* older engines: fall through to light */
    }
    return "light";
  }

  /**
   * Paints one element from a settings object: the theme and density
   * attributes the palettes and density rules are scoped to, plus the accent
   * as inline custom properties (inline beats a stylesheet, so the accent is
   * one write whichever palette block happens to match).
   *
   * Both consumers use this: content/ui.js for the live panel's shadow host,
   * and options/options.js for the settings page's preview — which is why the
   * preview cannot end up looking different from the real thing.
   */
  function applyThemeVars(el, settings) {
    const next = settings || {};
    const theme = resolveTheme(next.theme);
    const density = next.density === "compact" ? "compact" : "comfortable";
    const accentName = ACCENTS[next.accent] ? next.accent : DEFAULT_ACCENT;
    const colors = (ACCENTS[accentName] || {})[theme] || null;
    if (el) {
      el.setAttribute("data-theme", theme);
      el.setAttribute("data-density", density);
      el.setAttribute("data-accent", accentName);
      if (colors) {
        Object.keys(colors).forEach((key) => {
          el.style.setProperty(key === "accent" ? "--fi-accent" : `--fi-accent-${key}`, colors[key]);
        });
      }
    }
    return { theme, density, accent: accentName, colors };
  }

  function normalizeOrigin(text) {
    if (!text || typeof text !== "string") return "";
    const candidate = text.trim();
    if (!candidate) return "";
    if (/\s/.test(candidate)) return "";
    // A wildcard would turn "remember this site" into "remember every site";
    // a backslash is how host-confusion tricks are spelled.
    if (/[*\\]/.test(candidate)) return "";
    // Credentials are refused rather than stripped: quietly saving
    // "https://erp.example.com" from a paste that contained a password would
    // leave the user thinking the password was stored somewhere.
    if (candidate.includes("@")) return "";
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(candidate);
    // Only http/https. Without this, "file:///tmp" would be read as the host
    // "file" once the scheme below is prepended.
    if (hasScheme && !/^https?:\/\//i.test(candidate)) return "";
    let parsed;
    try {
      parsed = new URL(hasScheme ? candidate : "https://" + candidate);
    } catch (err) {
      return "";
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (!parsed.hostname) return "";
    if (parsed.hostname.startsWith(".") || parsed.hostname.endsWith(".")) return "";
    if (parsed.hostname.includes("..")) return "";
    // The URL parser accepts port 0, which is not a reachable target; Chrome
    // would reject the permission request later with a far less obvious error.
    if (parsed.port && Number(parsed.port) < 1) return "";
    // Path, query and fragment are dropped on purpose: users paste whole Odoo
    // URLs, and the remembered-site entry is an origin, so "…/web#web_client"
    // has to reduce to "https://erp.example.com" rather than never matching.
    return parsed.origin;
  }

  /**
   * Accent palettes. Each entry carries its own light and dark values so a
   * colour chosen in one theme stays readable in the other: `strong` is always
   * dark enough to carry white text (badges, the primary button), `accent` is
   * the link/underline colour, `soft`/`border`/`fg` are the tinted row and chip
   * colours, and `outline`/`wash` drive the page-level highlight in
   * content.css, which lives outside this shadow root and therefore cannot
   * read the host's own variables.
   */
  const ACCENTS = {
    blue: {
      label: "Blue",
      light: { accent: "#2563eb", strong: "#1d4ed8", soft: "#eef2ff", border: "#c7d2fe", fg: "#1e40af", outline: "rgba(37, 99, 235, 0.55)", wash: "rgba(37, 99, 235, 0.08)" },
      dark: { accent: "#7fa1f5", strong: "#3b6fe0", soft: "#1c2740", border: "#33456b", fg: "#a8c0fa", outline: "rgba(127, 161, 245, 0.6)", wash: "rgba(127, 161, 245, 0.12)" },
    },
    teal: {
      label: "Teal",
      light: { accent: "#0f766e", strong: "#0d5f59", soft: "#f0fdfa", border: "#99f6e4", fg: "#115e59", outline: "rgba(13, 148, 136, 0.55)", wash: "rgba(13, 148, 136, 0.08)" },
      dark: { accent: "#5eead4", strong: "#0f766e", soft: "#10332f", border: "#1c5b53", fg: "#7fe9da", outline: "rgba(94, 234, 212, 0.55)", wash: "rgba(94, 234, 212, 0.1)" },
    },
    purple: {
      label: "Purple",
      light: { accent: "#7c3aed", strong: "#6d28d9", soft: "#f5f3ff", border: "#ddd6fe", fg: "#5b21b6", outline: "rgba(124, 58, 237, 0.55)", wash: "rgba(124, 58, 237, 0.08)" },
      dark: { accent: "#c4b5fd", strong: "#9061e8", soft: "#2a2244", border: "#47356f", fg: "#d8ccfd", outline: "rgba(196, 181, 253, 0.55)", wash: "rgba(196, 181, 253, 0.1)" },
    },
    green: {
      label: "Green",
      light: { accent: "#15803d", strong: "#166534", soft: "#f0fdf4", border: "#bbf7d0", fg: "#14532d", outline: "rgba(21, 128, 61, 0.55)", wash: "rgba(21, 128, 61, 0.08)" },
      dark: { accent: "#5fd88a", strong: "#1f7a44", soft: "#123222", border: "#205738", fg: "#86e5a8", outline: "rgba(95, 216, 138, 0.55)", wash: "rgba(95, 216, 138, 0.1)" },
    },
    orange: {
      label: "Orange",
      light: { accent: "#c2410c", strong: "#9a3412", soft: "#fff7ed", border: "#fed7aa", fg: "#7c2d12", outline: "rgba(194, 65, 12, 0.55)", wash: "rgba(194, 65, 12, 0.08)" },
      dark: { accent: "#fdba74", strong: "#c2410c", soft: "#3a2413", border: "#6b3d1c", fg: "#fcd0a4", outline: "rgba(253, 186, 116, 0.55)", wash: "rgba(253, 186, 116, 0.1)" },
    },
    pink: {
      label: "Pink",
      light: { accent: "#be185d", strong: "#9d174d", soft: "#fdf2f8", border: "#fbcfe8", fg: "#831843", outline: "rgba(190, 24, 93, 0.55)", wash: "rgba(190, 24, 93, 0.08)" },
      dark: { accent: "#f0abfc", strong: "#a21caf", soft: "#3d1636", border: "#6b2459", fg: "#f8cffc", outline: "rgba(240, 171, 252, 0.55)", wash: "rgba(240, 171, 252, 0.1)" },
    },
  };
  const DEFAULT_ACCENT = "blue";

  /**
   * The panel's two colour palettes, as data. These 58 variables used to be
   * written out by hand inside PANEL_CSS; they are data here so the full-page
   * settings can paint itself from exactly the same values (via paletteCss)
   * instead of keeping a second copy that would quietly drift. The panel and
   * the options page provably agree, because neither owns the numbers.
   *
   * Accent-specific entries (--fi-link, --fi-tab-active, the copy-button
   * colours) are the accent's own values and are deliberately NOT here: they
   * are applied by JS as custom properties on the host, so changing accent
   * needs no stylesheet edit in either surface.
   */
  const PALETTE = {
    light: {
      "--fi-bg": "#ffffff",
      "--fi-fg": "#1f2430",
      "--fi-shadow": "0 8px 32px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(15, 23, 42, 0.06)",
      "--fi-header-bg": "#111827",
      "--fi-header-fg": "#f8fafc",
      "--fi-badge-form-bg": "var(--fi-accent-strong)",
      "--fi-badge-list-bg": "#7c3aed",
      "--fi-close-fg": "#cbd5e1",
      "--fi-close-hover-bg": "rgba(255,255,255,0.12)",
      "--fi-close-hover-fg": "#ffffff",
      "--fi-section-title-fg": "#64748b",
      "--fi-section-border": "#e5e7eb",
      "--fi-row-label-fg": "#64748b",
      "--fi-row-value-fg": "#111827",
      "--fi-pill-bg": "#f1f5f9",
      "--fi-pill-fg": "#334155",
      "--fi-pill-yes-bg": "#dcfce7",
      "--fi-pill-yes-fg": "#166534",
      "--fi-pill-no-bg": "#f1f5f9",
      "--fi-pill-no-fg": "#64748b",
      "--fi-copyable-bg": "#f8fafc",
      "--fi-copyable-border": "#e5e7eb",
      "--fi-code-fg": "#0f172a",
      "--fi-copy-btn-border": "#e2e8f0",
      "--fi-copy-btn-bg": "#ffffff",
      "--fi-copy-btn-fg": "#334155",
      "--fi-copy-btn-hover-bg": "var(--fi-accent-soft)",
      "--fi-copy-btn-hover-border": "var(--fi-accent-border)",
      "--fi-copied-bg": "#dcfce7",
      "--fi-copied-border": "#86efac",
      "--fi-copied-fg": "#166534",
      "--fi-preview-bg": "#0f172a",
      "--fi-preview-fg": "#e2e8f0",
      "--fi-attr-key": "#7c3aed",
      "--fi-hint-fg": "#94a3b8",
      "--fi-footer-bg": "#f8fafc",
      "--fi-footer-border": "#e5e7eb",
      "--fi-copy-all-bg": "var(--fi-accent-strong)",
      "--fi-copy-all-fg": "#ffffff",
      "--fi-copy-all-hover-bg": "var(--fi-accent)",
      "--fi-copy-all-copied-bg": "#16a34a",
      "--fi-link": "var(--fi-accent)",
      "--fi-table-stripe-bg": "rgba(15, 23, 42, 0.028)",
      "--fi-table-header-bg": "rgba(15, 23, 42, 0.035)",
      "--fi-tab-active": "var(--fi-accent)",
      "--fi-required-dot": "#ef4444",
      "--fi-chip-blue-bg": "#dbeafe",
      "--fi-chip-blue-fg": "#1d4ed8",
      "--fi-chip-purple-bg": "#ede9fe",
      "--fi-chip-purple-fg": "#6d28d9",
      "--fi-chip-green-bg": "#dcfce7",
      "--fi-chip-green-fg": "#166534",
      "--fi-chip-orange-bg": "#ffedd5",
      "--fi-chip-orange-fg": "#c2410c",
      "--fi-chip-teal-bg": "#ccfbf1",
      "--fi-chip-teal-fg": "#0f766e",
      "--fi-chip-pink-bg": "#fce7f3",
      "--fi-chip-pink-fg": "#be185d"
    },
    dark: {
      "--fi-bg": "#1a1d26",
      "--fi-fg": "#e6e9f0",
      "--fi-shadow": "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06)",
      "--fi-header-bg": "#0b0e14",
      "--fi-header-fg": "#f2f4f8",
      "--fi-badge-form-bg": "var(--fi-accent-strong)",
      "--fi-badge-list-bg": "#9061e8",
      "--fi-close-fg": "#8b93a7",
      "--fi-close-hover-bg": "rgba(255,255,255,0.1)",
      "--fi-close-hover-fg": "#ffffff",
      "--fi-section-title-fg": "#8b93a7",
      "--fi-section-border": "#2c313d",
      "--fi-row-label-fg": "#8b93a7",
      "--fi-row-value-fg": "#e6e9f0",
      "--fi-pill-bg": "#262b36",
      "--fi-pill-fg": "#c3c9d6",
      "--fi-pill-yes-bg": "#163a24",
      "--fi-pill-yes-fg": "#5fd88a",
      "--fi-pill-no-bg": "#262b36",
      "--fi-pill-no-fg": "#8b93a7",
      "--fi-copyable-bg": "#20242e",
      "--fi-copyable-border": "#2c313d",
      "--fi-code-fg": "#dbe1ee",
      "--fi-copy-btn-border": "#333947",
      "--fi-copy-btn-bg": "#20242e",
      "--fi-copy-btn-fg": "#c3c9d6",
      "--fi-copy-btn-hover-bg": "var(--fi-accent-soft)",
      "--fi-copy-btn-hover-border": "var(--fi-accent-border)",
      "--fi-copied-bg": "#163a24",
      "--fi-copied-border": "#1f7a44",
      "--fi-copied-fg": "#5fd88a",
      "--fi-preview-bg": "#0b0e14",
      "--fi-preview-fg": "#d7dbe4",
      "--fi-attr-key": "#b79bf5",
      "--fi-hint-fg": "#6b7385",
      "--fi-footer-bg": "#171a22",
      "--fi-footer-border": "#2c313d",
      "--fi-copy-all-bg": "var(--fi-accent)",
      "--fi-copy-all-fg": "#ffffff",
      "--fi-copy-all-hover-bg": "var(--fi-accent-strong)",
      "--fi-copy-all-copied-bg": "#1f9d55",
      "--fi-link": "var(--fi-accent)",
      "--fi-table-stripe-bg": "rgba(255, 255, 255, 0.032)",
      "--fi-table-header-bg": "rgba(255, 255, 255, 0.045)",
      "--fi-tab-active": "var(--fi-accent)",
      "--fi-required-dot": "#f87171",
      "--fi-chip-blue-bg": "#1e3a5f",
      "--fi-chip-blue-fg": "#93c5fd",
      "--fi-chip-purple-bg": "#3b2f5e",
      "--fi-chip-purple-fg": "#c4b5fd",
      "--fi-chip-green-bg": "#163a24",
      "--fi-chip-green-fg": "#5fd88a",
      "--fi-chip-orange-bg": "#4a2c12",
      "--fi-chip-orange-fg": "#fdba74",
      "--fi-chip-teal-bg": "#0f3d38",
      "--fi-chip-teal-fg": "#5eead4",
      "--fi-chip-pink-bg": "#4a1942",
      "--fi-chip-pink-fg": "#f0abfc"
    },
  };

  /**
   * The two palettes as CSS, scoped by a caller-supplied selector *function*
   * (the panel passes `:host([data-theme="…"])`, the options page passes
   * `:root[data-theme="…"]`). A function rather than a plain string because
   * the two forms are not interchangeable: `:root([data-theme="x"])` is
   * invalid — the parser reads `:root(` as an unknown functional pseudo-class
   * and drops the entire rule — while `:host([data-theme="x"])` is a real
   * functional pseudo-class and works. Writing it the wrong way round
   * silently produced a completely unstyled options page.
   *
   * Both surfaces resolving from this one function is the point: the panel and
   * the settings page cannot show different colours for the same theme.
   */
  function paletteCss(selectorFor) {
    const block = (theme) =>
      `    ${selectorFor(theme)} {\n` +
      Object.keys(PALETTE[theme])
        .map((name) => `      ${name}: ${PALETTE[theme][name]};`)
        .join("\n") +
      "\n    }";
    return [block("light"), block("dark")].join("\n");
  }

  /**
   * Every setting the extension has, with the value used when the user has
   * never touched it. This is the single source of truth: the content script,
   * the popup and the full-page settings (options/) all read it, so adding a
   * setting no longer means editing two or three copies that can silently
   * drift apart. tests/shared.test.cjs fails if any of them defines its own
   * literal defaults instead of reading this.
   */
  const DEFAULT_SETTINGS = {
    formView: true,
    listView: true,
    highlight: true,
    copyFormat: "text",
    odooMode: true,
    showSensitiveValues: false,
    interceptClicks: true,
    theme: "system",
    accent: DEFAULT_ACCENT,
    density: "comfortable",
    debug: false,
  };

  /**
   * The panel's entire stylesheet, verbatim. It lives here rather than in
   * content/ui.js so the full-page settings can show a *real* preview of the
   * panel: it mounts this exact text in a shadow root and applies the same
   * data-theme / data-density attributes and accent variables the live panel
   * uses. A hand-written mock would drift from the panel the first time the
   * panel's CSS changed; this cannot. content/ui.js is the other consumer.
   */
  const PANEL_CSS = `
    /* The active palette is applied by JS as an attribute on the host:
       "system" is resolved against matchMedia there, so the two palettes
       below are plain attribute-scoped blocks rather than a
       prefers-color-scheme media query. That is what lets an explicit
       choice override the OS setting instead of fighting it. */
    :host { all: initial; }
    /* light + dark palettes: PALETTE in this file, scoped to the shadow host */
    ${paletteCss((theme) => `:host([data-theme="${theme}"])`)}
    * { box-sizing: border-box; }
    .fi-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      bottom: 16px;
      width: 380px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px);
      display: flex;
      flex-direction: column;
      background: var(--fi-bg);
      color: var(--fi-fg);
      border-radius: 10px;
      box-shadow: var(--fi-shadow);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      z-index: 2147483647;
      overflow: hidden;
      animation: fi-slide-in 140ms ease-out;
    }
    /* An author display rule always wins the cascade over the browser's
       built-in [hidden] display:none UA rule, even at equal specificity
       -- so without this, setting panel.hidden = true (the close button,
       Esc, and click-outside-to-close all do this) had no visual effect
       and the panel never actually closed. */
    .fi-panel[hidden] { display: none; }
    @keyframes fi-slide-in {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fi-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: var(--fi-header-bg);
      color: var(--fi-header-fg);
      flex: 0 0 auto;
      cursor: grab;
      user-select: none;
    }
    .fi-header.fi-dragging { cursor: grabbing; }
    .fi-header-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; }
    .fi-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--fi-badge-form-bg);
      color: white;
    }
    .fi-badge.list { background: var(--fi-badge-list-bg); }
    .fi-required-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--fi-required-dot);
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
      flex: 0 0 auto;
    }
    .fi-required-dot[hidden] { display: none; }
    .fi-header-actions { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; }
    .fi-icon-btn {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--fi-close-fg);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
    }
    .fi-icon-btn svg { width: 15px; height: 15px; display: block; }
    .fi-icon-btn:hover { background: var(--fi-close-hover-bg); color: var(--fi-close-hover-fg); }
    .fi-close-btn {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--fi-close-fg);
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .fi-close-btn:hover { background: var(--fi-close-hover-bg); color: var(--fi-close-hover-fg); }
    .fi-history {
      flex: 0 0 auto;
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding: 6px 10px;
      border-bottom: 1px solid var(--fi-section-border);
      background: var(--fi-footer-bg);
    }
    .fi-history[hidden] { display: none; }
    .fi-history-item {
      appearance: none;
      border: 1px solid var(--fi-copy-btn-border);
      background: var(--fi-copy-btn-bg);
      color: var(--fi-copy-btn-fg);
      font-size: 10.5px;
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
      cursor: pointer;
      flex: 0 0 auto;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .fi-history-item:hover { background: var(--fi-copy-btn-hover-bg); }
    .fi-history-item.current { background: var(--fi-tab-active); border-color: var(--fi-tab-active); color: #fff; }
    .fi-body { overflow: hidden; padding: 0; flex: 1 1 auto; display: flex; flex-direction: column; }
    /* Styled after Odoo's own form-view notebook tabs: flat text tabs on the
       page background with a colored underline on the active one, rather
       than filled pill buttons — so the panel reads like an Odoo page. */
    .fi-tabs {
      flex: 0 0 auto;
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      gap: 4px;
      padding: 0 10px;
      border-bottom: 1px solid var(--fi-section-border);
      scrollbar-width: thin;
    }
    .fi-tabs::-webkit-scrollbar { height: 4px; }
    .fi-tabs::-webkit-scrollbar-track { background: transparent; }
    .fi-tabs::-webkit-scrollbar-thumb { background: var(--fi-section-border); border-radius: 4px; }
    .fi-tab {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--fi-section-title-fg);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 10px 9px;
      margin-bottom: -1px;
      border-bottom: 2px solid transparent;
      cursor: pointer;
    }
    .fi-tab-icon { display: inline-flex; width: 14px; height: 14px; flex: 0 0 auto; }
    .fi-tab-icon svg { display: block; }
    .fi-tab:hover { color: var(--fi-row-value-fg); border-bottom-color: var(--fi-section-border); }
    .fi-tab.active { color: var(--fi-tab-active); font-weight: 700; border-bottom-color: var(--fi-tab-active); }
    .fi-tab-content { overflow-y: auto; padding: 10px 14px 14px; flex: 1 1 auto; animation: fi-fade-in 130ms ease-out; }
    @keyframes fi-fade-in {
      from { opacity: 0; transform: translateY(2px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fi-tab-toolbar { display: flex; justify-content: flex-end; margin-bottom: 6px; }
    .fi-table {
      border: 1px solid var(--fi-section-border);
      border-radius: 8px;
      overflow: hidden;
      background: var(--fi-copyable-bg);
      margin: 2px 0 4px;
    }
    .fi-table-head {
      display: flex;
      padding: 5px 10px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--fi-section-title-fg);
      background: var(--fi-table-header-bg);
      border-bottom: 1px solid var(--fi-section-border);
    }
    .fi-table-head span:first-child { flex: 0 0 112px; }
    .fi-table-head span:last-child { flex: 1 1 auto; }
    .fi-row { display: flex; gap: 10px; padding: 7px 10px; align-items: flex-start; }
    .fi-table .fi-row + .fi-row { border-top: 1px solid var(--fi-section-border); }
    .fi-table .fi-row:nth-child(even) { background: var(--fi-table-stripe-bg); }
    .fi-table .fi-row:hover { background: var(--fi-copy-btn-hover-bg); }
    .fi-row-label {
      flex: 0 0 112px;
      color: var(--fi-row-label-fg);
      font-weight: 600;
      font-size: 12px;
      padding-top: 1px;
    }
    .fi-table .fi-row-label {
      border-right: 1px solid var(--fi-section-border);
      padding-right: 10px;
      margin-right: -1px;
    }
    .fi-row-label.fi-mono-label {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--fi-attr-key);
      font-weight: 600;
    }
    .fi-row-value {
      flex: 1 1 auto;
      color: var(--fi-row-value-fg);
      word-break: break-word;
      font-size: 12.5px;
    }
    .fi-row-value.fi-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; }
    .fi-link { color: var(--fi-link); }
    .fi-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--fi-pill-bg);
      color: var(--fi-pill-fg);
    }
    .fi-pill.yes { background: var(--fi-pill-yes-bg); color: var(--fi-pill-yes-fg); }
    .fi-pill.no { background: var(--fi-pill-no-bg); color: var(--fi-pill-no-fg); }
    .fi-pill.blue { background: var(--fi-chip-blue-bg); color: var(--fi-chip-blue-fg); }
    .fi-pill.purple { background: var(--fi-chip-purple-bg); color: var(--fi-chip-purple-fg); }
    .fi-pill.green { background: var(--fi-chip-green-bg); color: var(--fi-chip-green-fg); }
    .fi-pill.orange { background: var(--fi-chip-orange-bg); color: var(--fi-chip-orange-fg); }
    .fi-pill.teal { background: var(--fi-chip-teal-bg); color: var(--fi-chip-teal-fg); }
    .fi-pill.pink { background: var(--fi-chip-pink-bg); color: var(--fi-chip-pink-fg); }
    .fi-pill.gray { background: var(--fi-pill-bg); color: var(--fi-pill-fg); }
    .fi-copyable {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--fi-copyable-bg);
      border: 1px solid var(--fi-copyable-border);
      border-radius: 6px;
      padding: 6px 8px;
      margin-top: 4px;
    }
    .fi-copyable code {
      flex: 1 1 auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11.5px;
      word-break: break-all;
      color: var(--fi-code-fg);
    }
    .fi-copy-btn {
      appearance: none;
      border: 1px solid var(--fi-copy-btn-border);
      background: var(--fi-copy-btn-bg);
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
      padding: 3px 7px;
      flex: 0 0 auto;
      color: var(--fi-copy-btn-fg);
    }
    .fi-copy-btn:hover { background: var(--fi-copy-btn-hover-bg); border-color: var(--fi-copy-btn-hover-border); }
    .fi-copy-btn.fi-copied { background: var(--fi-copied-bg); border-color: var(--fi-copied-border); color: var(--fi-copied-fg); }
    .fi-html-preview {
      background: var(--fi-preview-bg);
      color: var(--fi-preview-fg);
      border-radius: 6px;
      padding: 8px 9px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 120px;
      overflow-y: auto;
    }
    .fi-empty-hint { color: var(--fi-hint-fg); font-size: 12px; font-style: italic; padding: 2px 0; }
    .fi-muted { color: var(--fi-row-label-fg); }
    .fi-footer { flex: 0 0 auto; padding: 10px 14px; border-top: 1px solid var(--fi-footer-border); background: var(--fi-footer-bg); }
    .fi-copy-all-btn {
      width: 100%;
      appearance: none;
      border: none;
      background: var(--fi-copy-all-bg);
      color: var(--fi-copy-all-fg);
      font-weight: 600;
      font-size: 13px;
      padding: 9px 10px;
      border-radius: 7px;
      cursor: pointer;
    }
    .fi-copy-all-btn:hover { background: var(--fi-copy-all-hover-bg); }
    .fi-copy-all-btn.fi-copied { background: var(--fi-copy-all-copied-bg); }
    .fi-finder-btn {
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      appearance: none;
      border: none;
      background: var(--fi-copy-all-bg);
      color: var(--fi-copy-all-fg);
      box-shadow: var(--fi-shadow);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
    }
    .fi-options-btn { transition: transform 150ms ease, background 150ms ease; }
    .fi-options-btn[aria-expanded="true"] { transform: rotate(45deg); }
    .fi-options-panel {
      position: fixed; right: 16px; bottom: 72px;
      width: max-content; max-width: calc(100vw - 32px);
      max-height: calc(100vh - 88px); overflow-y: auto;
      z-index: 2147483647; color: var(--fi-fg);
      font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .fi-options-panel[hidden] { display: none; }
    .fi-options-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; padding: 5px; }
    .fi-option {
      display: flex; align-items: center; gap: 9px; max-width: 100%;
      min-height: 42px; padding: 10px 16px; border: 1px solid var(--fi-section-border);
      border-radius: 24px; background: var(--fi-bg); color: inherit;
      box-shadow: 0 3px 10px rgba(15, 23, 42, .18);
      text-align: left; font: inherit; font-weight: 500; cursor: pointer;
      overflow-wrap: anywhere; transition: background 120ms ease, transform 120ms ease;
    }
    .fi-option:hover:not(:disabled) { background: var(--fi-copy-btn-hover-bg); transform: translateX(-3px); }
    .fi-option:focus-visible { outline: 2px solid var(--fi-tab-active); outline-offset: 2px; }
    .fi-option[aria-pressed="true"] { border-color: var(--fi-tab-active); }
    .fi-option:disabled { opacity: .5; cursor: default; }
    .fi-option-icon { display: flex; flex: 0 0 18px; }
    .fi-option-icon svg { width: 18px; height: 18px; }
    .fi-option small { display: block; color: var(--fi-hint-fg); margin-top: 3px; overflow-wrap: anywhere; }
    @media (prefers-reduced-motion: reduce) { .fi-options-btn, .fi-option { transition: none; } }
    .fi-finder-btn[hidden] { display: none; }
    .fi-finder-btn svg { width: 20px; height: 20px; }
    .fi-finder-btn:hover { background: var(--fi-copy-all-hover-bg); }
    .fi-finder-panel {
      position: fixed;
      right: 16px;
      bottom: 68px;
      width: 340px;
      max-width: calc(100vw - 32px);
      max-height: min(60vh, 480px);
      display: flex;
      flex-direction: column;
      background: var(--fi-bg);
      color: var(--fi-fg);
      border-radius: 10px;
      box-shadow: var(--fi-shadow);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      overflow: hidden;
      animation: fi-slide-in 140ms ease-out;
    }
    .fi-finder-panel[hidden] { display: none; }
    .fi-settings-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      bottom: 16px;
      width: 340px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px);
      display: flex;
      flex-direction: column;
      background: var(--fi-bg);
      color: var(--fi-fg);
      border-radius: 10px;
      box-shadow: var(--fi-shadow);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      overflow: hidden;
      animation: fi-slide-in 140ms ease-out;
    }
    .fi-settings-panel[hidden] { display: none; }
    .fi-settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: var(--fi-header-bg);
      color: var(--fi-header-fg);
      font-weight: 600;
      flex: 0 0 auto;
    }
    .fi-settings-body { overflow-y: auto; padding: 4px 0 14px; flex: 1 1 auto; }
    .fi-settings-section-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--fi-section-title-fg);
      padding: 14px 14px 6px;
    }
    .fi-setting {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 14px;
      min-height: 34px;
    }
    .fi-setting + .fi-setting { border-top: 1px solid var(--fi-section-border); }
    .fi-setting-label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .fi-setting-label > span { font-weight: 500; }
    .fi-setting-hint { font-size: 11px; color: var(--fi-hint-fg); }
    .fi-segmented { display: flex; flex: 0 0 auto; border: 1px solid var(--fi-section-border); border-radius: 6px; overflow: hidden; }
    .fi-segmented button {
      appearance: none;
      border: none;
      background: var(--fi-copy-btn-bg);
      color: var(--fi-copy-btn-fg);
      font: inherit;
      font-size: 11px;
      padding: 4px 9px;
      cursor: pointer;
    }
    .fi-segmented button + button { border-left: 1px solid var(--fi-section-border); }
    .fi-segmented button[aria-pressed="true"] { background: var(--fi-accent-soft); color: var(--fi-accent-fg); font-weight: 600; }
    .fi-swatches { display: flex; flex: 0 0 auto; gap: 6px; }
    .fi-swatch {
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid transparent;
      box-shadow: 0 0 0 1px var(--fi-copy-btn-border);
      cursor: pointer;
      padding: 0;
    }
    .fi-swatch[aria-pressed="true"] { border-color: var(--fi-bg); box-shadow: 0 0 0 2px var(--fi-accent); }
    .fi-switch {
      appearance: none;
      position: relative;
      flex: 0 0 auto;
      width: 34px;
      height: 20px;
      border-radius: 10px;
      border: 1px solid var(--fi-section-border);
      background: var(--fi-pill-bg);
      cursor: pointer;
      margin: 0;
    }
    .fi-switch::after {
      content: "";
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--fi-copy-btn-fg);
      transition: transform 120ms ease;
    }
    .fi-switch[aria-checked="true"] { background: var(--fi-accent); border-color: var(--fi-accent); }
    .fi-switch[aria-checked="true"]::after { transform: translateX(14px); background: #ffffff; }
    .fi-settings-note { font-size: 11px; color: var(--fi-hint-fg); padding: 4px 14px 0; }
    .fi-settings-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      background: var(--fi-copyable-bg);
      border: 1px solid var(--fi-copyable-border);
      border-radius: 4px;
      padding: 1px 4px;
      color: var(--fi-code-fg);
    }
    .fi-debug-log {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10.5px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 6px 14px 0;
      padding: 8px 10px;
      max-height: 170px;
      overflow-y: auto;
      background: var(--fi-preview-bg);
      color: var(--fi-preview-fg);
      border-radius: 6px;
    }
    .fi-finder-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--fi-header-bg);
      color: var(--fi-header-fg);
      font-weight: 600;
      flex: 0 0 auto;
    }
    .fi-finder-search-wrap { padding: 10px 12px; flex: 0 0 auto; border-bottom: 1px solid var(--fi-section-border); }
    .fi-finder-search {
      width: 100%;
      appearance: none;
      border: 1px solid var(--fi-copy-btn-border);
      background: var(--fi-copyable-bg);
      color: var(--fi-fg);
      border-radius: 7px;
      padding: 7px 9px;
      font-size: 13px;
      outline: none;
    }
    .fi-finder-search:focus { border-color: var(--fi-tab-active); }
    .fi-finder-count { padding: 6px 12px 0; font-size: 11px; color: var(--fi-hint-fg); flex: 0 0 auto; }
    .fi-finder-results { overflow-y: auto; flex: 1 1 auto; padding: 6px; }
    .fi-finder-result {
      display: block;
      width: 100%;
      text-align: left;
      appearance: none;
      border: none;
      background: transparent;
      border-radius: 7px;
      padding: 7px 8px;
      cursor: pointer;
      color: inherit;
      font: inherit;
    }
    .fi-finder-result:hover { background: var(--fi-copy-btn-hover-bg); }
    .fi-finder-result-top { display: flex; align-items: center; gap: 6px; }
    .fi-finder-result-label { font-weight: 600; font-size: 12.5px; min-width: 0; white-space: normal; overflow-wrap: anywhere; }
    .fi-finder-result-name {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      color: var(--fi-row-label-fg);
      margin-top: 2px;
    }
    @media (max-width: 460px) {
      .fi-panel { left: 12px; right: 12px; top: 12px; bottom: 12px; width: auto; }
      .fi-finder-panel { left: 12px; right: 12px; width: auto; }
      .fi-settings-panel { left: 12px; right: 12px; top: 12px; bottom: 12px; width: auto; }
    }
    /* Compact density only tightens spacing and text size — never layout,
       widths, or anything a value could be clipped by. */
    :host([data-density="compact"]) .fi-panel { font-size: 12px; }
    :host([data-density="compact"]) .fi-header { padding: 8px 12px; }
    :host([data-density="compact"]) .fi-tab-content { padding: 7px 12px 11px; }
    :host([data-density="compact"]) .fi-row { padding: 4px 10px; }
    :host([data-density="compact"]) .fi-footer { padding: 7px 12px; }
    :host([data-density="compact"]) .fi-finder-search-wrap { padding: 7px 10px; }
    :host([data-density="compact"]) .fi-finder-results { padding: 4px; }
  `;

  /**
   * The panel's inline SVG icons, shared so the full-page settings preview can
   * show the real header buttons instead of an approximation of them.
   */
  const ICONS = {
    chatter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 3h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6 4V4a1 1 0 0 1 1-1z"/><path d="M7 8h10M7 12h7"/></svg>`,
    history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg>`,
    power: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v9M6 6a9 9 0 1 0 12 0"/></svg>`,
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m10 5-7 7 7 7M3 12h18"/></svg>`,
    gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.1"/><path d="M19.4 14.4a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.04a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.04z"/></svg>`,
    target: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke-linecap="round"/></svg>`,
    odoo: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><ellipse cx="8" cy="3.4" rx="5.5" ry="1.8"/><path d="M2.5 3.4v4.1c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8V3.4"/><path d="M2.5 7.5v4.1c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8V7.5"/></svg>`,
    info: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 7.3v4" stroke-linecap="round"/><circle cx="8" cy="4.9" r="0.9" fill="currentColor" stroke="none"/></svg>`,
    state: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="5" width="13" height="6" rx="3"/><circle cx="10.5" cy="8" r="1.7" fill="currentColor" stroke="none"/></svg>`,
    selectors: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M2 2l5.2 12 1.9-4.9L14 7.2z"/></svg>`,
    structure: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 1.5l6.5 3.2L8 8 1.5 4.7z"/><path d="M1.5 8.3L8 11.5l6.5-3.2"/><path d="M1.5 11.6L8 14.8l6.5-3.2"/></svg>`,
    validation: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.5l5.5 2v4c0 4-2.5 6.2-5.5 7-3-.8-5.5-3-5.5-7v-4z"/><path d="M5.7 8.2l1.6 1.6 3-3.4" stroke-linecap="round"/></svg>`,
    data: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><path d="M1.5 8.5V2.5a1 1 0 0 1 1-1H8l6.5 6.5-6.5 6.5z"/><circle cx="4.7" cy="4.7" r="1" fill="currentColor" stroke="none"/></svg>`,
    aria: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 8s2.7-4.5 7-4.5S15 8 15 8s-2.7 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg>`,
    other: `<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg>`,
    column: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="2" width="5.5" height="12" rx="1"/><rect x="9" y="2" width="5.5" height="12" rx="1"/></svg>`,
    cell: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/><path d="M8 1.5v13M1.5 8h13"/></svg>`,
    table: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M1.5 6.3h13M1.5 10h13M6.2 2.5v11M10.8 2.5v11"/></svg>`,
    sample: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="4.5" width="13" height="7" rx="1.5"/><path d="M5 6.5v3" stroke-linecap="round"/></svg>`,
    search: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>`,
    mouse: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3.5" y="1.5" width="9" height="13" rx="4.5"/><path d="M8 4.5v2.5" stroke-linecap="round"/></svg>`,
  };

  scope.FI_SHARED = {
    CONTENT_FILES,
    CONTENT_CSS,
    isInjectableUrl,
    autoEnableOriginForUrl,
    isRememberedOrigin,
    isOriginGranted,
    debugFlagForUrl,
    ACCENTS,
    DEFAULT_ACCENT,
    DEFAULT_SETTINGS,
    PANEL_CSS,
    PALETTE,
    paletteCss,
    ICONS,
    applyThemeVars,
    resolveTheme,
    normalizeOrigin,
  };
})(typeof self !== "undefined" ? self : globalThis);
