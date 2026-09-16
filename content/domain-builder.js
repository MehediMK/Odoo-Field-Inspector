/** Visual domain builder, isolated with the inspector's existing Shadow DOM. */
(function () {
  const { ui, domain, utils, odoo } = window.__FI__;
  if (window.__FI__.domainBuilder) return;
  let panel = null;
  let request = 0;
  let model = "";
  let fields = {};
  let rules = [];
  let match = "all";
  let serial = 0;
  const types = { text: "Text", integer: "Integer / record ID", number: "Number", boolean: "Boolean", date: "Date", datetime: "Datetime (UTC)" };
  const escape = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const isOpen = () => !!panel && !panel.hidden;
  const newRule = (field = "") => ({ id: ++serial, field, operator: "=", type: "text", value: "" });
  const typeFor = (field) => ({ integer: "integer", many2one: "integer", one2many: "integer", many2many: "integer", float: "number", monetary: "number", boolean: "boolean", date: "date", datetime: "datetime" }[field?.type] || "text");
  const membership = rule => rule.operator === "in" || rule.operator === "not in";
  const noValue = rule => rule.operator === "is set" || rule.operator === "is not set";
  const option = (value, label, selected) => `<option value="${escape(value)}" ${value === selected ? "selected" : ""}>${escape(label)}</option>`;

  function close(restoreFocus = false) {
    request++;
    if (panel) {
      panel.hidden = true;
      panel.querySelector('[data-action="load"]').disabled = !ui.settingsRef.odooMode;
    }
    if (restoreFocus) ui.finderBtnEl?.focus();
  }

  function refreshPreview() {
    const preview = panel.querySelector('#fi-domain-preview');
    const status = panel.querySelector('#fi-domain-validation');
    try {
      const result = domain.build(rules, match);
      preview.textContent = result.python;
      status.textContent = rules.length ? "" : "An empty domain matches all records.";
      panel.querySelectorAll('[data-action^="copy-"]').forEach(button => { button.disabled = false; });
    } catch (error) {
      preview.textContent = "";
      status.textContent = error.message;
      panel.querySelectorAll('[data-action^="copy-"]').forEach(button => { button.disabled = true; });
    }
  }

  function valueControl(rule) {
    if (noValue(rule)) return '<span class="fi-domain-muted">No value needed</span>';
    if (membership(rule)) return `<input data-key="value" aria-label="List of values" value="${escape(rule.value)}" placeholder='JSON list: [1, 2] or ["draft", "done"]'>`;
    if (rule.type === "boolean") return `<select data-key="value" aria-label="Boolean value">${option("true", "True", rule.value)}${option("false", "False", rule.value)}</select>`;
    const selection = fields[rule.field]?.selection;
    if (Array.isArray(selection)) return `<select data-key="value" aria-label="Selection value">${option("", "Choose a value…", rule.value)}${selection.map(([value, label]) => option(String(value), `${label} (${value})`, rule.value)).join("")}</select>`;
    const hint = rule.type === "date" ? "YYYY-MM-DD" : rule.type === "datetime" ? "YYYY-MM-DD HH:mm:ss (UTC)" : rule.type === "integer" ? "Whole number / record ID" : rule.type === "number" ? "Number" : "Value";
    return `<input data-key="value" aria-label="Value" value="${escape(rule.value)}" placeholder="${hint}">`;
  }

  function renderRules(focusId) {
    panel.querySelector('#fi-domain-rules').innerHTML = rules.map((rule, index) => {
      const meta = fields[rule.field];
      return `<div class="fi-domain-rule" data-rule="${rule.id}">
        <div class="fi-domain-rule-title"><strong>Condition ${index + 1}</strong><button type="button" data-action="remove" aria-label="Remove condition ${index + 1}">Remove</button></div>
        <label>Field<input data-key="field" list="fi-domain-fields" value="${escape(rule.field)}" placeholder="Search by label or technical name" autocomplete="off"></label>
        <div class="fi-domain-muted">${escape(meta ? `${meta.string || rule.field} · ${rule.field}` : "Enter a technical field name or choose a loaded field.")}</div>
        <div class="fi-domain-pair"><label>Operator<select data-key="operator">${domain.operators.map(op => option(op, op, rule.operator)).join("")}</select></label>
        <label>Value type<select data-key="type">${Object.entries(types).map(([value, label]) => option(value, label, rule.type)).join("")}</select></label></div>
        <label>Value${valueControl(rule)}</label>
      </div>`;
    }).join("");
    refreshPreview();
    if (focusId) panel.querySelector(`[data-rule="${focusId}"] [data-key="field"]`)?.focus();
  }

  function assignField(rule) {
    const meta = fields[rule.field];
    if (!meta) return;
    rule.type = typeFor(meta);
    rule.operator = ["one2many", "many2many"].includes(meta.type) ? "in" : "=";
    rule.value = rule.type === "boolean" ? "true" : membership(rule) ? "[]" : "";
  }

  async function loadFields() {
    if (!ui.settingsRef.odooMode) return;
    const nextModel = panel.querySelector('#fi-domain-model').value.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(nextModel)) {
      panel.querySelector('#fi-domain-status').textContent = "Enter a model such as res.partner.";
      return;
    }
    const token = ++request;
    const loadButton = panel.querySelector('[data-action="load"]');
    const status = panel.querySelector('#fi-domain-status');
    loadButton.disabled = true;
    status.textContent = "Loading field definitions…";
    try {
      const result = await odoo.call(nextModel, "fields_get", [], { attributes: ["string", "type", "selection", "relation", "searchable"] });
      if (token !== request || !isOpen() || !ui.settingsRef.odooMode) return;
      if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("The server did not return field definitions.");
      if (model && model !== nextModel) { rules = [newRule()]; match = "all"; panel.querySelector('#fi-domain-match').value = match; }
      model = nextModel;
      fields = Object.fromEntries(Object.entries(result).filter(([, field]) => field && typeof field === "object" && field.searchable !== false));
      panel.querySelector('#fi-domain-fields').innerHTML = Object.entries(fields)
        .sort((a, b) => String(a[1].string || a[0]).localeCompare(String(b[1].string || b[0])))
        .map(([name, field]) => `<option value="${escape(name)}" label="${escape(field.string || name)}">${escape(field.string || name)} · ${escape(name)}</option>`).join("");
      rules.forEach(rule => { if (!rule.value) assignField(rule); });
      status.textContent = `${Object.keys(fields).length} fields loaded for ${model}.`;
      renderRules();
    } catch (error) {
      if (token === request && isOpen()) status.textContent = `Could not load fields: ${error.message}. You can enter technical names manually.`;
    } finally {
      if (token === request) loadButton.disabled = !ui.settingsRef.odooMode;
    }
  }

  function ensurePanel() {
    ui.ensureHost();
    if (panel && panel.isConnected) return;
    panel = document.createElement('section');
    panel.className = 'fi-domain-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Domain Builder');
    panel.innerHTML = `<style>
      .fi-domain-panel { position:fixed; right:16px; bottom:72px; width:460px; max-width:calc(100vw - 32px); max-height:calc(100vh - 100px); display:flex; flex-direction:column; background:var(--fi-bg); color:var(--fi-fg); box-shadow:var(--fi-shadow); border-radius:12px; overflow:hidden; font:13px system-ui,sans-serif; z-index:2147483647; }
      .fi-domain-panel[hidden] { display:none; }
      .fi-domain-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--fi-header-bg); color:var(--fi-header-fg); }
      .fi-domain-body { padding:14px; overflow:auto; display:grid; gap:12px; }
      .fi-domain-panel label { display:grid; gap:5px; font-weight:500; }
      .fi-domain-panel input,.fi-domain-panel select { box-sizing:border-box; width:100%; min-width:0; padding:8px; border:1px solid var(--fi-section-border); border-radius:6px; background:var(--fi-bg); color:var(--fi-fg); font:inherit; }
      .fi-domain-panel button { padding:7px 10px; border:1px solid var(--fi-section-border); border-radius:6px; background:var(--fi-bg); color:var(--fi-fg); font:inherit; cursor:pointer; }
      .fi-domain-panel button:disabled { opacity:.45; cursor:default; }
      .fi-domain-panel button:hover:not(:disabled) { background:var(--fi-copy-btn-hover-bg); }
      .fi-domain-panel :focus-visible { outline:2px solid var(--fi-tab-active); outline-offset:2px; }
      .fi-domain-pair { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .fi-domain-rule { display:grid; gap:8px; padding:12px; margin-bottom:10px; border:1px solid var(--fi-section-border); border-radius:8px; }
      .fi-domain-rule-title { display:flex; justify-content:space-between; align-items:center; }
      .fi-domain-muted { font-size:12px; color:var(--fi-hint-fg); overflow-wrap:anywhere; }
      .fi-domain-panel pre { margin:0; padding:10px; background:var(--fi-copyable-bg); border-radius:6px; white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; }
      .fi-domain-actions { display:flex; flex-wrap:wrap; gap:8px; }
      @media(max-width:400px) { .fi-domain-pair { grid-template-columns:1fr; } }
    </style><div class="fi-domain-header"><strong>Domain Builder</strong><button type="button" data-action="close" aria-label="Close Domain Builder">×</button></div>
    <div class="fi-domain-body">
      <label>Model<input id="fi-domain-model" placeholder="res.partner" autocomplete="off"></label>
      <div><button type="button" data-action="load">Load Fields</button></div>
      <div id="fi-domain-status" class="fi-domain-muted" role="status"></div>
      <datalist id="fi-domain-fields"></datalist>
      <label>Combine conditions<select id="fi-domain-match"><option value="all">Match all (AND)</option><option value="any">Match any (OR)</option></select></label>
      <div id="fi-domain-rules"></div>
      <div class="fi-domain-actions"><button type="button" data-action="add">+ Add Condition</button><button type="button" data-action="clear">Clear</button></div>
      <strong>Odoo Domain</strong><pre id="fi-domain-preview"></pre>
      <div id="fi-domain-validation" class="fi-domain-muted" role="status"></div>
      <div class="fi-domain-actions"><button type="button" data-action="copy-python">Copy Domain</button><button type="button" data-action="copy-json">Copy JSON</button></div>
    </div>`;
    ui.shadowRoot.appendChild(panel);
    panel.addEventListener('input', event => {
      if (event.target.id === 'fi-domain-model') {
        request++;
        panel.querySelector('[data-action="load"]').disabled = !ui.settingsRef.odooMode;
        panel.querySelector('#fi-domain-status').textContent = 'Load fields for this model. Loading a different model resets the conditions.';
      }
      const row = event.target.closest('[data-rule]');
      const rule = row && rules.find(rule => rule.id === Number(row.dataset.rule));
      if (rule && ['field', 'value'].includes(event.target.dataset.key)) {
        rule[event.target.dataset.key] = event.target.value;
        refreshPreview();
      }
    });
    panel.addEventListener('change', event => {
      if (event.target.id === 'fi-domain-model') { request++; panel.querySelector('[data-action="load"]').disabled = !ui.settingsRef.odooMode; }
      if (event.target.id === 'fi-domain-match') { match = event.target.value; refreshPreview(); return; }
      const row = event.target.closest('[data-rule]');
      const rule = row && rules.find(rule => rule.id === Number(row.dataset.rule));
      if (!rule || !event.target.dataset.key) return;
      const key = event.target.dataset.key;
      rule[key] = event.target.value;
      if (key === 'field') assignField(rule);
      if (key === 'type' || key === 'operator') {
        rule.value = membership(rule) ? '[]' : rule.type === 'boolean' ? 'true' : '';
      }
      if (key !== 'value') renderRules(); else refreshPreview();
    });
    panel.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;
      const action = button.dataset.action;
      if (action === 'close') close(true);
      if (action === 'load') await loadFields();
      if (action === 'add') { const rule = newRule(); rules.push(rule); renderRules(rule.id); }
      if (action === 'remove') { rules = rules.filter(rule => rule.id !== Number(button.closest('[data-rule]').dataset.rule)); renderRules(); }
      if (action === 'clear') { rules = []; renderRules(); }
      if (action.startsWith('copy-')) {
        try {
          const result = domain.build(rules, match);
          const ok = await utils.copyToClipboard(action === 'copy-json' ? result.json : result.python);
          panel.querySelector('#fi-domain-validation').textContent = ok ? 'Copied!' : 'Copy failed. Select the domain preview and copy it manually.';
        } catch (error) { panel.querySelector('#fi-domain-validation').textContent = error.message; }
      }
    });
  }

  function open() {
    ensurePanel();
    if (ui.finderBtnEl?.hidden) return;
    ui.closeOptions(); ui.closeFinder();
    if (!rules.length && !serial) {
      const rule = newRule(ui.lastInfo?.odooFieldName || '');
      const meta = ui.lastInfo?.odooFieldMeta;
      if (meta && !meta.error) { rule.type = typeFor({ type: meta.ttype }); if (rule.type === 'boolean') rule.value = 'true'; }
      rules.push(rule);
    }
    if (!panel.querySelector('#fi-domain-model').value) {
      panel.querySelector('#fi-domain-model').value = ui.lastInfo?.odooModel || odoo.detectCurrentModel() || '';
    }
    panel.querySelector('[data-action="load"]').disabled = !ui.settingsRef.odooMode;
    panel.querySelector('#fi-domain-status').textContent = !ui.settingsRef.odooMode
      ? 'Enable Odoo Developer Mode to load fields, or enter technical names manually.'
      : model ? `Fields loaded for ${model}.` : 'Load model fields to choose by label or technical name, or enter technical names manually.';
    panel.hidden = false;
    renderRules();
    panel.querySelector('#fi-domain-model').focus();
  }

  window.__FI__.domainBuilder = { open, close, isOpen };
})();
