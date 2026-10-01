/**
 * Odoo Field Inspector - main content script controller
 *
 * Wires together utils.js / detector.js / ui.js, owns the enabled/settings
 * state for this page, and talks to the popup/background via
 * chrome.runtime messages. Guarded so re-injection (e.g. popup calling
 * scripting.executeScript twice) is a safe no-op.
 *
 * Data-safety guarantee: while the inspector is enabled AND the
 * "intercept clicks" setting is on (the default), clicks (and the
 * mousedown that precedes a <select> opening or a checkbox toggling) on a
 * detected field are intercepted in the capture phase and prevented from
 * reaching the page, so no form value or focus state is ever changed by
 * this extension. Clicks that don't land on a detected field are left
 * completely untouched and behave exactly as the host page intends.
 *
 * Click-through mode ("intercept clicks" off): the panel still opens on a
 * click, but the event is allowed through to the page, so the user can
 * keep working the form while inspecting it. This is an explicit opt-in
 * because the page's own handlers then run normally — including anything
 * they change.
 */
(function () {
  if (window.__FI__ && window.__FI__.__contentLoaded__) return; // idempotent re-injection guard
  window.__FI__ = window.__FI__ || {};
  window.__FI__.__contentLoaded__ = true;

  const { utils, detector, ui } = window.__FI__;

  // One definition, in shared.js. A literal copy here used to be the thing
  // that drifted from the popup's; tests/shared.test.cjs now fails if either
  // surface defines its own defaults instead of reading this.
  const DEFAULT_SETTINGS = self.FI_SHARED.DEFAULT_SETTINGS;

  const state = {
    enabled: false,
    settings: { ...DEFAULT_SETTINGS },
    // null = the URL said nothing, so the saved `debug` setting decides.
    debugOverride: null,
    debug: false,
  };

  const debugLog = [];
  const DEBUG_LOG_LIMIT = 80;

  /**
   * `?debug=1` / `?debug=0` from the page URL, or null when absent. Read
   * through shared.js when it is present (the same rule the popup and worker
   * use) and degraded to null when it is not, so a page that somehow loads
   * these scripts without shared.js still gets a working inspector instead of
   * a crash — it just loses the URL override.
   */
  function debugOverrideForUrl() {
    const api = typeof self !== "undefined" ? self.FI_SHARED : null;
    if (!api || typeof api.debugFlagForUrl !== "function") return null;
    try {
      const value = api.debugFlagForUrl(location.href);
      return value === true || value === false ? value : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Debug diagnostics. Kept in a bounded ring so the on-screen readout stays
   * useful, and only ever written when debug mode is actually on — the
   * strings are built at the call site, so a disabled logger costs one
   * boolean check per call site.
   */
  function logDebug(message, detail) {
    if (!state.debug) return;
    const stamp = new Date().toISOString().slice(11, 23);
    let line = `[${stamp}] ${message}`;
    if (detail !== undefined) {
      let text;
      try {
        text = typeof detail === "string" ? detail : JSON.stringify(detail);
      } catch (err) {
        text = "(unserializable detail)";
      }
      line += ` ${text}`;
    }
    debugLog.push(line);
    if (debugLog.length > DEBUG_LOG_LIMIT) debugLog.shift();
    console.debug(`[Field Inspector] ${line}`);
  }

  ui.onDebugReport = function () {
    // No lines at all when debug is off: the readout is a debug feature, and a
    // panel that prints "effective debug: false" is noise on a normal page.
    if (!state.debug) return { lines: [] };
    const resolved = ui.resolvedTheme || "(unpainted)";
    return {
      lines: [
        ...debugLog,
        `enabled: ${state.enabled}`,
        `url debug param: ${state.debugOverride === null ? "(not set)" : state.debugOverride}`,
        `saved debug setting: ${!!state.settings.debug}`,
        `effective debug: ${state.debug}`,
        `theme: ${state.settings.theme} → ${resolved}   accent: ${state.settings.accent}   density: ${state.settings.density}`,
      ],
    };
  };

  let lastHoverEl = null;

  // Wired once: the Field Finder (in ui.js) doesn't know about detector/odoo
  // itself, it just asks for a fresh field list on open and reports back
  // which entry the user picked. When an Odoo wizard (dialog) is open, the
  // search is automatically scoped to just that dialog's fields instead of
  // the whole page — that's almost always what you want while a wizard is
  // open, and it also sidesteps duplicate-label collisions between the
  // wizard and whatever's behind it.
  ui.onFinderOpen = () => {
    const wizardRoot = detector.findOpenWizard();
    return {
      scope: wizardRoot ? "wizard" : "page",
      scopeLabel: wizardRoot ? detector.getWizardTitle(wizardRoot) : "",
      fields: detector.listAllFields(state.settings, wizardRoot || undefined),
    };
  };
  ui.onFinderSelect = (entry) => inspectElement({ kind: entry.kind, el: entry.el });

  ui.onDisable = () => disable(true);
  ui.onOptionSetting = (key, value) => {
    updateSettings({ [key]: value });
    chrome.storage.local.set({ fiSettings: state.settings }).catch((err) => {
      console.error("[Field Inspector] could not save settings:", err);
    });
  };

  function inPanel(e) {
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    return !!(ui.hostEl && path.includes(ui.hostEl));
  }

  function onMouseDown(e) {
    try {
      if (!state.enabled || !state.settings.interceptClicks || inPanel(e)) return;
      const resolved = detector.resolveInspectable(e.target, state.settings);
      if (!resolved) return;
      // Prevent the native focus / dropdown-open / check-toggle that mousedown
      // triggers by default, before the click handler even runs. This matters
      // for widgets (e.g. an Odoo many2one/date field) that open their own
      // autocomplete or "create/search" popup on focus rather than waiting
      // for a click — stopping the click alone is too late for those.
      e.preventDefault();
    } catch (err) {
      console.error("[Field Inspector] onMouseDown error:", err);
    }
  }

  /**
   * Builds the info panel for a resolved element and shows it, including the
   * live Odoo lookups. Shared by the real click handler and the Field
   * Finder's "select a result" action, so both paths behave identically.
   */
  function inspectElement(resolved) {
    let info;
    if (resolved.kind === "list") {
      info = detector.buildColumnInfo(resolved.el);
    } else if (resolved.kind === "listCell") {
      info = detector.buildDataCellInfo(resolved.el);
    } else if (resolved.kind === "button") {
      info = detector.buildButtonInfo(resolved.el);
    } else {
      info = detector.buildFormFieldInfo(resolved.el, { showSensitiveValues: state.settings.showSensitiveValues });
    }

    const started = state.debug ? performance.now() : 0;
    logDebug(`inspect ${info.kind}`, {
      tag: (resolved.el.tagName || "").toLowerCase(),
      name: info.odooFieldName || info.nameAttr || info.technicalName || "",
    });

    const odoo = window.__FI__.odoo;
    if (state.settings.odooMode && odoo) info.odooRecordInfo = odoo.detectRecordInfo(resolved.el);
    ui.showPanel(info, state.settings, resolved.el);
    if (state.settings.odooMode && odoo) {
      const requestId = ui.beginOdooLookup();
      const inspectedUrl = location.href;
      const current = () => location.href === inspectedUrl && resolved.el.isConnected && state.enabled && state.settings.odooMode && ui.isCurrentLookup(requestId, info);
      (async () => {
        const recordInfo = await odoo.resolveRecordInfo(resolved.el);
        if (!current()) return;
        info.odooRecordInfo = recordInfo;
        info.odooModel = recordInfo?.model || null;
        ui.refreshPanel(info);
        if (!info.odooModel) return;
        const isButton = info.kind === 'button';
        const viewType = recordInfo?.viewType || (resolved.kind === 'form' || isButton ? 'form' : 'list');
        info.odooViewType = viewType;
        const viewId = recordInfo?.viewId || null;
        const context = recordInfo?.context || {};
        const apply = (promise, fn) => promise.then(value => { if (current()) fn(value); }).catch(() => {});
        if (info.odooFieldName && !isButton)
          apply(odoo.fetchFieldMeta(info.odooModel, info.odooFieldName, context), meta => ui.applyOdooFieldMeta(requestId, meta));
        if (isButton || info.odooFieldName)
          apply(odoo.fetchViewNodeAttrs(info.odooModel, isButton ? 'button' : 'field', isButton ? info.nameAttr : info.odooFieldName, viewType, viewId, context), attrs => ui.applyOdooViewAttrs(requestId, attrs));
        apply(odoo.fetchViewStack(info.odooModel, viewType, viewId, context), stack => ui.applyViewStack(requestId, stack));
        apply(odoo.fetchServerVersion(), version => ui.applyOdooVersion(requestId, version));
        if (recordInfo?.actionId && !recordInfo.actionName && /^\d+$/.test(String(recordInfo.actionId))) {
          apply(odoo.fetchActionDetails(recordInfo.actionId), action => {
            if (!action || action.error) return;
            Object.assign(recordInfo, {
              actionName: action.name, actionType: action.type, actionXmlId: action.xml_id,
              actionContext: typeof action.context === 'string' ? action.context : JSON.stringify(action.context || {}),
              actionDomain: typeof action.domain === 'string' ? action.domain : JSON.stringify(action.domain || []),
            });
            ui.refreshPanel(info);
          });
        }
      })().catch(error => logDebug('Context lookup failed', String(error)));
    }

    if (state.debug) {
      const kind = info.kind;
      requestAnimationFrame(() => logDebug(`panel rendered`, { kind, ms: Math.round((performance.now() - started) * 10) / 10 }));
    }
  }

  function onClick(e) {
    try {
      if (!state.enabled) return;
      if (inPanel(e)) return; // let the panel's own listeners handle internal clicks

      const resolved = detector.resolveInspectable(e.target, state.settings);
      if (!resolved) {
        ui.closePanel();
        ui.closeOptions();
        return;
      }

      ui.closeOptions();

      // In click-through mode the event is deliberately allowed to reach the
      // page (no preventDefault/stopPropagation) so the form stays usable,
      // while the panel still opens for the same element.
      if (state.settings.interceptClicks) {
        e.preventDefault();
        e.stopPropagation();
      }

      inspectElement(resolved);
    } catch (err) {
      console.error("[Field Inspector] onClick error:", err);
    }
  }

  function onMouseOver(e) {
    try {
      if (!state.enabled || !state.settings.highlight || inPanel(e)) return;
      const resolved = detector.resolveInspectable(e.target, state.settings);
      if (resolved) {
        if (lastHoverEl && lastHoverEl !== resolved.el) detector.setHover(lastHoverEl, false);
        detector.setHover(resolved.el, true);
        lastHoverEl = resolved.el;
      } else if (lastHoverEl) {
        detector.setHover(lastHoverEl, false);
        lastHoverEl = null;
      }
    } catch (err) {
      console.error("[Field Inspector] onMouseOver error:", err);
    }
  }

  function onMouseOut(e) {
    if (!e.relatedTarget && lastHoverEl) {
      detector.setHover(lastHoverEl, false);
      lastHoverEl = null;
    }
  }

  function onKeyDown(e) {
    if (e.key !== "Escape") return;
    if (window.__FI__.technical?.isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      window.__FI__.technical.close();
    } else if (ui.isOptionsOpen()) {
      e.preventDefault();
      e.stopPropagation();
      ui.closeOptions(true);
    } else if (ui.isSettingsOpen && ui.isSettingsOpen()) {
      e.preventDefault();
      e.stopPropagation();
      ui.closeSettings(true);
    } else if (window.__FI__.chatter?.isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      window.__FI__.chatter.close(true);
    } else if (window.__FI__.domainBuilder?.isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      window.__FI__.domainBuilder.close(true);
    } else if (ui.isFinderOpen && ui.isFinderOpen()) {
      ui.closeFinder();
    } else if (ui.isPanelOpen()) {
      ui.closePanel();
    }
  }

  function attachListeners() {
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function detachListeners() {
    document.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("mouseout", onMouseOut, true);
    document.removeEventListener("keydown", onKeyDown, true);
  }

  /**
   * @param {boolean} enabled
   * @param {boolean} userInitiated
   *   True when a person turned the inspector off (FAB menu or popup), false
   *   for internal teardown such as pagehide. The service worker uses this
   *   to remember an opt-out for the current site; reporting every internal
   *   teardown as user intent would silently defeat per-site auto-enable.
   */
  function notifyBackground(enabled, userInitiated = false) {
    try {
      chrome.runtime.sendMessage({ type: "FI_STATE_CHANGED", enabled, userInitiated });
    } catch (err) {
      // Extension context may be invalidated (e.g. extension reloaded); ignore.
    }
  }

  function enable(settings) {
    state.enabled = true;
    // Unknown/removed keys from a newer or older build are merged as-is and
    // then normalised here, so an unknown theme/accent can never leave the
    // panel unstyled (ui.applyTheme falls back rather than trusting the value).
    state.settings = { ...state.settings, ...(settings || {}) };
    state.debugOverride = debugOverrideForUrl();
    state.debug = state.debugOverride === null ? !!state.settings.debug : state.debugOverride;
    ui.debugState = { effective: state.debug, override: state.debugOverride, saved: !!state.settings.debug };
    document.documentElement.setAttribute("data-fi-active", "true");
    attachListeners();
    detector.applyHighlights(state.settings);
    detector.startObserving(state.settings);
    ui.ensureHost();
    ui.settingsRef = state.settings;
    ui.applyTheme(state.settings);
    ui.showFinderButton();
    window.__FI__.chatter?.start();
    logDebug("inspector enabled", { theme: state.settings.theme, accent: state.settings.accent, debug: state.debug });
    notifyBackground(true);
  }

  function disable(userInitiated = false) {
    state.enabled = false;
    window.__FI__.technical?.close();
    document.documentElement.removeAttribute("data-fi-active");
    detachListeners();
    detector.stopObserving();
    detector.clearHighlights();
    ui.closePanel();
    ui.closeFinder();
    ui.closeSettings();
    ui.hideFinderButton();
    // The accent lives on <html> for content.css, which is injected into the
    // page — so disabling has to take it back off, or the host page is left
    // carrying properties (and a data attribute) it never had.
    ui.clearTheme();
    window.__FI__.chatter?.stop();
    window.__FI__.domainBuilder?.close();
    if (lastHoverEl) {
      detector.setHover(lastHoverEl, false);
      lastHoverEl = null;
    }
    notifyBackground(false, userInitiated);
  }

  /**
   * Re-redacts any history entry that was built while "show sensitive
   * values" was on, so turning the setting off also clears already-captured
   * values from the Recent Fields cache (not just from the live panel).
   */
  function redactHistory() {
    (ui.history || []).forEach((entry, i) => {
      const info = entry && entry.info;
      if (!info || info.kind !== "form" || !info.sensitive || !info.valuesRevealed || !entry.el) return;
      try {
        ui.history[i] = { ...entry, info: detector.buildFormFieldInfo(entry.el, { showSensitiveValues: false }) };
      } catch (err) {
        console.error("[Field Inspector] history redaction failed:", err);
      }
    });
  }

  function updateSettings(newSettings) {
    window.__FI__.technical?.close();
    const wasOdooMode = state.settings.odooMode;
    const wasReveal = state.settings.showSensitiveValues;
    state.settings = { ...state.settings, ...(newSettings || {}) };
    ui.settingsRef = state.settings;
    state.debugOverride = debugOverrideForUrl();
    state.debug = state.debugOverride === null ? !!state.settings.debug : state.debugOverride;
    ui.debugState = { effective: state.debug, override: state.debugOverride, saved: !!state.settings.debug };
    // Only paint while enabled: applyTheme would otherwise create the shadow
    // host on a page where the inspector is supposed to be absent.
    if (state.enabled) ui.applyTheme(state.settings);
    else ui.clearTheme();
    if (wasOdooMode && !state.settings.odooMode) window.__FI__.domainBuilder?.close();
    if (wasReveal && !state.settings.showSensitiveValues) redactHistory();
    if (state.enabled) {
      detector.applyHighlights(state.settings);
      detector.startObserving(state.settings);
      if (!state.settings.highlight && lastHoverEl) {
        detector.setHover(lastHoverEl, false);
        lastHoverEl = null;
      }
      if (ui.isOptionsOpen()) ui.openOptions();
      if (ui.isSettingsOpen()) ui.openSettings();
      const needsRebuild =
        newSettings && ("odooMode" in newSettings || "showSensitiveValues" in newSettings);
      if (ui.lastInfo && ui.lastElement && needsRebuild) {
        inspectElement({ kind: ui.lastInfo.kind, el: ui.lastElement });
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (!message || typeof message.type !== "string") return false;

      switch (message.type) {
        case "PING":
          sendResponse({ pong: true, enabled: state.enabled });
          return false;
        case "FI_ENABLE":
          enable(message.settings);
          sendResponse({ ok: true });
          return false;
        case "FI_DISABLE":
          disable(true);
          sendResponse({ ok: true });
          return false;
        case "FI_UPDATE_SETTINGS":
          updateSettings(message.settings);
          sendResponse({ ok: true });
          return false;
        case "GET_STATE":
          sendResponse({ enabled: state.enabled, settings: state.settings });
          return false;
        default:
          return false;
      }
    } catch (err) {
      console.error("[Field Inspector] message handler error:", err);
      try {
        sendResponse({ ok: false, error: String(err) });
      } catch (_) {
        /* channel may already be closed */
      }
      return false;
    }
  });

  window.addEventListener("pagehide", () => {
    if (state.enabled) disable();
  });
})();
