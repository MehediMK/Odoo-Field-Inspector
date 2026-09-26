/**
 * Field Inspector - full-page settings (the extension's Options page).
 *
 * This is the canonical settings surface: the popup keeps a compact set of
 * quick toggles, and everything is settable here with room to explain it.
 * Two rules keep the two surfaces honest:
 *
 *  1. The list of settings is not repeated in this file. DEFAULT_SETTINGS in
 *     shared.js owns the keys, and GROUPS below owns only the presentation
 *     (label, control type, help text). tests/shared.test.cjs fails if a
 *     setting has no entry here.
 *  2. The preview is the real panel. PANEL_CSS and ICONS come from shared.js
 *     and the palette is injected from the same PALETTE object the panel's own
 *     stylesheet is generated from, so the preview cannot drift from the panel
 *     the way a hand-written mock would.
 */
(function () {
  "use strict";

  const {
    DEFAULT_SETTINGS,
    ACCENTS,
    PANEL_CSS,
    paletteCss,
    applyThemeVars,
    resolveTheme,
    ICONS,
    normalizeOrigin,
  } = self.FI_SHARED;

  const SETTINGS_KEY = "fiSettings";
  const REMEMBERED_SITES_KEY = "fiRememberedOrigins";

  /**
   * Presentation for every setting. `key` must exist in DEFAULT_SETTINGS; the
   * control writes that key back verbatim.
   */
  const GROUPS = [
    {
      id: "appearance",
      title: "Appearance",
      intro:
        "These apply to the inspector panel and to the outlines it draws around detected fields.",
      items: [
        {
          key: "theme",
          type: "segmented",
          label: "Theme",
          options: [
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ],
          hint: "System follows your operating system, including while it is running — the panel repaints as the OS flips.",
        },
        {
          key: "accent",
          type: "accents",
          label: "Accent color",
          hint: "Recolours links, tabs, the primary button and the highlight outlines on the page. Each colour is tuned to stay readable in both themes.",
        },
        {
          key: "density",
          type: "segmented",
          label: "Density",
          options: [
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ],
          hint: "Compact fits more rows on screen, for long list views.",
        },
      ],
    },
    {
      id: "detection",
      title: "Detection",
      intro: "Which parts of a page the inspector treats as inspectable.",
      items: [
        {
          key: "formView",
          type: "switch",
          label: "Form View",
          hint: "Labels, inputs, selects, textareas and custom Odoo controls.",
        },
        {
          key: "listView",
          type: "switch",
          label: "List View",
          hint: "Table and grid column headers.",
        },
      ],
    },
    {
      id: "behavior",
      title: "Behavior",
      items: [
        {
          key: "highlight",
          type: "switch",
          label: "Highlight detected fields",
          hint: "Outlines every field the inspector recognises, using your accent colour.",
        },
        {
          key: "interceptClicks",
          type: "switch",
          label: "Intercept clicks",
          hint: "On: clicking a field opens the panel and the click does not reach the page. Off: clicks pass through and can change data, and the panel opens alongside. Save and Delete buttons are never hijacked either way.",
        },
        {
          key: "odooMode",
          type: "switch",
          label: "Odoo Developer Mode",
          hint: "The only setting that sends anything to your server: the clicked field's model and technical name, one fixed setting to detect your Odoo version, and view metadata for the model you are on. Turn it off and everything else keeps working.",
        },
        {
          key: "showSensitiveValues",
          type: "switch",
          label: "Show sensitive values",
          hint: "Passwords, tokens and other secret-named values stay redacted until you turn this on.",
        },
        {
          key: "copyFormat",
          type: "segmented",
          label: "Copy format",
          options: [
            { value: "text", label: "Plain text" },
            { value: "json", label: "JSON" },
          ],
          hint: "What the panel's copy buttons put on your clipboard.",
        },
      ],
    },
    {
      id: "debug",
      title: "Debug",
      items: [
        {
          key: "debug",
          type: "switch",
          label: "Debug logging",
          hint: "Verbose diagnostics in the page console, plus a live readout in the panel's own Settings page. You can also force it per page load with ?debug=1 (on) or ?debug=0 (off) in that page's URL — the URL always wins over this switch and is never remembered.",
        },
      ],
    },
  ];

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    remembered: [],
  };

  const els = {};
  let previewBuilt = false;

  // --- storage -------------------------------------------------------------

  function normalizeSites(sites) {
    return Array.isArray(sites) ? sites.filter((entry) => typeof entry === "string") : [];
  }

  function readStored() {
    return chrome.storage.local
      .get([SETTINGS_KEY, REMEMBERED_SITES_KEY])
      .then((stored) => {
        const settings = stored && stored[SETTINGS_KEY];
        state.settings = { ...DEFAULT_SETTINGS, ...(settings && typeof settings === "object" ? settings : {}) };
        state.remembered = normalizeSites(stored && stored[REMEMBERED_SITES_KEY]);
      })
      .catch(() => {});
  }

  function writeSettings() {
    return chrome.storage.local.set({ [SETTINGS_KEY]: { ...state.settings } }).catch(() => {});
  }

  function writeRemembered() {
    return chrome.storage.local.set({ [REMEMBERED_SITES_KEY]: state.remembered }).catch(() => {});
  }

  // --- painting ------------------------------------------------------------

  /**
   * The page's own colours come from the same palette object the panel uses,
   * just scoped to :root instead of the panel's shadow host.
   */
  function injectPalette() {
    const style = document.createElement("style");
    // ":root[...]" without parentheses — see paletteCss's note: ":root([...])"
    // is not a valid selector and would drop the whole palette.
    style.textContent =
      paletteCss((theme) => `:root[data-theme="${theme}"]`) +
      '\n:root[data-theme="dark"] { color-scheme: dark; }\n' +
      ':root[data-theme="light"] { color-scheme: light; }';
    document.head.appendChild(style);
  }

  function setSetting(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return;
    state.settings[key] = value;
    writeSettings();
    syncControls();
    paint();
  }

  function syncControls() {
    els.settings.querySelectorAll("[data-setting]").forEach((control) => {
      const key = control.dataset.setting;
      const current = state.settings[key];
      if (control.type === "checkbox") control.checked = !!current;
      else control.setAttribute("aria-pressed", String(control.dataset.value === String(current)));
    });
    // Swatch fills follow the *resolved* theme, so a dark theme shows the
    // colours the user would actually see on a page. Resolved from the setting
    // directly: reading the last painted result instead left every swatch one
    // change behind the theme, because paint() runs after this.
    const theme = resolveTheme(state.settings.theme);
    els.settings.querySelectorAll(".op-swatch").forEach((swatch) => {
      const entry = ACCENTS[swatch.dataset.value];
      const colors = entry && (entry[theme] || entry.light);
      if (colors) swatch.style.setProperty("--op-swatch", colors.strong);
    });
  }

  function controlMarkup(item) {
    if (item.type === "switch") {
      return `<label class="op-switch"><input type="checkbox" data-setting="${item.key}" aria-label="${item.label}"><span class="op-slider"></span></label>`;
    }
    if (item.type === "accents") {
      const swatches = Object.keys(ACCENTS)
        .map(
          (name) =>
            `<button type="button" class="op-swatch" data-setting="${item.key}" data-type="choice" data-value="${name}" aria-pressed="false" title="${ACCENTS[name].label}" aria-label="${ACCENTS[name].label}"></button>`,
        )
        .join("");
      return `<div class="op-swatches" role="group" aria-label="${item.label}">${swatches}</div>`;
    }
    // segmented
    const buttons = item.options
      .map(
        (option) =>
          `<button type="button" data-setting="${item.key}" data-type="choice" data-value="${option.value}" aria-pressed="false">${option.label}</button>`,
      )
      .join("");
    return `<div class="op-seg" role="group" aria-label="${item.label}">${buttons}</div>`;
  }

  function rowMarkup(item) {
    const hint = item.hint ? `<p class="op-hint-inline">${item.hint}</p>` : "";
    return `<div class="op-row">
      <div class="op-row-main">
        <span class="op-label">${item.label}</span>
        ${hint}
      </div>
      <div class="op-control">${controlMarkup(item)}</div>
    </div>`;
  }

  function groupMarkup(group) {
    const intro = group.intro ? `<p class="op-hint op-group-intro">${group.intro}</p>` : "";
    return `<section class="op-card" data-group="${group.id}">
      <h2 class="op-card-title">${group.title}</h2>
      ${intro}
      ${group.items.map(rowMarkup).join("")}
    </section>`;
  }

  function renderGroups() {
    els.settings.innerHTML = GROUPS.map(groupMarkup).join("");
  }

  /**
   * A faithful stand-in for the panel: same stylesheet, same class names, same
   * header buttons. What it does not have is live field data — this is a
   * picture of the panel's chrome, not a second implementation of it.
   */
  const PREVIEW_HTML = `
    <div class="fi-panel">
      <div class="fi-header">
        <div class="fi-header-title">
          <span>Field Inspector</span>
          <span class="fi-badge">Form</span>
        </div>
        <div class="fi-header-actions">
          <button type="button" class="fi-icon-btn" aria-label="Settings" tabindex="-1">${ICONS.gear}</button>
          <button type="button" class="fi-close-btn" aria-label="Close" tabindex="-1">×</button>
        </div>
      </div>
      <div class="fi-body">
        <div class="fi-tabs" role="tablist">
          <button type="button" class="fi-tab active" tabindex="-1"><span class="fi-tab-icon">${ICONS.selectors}</span><span>Selectors</span></button>
          <button type="button" class="fi-tab" tabindex="-1"><span class="fi-tab-icon">${ICONS.odoo}</span><span>Odoo</span></button>
          <button type="button" class="fi-tab" tabindex="-1"><span class="fi-tab-icon">${ICONS.structure}</span><span>View</span></button>
        </div>
        <div class="fi-tab-content">
          <div class="fi-row">
            <div class="fi-row-label">CSS Selector</div>
            <div class="fi-row-value fi-copyable">#partner_name</div>
          </div>
          <div class="fi-row">
            <div class="fi-row-label">XPath</div>
            <div class="fi-row-value fi-copyable">//input[@name='partner_name']</div>
          </div>
          <div class="fi-row">
            <div class="fi-row-label">Technical Name</div>
            <div class="fi-row-value">partner_name</div>
          </div>
          <div class="fi-row">
            <div class="fi-row-label">Value</div>
            <div class="fi-row-value">Azure Interior</div>
          </div>
          <div class="fi-row">
            <div class="fi-row-label">Record</div>
            <div class="fi-row-value"><a class="fi-link" href="#" onclick="return false">res.partner(7)</a></div>
          </div>
          <div class="fi-row">
            <div class="fi-row-label">Required</div>
            <div class="fi-row-value"><span class="fi-pill fi-pill-yes">Yes</span></div>
          </div>
          <div class="fi-row">
            <div class="fi-row-label">Copy this row</div>
            <div class="fi-row-value"><button type="button" class="fi-copy-btn" tabindex="-1">Copy</button></div>
          </div>
        </div>
      </div>
      <div class="fi-footer">
        <button type="button" class="fi-copy-all-btn" tabindex="-1">Copy All Information</button>
      </div>
    </div>`;

  function buildPreview() {
    if (previewBuilt) return;
    const shadow = els.preview.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);
    const holder = document.createElement("div");
    holder.innerHTML = PREVIEW_HTML;
    shadow.appendChild(holder.firstElementChild);
    previewBuilt = true;
  }

  function paint() {
    const painted = applyThemeVars(els.preview, state.settings);
    // The page chrome needs the same theme attributes AND accent variables the
    // panel gets. Setting them on the preview host alone left every control on
    // this page falling back to the hard-coded blue defaults in options.css.
    applyThemeVars(document.documentElement, state.settings);
    const accent = ACCENTS[painted.accent];
    const label = accent ? accent.label : painted.accent;
    const themeLabel = state.settings.theme === "system" ? `System (${painted.theme})` : painted.theme;
    els.previewState.textContent = `Panel theme: ${themeLabel} · Accent: ${label} · Density: ${painted.density}`;
  }

  // --- sites ---------------------------------------------------------------

  function renderSites() {
    if (!state.remembered.length) {
      els.siteList.innerHTML = "";
      return;
    }
    els.siteList.innerHTML = state.remembered
      .map(
        (origin) => `<div class="op-site">
          <span class="op-site-origin">${origin}</span>
          <button type="button" class="op-btn op-btn-danger" data-remove-origin="${origin}">Remove</button>
        </div>`,
      )
      .join("");
  }

  function setSiteHint(text, isError) {
    els.siteHint.textContent = text;
    els.siteHint.classList.toggle("op-hint-inline", false);
    els.siteHint.style.color = isError ? "var(--fi-close-hover-fg, #b42318)" : "";
  }

  async function onAddSite(event) {
    event.preventDefault();
    const origin = normalizeOrigin(els.siteInput.value);
    if (!origin) {
      setSiteHint("That does not look like a site address. Try something like https://erp.example.com", true);
      return;
    }
    if (state.remembered.includes(origin)) {
      setSiteHint(`${origin} is already on the list.`, true);
      return;
    }
    // Must be the first await: Chrome only accepts a permission request while
    // it still considers us inside the click's user gesture.
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    } catch (err) {
      granted = false;
    }
    if (!granted) {
      setSiteHint("Chrome denied access to that site, so nothing was changed. You can grant it from the extension's page in chrome://extensions.", true);
      return;
    }
    state.remembered = [...state.remembered, origin];
    await writeRemembered();
    els.siteInput.value = "";
    renderSites();
    setSiteHint(`The inspector will start automatically on every page at ${origin}.`, false);
  }

  async function onRemoveSite(origin) {
    await chrome.permissions.remove({ origins: [`${origin}/*`] }).catch(() => {});
    state.remembered = state.remembered.filter((entry) => entry !== origin);
    await writeRemembered();
    renderSites();
    setSiteHint(`Removed ${origin}, and access to it was handed back.`, false);
  }

  // --- wiring --------------------------------------------------------------

  function onSettingsClick(event) {
    const control = event.target.closest("[data-setting][data-type=\"choice\"]");
    if (!control) return;
    setSetting(control.dataset.setting, control.dataset.value);
  }

  function onSettingsChange(event) {
    const control = event.target.closest("input[type=\"checkbox\"][data-setting]");
    if (!control) return;
    setSetting(control.dataset.setting, !!control.checked);
  }

  /**
   * The popup and this page can be open at the same time, so a change made in
   * either one is reflected in the other. The panel in a tab re-applies its
   * theme on the next inspection either way.
   */
  function onStorageChanged(changes, area) {
    if (area !== "local") return;
    // The popup adds and removes sites too, so this page has to follow that key
    // as well. Watching only the settings left the list stale, and a site that
    // was already remembered still looked new and asked for permission again.
    const sites = changes && changes[REMEMBERED_SITES_KEY];
    if (sites) {
      state.remembered = normalizeSites(sites.newValue);
      renderSites();
    }
    const changed = changes && changes[SETTINGS_KEY];
    if (!changed) return;
    const next = changed.newValue;
    if (!next || typeof next !== "object") return;
    state.settings = { ...DEFAULT_SETTINGS, ...next };
    syncControls();
    paint();
  }

  function onSystemThemeChange() {
    if (state.settings.theme !== "system") return;
    // Swatches are tinted per theme too, so they have to be re-tinted here as
    // well: painting alone left every swatch showing the previous OS theme's
    // colours after a flip.
    syncControls();
    paint();
  }

  function bind() {
    els.settings.addEventListener("click", onSettingsClick);
    els.settings.addEventListener("change", onSettingsChange);
    els.siteForm.addEventListener("submit", onAddSite);
    els.siteList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-origin]");
      if (button) onRemoveSite(button.dataset.removeOrigin);
    });
    if (chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener) {
      chrome.storage.onChanged.addListener(onStorageChanged);
    }
    if (typeof matchMedia === "function") {
      const media = matchMedia("(prefers-color-scheme: dark)");
      const listen = media.addEventListener ? "addEventListener" : "addListener";
      if (typeof media[listen] === "function") media[listen]("change", onSystemThemeChange);
    }
  }

  function cacheEls() {
    els.settings = document.getElementById("op-settings");
    els.preview = document.getElementById("op-preview");
    els.previewState = document.getElementById("op-preview-state");
    els.siteList = document.getElementById("op-site-list");
    els.siteForm = document.getElementById("op-site-form");
    els.siteInput = document.getElementById("op-site-input");
    els.siteHint = document.getElementById("op-site-hint");
    els.version = document.getElementById("op-version");
  }

  function showVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) els.version.textContent = `v${manifest.version}`;
    } catch (err) {
      /* not available outside the extension (e.g. a test fixture) */
    }
  }

  async function init() {
    cacheEls();
    injectPalette();
    renderGroups();
    buildPreview();
    bind();
    await readStored();
    syncControls();
    renderSites();
    paint();
    showVersion();
    document.body.dataset.opReady = "1";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
