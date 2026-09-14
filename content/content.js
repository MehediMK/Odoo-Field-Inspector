/**
 * Odoo Field Inspector - main content script controller
 *
 * Wires together utils.js / detector.js / ui.js, owns the enabled/settings
 * state for this page, and talks to the popup/background via
 * chrome.runtime messages. Guarded so re-injection (e.g. popup calling
 * scripting.executeScript twice) is a safe no-op.
 *
 * Data-safety guarantee: while the inspector is enabled, clicks (and the
 * mousedown that precedes a <select> opening or a checkbox toggling) on a
 * detected field are intercepted in the capture phase and prevented from
 * reaching the page, so no form value or focus state is ever changed by
 * this extension. Clicks that don't land on a detected field are left
 * completely untouched and behave exactly as the host page intends.
 */
(function () {
  if (window.__FI__ && window.__FI__.__contentLoaded__) return; // idempotent re-injection guard
  window.__FI__ = window.__FI__ || {};
  window.__FI__.__contentLoaded__ = true;

  const { utils, detector, ui } = window.__FI__;

  const DEFAULT_SETTINGS = {
    formView: true,
    listView: true,
    highlight: true,
    copyFormat: "text",
  };

  const state = {
    enabled: false,
    settings: { ...DEFAULT_SETTINGS },
  };

  let lastHoverEl = null;

  function inPanel(e) {
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    return !!(ui.hostEl && path.includes(ui.hostEl));
  }

  function onMouseDown(e) {
    try {
      if (!state.enabled || inPanel(e)) return;
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

  function onClick(e) {
    try {
      if (!state.enabled) return;
      if (inPanel(e)) return; // let the panel's own listeners handle internal clicks

      const resolved = detector.resolveInspectable(e.target, state.settings);
      if (!resolved) {
        ui.closePanel();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const info =
        resolved.kind === "list" ? detector.buildColumnInfo(resolved.el) : detector.buildFormFieldInfo(resolved.el);

      const odoo = window.__FI__.odoo;
      if (info.kind === "form" && info.odooFieldName && odoo) {
        info.odooModel = odoo.detectCurrentModel();
      }

      ui.showPanel(info, state.settings);

      // Live Odoo field definition lookup: runs after the panel is already
      // showing (synchronous DOM-derived info first, network second) and is
      // race-guarded against the user clicking a different field before the
      // RPC resolves — see ui.beginOdooLookup/applyOdooFieldMeta.
      if (info.kind === "form" && info.odooFieldName && info.odooModel && odoo) {
        const requestId = ui.beginOdooLookup();
        odoo.fetchFieldMeta(info.odooModel, info.odooFieldName).then((meta) => {
          ui.applyOdooFieldMeta(requestId, meta);
        });
      }
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
    if (e.key === "Escape" && ui.isPanelOpen()) {
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

  function notifyBackground(enabled) {
    try {
      chrome.runtime.sendMessage({ type: "FI_STATE_CHANGED", enabled });
    } catch (err) {
      // Extension context may be invalidated (e.g. extension reloaded); ignore.
    }
  }

  function enable(settings) {
    state.enabled = true;
    state.settings = { ...state.settings, ...(settings || {}) };
    document.documentElement.setAttribute("data-fi-active", "true");
    attachListeners();
    detector.applyHighlights(state.settings);
    detector.startObserving(state.settings);
    notifyBackground(true);
  }

  function disable() {
    state.enabled = false;
    document.documentElement.removeAttribute("data-fi-active");
    detachListeners();
    detector.stopObserving();
    detector.clearHighlights();
    ui.closePanel();
    if (lastHoverEl) {
      detector.setHover(lastHoverEl, false);
      lastHoverEl = null;
    }
    notifyBackground(false);
  }

  function updateSettings(newSettings) {
    state.settings = { ...state.settings, ...(newSettings || {}) };
    if (state.enabled) {
      detector.applyHighlights(state.settings);
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
          disable();
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
