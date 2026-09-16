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
      --fi-attr-bg: #f8fafc;
      --fi-attr-key: #7c3aed;
      --fi-attr-val: #0f172a;
      --fi-hint-fg: #94a3b8;
      --fi-footer-bg: #f8fafc;
      --fi-footer-border: #e5e7eb;
      --fi-copy-all-bg: #111827;
      --fi-copy-all-fg: #ffffff;
      --fi-copy-all-hover-bg: #1f2937;
      --fi-copy-all-copied-bg: #16a34a;
      --fi-link: #2563eb;
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
        --fi-attr-bg: #20242e;
        --fi-attr-key: #b79bf5;
        --fi-attr-val: #dbe1ee;
        --fi-hint-fg: #6b7385;
        --fi-footer-bg: #171a22;
        --fi-footer-border: #2c313d;
        --fi-copy-all-bg: #2f6fed;
        --fi-copy-all-fg: #ffffff;
        --fi-copy-all-hover-bg: #4a80f0;
        --fi-copy-all-copied-bg: #1f9d55;
        --fi-link: #7fa1f5;
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
    }
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
    .fi-body { overflow-y: auto; padding: 10px 14px 14px; flex: 1 1 auto; }
    .fi-section { margin-top: 14px; }
    .fi-section:first-child { margin-top: 4px; }
    .fi-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--fi-section-title-fg);
      margin-bottom: 6px;
      border-bottom: 1px solid var(--fi-section-border);
      padding-bottom: 4px;
    }
    .fi-row { display: flex; gap: 10px; padding: 4px 0; align-items: flex-start; }
    .fi-row-label { flex: 0 0 108px; color: var(--fi-row-label-fg); font-weight: 600; font-size: 12px; padding-top: 1px; }
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
    .fi-attr-list { display: flex; flex-direction: column; gap: 3px; }
    .fi-attr-item {
      display: flex;
      gap: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11.5px;
      background: var(--fi-attr-bg);
      border-radius: 4px;
      padding: 3px 6px;
    }
    .fi-attr-key { color: var(--fi-attr-key); }
    .fi-attr-val { color: var(--fi-attr-val); word-break: break-all; }
    .fi-empty-hint { color: var(--fi-hint-fg); font-size: 12px; font-style: italic; }
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
    @media (max-width: 460px) {
      .fi-panel { left: 12px; right: 12px; top: 12px; bottom: 12px; width: auto; }
    }
  `;

  const ui = {
    hostEl: null,
    shadowRoot: null,
    panelEl: null,
    bodyEl: null,
    lastInfo: null,
    settingsRef: { copyFormat: "text" },
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
        </div>
        <button type="button" class="fi-close-btn" id="fi-close-btn" title="Close" aria-label="Close">×</button>
      </div>
      <div class="fi-body" id="fi-body"></div>
      <div class="fi-footer">
        <button type="button" class="fi-copy-all-btn" id="fi-copy-all-btn">Copy All Information</button>
      </div>
    `;
    shadow.appendChild(panel);

    panel.querySelector("#fi-close-btn").addEventListener("click", () => ui.closePanel());
    panel.querySelector("#fi-copy-all-btn").addEventListener("click", (e) => ui.copyAll(e.currentTarget));

    shadow.addEventListener("click", (e) => {
      const copyBtn = e.target.closest(".fi-copy-btn");
      if (copyBtn) {
        const text = copyBtn.getAttribute("data-copy-value") || "";
        ui.copySingle(copyBtn, text);
      }
    });

    ui.hostEl = host;
    ui.shadowRoot = shadow;
    ui.panelEl = panel;
    ui.bodyEl = panel.querySelector("#fi-body");
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
    } else {
      valueHtml = escapeHtml(value === "" || value == null ? "—" : value);
    }
    return `<div class="fi-row"><div class="fi-row-label">${escapeHtml(label)}</div><div class="${cls}">${valueHtml}</div></div>`;
  }

  function copyableBlock(value) {
    const safe = escapeHtml(value || "");
    return `<div class="fi-copyable"><code>${safe || "—"}</code><button type="button" class="fi-copy-btn" data-copy-value="${safe}" title="Copy">📋</button></div>`;
  }

  function attrList(obj) {
    const keys = Object.keys(obj || {});
    if (keys.length === 0) return `<div class="fi-empty-hint">None</div>`;
    return `<div class="fi-attr-list">${keys
      .map(
        (k) =>
          `<div class="fi-attr-item"><span class="fi-attr-key">${escapeHtml(k)}</span><span class="fi-attr-val">=${escapeHtml(
            String(obj[k])
          )}</span></div>`
      )
      .join("")}</div>`;
  }

  function section(title, innerHtml) {
    return `<div class="fi-section"><div class="fi-section-title">${escapeHtml(title)}</div>${innerHtml}</div>`;
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

  function renderOdooSection(info) {
    if (!info.odooFieldName) return "";

    if (!ui.settingsRef.odooMode) {
      return section(
        "Odoo Field Definition",
        row("Technical Field Name", info.odooFieldName, { mono: true }) +
          `<div class="fi-empty-hint" style="padding:4px 0;">Odoo Developer Mode is off — turn it on in the popup for a live model/type/relation lookup from your Odoo server.</div>`
      );
    }

    const rows = [
      row("Model", info.odooModel || "(not detected)", { mono: true }),
      row("Technical Field Name", info.odooFieldName, { mono: true }),
    ];
    const meta = info.odooFieldMeta;

    if (meta === undefined) {
      rows.push(`<div class="fi-empty-hint" style="padding:4px 0;">Looking up live field definition from Odoo…</div>`);
    } else if (meta === null) {
      rows.push(
        `<div class="fi-empty-hint" style="padding:4px 0;">No matching ir.model.fields row${
          info.odooModel ? ` on ${escapeHtml(info.odooModel)}` : ""
        } — model may not have been detected yet, or this is a non-stored/dynamic field.</div>`
      );
    } else if (meta.error) {
      rows.push(`<div class="fi-empty-hint" style="padding:4px 0;">Could not reach the Odoo backend: ${escapeHtml(meta.error)}</div>`);
    } else {
      rows.push(
        row("Label (field_description)", meta.field_description || "—"),
        row("ORM Type", meta.ttype, { mono: true })
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

      const options = meta.ttype === "selection" ? parsePySelectionLiteral(meta.selection) : null;
      if (options) {
        rows.push(
          `<div class="fi-row-label" style="margin:6px 0 2px;">Selection Options</div><div class="fi-attr-list">${options
            .map(([key, label]) => `<div class="fi-attr-item"><span class="fi-attr-key">${escapeHtml(key)}</span><span class="fi-attr-val">= ${escapeHtml(label)}</span></div>`)
            .join("")}</div>`
        );
      }

      if (meta.id != null) {
        const url = `${location.origin}/web#model=ir.model.fields&id=${encodeURIComponent(meta.id)}&view_type=form`;
        rows.push(
          `<div class="fi-row"><div class="fi-row-label">Field Record</div><div class="fi-row-value"><a class="fi-link" href="${escapeHtml(
            url
          )}" target="_blank" rel="noopener">Open in Odoo (Settings → Technical → Fields) ↗</a></div></div>`
        );
      }
    }

    rows.push(renderViewAttrsBlock(info));

    const snippet = `<field name="${info.odooFieldName}"/>`;
    rows.push(`<div class="fi-row-label" style="margin:8px 0 2px;">View XML Snippet</div>${copyableBlock(snippet)}`);

    return section("Odoo Field Definition (live)", rows.join(""));
  }

  function renderFormInfo(info) {
    let html = "";
    html += renderOdooSection(info);

    const fieldInfoRows = [row("Field Label", info.fieldLabel)];
    fieldInfoRows.push(
      row("HTML Element", info.element, { mono: true }),
      row("Field Type", info.fieldType),
      row("Input Type", info.inputType || "—"),
      row("Field ID", info.id, { mono: true }),
      row("Name Attribute", info.nameAttr, { mono: true }),
      row("CSS Classes", info.classes, { mono: true }),
      row("Placeholder", info.placeholder)
    );
    html += section("Field Info", fieldInfoRows.join(""));

    html += section(
      "Current State",
      [
        row("Current Value", info.currentValue),
        row("Default Value", info.defaultValue),
        row("Required", info.required ? "Yes" : "No", { pill: true }),
        row("Read Only", info.readOnly ? "Yes" : "No", { pill: true }),
        row("Disabled", info.disabled ? "Yes" : "No", { pill: true }),
      ].join("")
    );

    html += section(
      "Selectors",
      `<div class="fi-row-label" style="margin-bottom:2px;">CSS Selector</div>${copyableBlock(
        info.cssSelector
      )}<div class="fi-row-label" style="margin:8px 0 2px;">XPath</div>${copyableBlock(info.xpath)}`
    );

    html += section(
      "Structure",
      [
        row("Parent Element", info.parentElement, { mono: true }),
        row(
          "Form Name/ID",
          info.owningForm ? `${info.owningForm.name || info.owningForm.id || "(unnamed form)"}` : "Not inside a <form>"
        ),
        `<div class="fi-row-label" style="margin:6px 0 2px;">HTML Preview</div><div class="fi-html-preview">${escapeHtml(
          info.htmlPreview
        )}</div>`,
      ].join("")
    );

    if (Object.keys(info.validationAttributes || {}).length) {
      html += section("Validation Attributes", attrList(info.validationAttributes));
    }
    if (Object.keys(info.dataAttributes || {}).length) {
      html += section("Data Attributes", attrList(info.dataAttributes));
    }
    if (Object.keys(info.ariaAttributes || {}).length) {
      html += section("ARIA Attributes", attrList(info.ariaAttributes));
    }
    if (Object.keys(info.otherAttributes || {}).length) {
      html += section("Other Attributes", attrList(info.otherAttributes));
    }

    return html;
  }

  function renderListInfo(info) {
    let html = "";
    html += section(
      "Column Info",
      [
        row("Column Name", info.columnName),
        row("Element Type", info.element, { mono: true }),
        row("Column Index", String(info.columnIndex)),
        row("ID", info.id, { mono: true }),
        row("Name", info.nameAttr, { mono: true }),
        row("CSS Classes", info.classes, { mono: true }),
      ].join("")
    );

    html += section(
      "Selectors",
      `<div class="fi-row-label" style="margin-bottom:2px;">CSS Selector</div>${copyableBlock(
        info.cssSelector
      )}<div class="fi-row-label" style="margin:8px 0 2px;">XPath</div>${copyableBlock(info.xpath)}`
    );

    html += section(
      "HTML Structure",
      `<div class="fi-html-preview">${escapeHtml(info.htmlPreview)}</div>`
    );

    if (info.table) {
      html += section(
        "Parent Table / Grid",
        [
          row("Tag", info.table.tag, { mono: true }),
          row("ID", info.table.id, { mono: true }),
          row("Classes", info.table.classes, { mono: true }),
          row("Row Count", info.table.rowCount == null ? "—" : String(info.table.rowCount)),
          row("Column Count", info.table.columnCount == null ? "—" : String(info.table.columnCount)),
        ].join("")
      );
    }

    if (info.relatedInput) {
      html += section(
        "Related Form/Input (sample row)",
        [row("Element", info.relatedInput.tag, { mono: true }), row("Type", info.relatedInput.type), row("CSS Selector", info.relatedInput.cssSelector, { mono: true })].join(
          ""
        )
      );
    }

    if (Object.keys(info.dataAttributes || {}).length) {
      html += section("Data Attributes", attrList(info.dataAttributes));
    }
    if (Object.keys(info.ariaAttributes || {}).length) {
      html += section("ARIA Attributes", attrList(info.ariaAttributes));
    }
    if (Object.keys(info.otherAttributes || {}).length) {
      html += section("Other Attributes / Metadata", attrList(info.otherAttributes));
    }

    return html;
  }

  /** A single table/grid data cell — column+row context, as opposed to renderListInfo's column-only view. */
  function renderDataCellInfo(info) {
    let html = "";
    html += renderOdooSection(info);

    html += section(
      "Cell Info",
      [
        row("Column Name", info.columnName || "—"),
        row("Column Index", String(info.columnIndex)),
        row("Row Index", info.rowIndex >= 0 ? String(info.rowIndex) : "—"),
        row("Element Type", info.element, { mono: true }),
        row("Cell Text", info.cellText),
        row("ID", info.id, { mono: true }),
        row("CSS Classes", info.classes, { mono: true }),
      ].join("")
    );

    html += section(
      "Selectors",
      `<div class="fi-row-label" style="margin-bottom:2px;">CSS Selector</div>${copyableBlock(
        info.cssSelector
      )}<div class="fi-row-label" style="margin:8px 0 2px;">XPath</div>${copyableBlock(info.xpath)}`
    );

    html += section("HTML Structure", `<div class="fi-html-preview">${escapeHtml(info.htmlPreview)}</div>`);

    if (Object.keys(info.dataAttributes || {}).length) html += section("Data Attributes", attrList(info.dataAttributes));
    if (Object.keys(info.ariaAttributes || {}).length) html += section("ARIA Attributes", attrList(info.ariaAttributes));
    if (Object.keys(info.otherAttributes || {}).length) html += section("Other Attributes", attrList(info.otherAttributes));

    return html;
  }

  function renderBody(info) {
    if (info.kind === "list") return renderListInfo(info);
    if (info.kind === "listCell") return renderDataCellInfo(info);
    return renderFormInfo(info);
  }

  let odooRequestSeq = 0;

  ui.showPanel = function (info, settings) {
    try {
      ui.ensureHost();
      ui.lastInfo = info;
      ui.settingsRef = settings || ui.settingsRef;
      // Showing any panel invalidates whatever live Odoo lookup was still
      // in flight for the previously-inspected field.
      odooRequestSeq += 1;

      const badge = ui.panelEl.querySelector("#fi-kind-badge");
      const badgeText = { list: "List / Column", listCell: "List / Cell" }[info.kind] || "Form Field";
      badge.textContent = badgeText;
      badge.classList.toggle("list", info.kind === "list" || info.kind === "listCell");

      ui.bodyEl.innerHTML = renderBody(info);
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
    if (ui.bodyEl) ui.bodyEl.innerHTML = renderBody(ui.lastInfo);
  };

  /** Applies a live "how is this field declared in the current view" result, same staleness guard as above. */
  ui.applyOdooViewAttrs = function (requestId, viewAttrs) {
    if (requestId !== odooRequestSeq) return;
    if (!canHaveOdooLookup(ui.lastInfo)) return;
    ui.lastInfo.odooViewAttrs = viewAttrs;
    if (ui.bodyEl) ui.bodyEl.innerHTML = renderBody(ui.lastInfo);
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
