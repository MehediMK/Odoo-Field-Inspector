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

  const PANEL_CSS = `
    :host {
      all: initial;
      --fi-bg: #ffffff;
      --fi-fg: #1f2430;
      --fi-shadow: 0 8px 32px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(15, 23, 42, 0.06);
      --fi-header-bg: #111827;
      --fi-header-fg: #f8fafc;
      --fi-badge-form-bg: #2563eb;
      --fi-badge-list-bg: #7c3aed;
      --fi-close-fg: #cbd5e1;
      --fi-close-hover-bg: rgba(255,255,255,0.12);
      --fi-close-hover-fg: #ffffff;
      --fi-section-title-fg: #64748b;
      --fi-section-border: #e5e7eb;
      --fi-row-label-fg: #64748b;
      --fi-row-value-fg: #111827;
      --fi-pill-bg: #f1f5f9;
      --fi-pill-fg: #334155;
      --fi-pill-yes-bg: #dcfce7;
      --fi-pill-yes-fg: #166534;
      --fi-pill-no-bg: #f1f5f9;
      --fi-pill-no-fg: #64748b;
      --fi-copyable-bg: #f8fafc;
      --fi-copyable-border: #e5e7eb;
      --fi-code-fg: #0f172a;
      --fi-copy-btn-border: #e2e8f0;
      --fi-copy-btn-bg: #ffffff;
      --fi-copy-btn-fg: #334155;
      --fi-copy-btn-hover-bg: #eef2ff;
      --fi-copy-btn-hover-border: #c7d2fe;
      --fi-copied-bg: #dcfce7;
      --fi-copied-border: #86efac;
      --fi-copied-fg: #166534;
      --fi-preview-bg: #0f172a;
      --fi-preview-fg: #e2e8f0;
      --fi-attr-key: #7c3aed;
      --fi-hint-fg: #94a3b8;
      --fi-footer-bg: #f8fafc;
      --fi-footer-border: #e5e7eb;
      --fi-copy-all-bg: #111827;
      --fi-copy-all-fg: #ffffff;
      --fi-copy-all-hover-bg: #1f2937;
      --fi-copy-all-copied-bg: #16a34a;
      --fi-link: #2563eb;
      --fi-table-stripe-bg: rgba(15, 23, 42, 0.028);
      --fi-table-header-bg: rgba(15, 23, 42, 0.035);
      --fi-tab-active: #714b67;
      --fi-required-dot: #ef4444;
      --fi-chip-blue-bg: #dbeafe;
      --fi-chip-blue-fg: #1d4ed8;
      --fi-chip-purple-bg: #ede9fe;
      --fi-chip-purple-fg: #6d28d9;
      --fi-chip-green-bg: #dcfce7;
      --fi-chip-green-fg: #166534;
      --fi-chip-orange-bg: #ffedd5;
      --fi-chip-orange-fg: #c2410c;
      --fi-chip-teal-bg: #ccfbf1;
      --fi-chip-teal-fg: #0f766e;
      --fi-chip-pink-bg: #fce7f3;
      --fi-chip-pink-fg: #be185d;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --fi-bg: #1a1d26;
        --fi-fg: #e6e9f0;
        --fi-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06);
        --fi-header-bg: #0b0e14;
        --fi-header-fg: #f2f4f8;
        --fi-badge-form-bg: #3b6fe0;
        --fi-badge-list-bg: #9061e8;
        --fi-close-fg: #8b93a7;
        --fi-close-hover-bg: rgba(255,255,255,0.1);
        --fi-close-hover-fg: #ffffff;
        --fi-section-title-fg: #8b93a7;
        --fi-section-border: #2c313d;
        --fi-row-label-fg: #8b93a7;
        --fi-row-value-fg: #e6e9f0;
        --fi-pill-bg: #262b36;
        --fi-pill-fg: #c3c9d6;
        --fi-pill-yes-bg: #163a24;
        --fi-pill-yes-fg: #5fd88a;
        --fi-pill-no-bg: #262b36;
        --fi-pill-no-fg: #8b93a7;
        --fi-copyable-bg: #20242e;
        --fi-copyable-border: #2c313d;
        --fi-code-fg: #dbe1ee;
        --fi-copy-btn-border: #333947;
        --fi-copy-btn-bg: #20242e;
        --fi-copy-btn-fg: #c3c9d6;
        --fi-copy-btn-hover-bg: #262c3d;
        --fi-copy-btn-hover-border: #3b4a6b;
        --fi-copied-bg: #163a24;
        --fi-copied-border: #1f7a44;
        --fi-copied-fg: #5fd88a;
        --fi-preview-bg: #0b0e14;
        --fi-preview-fg: #d7dbe4;
        --fi-attr-key: #b79bf5;
        --fi-hint-fg: #6b7385;
        --fi-footer-bg: #171a22;
        --fi-footer-border: #2c313d;
        --fi-copy-all-bg: #2f6fed;
        --fi-copy-all-fg: #ffffff;
        --fi-copy-all-hover-bg: #4a80f0;
        --fi-copy-all-copied-bg: #1f9d55;
        --fi-link: #7fa1f5;
        --fi-table-stripe-bg: rgba(255, 255, 255, 0.032);
        --fi-table-header-bg: rgba(255, 255, 255, 0.045);
        --fi-tab-active: #d4a6c8;
        --fi-required-dot: #f87171;
        --fi-chip-blue-bg: #1e3a5f;
        --fi-chip-blue-fg: #93c5fd;
        --fi-chip-purple-bg: #3b2f5e;
        --fi-chip-purple-fg: #c4b5fd;
        --fi-chip-green-bg: #163a24;
        --fi-chip-green-fg: #5fd88a;
        --fi-chip-orange-bg: #4a2c12;
        --fi-chip-orange-fg: #fdba74;
        --fi-chip-teal-bg: #0f3d38;
        --fi-chip-teal-fg: #5eead4;
        --fi-chip-pink-bg: #4a1942;
        --fi-chip-pink-fg: #f0abfc;
      }
    }
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
    .fi-finder-result-label { font-weight: 600; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fi-finder-result-name {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      color: var(--fi-row-label-fg);
      margin-top: 2px;
    }
    @media (max-width: 460px) {
      .fi-panel { left: 12px; right: 12px; top: 12px; bottom: 12px; width: auto; }
      .fi-finder-panel { left: 12px; right: 12px; width: auto; }
    }
  `;

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
    finderBtnEl: null,
    finderPanelEl: null,
    finderFields: [], // last-fetched full { kind, technicalName, label, el } list
    onFinderOpen: null, // () => { scope: "page"|"wizard", scopeLabel, fields[] } — set by content.js
    onFinderSelect: null, // (entry) => void — set by content.js
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
  const ICONS = {
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
  };

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
    finderBtn.className = "fi-finder-btn";
    finderBtn.title = "Search fields (label or technical name)";
    finderBtn.hidden = true;
    finderBtn.innerHTML = ICONS.search;
    shadow.appendChild(finderBtn);

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

    panel.querySelector("#fi-close-btn").addEventListener("click", () => ui.closePanel());
    panel.querySelector("#fi-copy-all-btn").addEventListener("click", (e) => ui.copyAll(e.currentTarget));
    panel.querySelector("#fi-jump-btn").addEventListener("click", () => ui.jumpToElement());
    makeDraggable(panel, panel.querySelector(".fi-header"));

    finderBtn.addEventListener("click", () => (ui.isFinderOpen() ? ui.closeFinder() : ui.openFinder()));
    finderPanel.querySelector("#fi-finder-close-btn").addEventListener("click", () => ui.closeFinder());
    finderPanel.querySelector("#fi-finder-search").addEventListener("input", (e) => renderFinderResults(e.target.value));

    shadow.addEventListener("click", (e) => {
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
    ui.finderBtnEl = finderBtn;
    ui.finderPanelEl = finderPanel;
  };

  function finderKindLabel(kind) {
    return kind === "list" ? "Column" : "Form";
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
            f.kind === "list" ? " purple" : " blue"
          }" style="font-size:10px;">${escapeHtml(finderKindLabel(f.kind))}</span><span class="fi-finder-result-label">${escapeHtml(
            f.label || "(no label)"
          )}</span></div>${
            f.technicalName ? `<div class="fi-finder-result-name">${escapeHtml(f.technicalName)}</div>` : ""
          }</button>`
      )
      .join("");
  }

  ui.showFinderButton = function () {
    ui.ensureHost();
    if (ui.finderBtnEl) ui.finderBtnEl.hidden = false;
  };

  ui.hideFinderButton = function () {
    if (ui.finderBtnEl) ui.finderBtnEl.hidden = true;
  };

  ui.isFinderOpen = function () {
    return !!(ui.finderPanelEl && !ui.finderPanelEl.hidden);
  };

  ui.openFinder = function () {
    ui.ensureHost();
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

  function renderViewAttrsBlock(info) {
    const va = info.odooViewAttrs;
    let body;
    if (va === undefined) {
      body = `<div class="fi-empty-hint" style="padding:4px 0;">Looking up how this field is declared in the current view…</div>`;
    } else if (va === null) {
      body = `<div class="fi-empty-hint" style="padding:4px 0;">Not found in this model's default form view arch — it may only appear in a different view (list/kanban), or a non-default form view is actually in use.</div>`;
    } else if (va.error) {
      body = `<div class="fi-empty-hint" style="padding:4px 0;">Could not fetch the view: ${escapeHtml(va.error)}</div>`;
    } else {
      const attrs = va.attrs || {};
      body = Object.keys(attrs).length
        ? attrList(attrs)
        : `<div class="fi-empty-hint" style="padding:4px 0;">Declared with no extra attributes: &lt;field name="${escapeHtml(
            info.odooFieldName
          )}"/&gt;</div>`;
      if (va.occurrences > 1) {
        body += `<div class="fi-empty-hint" style="padding:4px 0;">Appears ${va.occurrences} times in this view — showing the least-nested match.</div>`;
      }
    }
    return `<div class="fi-row-label" style="margin:10px 0 2px;">Declared In Current View (form)</div>${body}`;
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
        const url = `${location.origin}/web#model=ir.model.fields&id=${encodeURIComponent(meta.id)}&view_type=form`;
        rows.push(
          row(
            "Field Record",
            `<a class="fi-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open in Odoo (Settings → Technical → Fields) ↗</a>`,
            { html: true }
          )
        );
      }

      const options = meta.ttype === "selection" ? parsePySelectionLiteral(meta.selection) : null;
      if (options) {
        selectionOptionsHtml = `<div class="fi-row-label" style="margin:10px 0 4px;">Selection Options</div>${kvTable(options)}`;
      }
    }

    let html = table(rows.join("")) + hint + selectionOptionsHtml;
    html += renderViewAttrsBlock(info);

    const snippet = `<field name="${info.odooFieldName}"/>`;
    html += `<div class="fi-row-label" style="margin:10px 0 4px;">View XML Snippet</div>${copyableBlock(snippet)}`;

    return html;
  }

  /** Builds the ordered list of { title, html } tabs for a Form Field panel. */
  function renderFormInfo(info) {
    const tabs = [];

    if (info.odooFieldName) tabs.push({ title: "Odoo Field", icon: "odoo", html: renderOdooTabContent(info) });

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

    tabs.push({
      title: "State",
      icon: "state",
      html: table(
        [
          row("Current Value", info.currentValue),
          row("Default Value", info.defaultValue),
          row("Required", info.required ? "Yes" : "No", { pill: true }),
          row("Read Only", info.readOnly ? "Yes" : "No", { pill: true }),
          row("Disabled", info.disabled ? "Yes" : "No", { pill: true }),
        ].join("")
      ),
    });

    tabs.push({
      title: "Selectors",
      icon: "selectors",
      html: `<div class="fi-row-label" style="margin-bottom:2px;">CSS Selector</div>${copyableBlock(
        info.cssSelector
      )}<div class="fi-row-label" style="margin:8px 0 2px;">XPath</div>${copyableBlock(info.xpath)}`,
    });

    tabs.push({
      title: "Structure",
      icon: "structure",
      html:
        table(
          row("Parent Element", info.parentElement, { mono: true }) +
            row(
              "Form Name/ID",
              info.owningForm ? `${info.owningForm.name || info.owningForm.id || "(unnamed form)"}` : "Not inside a <form>"
            )
        ) +
        `<div class="fi-row-label" style="margin:10px 0 4px;">HTML Preview</div><div class="fi-html-preview">${escapeHtml(
          info.htmlPreview
        )}</div>`,
    });

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
      html: `<div class="fi-row-label" style="margin-bottom:2px;">CSS Selector</div>${copyableBlock(
        info.cssSelector
      )}<div class="fi-row-label" style="margin:8px 0 2px;">XPath</div>${copyableBlock(info.xpath)}`,
    });

    tabs.push({ title: "Structure", icon: "structure", html: `<div class="fi-html-preview">${escapeHtml(info.htmlPreview)}</div>` });

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

    if (info.odooFieldName) tabs.push({ title: "Odoo Field", icon: "odoo", html: renderOdooTabContent(info) });

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

    tabs.push({
      title: "Selectors",
      icon: "selectors",
      html: `<div class="fi-row-label" style="margin-bottom:2px;">CSS Selector</div>${copyableBlock(
        info.cssSelector
      )}<div class="fi-row-label" style="margin:8px 0 2px;">XPath</div>${copyableBlock(info.xpath)}`,
    });

    tabs.push({ title: "Structure", icon: "structure", html: `<div class="fi-html-preview">${escapeHtml(info.htmlPreview)}</div>` });

    if (Object.keys(info.dataAttributes || {}).length) tabs.push({ title: "Data Attrs", icon: "data", html: attrList(info.dataAttributes) });
    if (Object.keys(info.ariaAttributes || {}).length) tabs.push({ title: "ARIA Attrs", icon: "aria", html: attrList(info.ariaAttributes) });
    if (Object.keys(info.otherAttributes || {}).length) tabs.push({ title: "Other Attrs", icon: "other", html: attrList(info.otherAttributes) });

    return tabs;
  }

  /** Dispatches to the right tab-array builder for the panel's kind. */
  function renderBody(info) {
    if (info.kind === "list") return renderListInfo(info);
    if (info.kind === "listCell") return renderDataCellInfo(info);
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
    const badgeText = { list: "List / Column", listCell: "List / Cell" }[info.kind] || "Form Field";
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
    return !!info && (info.kind === "form" || info.kind === "listCell");
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

  ui.closePanel = function () {
    if (ui.panelEl) ui.panelEl.hidden = true;
    ui.lastInfo = null;
  };

  ui.isPanelOpen = function () {
    return !!(ui.panelEl && !ui.panelEl.hidden);
  };

  ui.destroy = function () {
    ui.closePanel();
    if (ui.hostEl && ui.hostEl.parentNode) ui.hostEl.parentNode.removeChild(ui.hostEl);
    ui.hostEl = null;
    ui.shadowRoot = null;
    ui.panelEl = null;
    ui.bodyEl = null;
    ui.lastElement = null;
    ui.history = [];
    ui.historyPos = -1;
    ui.finderBtnEl = null;
    ui.finderPanelEl = null;
    ui.finderFields = [];
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
      if (meta.id != null) lines.push(`Field Record: ${location.origin}/web#model=ir.model.fields&id=${meta.id}&view_type=form`);
    } else if (meta && meta.error) {
      lines.push(`(Odoo backend lookup failed: ${meta.error})`);
    } else if (meta === null) {
      lines.push(`(No matching ir.model.fields row found)`);
    } else {
      lines.push(`(Odoo backend lookup was still in progress when copied)`);
    }

    const va = info.odooViewAttrs;
    if (va && !va.error && va.attrs && Object.keys(va.attrs).length) {
      lines.push(`Declared In Current View (form): ${JSON.stringify(va.attrs)}`);
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
