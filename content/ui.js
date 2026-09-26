/**
 * Field Inspector - Shadow DOM inspector panel
 *
 * All panel markup/styles live inside a single open Shadow DOM host so the
 * host page's CSS can never bleed in (and our CSS can never leak out onto
 * the page). Depends on window.__FI__.utils.
 */
(function () {
  if (window.__FI__ && window.__FI__.ui) return; // already loaded
  window.__FI__ = window.__FI__ || {};

  const utils = window.__FI__.utils;
  const HOST_ID = "__fi_inspector_host__";

  // resolveTheme/applyThemeVars live in shared.js so the full-page settings
  // can paint its preview with the very same code the live panel uses.
  const { PANEL_CSS, resolveTheme, applyThemeVars } = self.FI_SHARED;


  const { ACCENTS, DEFAULT_ACCENT } = self.FI_SHARED;
  const DENSITIES = ["comfortable", "compact"];

  const ui = {
    hostEl: null,
    shadowRoot: null,
    panelEl: null,
    bodyEl: null,
    lastInfo: null,
    lastElement: null,
    settingsRef: { copyFormat: "text" },
    activeTab: 0,
    history: [], // { label, info, el } — most recent last
    historyPos: -1, // index into history currently on screen
    optionsPanelEl: null,
    onOptionSetting: null,
    onDisable: null,
    finderBtnEl: null,
    finderPanelEl: null,
    finderFields: [], // last-fetched full { kind, technicalName, label, el } list
    onFinderOpen: null, // () => { scope: "page"|"wizard", scopeLabel, fields[] } — set by content.js
    onFinderSelect: null, // (entry) => void — set by content.js
    settingsPanelEl: null,
    resolvedTheme: "", // "light" | "dark" — what "system" currently resolves to
    themeMedia: null, // matchMedia handle, kept so the listener can be replaced
    onDebugReport: null, // () => { lines: string[] } — set by content.js
    // { effective, override, saved } — `override` is the ?debug= value (or
    // null). The settings switch renders `effective`, so it can never claim to
    // be off while the URL is forcing logging on.
    debugState: { effective: false, override: null, saved: false },
  };


  /** The palette entry for an accent name in a theme, falling back like the panel does. */
  function accentFor(name, theme) {
    const entry = ACCENTS[name] || ACCENTS[DEFAULT_ACCENT];
    return entry ? entry[theme] || entry.light : null;
  }

  /**
   * Paints the panel and the page-level highlights from the current settings.
   * The shadow host gets the theme/density attributes plus its accent as inline
   * custom properties (inline wins over the shadow stylesheet, so this is one
   * write regardless of which palette block applies), and `documentElement`
   * gets the outline/wash colours for content.css, which is injected into the
   * page and cannot see the host's variables.
   */
  ui.applyTheme = function (settings) {
    const next = settings || {};
    ui.ensureHost();
    const painted = applyThemeVars(ui.hostEl, next);
    const { theme, density, accent: accentName, colors } = painted;
    ui.resolvedTheme = theme;

    const root = document.documentElement;
    // content.css is injected into the page and lives outside this shadow
    // root, so the two highlight colours are exported to <html> instead.
    if (colors) {
      root.style.setProperty("--fi-accent-outline", colors.outline);
      root.style.setProperty("--fi-accent-wash", colors.wash);
    }
    root.setAttribute("data-fi-accent", accentName);

    if (ui.themeMedia) {
      if (typeof ui.themeMedia.removeEventListener === "function") ui.themeMedia.removeEventListener("change", onSystemThemeChange);
      else if (typeof ui.themeMedia.removeListener === "function") ui.themeMedia.removeListener(onSystemThemeChange);
      ui.themeMedia = null;
    }
    if (next.theme !== "light" && next.theme !== "dark" && window.matchMedia) {
      ui.themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
      const listen = ui.themeMedia.addEventListener ? "addEventListener" : "addListener";
      if (typeof ui.themeMedia[listen] === "function") ui.themeMedia[listen]("change", onSystemThemeChange);
    }
    return { theme, density, accent: accentName };
  };

  /** Re-resolves "system" when the OS flips light/dark while the panel is open. */
  function onSystemThemeChange() {
    ui.applyTheme(ui.settingsRef);
  }

  /** Removes the page-level accent properties so the host page is left as found. */
  ui.clearTheme = function () {
    const root = document.documentElement;
    ["--fi-accent-outline", "--fi-accent-wash"].forEach((name) => root.style.removeProperty(name));
    root.removeAttribute("data-fi-accent");
    if (ui.themeMedia) {
      if (typeof ui.themeMedia.removeEventListener === "function") ui.themeMedia.removeEventListener("change", onSystemThemeChange);
      else if (typeof ui.themeMedia.removeListener === "function") ui.themeMedia.removeListener(onSystemThemeChange);
      ui.themeMedia = null;
    }
  };

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  /** Small monochrome (currentColor) tab icons, purely decorative — keyed by tab kind. */
  const ICONS = self.FI_SHARED.ICONS;

  /** Best-effort color category for a type-ish string (ORM ttype, HTML input type, generic field type) — purely cosmetic. */
  function typeChipClass(value) {
    const v = String(value || "").toLowerCase();
    if (!v) return "gray";
    if (/many2one|one2many|many2many|relation/.test(v)) return "purple";
    if (/^bool|checkbox|radio/.test(v)) return "green";
    if (/int|float|number|monetary|numeric/.test(v)) return "orange";
    if (/date|time/.test(v)) return "teal";
    if (/^select/.test(v)) return "pink";
    if (/char|text|html|string|email|url|password|tel|search/.test(v)) return "blue";
    return "gray";
  }

  /** Briefly flashes an outline/background around a real page element (e.g. after "scroll to element"). Inline styles only — no page CSS touched. */
  function flashHighlightElement(el) {
    if (!el || !el.isConnected) return;
    const prevOutline = el.style.outline;
    const prevOffset = el.style.outlineOffset;
    const prevBg = el.style.backgroundColor;
    const prevTransition = el.style.transition;
    el.style.transition = "outline-color 200ms ease, background-color 200ms ease";
    el.style.outline = "3px solid #f59e0b";
    el.style.outlineOffset = "2px";
    el.style.backgroundColor = "rgba(245, 158, 11, 0.15)";
    setTimeout(() => {
      el.style.outline = prevOutline;
      el.style.outlineOffset = prevOffset;
      el.style.backgroundColor = prevBg;
      setTimeout(() => {
        el.style.transition = prevTransition;
      }, 220);
    }, 900);
  }

  /** A short, human label for a history chip — best-effort per info kind. */
  function shortLabelFor(info) {
    if (!info) return "";
    if (info.kind === "form") return info.fieldLabel || info.nameAttr || info.id || "Field";
    if (info.kind === "listCell") return info.columnName ? `Cell: ${info.columnName}` : "Cell";
    if (info.kind === "button") return info.buttonLabel ? `Button: ${info.buttonLabel}` : info.nameAttr || "Button";
    return info.columnName || "Column";
  }

  /** Pulls a readable "Label: value" text dump out of a rendered tab's DOM — used by the per-tab copy button so it doesn't need a parallel text-building path. */
  function extractTabText(containerEl) {
    const lines = [];
    containerEl.querySelectorAll(".fi-row").forEach((rowEl) => {
      const labelEl = rowEl.querySelector(".fi-row-label");
      const valueEl = rowEl.querySelector(".fi-row-value");
      if (!labelEl || !valueEl) return;
      lines.push(`${labelEl.textContent.trim()}: ${valueEl.textContent.trim()}`);
    });
    containerEl.querySelectorAll(".fi-copyable").forEach((box) => {
      const heading = box.previousElementSibling;
      const label = heading && heading.classList.contains("fi-row-label") ? heading.textContent.trim() : "Value";
      const code = box.querySelector("code");
      lines.push(`${label}: ${code ? code.textContent.trim() : ""}`);
    });
    containerEl.querySelectorAll(".fi-html-preview").forEach((pre) => {
      lines.push(`HTML: ${pre.textContent.trim()}`);
    });
    containerEl.querySelectorAll(".fi-empty-hint").forEach((hint) => {
      if (!hint.closest(".fi-row")) lines.push(hint.textContent.trim());
    });
    return lines.join("\n");
  }

  /** Lets the user drag the panel by its header, switching it from right/bottom to left/top anchoring on first drag. */
  function makeDraggable(panel, header) {
    let dragging = false;
    let startX = 0,
      startY = 0,
      startLeft = 0,
      startTop = 0;

    header.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".fi-icon-btn, .fi-close-btn")) return;
      const rect = panel.getBoundingClientRect();
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.width = `${rect.width}px`;
      panel.style.height = `${rect.height}px`;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      dragging = true;
      header.classList.add("fi-dragging");
      try {
        header.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    header.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const maxLeft = window.innerWidth - 60;
      const maxTop = window.innerHeight - 40;
      panel.style.left = `${Math.min(Math.max(startLeft + dx, -panel.offsetWidth + 80), maxLeft)}px`;
      panel.style.top = `${Math.min(Math.max(startTop + dy, 0), maxTop)}px`;
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      header.classList.remove("fi-dragging");
      try {
        header.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);
  }

  ui.ensureHost = function () {
    if (ui.hostEl && document.documentElement.contains(ui.hostEl)) return;

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "all: initial !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; z-index: 2147483647 !important;";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);

    const panel = document.createElement("div");
    panel.className = "fi-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="fi-header">
        <div class="fi-header-title">
          <span>Field Inspector</span>
          <span class="fi-badge" id="fi-kind-badge">Form</span>
          <span class="fi-required-dot" id="fi-required-dot" hidden title="This field is required"></span>
        </div>
        <div class="fi-header-actions">
          <button type="button" class="fi-icon-btn" id="fi-settings-btn" title="Settings" aria-label="Settings" aria-controls="fi-settings-panel">${ICONS.gear}</button>
          <button type="button" class="fi-icon-btn" id="fi-jump-btn" title="Scroll to element">${ICONS.target}</button>
          <button type="button" class="fi-close-btn" id="fi-close-btn" title="Close" aria-label="Close">×</button>
        </div>
      </div>
      <div class="fi-history" id="fi-history" hidden></div>
      <div class="fi-body" id="fi-body"></div>
      <div class="fi-footer">
        <button type="button" class="fi-copy-all-btn" id="fi-copy-all-btn">Copy All Information</button>
      </div>
    `;
    shadow.appendChild(panel);

    const finderBtn = document.createElement("button");
    finderBtn.type = "button";
    finderBtn.className = "fi-finder-btn fi-options-btn";
    finderBtn.title = "Inspector options";
    finderBtn.setAttribute("aria-expanded", "false");
    finderBtn.setAttribute("aria-controls", "fi-options-panel");
    finderBtn.hidden = true;
    finderBtn.setAttribute("aria-label", "Inspector options");
    finderBtn.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-3z"/><circle cx="12" cy="11" r="3"/></svg>`;
    shadow.appendChild(finderBtn);

    const optionsPanel = document.createElement("div");
    optionsPanel.id = "fi-options-panel";
    optionsPanel.className = "fi-options-panel";
    optionsPanel.hidden = true;
    optionsPanel.setAttribute("role", "region");
    optionsPanel.setAttribute("aria-label", "Inspector options");
    shadow.appendChild(optionsPanel);
    optionsPanel.addEventListener("click", (e) => {
      const button = e.target.closest("[data-option]");
      if (!button || button.disabled) return;
      const action = button.dataset.option;
      if (action === "recent") { ui.openOptions(true); return; }
      if (action === "back") { ui.openOptions(); return; }
      ui.closeOptions(true);
      if (action === "search") ui.openFinder();
      else if (action === "domain") window.__FI__.domainBuilder.open();
      else if (action === "chatter") window.__FI__.chatter.open();
      else if (action === "history") {
        const index = Number(button.dataset.index);
        const entry = ui.history[index];
        if (entry) ui.showPanel(entry.info, ui.settingsRef, entry.el, { fromHistory: true, historyIndex: index });
      } else if (action === "highlight" || action === "odooMode" || action === "showSensitiveValues" || action === "interceptClicks") {
        if (ui.onOptionSetting) ui.onOptionSetting(action, !ui.settingsRef[action]);
      } else if (action === "copy") ui.copyAll(ui.panelEl.querySelector("#fi-copy-all-btn"));
      else if (action === "settings") ui.openSettings();
      else if (action === "disable" && ui.onDisable) ui.onDisable();
    });

    const finderPanel = document.createElement("div");
    finderPanel.className = "fi-finder-panel";
    finderPanel.hidden = true;
    finderPanel.innerHTML = `
      <div class="fi-finder-header">
        <span class="fi-header-title"><span>Field Finder</span><span class="fi-badge" id="fi-finder-scope-badge" hidden>Wizard</span></span>
        <button type="button" class="fi-close-btn" id="fi-finder-close-btn" title="Close" aria-label="Close">×</button>
      </div>
      <div class="fi-finder-search-wrap">
        <input type="text" class="fi-finder-search" id="fi-finder-search" placeholder="Search by label or technical name…" autocomplete="off" spellcheck="false" />
      </div>
      <div class="fi-finder-count" id="fi-finder-count"></div>
      <div class="fi-finder-results" id="fi-finder-results"></div>
    `;
    shadow.appendChild(finderPanel);

    const settingsPanel = document.createElement("div");
    settingsPanel.className = "fi-settings-panel";
    settingsPanel.id = "fi-settings-panel";
    settingsPanel.hidden = true;
    settingsPanel.setAttribute("role", "dialog");
    settingsPanel.setAttribute("aria-label", "Inspector settings");
    settingsPanel.innerHTML = `
      <div class="fi-settings-header">
        <span class="fi-header-title">${escapeHtml("Settings")}</span>
        <button type="button" class="fi-close-btn" id="fi-settings-close-btn" title="Close" aria-label="Close">×</button>
      </div>
      <div class="fi-settings-body" id="fi-settings-body"></div>
    `;
    shadow.appendChild(settingsPanel);

    panel.querySelector("#fi-close-btn").addEventListener("click", () => ui.closePanel());
    panel.querySelector("#fi-copy-all-btn").addEventListener("click", (e) => ui.copyAll(e.currentTarget));
    panel.querySelector("#fi-jump-btn").addEventListener("click", () => ui.jumpToElement());
    panel.querySelector("#fi-settings-btn").addEventListener("click", () => ui.openSettings());
    makeDraggable(panel, panel.querySelector(".fi-header"));

    finderBtn.addEventListener("click", () => (ui.isOptionsOpen() ? ui.closeOptions() : ui.openOptions()));
    finderPanel.querySelector("#fi-finder-close-btn").addEventListener("click", () => ui.closeFinder());
    finderPanel.querySelector("#fi-finder-search").addEventListener("input", (e) => renderFinderResults(e.target.value));
    settingsPanel.querySelector("#fi-settings-close-btn").addEventListener("click", () => ui.closeSettings(true));
    settingsPanel.querySelector("#fi-settings-body").addEventListener("click", (e) => {
      const control = e.target.closest("[data-setting]");
      if (!control) return;
      const key = control.dataset.setting;
      if (control.disabled) return;
      if (control.dataset.settingType === "bool") {
        if (ui.onOptionSetting) ui.onOptionSetting(key, control.getAttribute("aria-checked") !== "true");
      } else if (ui.onOptionSetting) {
        ui.onOptionSetting(key, control.dataset.value);
      }
    });

    shadow.addEventListener("click", (e) => {
      if (!optionsPanel.contains(e.target) && !finderBtn.contains(e.target)) ui.closeOptions();
      const finderResult = e.target.closest(".fi-finder-result");
      if (finderResult) {
        const idx = Number(finderResult.getAttribute("data-idx"));
        const entry = ui.finderFields[idx];
        if (entry && typeof ui.onFinderSelect === "function") ui.onFinderSelect(entry);
        return;
      }
      const tabCopyBtn = e.target.closest(".fi-tab-copy-btn");
      if (tabCopyBtn) {
        const body = tabCopyBtn.closest(".fi-tab-content").querySelector(".fi-tab-body");
        ui.copySingle(tabCopyBtn, body ? extractTabText(body) : "");
        return;
      }
      const copyBtn = e.target.closest(".fi-copy-btn");
      if (copyBtn) {
        const text = copyBtn.getAttribute("data-copy-value") || "";
        ui.copySingle(copyBtn, text);
        return;
      }
      const historyBtn = e.target.closest(".fi-history-item");
      if (historyBtn) {
        const idx = Number(historyBtn.getAttribute("data-history-index"));
        const entry = ui.history[idx];
        if (entry) ui.showPanel(entry.info, ui.settingsRef, entry.el, { fromHistory: true, historyIndex: idx });
        return;
      }
      const tabBtn = e.target.closest(".fi-tab");
      if (tabBtn) {
        const idx = Number(tabBtn.getAttribute("data-tab-index"));
        if (!Number.isNaN(idx) && idx !== ui.activeTab) {
          ui.activeTab = idx;
          if (ui.lastInfo) renderPanelBody(ui.lastInfo);
        }
      }
    });

    ui.hostEl = host;
    ui.shadowRoot = shadow;
    ui.panelEl = panel;
    ui.bodyEl = panel.querySelector("#fi-body");
    ui.optionsPanelEl = optionsPanel;
    ui.finderBtnEl = finderBtn;
    ui.finderPanelEl = finderPanel;
    ui.settingsPanelEl = settingsPanel;
  };

  function finderKindLabel(kind) {
    if (kind === "list") return "Column";
    if (kind === "button") return "Button";
    return "Form";
  }

  /** Pill colour per finder result kind — buttons get the same violet as columns so they read as "not a field". */
  function finderKindPill(kind) {
    if (kind === "list") return " purple";
    if (kind === "button") return " pink";
    return " blue";
  }

  /** Filters ui.finderFields by the query (matches label OR technical name, case-insensitive) and renders the result list. */
  function renderFinderResults(query) {
    const resultsEl = ui.finderPanelEl && ui.finderPanelEl.querySelector("#fi-finder-results");
    const countEl = ui.finderPanelEl && ui.finderPanelEl.querySelector("#fi-finder-count");
    if (!resultsEl) return;
    const q = String(query || "")
      .trim()
      .toLowerCase();
    const matches = ui.finderFields.filter((f, i) => {
      f.__idx = i; // stable index into ui.finderFields for the click handler
      if (!q) return true;
      return (f.label && f.label.toLowerCase().includes(q)) || (f.technicalName && f.technicalName.toLowerCase().includes(q));
    });

    if (countEl) {
      countEl.textContent = ui.finderFields.length
        ? `${matches.length} of ${ui.finderFields.length} field${ui.finderFields.length === 1 ? "" : "s"}`
        : "No fields detected on this page yet.";
    }

    if (!matches.length) {
      resultsEl.innerHTML = `<div class="fi-empty-hint" style="padding:10px 6px;">${
        ui.finderFields.length ? "No matches." : "Nothing to search — enable Form View/List View and click into a form or list first."
      }</div>`;
      return;
    }

    resultsEl.innerHTML = matches
      .slice(0, 200)
      .map(
        (f) =>
          `<button type="button" class="fi-finder-result" data-idx="${f.__idx}"><div class="fi-finder-result-top"><span class="fi-pill${
            finderKindPill(f.kind)
          }" style="font-size:10px;">${escapeHtml(finderKindLabel(f.kind))}</span><span class="fi-finder-result-label">${escapeHtml(
            f.label || "(no label)"
          )}</span></div>${
            f.technicalName ? `<div class="fi-finder-result-name">${escapeHtml(f.technicalName)}</div>` : ""
          }</button>`
      )
      .join("");
  }

  ui.isOptionsOpen = function () {
    return !!(ui.optionsPanelEl && !ui.optionsPanelEl.hidden);
  };

  ui.closeOptions = function (restoreFocus = false) {
    if (ui.optionsPanelEl) ui.optionsPanelEl.hidden = true;
    if (ui.finderBtnEl) {
      ui.finderBtnEl.setAttribute("aria-expanded", "false");
      if (restoreFocus && !ui.finderBtnEl.hidden) ui.finderBtnEl.focus();
    }
  };

  ui.openOptions = function (recent = false) {
    ui.ensureHost();
    if (ui.finderBtnEl.hidden) return;
    ui.closeFinder();
    ui.closeSettings();
    window.__FI__.domainBuilder?.close();
    window.__FI__.chatter?.close();
    const hasChatter = window.__FI__.chatter?.available();
    const items = recent
      ? `<button type="button" class="fi-option" data-option="back">← All options</button>` +
        ui.history.map((entry, index) => ({ entry, index })).reverse().map(({ entry, index }) =>
          `<button type="button" class="fi-option" data-option="history" data-index="${index}">${escapeHtml(entry.label)}<small>${escapeHtml(entry.info.odooFieldName || entry.info.nameAttr || "")}</small></button>`
        ).join("")
      : `<button type="button" class="fi-option" data-option="search">Search Fields</button>
        <button type="button" class="fi-option" data-option="domain">Domain Builder</button>
        ${hasChatter ? '<button type="button" class="fi-option" data-option="chatter">Chatter Manager</button>' : ""}
        <button type="button" class="fi-option" data-option="recent" ${ui.history.length ? "" : "disabled"}>Recent Fields</button>
        <button type="button" class="fi-option" data-option="highlight" aria-pressed="${!!ui.settingsRef.highlight}">Highlight Fields · ${ui.settingsRef.highlight ? "On" : "Off"}</button>
        <button type="button" class="fi-option" data-option="odooMode" aria-pressed="${!!ui.settingsRef.odooMode}">Odoo Developer Mode · ${ui.settingsRef.odooMode ? "On" : "Off"}</button>
        <button type="button" class="fi-option" data-option="showSensitiveValues" aria-pressed="${!!ui.settingsRef.showSensitiveValues}">Show Sensitive Values · ${ui.settingsRef.showSensitiveValues ? "On" : "Off"}</button>
        <button type="button" class="fi-option" data-option="interceptClicks" aria-pressed="${ui.settingsRef.interceptClicks !== false}">Intercept Clicks · ${ui.settingsRef.interceptClicks !== false ? "On" : "Off"}</button>
        <button type="button" class="fi-option" data-option="copy" ${ui.lastInfo ? "" : "disabled"}>Copy Current Field</button>
        <button type="button" class="fi-option" data-option="settings">Settings · Theme &amp; Colors</button>
        <button type="button" class="fi-option" data-option="disable">Disable Inspector</button>`;
    ui.optionsPanelEl.innerHTML = `<div class="fi-options-actions">${items}</div>`;
    const actionIcons = {
      chatter: ICONS.chatter, domain: ICONS.selectors, search: ICONS.search, recent: ICONS.history, history: ICONS.history,
      highlight: ICONS.target, odooMode: ICONS.odoo, showSensitiveValues: ICONS.validation, interceptClicks: ICONS.mouse, copy: ICONS.copy,
      disable: ICONS.power, back: ICONS.back, settings: ICONS.gear,
    };
    ui.optionsPanelEl.querySelectorAll("[data-option]").forEach((button) => {
      const label = document.createElement("span");
      while (button.firstChild) label.appendChild(button.firstChild);
      const icon = document.createElement("span");
      icon.className = "fi-option-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = actionIcons[button.dataset.option] || ICONS.info;
      button.append(icon, label);
    });
    ui.optionsPanelEl.hidden = false;
    ui.finderBtnEl.setAttribute("aria-expanded", "true");
    ui.optionsPanelEl.querySelector("button:not(:disabled)")?.focus();
  };

  ui.showFinderButton = function () {
    ui.ensureHost();
    if (ui.finderBtnEl) ui.finderBtnEl.hidden = false;
  };

  ui.hideFinderButton = function () {
    ui.closeOptions();
    if (ui.finderBtnEl) ui.finderBtnEl.hidden = true;
  };

  ui.isFinderOpen = function () {
    return !!(ui.finderPanelEl && !ui.finderPanelEl.hidden);
  };

  ui.openFinder = function () {
    window.__FI__.chatter?.close();
    window.__FI__.domainBuilder?.close();
    ui.ensureHost();
    ui.closeOptions();
    ui.closeSettings();
    const result = typeof ui.onFinderOpen === "function" ? ui.onFinderOpen() : null;
    // Back-compat: accept either the newer { scope, scopeLabel, fields } shape or a bare fields array.
    const isScoped = result && !Array.isArray(result);
    ui.finderFields = (isScoped ? result.fields : result) || [];

    const scopeBadge = ui.finderPanelEl.querySelector("#fi-finder-scope-badge");
    const search = ui.finderPanelEl.querySelector("#fi-finder-search");
    if (scopeBadge) {
      const inWizard = isScoped && result.scope === "wizard";
      scopeBadge.hidden = !inWizard;
      scopeBadge.classList.toggle("list", inWizard);
      scopeBadge.textContent = inWizard && result.scopeLabel ? result.scopeLabel : "Wizard";
    }
    if (search) {
      search.placeholder =
        isScoped && result.scope === "wizard" ? "Search this wizard by label or technical name…" : "Search by label or technical name…";
    }

    ui.finderPanelEl.hidden = false;
    const input = ui.finderPanelEl.querySelector("#fi-finder-search");
    renderFinderResults(input ? input.value : "");
    if (input) {
      input.focus();
      input.select();
    }
  };

  ui.closeFinder = function () {
    if (ui.finderPanelEl) ui.finderPanelEl.hidden = true;
  };

  ui.isSettingsOpen = function () {
    return !!(ui.settingsPanelEl && !ui.settingsPanelEl.hidden);
  };

  ui.closeSettings = function (restoreFocus = false) {
    if (!ui.settingsPanelEl) return;
    ui.settingsPanelEl.hidden = true;
    const trigger = ui.shadowRoot && ui.shadowRoot.getElementById("fi-settings-btn");
    if (restoreFocus && trigger) trigger.focus();
  };

  /** The bare on/off control, reused by `settingSwitch` and the debug row. */
  function settingSwitchControl(key, label) {
    const on = !!ui.settingsRef[key];
    return `<button type="button" class="fi-switch" role="switch" data-setting="${escapeHtml(key)}" data-setting-type="bool" aria-checked="${on}" aria-label="${escapeHtml(label || key)}"></button>`;
  }

  /** A labelled on/off switch row. */
  function settingSwitch(key, label, hint) {
    return `<div class="fi-setting">
      <span class="fi-setting-label"><span>${escapeHtml(label)}</span>${hint ? `<span class="fi-setting-hint">${escapeHtml(hint)}</span>` : ""}</span>
      ${settingSwitchControl(key, label)}
    </div>`;
  }

  /** A segmented (single-choice) row, used for theme, density and copy format. */
  function settingSegmented(key, label, hint, options) {
    const current = ui.settingsRef[key];
    const buttons = options
      .map(([value, text]) => `<button type="button" data-setting="${escapeHtml(key)}" data-setting-type="choice" data-value="${escapeHtml(value)}" aria-pressed="${current === value}">${escapeHtml(text)}</button>`)
      .join("");
    return `<div class="fi-setting">
      <span class="fi-setting-label"><span>${escapeHtml(label)}</span>${hint ? `<span class="fi-setting-hint">${escapeHtml(hint)}</span>` : ""}</span>
      <span class="fi-segmented">${buttons}</span>
    </div>`;
  }

  /** The accent picker. Each swatch shows the colour against the live panel. */
  function settingAccent() {
    if (!Object.keys(ACCENTS).length) return "";
    const current = ui.settingsRef.accent || DEFAULT_ACCENT;
    const theme = ui.resolvedTheme || "light";
    const swatches = Object.keys(ACCENTS)
      .map((name) => {
        const color = accentFor(name, theme).strong;
        return `<button type="button" class="fi-swatch" data-setting="accent" data-setting-type="choice" data-value="${name}" aria-pressed="${current === name}" aria-label="${escapeHtml(ACCENTS[name].label)}" title="${escapeHtml(ACCENTS[name].label)}" style="background:${color}"></button>`;
      })
      .join("");
    return `<div class="fi-setting">
      <span class="fi-setting-label"><span>Accent color</span><span class="fi-setting-hint">Links, tabs, primary button and field highlights</span></span>
      <span class="fi-swatches">${swatches}</span>
    </div>`;
  }

  /**
   * The debug section. The switch mirrors the *effective* state, and is
   * disabled (with the reason spelled out) whenever a ?debug= parameter in the
   * page URL is overriding it — otherwise the panel would show "Off" while
   * still logging, or "On" with the switch doing nothing.
   */
  function debugBlock() {
    const debug = ui.debugState || { effective: false, override: null, saved: false };
    const forced = debug.override !== null && debug.override !== undefined;
    const hint = forced
      ? `Forced ${debug.override ? "on" : "off"} by ?debug=${debug.override ? "1" : "0"} in this page's URL`
      : "Console diagnostics for this tab";
    const control = `<button type="button" class="fi-switch" role="switch" data-setting="debug" data-setting-type="bool" aria-checked="${debug.effective}" aria-label="Debug logging"${forced ? ' disabled title="Overridden by this page\'s URL"' : ""}></button>`;
    const report = typeof ui.onDebugReport === "function" ? ui.onDebugReport() : null;
    const lines = debug.effective && report ? report.lines || [] : [];
    return `<div class="fi-setting">
      <span class="fi-setting-label"><span>Debug logging</span><span class="fi-setting-hint">${escapeHtml(hint)}</span></span>
      ${control}
    </div>
    <p class="fi-settings-note">Add <code class="fi-settings-code">?debug=1</code> to this page's URL to force it on for this page load, or <code class="fi-settings-code">?debug=0</code> to force it off. The URL wins over this switch, and is never saved.</p>
    ${lines.length ? `<pre class="fi-debug-log" id="fi-debug-log">${escapeHtml(lines.join("\n"))}</pre>` : ""}`;
  }

  function settingsBodyHtml() {
    const themeHint = ui.settingsRef.theme === "system"
      ? `Following your system (${ui.resolvedTheme === "dark" ? "dark" : "light"})`
      : `Always ${ui.settingsRef.theme}`;
    return `
      <div class="fi-settings-section-title">Appearance</div>
      ${settingSegmented("theme", "Theme", themeHint, [["system", "System"], ["light", "Light"], ["dark", "Dark"]])}
      ${settingAccent()}
      ${settingSegmented("density", "Density", "Compact fits more rows on screen", [["comfortable", "Comfortable"], ["compact", "Compact"]])}

      <div class="fi-settings-section-title">Behavior</div>
      ${settingSwitch("highlight", "Highlight fields", "Outline every detected field on the page")}
      ${settingSwitch("interceptClicks", "Intercept clicks", "Off = your click reaches the page normally")}
      ${settingSwitch("odooMode", "Odoo Developer Mode", "Live field/button lookups against your Odoo server")}
      ${settingSwitch("showSensitiveValues", "Show sensitive values", "Reveals password and token values")}
      ${settingSegmented("copyFormat", "Copy format", "Used by Copy All Information", [["text", "Text"], ["json", "JSON"]])}

      <div class="fi-settings-section-title">Debug</div>
      ${debugBlock()}
    `;
  }

  ui.openSettings = function () {
    ui.ensureHost();
    ui.closeOptions();
    ui.closeFinder();
    window.__FI__.domainBuilder?.close();
    window.__FI__.chatter?.close();
    if (!ui.settingsPanelEl) return;
    ui.settingsPanelEl.querySelector("#fi-settings-body").innerHTML = settingsBodyHtml();
    ui.settingsPanelEl.hidden = false;
    const first = ui.settingsPanelEl.querySelector("button, input");
    if (first) first.focus();
  };

  ui.jumpToElement = function () {
    if (!ui.lastElement || !ui.lastElement.isConnected) return;
    ui.lastElement.scrollIntoView({ behavior: "smooth", block: "center" });
    flashHighlightElement(ui.lastElement);
  };

  ui.copySingle = async function (btn, text) {
    const ok = await utils.copyToClipboard(text);
    if (!ok) return;
    const original = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("fi-copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("fi-copied");
    }, 1200);
  };

  ui.copyAll = async function (btn) {
    if (!ui.lastInfo) return;
    const text = ui.buildCopyAllText(ui.lastInfo, ui.settingsRef.copyFormat);
    const ok = await utils.copyToClipboard(text);
    if (!ok) return;
    const original = btn.textContent;
    btn.textContent = "Copied to clipboard!";
    btn.classList.add("fi-copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("fi-copied");
    }, 1400);
  };

  function row(label, value, opts = {}) {
    const cls = opts.mono ? "fi-row-value fi-mono" : "fi-row-value";
    let valueHtml;
    if (opts.pill) {
      const pillClass = value === "Yes" ? "yes" : "no";
      valueHtml = `<span class="fi-pill ${pillClass}">${escapeHtml(value)}</span>`;
    } else if (opts.chip) {
      valueHtml = value ? `<span class="fi-pill ${opts.chip}">${escapeHtml(value)}</span>` : escapeHtml("—");
    } else if (opts.html) {
      valueHtml = value; // pre-built, already-safe HTML (e.g. a link)
    } else {
      valueHtml = escapeHtml(value === "" || value == null ? "—" : value);
    }
    return `<div class="fi-row"><div class="fi-row-label">${escapeHtml(label)}</div><div class="${cls}">${valueHtml}</div></div>`;
  }

  /** Wraps one or more row()-built rows in a bordered, striped, column-divided table box. */
  function table(rowsHtml) {
    return `<div class="fi-table">${rowsHtml}</div>`;
  }

  function copyableBlock(value) {
    const safe = escapeHtml(value || "");
    return `<div class="fi-copyable"><code>${safe || "—"}</code><button type="button" class="fi-copy-btn" data-copy-value="${safe}" title="Copy">📋</button></div>`;
  }

  /** A table() of [key, value] pairs with monospace keys — used for attribute lists and decoded selection options. */
  function kvTable(pairs) {
    if (!pairs.length) return `<div class="fi-empty-hint">None</div>`;
    return table(
      pairs
        .map(
          ([k, v]) =>
            `<div class="fi-row"><div class="fi-row-label fi-mono-label">${escapeHtml(k)}</div><div class="fi-row-value fi-mono">${escapeHtml(
              String(v)
            )}</div></div>`
        )
        .join("")
    );
  }

  function attrList(obj) {
    return kvTable(Object.entries(obj || {}));
  }

  /** Best-effort parse of an ir.model.fields "selection" Python-literal string, e.g. "[('a','A'),('b','B')]". */
  function parsePySelectionLiteral(str) {
    if (!str || typeof str !== "string") return null;
    const pairRe = /\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3\s*\)/g;
    const out = [];
    let m;
    while ((m = pairRe.exec(str))) {
      out.push([m[2].replace(/\\(.)/g, "$1"), m[4].replace(/\\(.)/g, "$1")]);
    }
    return out.length ? out : null;
  }

  function renderViewAttrsBlock(info, nodeKind) {
    const va = info.odooViewAttrs;
    // "form" for a form field, "list" for a list column or data cell — the
    // lookup is arch-type-specific, so the label has to be too.
    const viewType = info.odooViewType === "list" ? "list" : "form";
    const typeLabel = viewType === "list" ? "list" : "form";
    // The node kind is what was looked up in the arch; it only changes the
    // wording, never the fetch (the same block serves a field or a button).
    const node = nodeKind === "button" ? "button" : "field";
    const nodeName = nodeKind === "button" ? info.nameAttr : info.odooFieldName;
    let body;
    if (va === undefined) {
      body = `<div class="fi-empty-hint" style="padding:4px 0;">Looking up how this ${node} is declared in the current ${typeLabel} view…</div>`;
    } else if (va === null) {
      body = `<div class="fi-empty-hint" style="padding:4px 0;">No &lt;${node} name="${escapeHtml(
        nodeName || ""
      )}"/&gt; in this model's default ${typeLabel} view arch — the page may be showing a different view, or it is a framework button with no view declaration.</div>`;
    } else if (va.error) {
      body = `<div class="fi-empty-hint" style="padding:4px 0;">Could not fetch the view: ${escapeHtml(va.error)}</div>`;
    } else {
      const attrs = va.attrs || {};
      body = Object.keys(attrs).length
        ? attrList(attrs)
        : `<div class="fi-empty-hint" style="padding:4px 0;">Declared with no extra attributes: &lt;${node} name="${escapeHtml(
            nodeName || ""
          )}"/&gt;</div>`;
      if (va.occurrences > 1) {
        body += `<div class="fi-empty-hint" style="padding:4px 0;">Appears ${va.occurrences} times in this view — showing the least-nested match.</div>`;
      }
    }
    return `<div class="fi-row-label" style="margin:10px 0 2px;">Declared In Current View (${typeLabel})</div>${body}`;
  }

  /**
   * Which XML ID this page is actually rendered from, and what that view
   * inherits from.
   *
   * This is the answer to "who defines this column?" — a question the rendered
   * page cannot answer on its own, because what you see is the *merge* of
   * every view in the stack. Showing the stack is honest about that: it names
   * the views that contributed without pretending to attribute one field node
   * to one file, which would need each ancestor's raw arch downloaded.
   */
  function renderViewStackBlock(info) {
    const stack = info.odooViewStack;
    const version = info.odooServerVersion;
    const odoo = window.__FI__.odoo;

    const xmlIdCell = (view) => (view.xmlId ? escapeHtml(view.xmlId) : `<span class="fi-muted">no external ID</span>`);

    const openLink = (view) => {
      if (!odoo || view.id == null) return "";
      const link = odoo.viewRecordLink(view.id, version);
      return ` <a class="fi-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">Open ↗</a>`;
    };

    if (stack === undefined) {
      return `<div class="fi-row-label" style="margin:10px 0 2px;">View Stack</div><div class="fi-empty-hint" style="padding:4px 0;">Resolving this view's XML ID and inheritance chain…</div>`;
    }
    if (stack === null) {
      return `<div class="fi-row-label" style="margin:10px 0 2px;">View Stack</div><div class="fi-empty-hint" style="padding:4px 0;">Could not resolve the active view record for this model.</div>`;
    }
    if (stack.error) {
      return `<div class="fi-row-label" style="margin:10px 0 2px;">View Stack</div><div class="fi-empty-hint" style="padding:4px 0;">Could not fetch the view: ${escapeHtml(stack.error)}</div>`;
    }

    const active = stack[0];
    const ancestors = stack.slice(1);
    const rows = [
      row("Active View XML ID", xmlIdCell(active) + openLink(active), { html: true }),
      row("View Name", active.name || "—"),
      row("View Type", stack.requestedType || (info.odooViewType === "list" ? "list" : "form"), { mono: true }),
      row("Model", active.model || info.odooModel || "—", { mono: true }),
      row("View Record ID", active.id != null ? String(active.id) : "—", { mono: true }),
    ];

    let html = table(rows.join(""));

    if (ancestors.length) {
      const items = ancestors
        .map((v, i) => {
          const label = v.xmlId || `view id ${v.id}`;
          return `<li style="margin:3px 0;"><span class="fi-muted">${i === 0 ? "parent" : `level ${i}`}:</span> ${escapeHtml(label)}${openLink(v)}</li>`;
        })
        .join("");
      html += `<div class="fi-row-label" style="margin:10px 0 2px;">Inherits From (${ancestors.length})</div><ul style="margin:0; padding-left:18px;">${items}</ul>`;
    } else {
      html += `<div class="fi-empty-hint" style="padding:6px 0 0;">This view has no parent (<code>inherit_id</code> is empty) — it is the model's own base view.</div>`;
    }

    html +=
      `<div class="fi-empty-hint" style="padding:6px 0 0;">The arch Odoo rendered is the merge of this whole stack, so a field's effective definition can combine several of these XML IDs. Ancestor archs are not downloaded to keep this fast.</div>`;

    if (stack.partial) {
      html += `<div class="fi-empty-hint" style="padding:4px 0 0;">Chain is incomplete: ${escapeHtml(stack.partial)}</div>`;
    }

    return `<div class="fi-row-label" style="margin:10px 0 2px;">View Stack</div>${html}`;
  }

  /** "17.0" / "saas~17.2" once read; an explicit state before that, never a silent blank. */
  function renderOdooVersion(version) {
    if (version === undefined) return "Reading…";
    if (version === null) return "Unknown";
    return version.raw || "Unknown";
  }

  /**
   * The "Open in Odoo" link, in the URL style the detected server supports.
   * When the version is unknown both styles are offered rather than betting
   * on one — a 404 in the admin is a worse outcome than an extra link.
   */
  function renderFieldRecordLink(fieldId, version) {
    const odoo = window.__FI__.odoo;
    if (!odoo) return "";
    const link = odoo.fieldRecordLink(fieldId, version);
    let html = `<a class="fi-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">Open in Odoo (Settings → Technical → Fields) ↗</a>`;
    if (link.form === "legacy-unknown") {
      html +=
        `<div class="fi-empty-hint" style="padding:6px 0 0;">Odoo version could not be detected, so the link above uses the Odoo 16-and-earlier URL. ` +
        `On Odoo 17+ the same record is reached from ` +
        `<a class="fi-link" href="${escapeHtml(odoo.fieldListLink())}" target="_blank" rel="noopener">the 17+ field-list link</a>.</div>`;
    }
    return html;
  }

  /** Inner content (no wrapper) for the "Odoo Field" tab — shared by form fields and list data cells. */
  function renderOdooTabContent(info) {
    if (!ui.settingsRef.odooMode) {
      return (
        table(row("Technical Field Name", info.odooFieldName, { mono: true })) +
        `<div class="fi-empty-hint">Odoo Developer Mode is off — turn it on in the popup for a live model/type/relation lookup from your Odoo server.</div>`
      );
    }

    const rows = [
      row("Server Version", renderOdooVersion(info.odooServerVersion)),
      row("Model", info.odooModel || "(not detected)", { mono: true }),
      row("Technical Field Name", info.odooFieldName, { mono: true }),
    ];
    const meta = info.odooFieldMeta;
    let hint = "";
    let selectionOptionsHtml = "";

    if (meta === undefined) {
      hint = `<div class="fi-empty-hint">Looking up live field definition from Odoo…</div>`;
    } else if (meta === null) {
      hint = `<div class="fi-empty-hint">No matching ir.model.fields row${
        info.odooModel ? ` on ${escapeHtml(info.odooModel)}` : ""
      } — model may not have been detected yet, or this is a non-stored/dynamic field.</div>`;
    } else if (meta.error) {
      hint = `<div class="fi-empty-hint">Could not reach the Odoo backend: ${escapeHtml(meta.error)}</div>`;
    } else {
      rows.push(
        row("Label (field_description)", meta.field_description || "—"),
        row("ORM Type", meta.ttype, { chip: typeChipClass(meta.ttype) })
      );
      if (meta.relation) rows.push(row("Relation Model", meta.relation, { mono: true }));
      rows.push(
        row("Required", meta.required ? "Yes" : "No", { pill: true }),
        row("Readonly", meta.readonly ? "Yes" : "No", { pill: true }),
        row("Stored", meta.store ? "Yes" : "No", { pill: true })
      );
      if (meta.related) rows.push(row("Related Path", meta.related, { mono: true }));
      if (meta.compute) rows.push(row("Computed", "Yes", { pill: true }));
      if (meta.help) rows.push(row("Help Text", meta.help));

      if (meta.id != null) {
        rows.push(row("Field Record", renderFieldRecordLink(meta.id, info.odooServerVersion), { html: true }));
      }

      const options = meta.ttype === "selection" ? parsePySelectionLiteral(meta.selection) : null;
      if (options) {
        selectionOptionsHtml = `<div class="fi-row-label" style="margin:10px 0 4px;">Selection Options</div>${kvTable(options)}`;
      }
    }

    let html = table(rows.join("")) + hint + selectionOptionsHtml;
    html += renderViewStackBlock(info);
    html += renderViewAttrsBlock(info);

    const snippet = `<field name="${info.odooFieldName}"/>`;
    html += `<div class="fi-row-label" style="margin:10px 0 4px;">View XML Snippet</div>${copyableBlock(snippet)}`;

    return html;
  }

  function renderSelectors(info) {
    const isOdooXPath = info.xpath && info.xpath.startsWith("//field[");
    const xpathLabel = isOdooXPath ? "Odoo View XPath" : "XPath";
    const hint = isOdooXPath
      ? `<div class="fi-empty-hint">For inherited XML views. If this field appears more than once, scope the expression to its parent in the view XML.</div>`
      : "";
    return `<div class="fi-row-label" style="margin:10px 0 2px;">CSS Selector</div>${copyableBlock(
      info.cssSelector
    )}<div class="fi-row-label" style="margin:8px 0 2px;">${xpathLabel}</div>${copyableBlock(info.xpath)}${hint}`;
  }

  /** Builds the ordered list of { title, html } tabs for a Form Field panel. */
  function renderFormInfo(info) {
    const tabs = [];
    const redactionNote =
      info.sensitive && !info.valuesRevealed
        ? `<div class="fi-empty-hint" style="padding:4px 0;">This field's value looks sensitive (password/secret), so it is redacted here and in Copy All / JSON output. Turn on “Show sensitive values” in the popup to display it.</div>`
        : "";
    const stateTable = table(
        [
          row("Current Value", info.currentValue),
          row("Default Value", info.defaultValue),
          row("Required", info.required ? "Yes" : "No", { pill: true }),
          row("Read Only", info.readOnly ? "Yes" : "No", { pill: true }),
          row("Disabled", info.disabled ? "Yes" : "No", { pill: true }),
        ].join("")
      ) + redactionNote;

    if (info.odooFieldName) {
      tabs.push({
        title: "Odoo Field",
        icon: "odoo",
        html: renderOdooTabContent(info) + `<div class="fi-row-label" style="margin:10px 0 4px;">State</div>` + stateTable + renderSelectors(info),
      });
    }

    tabs.push({
      title: "Field Info",
      icon: "info",
      html: table(
        [
          row("Field Label", info.fieldLabel),
          row("HTML Element", info.element, { mono: true }),
          row("Field Type", info.fieldType, { chip: typeChipClass(info.fieldType) }),
          info.inputType ? row("Input Type", info.inputType, { chip: typeChipClass(info.inputType) }) : row("Input Type", "—"),
          row("Field ID", info.id, { mono: true }),
          row("Name Attribute", info.nameAttr, { mono: true }),
          row("CSS Classes", info.classes, { mono: true }),
          row("Placeholder", info.placeholder),
        ].join("")
      ),
    });

    if (!info.odooFieldName) tabs.push({ title: "State", icon: "state", html: stateTable });

    if (!info.odooFieldName) tabs.push({ title: "Selectors", icon: "selectors", html: renderSelectors(info) });


    if (Object.keys(info.validationAttributes || {}).length) {
      tabs.push({ title: "Validation", icon: "validation", html: attrList(info.validationAttributes) });
    }
    if (Object.keys(info.dataAttributes || {}).length) {
      tabs.push({ title: "Data Attrs", icon: "data", html: attrList(info.dataAttributes) });
    }
    if (Object.keys(info.ariaAttributes || {}).length) {
      tabs.push({ title: "ARIA Attrs", icon: "aria", html: attrList(info.ariaAttributes) });
    }
    if (Object.keys(info.otherAttributes || {}).length) {
      tabs.push({ title: "Other Attrs", icon: "other", html: attrList(info.otherAttributes) });
    }

    return tabs;
  }

  /** Builds the ordered list of { title, html } tabs for a List / Column (header) panel. */
  function renderListInfo(info) {
    const tabs = [];

    tabs.push({
      title: "Column Info",
      icon: "column",
      html: table(
        [
          row("Column Name", info.columnName),
          row("Element Type", info.element, { mono: true }),
          row("Column Index", String(info.columnIndex)),
          row("ID", info.id, { mono: true }),
          row("Name", info.nameAttr, { mono: true }),
          row("CSS Classes", info.classes, { mono: true }),
        ].join("")
      ),
    });

    tabs.push({
      title: "Selectors",
      icon: "selectors",
      html: renderSelectors(info),
    });

    if (info.table) {
      tabs.push({
        title: "Table",
        icon: "table",
        html: table(
          [
            row("Tag", info.table.tag, { mono: true }),
            row("ID", info.table.id, { mono: true }),
            row("Classes", info.table.classes, { mono: true }),
            row("Row Count", info.table.rowCount == null ? "—" : String(info.table.rowCount)),
            row("Column Count", info.table.columnCount == null ? "—" : String(info.table.columnCount)),
          ].join("")
        ),
      });
    }

    if (info.relatedInput) {
      tabs.push({
        title: "Sample Input",
        icon: "sample",
        html: table(
          [
            row("Element", info.relatedInput.tag, { mono: true }),
            row("Type", info.relatedInput.type, { chip: typeChipClass(info.relatedInput.type) }),
            row("CSS Selector", info.relatedInput.cssSelector, { mono: true }),
          ].join("")
        ),
      });
    }

    if (Object.keys(info.dataAttributes || {}).length) tabs.push({ title: "Data Attrs", icon: "data", html: attrList(info.dataAttributes) });
    if (Object.keys(info.ariaAttributes || {}).length) tabs.push({ title: "ARIA Attrs", icon: "aria", html: attrList(info.ariaAttributes) });
    if (Object.keys(info.otherAttributes || {}).length) tabs.push({ title: "Other Attrs", icon: "other", html: attrList(info.otherAttributes) });

    return tabs;
  }

  /** A single table/grid data cell — column+row context, as opposed to renderListInfo's column-only view. */
  function renderDataCellInfo(info) {
    const tabs = [];

    if (info.odooFieldName) tabs.push({ title: "Odoo Field", icon: "odoo", html: renderOdooTabContent(info) + renderSelectors(info) });

    tabs.push({
      title: "Cell Info",
      icon: "cell",
      html: table(
        [
          row("Column Name", info.columnName || "—"),
          row("Column Index", String(info.columnIndex)),
          row("Row Index", info.rowIndex >= 0 ? String(info.rowIndex) : "—"),
          row("Element Type", info.element, { mono: true }),
          row("Cell Text", info.cellText),
          row("ID", info.id, { mono: true }),
          row("CSS Classes", info.classes, { mono: true }),
        ].join("")
      ),
    });

    if (!info.odooFieldName) tabs.push({ title: "Selectors", icon: "selectors", html: renderSelectors(info) });

    if (Object.keys(info.dataAttributes || {}).length) tabs.push({ title: "Data Attrs", icon: "data", html: attrList(info.dataAttributes) });
    if (Object.keys(info.ariaAttributes || {}).length) tabs.push({ title: "ARIA Attrs", icon: "aria", html: attrList(info.ariaAttributes) });
    if (Object.keys(info.otherAttributes || {}).length) tabs.push({ title: "Other Attrs", icon: "other", html: attrList(info.otherAttributes) });

    return tabs;
  }

  /**
   * A button's `type=`, `special=` and `confirm=` live in the view, not in the
   * rendered DOM: Odoo's web client consumes them and renders a plain
   * `type="button"` instead. So the arch wins whenever it answered, and the
   * DOM is only a fallback for a view we could not read.
   */
  function buttonAttr(info, name) {
    const va = info.odooViewAttrs;
    if (va && !va.error && va.attrs && va.attrs[name] != null) return va.attrs[name];
    if (name === "type") return info.buttonType || "";
    if (name === "special") return info.special || "";
    if (name === "confirm") return info.confirmText || "";
    return "";
  }

  /**
   * An Odoo button.
   *
   * Reads as "what will this do?": the method it calls or the action it opens,
   * which record it would act on, and whether clicking it prompts first. The
   * declared-in-view block is the same one fields use, so `groups=`,
   * `invisible=`, and friends come from the view rather than the DOM.
   */
  function renderButtonInfo(info) {
    const tabs = [];

    const buttonType = buttonAttr(info, "type");
    const special = buttonAttr(info, "special");
    const confirmText = buttonAttr(info, "confirm");
    const actionReference = info.actionReference || (buttonType === "action" ? buttonAttr(info, "name") : "");

    const typeRow = !buttonType
      ? row("Button Type", "—")
      : buttonType === "object"
      ? row("Button Type", "object — calls a Python method", { html: true })
      : buttonType === "action"
      ? row("Button Type", "action — opens an Odoo action", { html: true })
      : row("Button Type", buttonType, { mono: true });

    const actionRows = [];
    if (actionReference) {
      actionRows.push(row("Action Reference", actionReference, { mono: true }));
    } else if (info.nameAttr) {
      actionRows.push(
        buttonType === "action"
          ? row("Opens", info.nameAttr, { mono: true })
          : row("Calls Method", info.nameAttr, { mono: true })
      );
    }

    const behaviour = [];
    if (confirmText) {
      behaviour.push(
        `<div class="fi-empty-hint" style="padding:4px 0;">Asks for confirmation first: “${escapeHtml(confirmText)}”</div>`
      );
    }
    if (special) {
      behaviour.push(
        `<div class="fi-empty-hint" style="padding:4px 0;">Odoo built-in button (<code>special="${escapeHtml(
          special
        )}"</code>) — its behaviour comes from the framework, not from a view method.</div>`
      );
    }
    if (buttonType === "action") {
      behaviour.push(`<div class="fi-empty-hint" style="padding:4px 0;">This button navigates away from the current view when clicked.</div>`);
    }
    if (!info.odooViewAttrs) {
      behaviour.push(
        `<div class="fi-empty-hint" style="padding:4px 0;">Turn on Odoo Developer Mode to read this button's <code>type</code>, <code>special</code> and <code>confirm</code> from the view — the rendered DOM does not keep them.</div>`
      );
    } else if (info.odooViewAttrs === null || info.odooViewAttrs.error) {
      behaviour.push(
        `<div class="fi-empty-hint" style="padding:4px 0;">This button's view declaration could not be read, so its <code>type</code>/<code>special</code>/<code>confirm</code> are unavailable. The rendered DOM's <code>type="${escapeHtml(
          info.domType || "(none)"
        )}"</code> is the HTML type, not Odoo's.</div>`
      );
    }

    tabs.push({
      title: "Button",
      icon: "odoo",
      html:
        table(
          [
            row("Label", info.buttonLabel || "—"),
            typeRow,
            ...actionRows,
            row("Special", special || "—", { mono: true }),
            row("Record Model", info.recordModel || "—", { mono: true }),
            row("Record ID", info.recordId || "—", { mono: true }),
            confirmText ? row("Confirm Text", confirmText) : "",
            info.title ? row("Title Attribute", info.title) : "",
            row("CSS Classes", info.classes, { mono: true }),
          ]
              .filter(Boolean)
              .join("")
        ) +
        behaviour.join("") +
        `<div class="fi-empty-hint" style="padding:6px 0 0;">Record Model/ID come from the rendered DOM (<code>data-model</code>/<code>data-id</code>), so they're only present while a record is open.</div>`,
    });

    tabs.push({ title: "Selectors", icon: "selectors", html: renderSelectors(info) });

    if (Object.keys(info.dataAttributes || {}).length) tabs.push({ title: "Data Attrs", icon: "data", html: attrList(info.dataAttributes) });
    if (Object.keys(info.ariaAttributes || {}).length) tabs.push({ title: "ARIA Attrs", icon: "aria", html: attrList(info.ariaAttributes) });
    if (Object.keys(info.otherAttributes || {}).length) tabs.push({ title: "Other Attrs", icon: "other", html: attrList(info.otherAttributes) });

    // A button's real declaration lives in the view, not the DOM: the rendered
    // element has already had invisible=/readonly=/groups= evaluated away.
    if (ui.settingsRef.odooMode) {
      tabs.push({ title: "Odoo View", icon: "odoo", html: renderViewStackBlock(info) + renderViewAttrsBlock(info, "button") });
    }

    return tabs;
  }

  /** Dispatches to the right tab-array builder for the panel's kind. */
  function renderBody(info) {
    if (info.kind === "list") return renderListInfo(info);
    if (info.kind === "listCell") return renderDataCellInfo(info);
    if (info.kind === "button") return renderButtonInfo(info);
    return renderFormInfo(info);
  }

  function renderTabsBar(tabs, activeIndex) {
    return `<div class="fi-tabs" role="tablist">${tabs
      .map((t, i) => {
        const icon = t.icon && ICONS[t.icon] ? `<span class="fi-tab-icon">${ICONS[t.icon]}</span>` : "";
        return `<button type="button" class="fi-tab${
          i === activeIndex ? " active" : ""
        }" data-tab-index="${i}" role="tab" aria-selected="${i === activeIndex}">${icon}<span>${escapeHtml(t.title)}</span></button>`;
      })
      .join("")}</div>`;
  }

  /** Whether this field/cell is required — checked both from the DOM (form) and, once it arrives, the live Odoo metadata. */
  function isRequired(info) {
    if (!info) return false;
    if (info.kind === "form" && info.required) return true;
    return !!(info.odooFieldMeta && !info.odooFieldMeta.error && info.odooFieldMeta.required);
  }

  function updateBadge(info) {
    const badge = ui.panelEl.querySelector("#fi-kind-badge");
    const badgeText =
      { list: "List / Column", listCell: "List / Cell", button: "Odoo Button" }[info.kind] || "Form Field";
    badge.textContent = badgeText;
    badge.classList.toggle("list", info.kind === "list" || info.kind === "listCell");
    const dot = ui.panelEl.querySelector("#fi-required-dot");
    if (dot) dot.hidden = !isRequired(info);
  }

  /** Renders the tab bar + the active tab's content into the panel body. Preserves ui.activeTab across re-renders (e.g. async Odoo updates) unless it's now out of range. */
  function renderPanelBody(info) {
    updateBadge(info);
    const tabs = renderBody(info);
    if (!tabs.length) {
      ui.bodyEl.innerHTML = `<div class="fi-tab-content"><div class="fi-empty-hint">Nothing to show.</div></div>`;
      return;
    }
    if (ui.activeTab < 0 || ui.activeTab >= tabs.length) ui.activeTab = 0;
    ui.bodyEl.innerHTML = `${renderTabsBar(tabs, ui.activeTab)}<div class="fi-tab-content"><div class="fi-tab-toolbar"><button type="button" class="fi-copy-btn fi-tab-copy-btn" title="Copy this tab's info">📋 Copy Tab</button></div><div class="fi-tab-body">${
      tabs[ui.activeTab].html
    }</div></div>`;
  }

  let odooRequestSeq = 0;

  function renderHistoryBar() {
    const el = ui.panelEl.querySelector("#fi-history");
    if (!el) return;
    if (ui.history.length < 2) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = ui.history
      .map(
        (entry, i) =>
          `<button type="button" class="fi-history-item${i === ui.historyPos ? " current" : ""}" data-history-index="${i}" title="${escapeHtml(
            entry.label
          )}">${escapeHtml(entry.label)}</button>`
      )
      .join("");
  }

  ui.showPanel = function (info, settings, el, opts = {}) {
    try {
      ui.ensureHost();
      ui.lastInfo = info;
      ui.lastElement = el || null;
      ui.settingsRef = settings || ui.settingsRef;
      // Showing any panel invalidates whatever live Odoo lookup was still
      // in flight for the previously-inspected field.
      odooRequestSeq += 1;
      ui.activeTab = 0; // a newly inspected field always starts on its first tab

      if (opts.fromHistory) {
        ui.historyPos = opts.historyIndex;
      } else {
        const label = shortLabelFor(info);
        const last = ui.history[ui.history.length - 1];
        if (last && last.el === el) {
          ui.history[ui.history.length - 1] = { label, info, el };
        } else {
          ui.history.push({ label, info, el });
          if (ui.history.length > 6) ui.history.shift();
        }
        ui.historyPos = ui.history.length - 1;
      }
      renderHistoryBar();

      renderPanelBody(info);
      ui.panelEl.hidden = false;
    } catch (err) {
      console.error("[Field Inspector] showPanel failed:", err);
    }
  };

  /** Call once right after showPanel to get a token for an async Odoo lookup tied to the field now showing. */
  ui.beginOdooLookup = function () {
    return odooRequestSeq;
  };

  function canHaveOdooLookup(info) {
    return !!info && (info.kind === "form" || info.kind === "listCell" || info.kind === "button");
  }

  /** Applies a live Odoo field-metadata result, but only if it's still for the field currently on screen. */
  ui.applyOdooFieldMeta = function (requestId, meta) {
    if (requestId !== odooRequestSeq) return; // stale: a different field/panel is showing now
    if (!canHaveOdooLookup(ui.lastInfo)) return;
    ui.lastInfo.odooFieldMeta = meta;
    if (ui.bodyEl) renderPanelBody(ui.lastInfo);
  };

  /** Applies a live "how is this field declared in the current view" result, same staleness guard as above. */
  ui.applyOdooViewAttrs = function (requestId, viewAttrs) {
    if (requestId !== odooRequestSeq) return;
    if (!canHaveOdooLookup(ui.lastInfo)) return;
    ui.lastInfo.odooViewAttrs = viewAttrs;
    if (ui.bodyEl) renderPanelBody(ui.lastInfo);
  };

  /**
   * Applies the detected server version, same staleness guard as the field
   * metadata. It decides which deep-link style the panel offers, so it has to
   * be applied together with the field record rather than after it.
   */
  ui.applyOdooVersion = function (requestId, version) {
    if (requestId !== odooRequestSeq) return;
    if (!canHaveOdooLookup(ui.lastInfo)) return;
    ui.lastInfo.odooServerVersion = version;
    if (ui.bodyEl) renderPanelBody(ui.lastInfo);
  };

  /**
   * Applies the resolved view stack (active view + its inherit chain), same
   * staleness guard as the field metadata.
   */
  ui.applyViewStack = function (requestId, stack) {
    if (requestId !== odooRequestSeq) return;
    if (!canHaveOdooLookup(ui.lastInfo)) return;
    ui.lastInfo.odooViewStack = stack;
    if (ui.bodyEl) renderPanelBody(ui.lastInfo);
  };

  ui.closePanel = function () {
    if (ui.panelEl) ui.panelEl.hidden = true;
    ui.lastInfo = null;
  };

  ui.isPanelOpen = function () {
    return !!(ui.panelEl && !ui.panelEl.hidden);
  };

  ui.destroy = function () {
    window.__FI__.chatter?.stop();
    window.__FI__.domainBuilder?.close();
    ui.closePanel();
    ui.clearTheme();
    if (ui.hostEl && ui.hostEl.parentNode) ui.hostEl.parentNode.removeChild(ui.hostEl);
    ui.hostEl = null;
    ui.shadowRoot = null;
    ui.panelEl = null;
    ui.bodyEl = null;
    ui.lastElement = null;
    ui.history = [];
    ui.historyPos = -1;
    ui.optionsPanelEl = null;
    ui.finderBtnEl = null;
    ui.finderPanelEl = null;
    ui.finderFields = [];
    ui.settingsPanelEl = null;
  };

  /** Plain-text rendering of the live Odoo section, shared by the Form Field and List Cell copy-all text. */
  function buildOdooTextBlock(info) {
    if (!info.odooFieldName) return [];
    const lines = [`--- Odoo Field Definition (live) ---`];
    if (!ui.settingsRef.odooMode) {
      lines.push(`Technical Field Name: ${info.odooFieldName}`);
      lines.push(`(Odoo Developer Mode is off — no live lookup was performed)`);
      lines.push(`---`);
      return lines;
    }
    lines.push(`Server Version: ${info.odooServerVersion ? info.odooServerVersion.raw : info.odooServerVersion === null ? "Unknown" : "Reading…"}`);
    lines.push(`Model: ${info.odooModel || "(not detected)"}`);
    lines.push(`Technical Field Name: ${info.odooFieldName}`);
    const meta = info.odooFieldMeta;
    if (meta && !meta.error) {
      lines.push(`Label (field_description): ${meta.field_description || ""}`);
      lines.push(`ORM Type: ${meta.ttype}`);
      if (meta.relation) lines.push(`Relation Model: ${meta.relation}`);
      lines.push(`Required: ${meta.required ? "Yes" : "No"}`);
      lines.push(`Readonly: ${meta.readonly ? "Yes" : "No"}`);
      lines.push(`Stored: ${meta.store ? "Yes" : "No"}`);
      if (meta.related) lines.push(`Related Path: ${meta.related}`);
      if (meta.compute) lines.push(`Computed: Yes`);
      if (meta.help) lines.push(`Help Text: ${meta.help}`);
      if (meta.id != null) {
        const odoo = window.__FI__.odoo;
        const link = odoo ? odoo.fieldRecordLink(meta.id, info.odooServerVersion) : null;
        if (link) lines.push(`Field Record: ${link.url}`);
        if (link && link.form === "legacy-unknown") lines.push(`Field List (Odoo 17+ URL): ${odoo.fieldListLink()}`);
      }
    } else if (meta && meta.error) {
      lines.push(`(Odoo backend lookup failed: ${meta.error})`);
    } else if (meta === null) {
      lines.push(`(No matching ir.model.fields row found)`);
    } else {
      lines.push(`(Odoo backend lookup was still in progress when copied)`);
    }

    const stack = info.odooViewStack;
    if (Array.isArray(stack)) {
      const active = stack[0];
      const odoo = window.__FI__.odoo;
      lines.push(`Active View XML ID: ${active.xmlId || "(none)"}`);
      lines.push(`View Name: ${active.name || ""}`);
      lines.push(`View Type: ${stack.requestedType || ""}`);
      lines.push(`View Record ID: ${active.id != null ? active.id : ""}`);
      if (stack.length > 1) {
        lines.push(`Inherits From: ${stack.slice(1).map((v) => v.xmlId || `view id ${v.id}`).join(" -> ")}`);
        if (odoo) {
          for (const v of stack.slice(1)) {
            if (v.id != null) lines.push(`  ${v.xmlId || `view id ${v.id}`}: ${odoo.viewRecordLink(v.id, info.odooServerVersion).url}`);
          }
        }
      }
      if (stack.partial) lines.push(`View chain incomplete: ${stack.partial}`);
    } else if (stack && stack.error) {
      lines.push(`(View stack lookup failed: ${stack.error})`);
    } else if (stack === null) {
      lines.push(`(Active view record could not be resolved)`);
    }

    const va = info.odooViewAttrs;
    if (va && !va.error && va.attrs && Object.keys(va.attrs).length) {
      lines.push(`Declared In Current View (${info.odooViewType === "list" ? "list" : "form"}): ${JSON.stringify(va.attrs)}`);
    }

    lines.push(`View XML Snippet: <field name="${info.odooFieldName}"/>`);
    lines.push(`---`);
    return lines;
  }

  ui.buildCopyAllText = function (info, format) {
    if (format === "json") {
      try {
        return JSON.stringify(info, null, 2);
      } catch (err) {
        return String(err);
      }
    }

    const lines = [];
    if (info.kind === "form") {
      lines.push(`Field Inspector — Form Field`);
      lines.push(...buildOdooTextBlock(info));
      lines.push(`Field Label: ${info.fieldLabel}`);
      lines.push(`HTML Element: ${info.element}`);
      lines.push(`Field Type: ${info.fieldType}`);
      lines.push(`Input Type: ${info.inputType}`);
      lines.push(`Field ID: ${info.id}`);
      lines.push(`Name Attribute: ${info.nameAttr}`);
      lines.push(`CSS Classes: ${info.classes}`);
      lines.push(`Placeholder: ${info.placeholder}`);
      lines.push(`Current Value: ${info.currentValue}`);
      lines.push(`Default Value: ${info.defaultValue}`);
      lines.push(`Required: ${info.required ? "Yes" : "No"}`);
      lines.push(`Read Only: ${info.readOnly ? "Yes" : "No"}`);
      lines.push(`Disabled: ${info.disabled ? "Yes" : "No"}`);
      lines.push(`Parent Element: ${info.parentElement}`);
      lines.push(`Form: ${info.owningForm ? info.owningForm.name || info.owningForm.id || "(unnamed)" : "Not inside a <form>"}`);
      lines.push(`CSS Selector: ${info.cssSelector}`);
      lines.push(`XPath: ${info.xpath}`);
      if (Object.keys(info.validationAttributes || {}).length) {
        lines.push(`Validation Attributes: ${JSON.stringify(info.validationAttributes)}`);
      }
      if (Object.keys(info.dataAttributes || {}).length) {
        lines.push(`Data Attributes: ${JSON.stringify(info.dataAttributes)}`);
      }
      if (Object.keys(info.ariaAttributes || {}).length) {
        lines.push(`ARIA Attributes: ${JSON.stringify(info.ariaAttributes)}`);
      }
      if (Object.keys(info.otherAttributes || {}).length) {
        lines.push(`Other Attributes: ${JSON.stringify(info.otherAttributes)}`);
      }
      lines.push(`HTML: ${info.htmlPreview}`);
    } else if (info.kind === "listCell") {
      lines.push(`Field Inspector — List Cell`);
      lines.push(...buildOdooTextBlock(info));
      lines.push(`Column Name: ${info.columnName}`);
      lines.push(`Column Index: ${info.columnIndex}`);
      lines.push(`Row Index: ${info.rowIndex}`);
      lines.push(`Element Type: ${info.element}`);
      lines.push(`Cell Text: ${info.cellText}`);
      lines.push(`ID: ${info.id}`);
      lines.push(`CSS Classes: ${info.classes}`);
      lines.push(`CSS Selector: ${info.cssSelector}`);
      lines.push(`XPath: ${info.xpath}`);
      if (Object.keys(info.dataAttributes || {}).length) {
        lines.push(`Data Attributes: ${JSON.stringify(info.dataAttributes)}`);
      }
      if (Object.keys(info.ariaAttributes || {}).length) {
        lines.push(`ARIA Attributes: ${JSON.stringify(info.ariaAttributes)}`);
      }
      if (Object.keys(info.otherAttributes || {}).length) {
        lines.push(`Other Attributes: ${JSON.stringify(info.otherAttributes)}`);
      }
      lines.push(`HTML: ${info.htmlPreview}`);
    } else if (info.kind === "button") {
      const buttonType = buttonAttr(info, "type");
      const special = buttonAttr(info, "special");
      const confirmText = buttonAttr(info, "confirm");
      lines.push(`Field Inspector — Odoo Button`);
      lines.push(`Button Label: ${info.buttonLabel || ""}`);
      lines.push(`Button Type: ${buttonType || ""}`);
      if (info.actionReference) {
        lines.push(`Action Reference: ${info.actionReference}`);
      } else if (info.nameAttr) {
        lines.push(`${buttonType === "action" ? "Opens" : "Calls Method"}: ${info.nameAttr}`);
      }
      lines.push(`Special: ${special || ""}`);
      lines.push(`Record Model: ${info.recordModel || ""}`);
      lines.push(`Record ID: ${info.recordId || ""}`);
      lines.push(`Confirm Text: ${confirmText || ""}`);
      lines.push(`CSS Classes: ${info.classes}`);
      lines.push(`CSS Selector: ${info.cssSelector}`);
      lines.push(`XPath: ${info.xpath}`);
      if (Object.keys(info.dataAttributes || {}).length) {
        lines.push(`Data Attributes: ${JSON.stringify(info.dataAttributes)}`);
      }
      if (Object.keys(info.ariaAttributes || {}).length) {
        lines.push(`ARIA Attributes: ${JSON.stringify(info.ariaAttributes)}`);
      }
      const stack = info.odooViewStack;
      if (Array.isArray(stack)) {
        lines.push(`Active View XML ID: ${stack[0].xmlId || "(none)"}`);
        if (stack.length > 1) lines.push(`Inherits From: ${stack.slice(1).map((v) => v.xmlId || `view id ${v.id}`).join(" -> ")}`);
      }
      const va = info.odooViewAttrs;
      if (va && !va.error && va.attrs && Object.keys(va.attrs).length) {
        lines.push(`Declared In Current View: ${JSON.stringify(va.attrs)}`);
      }
      lines.push(`HTML: ${info.htmlPreview}`);
    } else {
      lines.push(`Field Inspector — List Column`);
      lines.push(`Column Name: ${info.columnName}`);
      lines.push(`Element Type: ${info.element}`);
      lines.push(`Column Index: ${info.columnIndex}`);
      lines.push(`ID: ${info.id}`);
      lines.push(`Name: ${info.nameAttr}`);
      lines.push(`CSS Classes: ${info.classes}`);
      lines.push(`CSS Selector: ${info.cssSelector}`);
      lines.push(`XPath: ${info.xpath}`);
      if (info.table) {
        lines.push(
          `Table: <${info.table.tag}> id="${info.table.id}" classes="${info.table.classes}" rows=${info.table.rowCount} cols=${info.table.columnCount}`
        );
      }
      if (info.relatedInput) {
        lines.push(`Related Input: <${info.relatedInput.tag}> type="${info.relatedInput.type}" selector="${info.relatedInput.cssSelector}"`);
      }
      if (Object.keys(info.dataAttributes || {}).length) {
        lines.push(`Data Attributes: ${JSON.stringify(info.dataAttributes)}`);
      }
      if (Object.keys(info.ariaAttributes || {}).length) {
        lines.push(`ARIA Attributes: ${JSON.stringify(info.ariaAttributes)}`);
      }
      lines.push(`HTML: ${info.htmlPreview}`);
    }
    return lines.join("\n");
  };

  window.__FI__.ui = ui;
})();
