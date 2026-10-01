/* On-demand, read-only Odoo record and model tools inside the inspector shadow root. */
(function () {
  if (window.__FI__?.technical) return;
  const { ui, odoo } = window.__FI__;
  let panel, content, info, generation = 0, returnFocus;
  let navigationTimer;
  let currentTab = 'record';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const json = value => JSON.stringify(value, null, 2);
  const note = text => `<p class="fi-empty-hint">${esc(text)}</p>`;
  const valueText = value => typeof value === 'object' ? json(value) : String(value ?? '');
  const cap = 200;

  const api = {
    isOpen: () => !!panel && !panel.hidden,
    close() {
      generation++;
      clearInterval(navigationTimer);
      if (panel) { panel.hidden = true; content.replaceChildren(); }
      info = null;
      returnFocus?.focus?.();
    },
    async open(tab = 'record') {
      ui.ensureHost();
      ui.closeOptions();
      ui.closeFinder();
      window.__FI__.domainBuilder?.close();
      window.__FI__.chatter?.close();
      ensurePanel();
      returnFocus = ui.shadowRoot.activeElement;
      panel.hidden = false;
      clearInterval(navigationTimer);
      const openedUrl = location.href;
      navigationTimer = setInterval(() => { if (location.href !== openedUrl) api.close(); }, 500);
      const token = ++generation;
      currentTab = tab;
      content.innerHTML = note('Reading current Odoo context…');
      panel.querySelector('[data-close]').focus();
      if (tab === 'debug') { info = null; renderDebug(); return; }
      if (!ui.settingsRef.odooMode) { content.innerHTML = note('Enable Odoo Developer Mode in inspector settings to use record and model tools.'); return; }
      // Resolve afresh so navigation cannot silently reuse the last inspected record.
      const element = ui.lastElement?.isConnected ? ui.lastElement : null;
      const resolved = await odoo.resolveRecordInfo(element);
      if (generation !== token || panel.hidden) return;
      info = resolved;
      if (!info?.model) { content.innerHTML = note('Model unavailable. Inspect a field in the current Odoo form and try again.'); return; }
      panel.querySelector('[data-context]').textContent = `${info.model}${info.recordId ? ' · #' + info.recordId : ''} · ${info.source || 'Unknown source'}`;
      await load(tab);
    },
  };

  function ensurePanel() {
    if (panel?.isConnected) return;
    const style = document.createElement('style');
    style.textContent = `
      .fi-technical{position:fixed;inset:6vh 5vw auto auto;width:min(850px,90vw);max-height:88vh;display:flex;flex-direction:column;background:var(--fi-bg,#fff);color:var(--fi-fg,#222);border:1px solid var(--fi-section-border,#ccc);border-radius:12px;box-shadow:0 12px 50px #0004;font:13px/1.5 system-ui;z-index:20;overflow:hidden}
      .fi-technical[hidden]{display:none}.fi-technical header,.fi-tool-tabs,.fi-tool-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px}.fi-technical header strong{flex:1}.fi-tool-tabs{border-block:1px solid var(--fi-section-border,#ccc)}.fi-tool-tabs button[aria-selected=true]{outline:2px solid var(--fi-accent,#714b67)}
      .fi-technical main{overflow:auto;padding:16px;min-height:150px}.fi-technical input,.fi-technical select{box-sizing:border-box;max-width:100%;padding:8px;background:var(--fi-bg,#fff);color:inherit;border:1px solid var(--fi-section-border,#ccc);border-radius:5px}.fi-technical input[type=search]{width:100%;margin:8px 0}
      .fi-technical table{width:100%;border-collapse:collapse}.fi-technical th,.fi-technical td{padding:8px;text-align:left;border-bottom:1px solid var(--fi-section-border,#ddd);vertical-align:top;overflow-wrap:anywhere}.fi-technical th{width:30%}.fi-technical pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:50vh;overflow:auto}.fi-technical a{color:var(--fi-accent,#714b67)}.fi-technical details{padding:8px 0}.fi-technical summary{cursor:pointer}.fi-tool-error{color:#c44}
    `;
    ui.shadowRoot.append(style);
    panel = document.createElement('section');
    panel.className = 'fi-technical';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Odoo record and model tools');
    panel.innerHTML = `<header><strong>Record &amp; Model Tools</strong><button class="fi-copy-btn" data-refresh>Refresh</button><button class="fi-copy-btn" data-close aria-label="Close tools">×</button></header><div style="padding:0 12px 8px" data-context></div>
      <nav class="fi-tool-tabs" aria-label="Tools">${[['record','Record Data'],['views','View XML'],['access','Access Rights'],['shortcuts','Shortcuts'],['debug','Debug Mode']].map(([key,label]) => `<button type="button" class="fi-copy-btn" data-tab="${key}">${label}</button>`).join('')}</nav><main aria-live="polite"></main>`;
    ui.shadowRoot.append(panel);
    content = panel.querySelector('main');
    panel.querySelector('[data-close]').onclick = api.close;
    panel.querySelector('[data-refresh]').onclick = () => { odoo.clearViewCache(); api.open(currentTab); };
    panel.addEventListener('click', event => {
      const tab = event.target.closest('[data-tab]');
      if (tab) api.open(tab.dataset.tab);
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); api.close(); }
    });
  }

  async function load(tab) {
    currentTab = tab;
    const token = ++generation;
    panel.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
    content.innerHTML = note('Loading…');
    const snapshot = info;
    const active = () => generation === token && !panel.hidden && ui.settingsRef.odooMode;
    try {
      if (tab === 'record') {
        const data = await odoo.fetchRecordData(snapshot, !!ui.settingsRef.showSensitiveValues);
        if (!active()) return;
        renderData(data);
      } else if (tab === 'views') {
        const view = await odoo.fetchViewArch(snapshot.model, snapshot.viewType || 'form', snapshot.viewId, snapshot.context || {});
        if (!active()) return;
        if (!view || view.error) throw new Error(view?.error || 'No view available.');
        await renderViews(view, snapshot, active);
      } else if (tab === 'access') {
        await renderAccess(snapshot, active);
      } else if (tab === 'shortcuts') {
        if (!snapshot.actionType && /^\d+$/.test(String(snapshot.actionId || ''))) {
          const action = await odoo.fetchActionDetails(snapshot.actionId);
          if (!active()) return;
          if (action && !action.error) snapshot.actionType = action.type;
        }
        renderShortcuts(snapshot);
      }
    } catch (error) {
      if (!active()) return;
      content.innerHTML = `<p class="fi-tool-error">${esc(error.message || error)}</p><button class="fi-copy-btn" data-retry>Retry</button>`;
      content.querySelector('[data-retry]').onclick = () => load(currentTab);
    }
  }

  function copyButton(label, getText) {
    const button = document.createElement('button');
    button.className = 'fi-copy-btn';
    button.textContent = label;
    button.onclick = () => ui.copySingle(button, getText());
    return button;
  }

  function renderData(data) {
    content.innerHTML = note('Server-saved values only. Unsaved form edits are not included. Binary contents are omitted; sensitive values follow your inspector setting.') +
      '<div class="fi-tool-actions" data-actions></div><input type="search" aria-label="Search record fields and values" placeholder="Search fields or values…"><div data-count></div><div data-data></div>';
    let mode = 'table';
    const actions = content.querySelector('[data-actions]');
    actions.append(copyButton('Copy JSON', () => json(data)));
    const toggle = document.createElement('button');
    toggle.className = 'fi-copy-btn'; toggle.textContent = 'Table / JSON';
    actions.append(toggle);
    const search = content.querySelector('input');
    const draw = () => {
      const query = search.value.toLowerCase();
      const entries = Object.entries(data).filter(([key, value]) => `${key} ${valueText(value)}`.toLowerCase().includes(query));
      content.querySelector('[data-count]').textContent = `${entries.length} of ${Object.keys(data).length} fields`;
      content.querySelector('[data-data]').innerHTML = mode === 'json'
        ? `<pre>${esc(json(Object.fromEntries(entries)))}</pre>`
        : `<table><tbody>${entries.map(([key,value]) => `<tr><th>${esc(key)}</th><td><pre>${esc(valueText(value))}</pre></td></tr>`).join('')}</tbody></table>`;
    };
    toggle.onclick = () => { mode = mode === 'table' ? 'json' : 'table'; draw(); };
    search.oninput = draw; draw();
  }

  async function renderViews(view, snapshot, active) {
    content.innerHTML = note(snapshot.viewId ? `Active view #${snapshot.viewId}. Merged XML reflects this request's context.` : `Active view ID unavailable. Showing the model's default ${snapshot.viewType || 'form'} view.`) +
      '<div data-copy></div><input type="search" aria-label="Search view XML" placeholder="Search field name or XML text…"><div data-matches></div><pre data-xml></pre><h3>Inherited views</h3><div data-inherits>Loading inherited views…</div>';
    const merged = String(view.arch || '');
    let currentXml = merged;
    content.querySelector('[data-copy]').append(copyButton('Copy XML', () => currentXml));
    const search = content.querySelector('input');
    const draw = () => {
      const query = search.value.toLowerCase();
      const lines = currentXml.replace(/>\s*</g, '>\n<').split('\n');
      const matches = query ? lines.filter(line => line.toLowerCase().includes(query)) : lines;
      content.querySelector('[data-matches]').textContent = query ? `${matches.length} matching lines` : 'Full XML';
      content.querySelector('[data-xml]').textContent = matches.join('\n');
    };
    search.oninput = draw; draw();
    const host = content.querySelector('[data-inherits]');
    try {
      if (!view.id) { host.textContent = 'View ID unavailable.'; return; }
      const rows = [{ id: view.id, name: view.name || 'Selected source view', depth: 0, active: true, priority: '—', mode: 'source' }];
      let parents = [view.id];
      const seen = new Set(parents);
      let truncated = false;
      for (let depth = 0; parents.length && depth < 12; depth++) {
        const children = await odoo.call('ir.ui.view', 'search_read', [], {
          domain: [['inherit_id', 'in', parents]], fields: ['name', 'inherit_id', 'priority', 'active', 'mode'],
          order: 'priority,id', limit: cap + 1, context: { ...(snapshot.context || {}), active_test: false },
        });
        if (!active()) return;
        parents = [];
        for (const child of children) {
          if (seen.has(child.id)) continue;
          if (rows.length >= cap) { truncated = true; break; }
          seen.add(child.id); rows.push({ ...child, depth }); parents.push(child.id);
        }
        if (truncated) break;
        if (depth === 11 && parents.length) truncated = true;
      }
      if (!active()) return;
      let externalIds = {};
      try {
        const ids = await odoo.call('ir.model.data', 'search_read', [], { domain: [['model','=','ir.ui.view'],['res_id','in',rows.map(row => row.id)]], fields: ['res_id','module','name'] });
        externalIds = Object.fromEntries(ids.map(row => [row.res_id, `${row.module}.${row.name}`]));
      } catch (_) { /* Source records are still usable without readable XML IDs. */ }
      if (!active()) return;
      host.innerHTML = note('These are inheritance descendants, including inactive views. Their presence does not prove they contributed to the current rendering.') +
        `<button class="fi-copy-btn" data-merged>Merged XML</button>` + rows.map(row => `<div style="padding-left:${Math.min(row.depth, 6)*12}px"><button class="fi-copy-btn" data-view="${Number(row.id)}">${esc(row.name)} · #${Number(row.id)}${externalIds[row.id] ? " · " + esc(externalIds[row.id]) : ""}</button> <small>${row.active ? 'Active' : 'Inactive'} · priority ${esc(row.priority)} · ${esc(row.mode)}</small></div>`).join('') +
        (truncated ? note('Results limited to 200 views / 12 levels.') : !rows.length ? note('No readable inherited views found.') : '');
      host.querySelector('[data-merged]').onclick = () => { currentXml = merged; draw(); };
      let selection = 0;
      host.addEventListener('click', async event => {
        const button = event.target.closest('[data-view]');
        if (!button) { if (event.target.closest('[data-merged]')) selection++; return; }
        const selected = ++selection;
        button.disabled = true;
        try {
          const result = await odoo.call('ir.ui.view', 'read', [[Number(button.dataset.view)]], { fields: ['arch_db'], context: snapshot.context || {} });
          if (!active() || selected !== selection) return;
          currentXml = String(result?.[0]?.arch_db || ''); draw();
        } catch (error) { if (active() && selected === selection) content.querySelector('[data-xml]').textContent = String(error.message || error); }
        finally { button.disabled = false; }
      });
    } catch (error) { if (active()) host.textContent = `Inherited views unavailable: ${error.message || error}`; }
  }

  async function renderAccess(snapshot, active) {
    const definitions = [
      ['Model Access Rights', 'ir.model.access', ['name','group_id','perm_read','perm_write','perm_create','perm_unlink']],
      ['Record Rules', 'ir.rule', ['name','groups','domain_force','active','global','perm_read','perm_write','perm_create','perm_unlink']],
    ];
    content.innerHTML = note('Configured rules for this model, subject to your account permissions. This is not an effective-access calculation for a particular user or record. Rule permission flags indicate which operations the rule applies to.') + '<div data-rules></div>';
    const host = content.querySelector('[data-rules]');
    const results = await Promise.allSettled(definitions.map(async ([label, model, desired]) => {
      const schema = await odoo.call(model, 'fields_get', [], { context: snapshot.context || {} });
      const fields = desired.filter(name => schema[name]);
      const rows = await odoo.call(model, 'search_read', [], { domain: [['model_id.model', '=', snapshot.model]], fields, limit: cap + 1, context: { ...(snapshot.context || {}), active_test: false } });
      return { label, model, rows };
    }));
    if (!active()) return;
    // New installations may expose unified ir.access instead of the two older models.
    if (results.every(result => result.status === 'rejected')) {
      try {
        const schema = await odoo.call('ir.access', 'fields_get', [], {});
        const fields = ['name','group_id','for_read','for_write','for_create','for_unlink','domain','active'].filter(name => schema[name]);
        const rows = await odoo.call('ir.access', 'search_read', [], { domain: [['model_id.model','=',snapshot.model]], fields, limit: cap + 1 });
        if (!active()) return;
        results.push({ status: 'fulfilled', value: { label: 'Unified Access Rules', model: 'ir.access', rows } });
      } catch (_) { /* Display original permission/schema errors below. */ }
    }
    const groupIds = new Set();
    for (const result of results) if (result.status === 'fulfilled') for (const row of result.value.rows) {
      for (const id of row.groups || []) if (Number.isInteger(id)) groupIds.add(id);
    }
    let groups = {};
    if (groupIds.size) try {
      const rows = await odoo.call('res.groups', 'read', [[...groupIds]], { fields: ['display_name'] });
      groups = Object.fromEntries(rows.map(row => [row.id, row.display_name]));
    } catch (_) { /* IDs remain meaningful if group names cannot be read. */ }
    if (!active()) return;
    results.forEach((result, index) => {
      const section = document.createElement('section');
      if (result.status === 'rejected') {
        section.innerHTML = `<h3>${esc(definitions[index]?.[0])}</h3>` + note(`Unavailable: ${result.reason.message || result.reason}`);
      } else {
        const { label, rows } = result.value;
        section.innerHTML = `<h3>${esc(label)}</h3>` + (!rows.length ? note('No readable entries found.') : '') +
          rows.slice(0, cap).map(row => `<details><summary>${esc(row.name || '#' + row.id)}</summary><table>${Object.entries(row).map(([key,value]) => `<tr><th>${esc(key)}</th><td>${esc(key === 'groups' ? (Array.isArray(value) ? value : []).map(id => groups[id] ? `${groups[id]} (#${id})` : `#${id}`).join(', ') : valueText(value))}</td></tr>`).join('')}</table></details>`).join('') + (rows.length > cap ? note('Showing the first 200 entries.') : '');
      }
      host.append(section);
    });
  }

  const recordUrl = (model, id) => odoo.recordUrl(model, id);

  function renderShortcuts(snapshot) {
    const defs = [
      ['Fields','ir.model.fields','model'], ['Views','ir.ui.view','model'],
      ['Access Rights','ir.model.access','model_id.model'], ['Record Rules','ir.rule','model_id.model'],
      ['Server Actions','ir.actions.server','model_id.model'],
    ];
    content.innerHTML = note('Choose a category to list matching technical records. Links open the record in a new tab; server actions are not executed.') + '<div class="fi-tool-actions" data-links></div><div data-results></div>';
    const links = content.querySelector('[data-links]');
    if (snapshot.actionId && /^\d+$/.test(String(snapshot.actionId)) && /^ir\.actions\.[\w]+$/.test(snapshot.actionType || '')) {
      const link = document.createElement('a'); link.textContent = 'Current Action ↗'; link.href = recordUrl(snapshot.actionType, snapshot.actionId); link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
    }
    let request = 0;
    const token = generation;
    for (const [label, model, field] of defs) {
      const button = document.createElement('button'); button.className = 'fi-copy-btn'; button.textContent = label; links.append(button);
      button.onclick = async () => {
        const selected = ++request;
        const host = content.querySelector('[data-results]'); host.textContent = 'Loading…';
        try {
          const rows = await odoo.call(model, 'search_read', [], { domain: [[field,'=',snapshot.model]], fields: ['display_name'], limit: cap + 1 });
          if (generation !== token || selected !== request) return;
          host.innerHTML = `<h3>${esc(label)}</h3>` + (rows.length ? rows.slice(0,cap).map(row => `<p><a target="_blank" rel="noopener noreferrer" href="${esc(recordUrl(model,row.id))}">${esc(row.display_name)} · #${Number(row.id)} ↗</a></p>`).join('') : note('No readable records found.')) + (rows.length > cap ? note('Showing the first 200 records.') : '');
        } catch (error) { if (generation === token && selected === request) host.textContent = String(error.message || error); }
      };
    }
  }

  function renderDebug() {
    panel.querySelector('[data-context]').textContent = '';
    panel.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === 'debug')));
    const mode = new URL(location.href).searchParams.get('debug') || 'off';
    content.innerHTML = note(`Current URL debug mode: ${mode}. Changing mode reloads the page. Save any form edits first.`) +
      '<label>Odoo debug mode <select aria-label="Odoo debug mode"><option value="off">Off</option><option value="1">Developer mode</option><option value="assets">Developer mode with assets</option></select></label><div class="fi-tool-actions"><button class="fi-copy-btn" data-apply>Apply &amp; reload page</button></div>';
    const select = content.querySelector('select'); select.value = ['1','assets'].includes(mode) ? mode : 'off';
    content.querySelector('[data-apply]').onclick = () => {
      const url = odoo.debugUrl(location.href, select.value);
      if (url === location.href) location.reload(); else location.assign(url);
    };
  }

  window.__FI__.technical = api;
})();
