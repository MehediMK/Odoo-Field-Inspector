/** Local chatter reader and reversible form layout controls. No RPC calls. */
(function () {
  const { ui, utils, detector } = window.__FI__;
  if (window.__FI__.chatter) return;
  const CHATTER = '.o-mail-Chatter, .o_Chatter, .oe_chatter, .o_chatter';
  const MESSAGE = '.o-mail-Message, .o-mail-NotificationMessage, .o_Message, .o_mail_message';
  const TRACKING = '.o-mail-Message-tracking, .o-mail-Message-trackingValues, .o_Message_trackingValues, .o_mail_tracking_value, [data-tracking-value-id]';
  const COLLAPSED = 'fi-chatter-collapsed';
  let enabled = false;
  let context = null;
  let panel = null;
  let observer = null;
  let timer = null;
  let routeTimer = null;
  let flashTimer = null;
  let flashed = null;
  let entries = [];
  let matches = [];
  let query = '';
  let filter = 'all';
  let expanded = false;
  let collapsed = null;
  let signature = '';
  let revision = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isOpen = () => !!panel && !panel.hidden;

  function detect() {
    const wizard = detector.findOpenWizard();
    const scope = wizard || document;
    const forms = Array.from(scope.querySelectorAll('.o_form_view, .o_form_renderer, .o_FormRenderer'))
      .filter(form => !form.closest('.o_inactive_modal') && utils.isVisible(form));
    for (const form of forms.reverse()) {
      const roots = Array.from(form.querySelectorAll(CHATTER));
      // Prefer the actual component over its layout wrapper.
      const root = roots.find(el => el.matches('.o-mail-Chatter, .o_Chatter') &&
        (utils.isVisible(el) || collapsed?.contains(el))) ||
        roots.find(el => utils.isVisible(el) || collapsed?.contains(el));
      if (!root) continue;
      const wrapper = root.closest('.o-mail-Form-chatter, .o_FormRenderer_chatterContainer, .o_ChatterContainer, .oe_chatter, .o_chatter');
      return {
        form, root, wrapper: wrapper && form.contains(wrapper) ? wrapper : root,
        thread: root.querySelector('.o-mail-Thread, .o_Thread, .o_mail_thread'),
        key: location.href + '|' + (form.dataset.resId || form.dataset.recordId || '') + '|' +
          (root.dataset.threadId || root.dataset.resId || ''),
      };
    }
    return null;
  }

  function sameContext(a, b) {
    return a && b && a.root === b.root && a.form === b.form && a.thread === b.thread && a.key === b.key;
  }

  function restoreLayout() {
    if (collapsed) collapsed.classList.remove(COLLAPSED);
    collapsed = null;
    if (flashed) flashed.classList.remove('fi-chatter-message-flash');
    flashed = null;
    clearTimeout(flashTimer);
  }

  function resetState() {
    revision++;
    restoreLayout();
    query = ''; filter = 'all'; expanded = false;
    entries = []; matches = []; signature = '';
    if (panel) {
      panel.querySelector('[data-search]').value = '';
      panel.querySelector('[data-filter]').value = 'all';
      panel.classList.remove('fi-chatter-expanded');
      panel.querySelector('[data-results]').replaceChildren();
      panel.querySelector('[data-count]').textContent = '';
      panel.querySelector('[data-status]').textContent = '';
    }
  }

  function syncContext() {
    const next = enabled ? detect() : null;
    if (!sameContext(context, next)) {
      resetState();
      context = next;
      if (!context) close();
    }
    return context;
  }

  // Open shadow roots are used by Odoo for email bodies. Never copy controls,
  // editor drafts, scripts or CSS as message text.
  function plainText(node) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
    if (node.matches?.('script, style, button, input, textarea, select, [contenteditable="true"], [contenteditable=""], .o-mail-Composer, .o_Composer')) return '';
    const children = node.shadowRoot ? node.shadowRoot.childNodes : node.childNodes;
    const text = Array.from(children).map(plainText).join('');
    return node.matches?.('p, div, li, br, tr') ? text + '\n' : text;
  }
  const text = node => plainText(node).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  function readMessage(el) {
    const author = text(el.querySelector('.o-mail-Message-author, .o-mail-NotificationMessage-author, .o_Message_authorName, .o_mail_author'));
    const date = el.querySelector('time, .o-mail-Message-date, .o_Message_date, .o_mail_timestamp');
    const body = el.querySelector('.o-mail-Message-body, .o_Message_content, .o_mail_body');
    const tracking = el.querySelector(TRACKING);
    const bodyText = body ? text(body) : tracking ? '' : text(el);
    const trackingText = tracking && !body?.contains(tracking) ? text(tracking) : '';
    const label = (el.getAttribute('aria-label') || '').toLowerCase();
    const subtype = el.getAttribute('data-subtype') || '';
    let kind = 'unknown';
    if (tracking) kind = 'tracking';
    else if (label === 'note' || subtype === 'mail.mt_note' || el.matches('.o_mail_note, .o_Message.o-note, .o_Message.o-not-discussion:not(.o-notification)')) kind = 'note';
    else if (label === 'message' || el.dataset.messageType === 'email' || el.matches('.o_Message.o-discussion:not(.o-notification)') || subtype === 'mail.mt_comment') kind = 'message';
    const datetime = date?.getAttribute('datetime') || el.dataset.date || '';
    return {
      el, author, body: [bodyText, trackingText].filter(Boolean).join('\n'), kind,
      date: date?.getAttribute('title') || text(date),
      timestamp: /^\d{4}-\d{2}-\d{2}T/.test(datetime) ? Date.parse(datetime) : NaN,
      id: /^\d+$/.test(el.dataset.messageId || '') ? Number(el.dataset.messageId) : NaN,
    };
  }

  function readEntries() {
    if (!context) return [];
    return Array.from(context.root.querySelectorAll(MESSAGE))
      .filter(el => !el.parentElement?.closest(MESSAGE) && !el.closest('[hidden], .d-none'))
      .map(readMessage);
  }

  function render() {
    if (!panel || !context) return;
    panel.classList.toggle('fi-chatter-expanded', expanded);
    const hide = panel.querySelector('[data-action="hide"]');
    hide.textContent = collapsed ? 'Show Chatter' : 'Hide Chatter';
    hide.setAttribute('aria-pressed', String(!!collapsed));
    const expand = panel.querySelector('[data-action="expand"]');
    expand.textContent = expanded ? 'Compact Reader' : 'Expand Chatter';
    expand.setAttribute('aria-pressed', String(expanded));
    panel.querySelector('[data-action="latest"]').disabled = entries.length === 0;
    const needle = query.trim().toLocaleLowerCase();
    matches = entries.filter(entry => (filter === 'all' || entry.kind === filter || entry.kind === 'unknown') &&
      (!needle || `${entry.author}\n${entry.body}`.toLocaleLowerCase().includes(needle)));
    const unknown = filter !== 'all' && matches.some(entry => entry.kind === 'unknown');
    panel.querySelector('[data-count]').textContent = `${matches.length} of ${entries.length} loaded messages${unknown ? ' · Unclassified messages included' : ''}`;
    const markup = matches.map((entry, index) => `<article class="fi-chatter-message" data-entry="${index}" tabindex="-1">
      <div class="fi-chatter-message-head"><strong>${escape(entry.author || 'Author not shown')}</strong><span>${escape({note:'Internal note',message:'Message',tracking:'Field changes',unknown:'Unclassified'}[entry.kind])}</span></div>
      ${entry.date ? `<div class="fi-chatter-muted">${escape(entry.date)}</div>` : ''}
      <div class="fi-chatter-text">${escape(entry.body || '(No readable message text)')}</div>
      <button type="button" data-action="copy" data-index="${index}" ${entry.body ? '' : 'disabled'}>Copy Message</button>
    </article>`).join('') || `<p class="fi-chatter-muted">${entries.length ? 'No matching loaded messages.' : 'No loaded messages found. Open the conversation in Odoo, then refresh.'}</p>`;
    // Avoid replacing focused copy buttons on unrelated page mutations.
    if (markup !== signature) {
      panel.querySelector('[data-results]').innerHTML = markup;
      signature = markup;
    }
  }

  function refresh() {
    if (!enabled) return;
    if (!syncContext()) return;
    if (!isOpen() && !collapsed && !entries.length) return;
    const next = readEntries();
    // Some clients reuse the same form and thread DOM when changing records.
    // A completely replaced message set is treated conservatively as a reset.
    const previousNodes = new Set(entries.map(entry => entry.el));
    if (entries.length && !next.some(entry => previousNodes.has(entry.el))) {
      resetState();
    }
    entries = next;
    if (isOpen()) render();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 120);
  }

  function close(restoreFocus = false) {
    if (panel) panel.hidden = true;
    if (restoreFocus && !ui.finderBtnEl?.hidden) ui.finderBtnEl?.focus();
  }

  function latest() {
    if (!entries.length) return;
    let entry = entries[0]; // Odoo chatter renders newest first.
    if (entries.every(item => Number.isFinite(item.timestamp))) entry = entries.reduce((a, b) => a.timestamp >= b.timestamp ? a : b);
    else if (entries.every(item => Number.isFinite(item.id))) entry = entries.reduce((a, b) => a.id >= b.id ? a : b);
    restoreLayout();
    query = ''; filter = 'all';
    panel.querySelector('[data-search]').value = '';
    panel.querySelector('[data-filter]').value = 'all';
    render();
    entry.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashed = entry.el;
    flashed.classList.add('fi-chatter-message-flash');
    flashTimer = setTimeout(() => { flashed?.classList.remove('fi-chatter-message-flash'); flashed = null; }, 1400);
    const card = panel.querySelector(`[data-entry="${matches.indexOf(entry)}"]`);
    card?.scrollIntoView({ block: 'nearest' });
    card?.focus({ preventScroll: true });
    panel.querySelector('[data-status]').textContent = 'Showing the latest loaded message.';
  }

  function ensurePanel() {
    ui.ensureHost();
    if (panel?.isConnected) return;
    signature = '';
    panel = document.createElement('section');
    panel.className = 'fi-chatter-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Chatter Manager');
    panel.innerHTML = `<style>
      .fi-chatter-panel { position:fixed; right:16px; bottom:72px; width:440px; max-width:calc(100vw - 32px); max-height:calc(100vh - 100px); display:flex; flex-direction:column; background:var(--fi-bg); color:var(--fi-fg); box-shadow:var(--fi-shadow); border-radius:12px; overflow:hidden; font:13px system-ui,sans-serif; z-index:2147483647; }
      .fi-chatter-panel[hidden] { display:none; }
      .fi-chatter-expanded { width:900px; top:16px; max-height:none; }
      .fi-chatter-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--fi-header-bg); color:var(--fi-header-fg); }
      .fi-chatter-controls { display:grid; gap:10px; padding:12px; border-bottom:1px solid var(--fi-section-border); overflow-y:auto; flex-shrink:0; max-height:45vh; }
      .fi-chatter-actions { display:flex; flex-wrap:wrap; gap:6px; }
      .fi-chatter-panel button { padding:7px 10px; border:1px solid var(--fi-section-border); border-radius:7px; background:var(--fi-bg); color:var(--fi-fg); font:inherit; cursor:pointer; }
      .fi-chatter-panel button:hover:not(:disabled) { background:var(--fi-copy-btn-hover-bg); }
      .fi-chatter-panel button:disabled { opacity:.45; cursor:default; }
      .fi-chatter-panel label { display:grid; gap:4px; }
      .fi-chatter-panel input,.fi-chatter-panel select { box-sizing:border-box; width:100%; min-width:0; padding:8px; border:1px solid var(--fi-section-border); border-radius:6px; background:var(--fi-bg); color:var(--fi-fg); font:inherit; }
      .fi-chatter-panel :focus-visible { outline:2px solid var(--fi-tab-active); outline-offset:2px; }
      .fi-chatter-results { padding:12px; overflow-y:auto; min-height:0; flex:1; }
      .fi-chatter-message { border:1px solid var(--fi-section-border); border-radius:8px; padding:12px; margin-bottom:10px; }
      .fi-chatter-message-head { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px; margin-bottom:5px; }
      .fi-chatter-message-head span,.fi-chatter-muted { font-size:12px; color:var(--fi-hint-fg); }
      .fi-chatter-text { white-space:pre-wrap; overflow-wrap:anywhere; margin:10px 0; line-height:1.5; }
      .fi-chatter-status { padding:0 12px 8px; }
    </style>
    <div class="fi-chatter-header"><strong>Chatter Manager</strong><button type="button" data-action="close" aria-label="Close Chatter Manager">×</button></div>
    <div class="fi-chatter-controls">
      <div class="fi-chatter-actions"><button type="button" data-action="hide">Hide Chatter</button><button type="button" data-action="expand">Expand Chatter</button><button type="button" data-action="latest">Jump to Latest</button><button type="button" data-action="reset">Reset Layout</button></div>
      <label>Search loaded messages<input type="search" data-search placeholder="Message text or author…"></label>
      <label>Message type<select data-filter><option value="all">All messages</option><option value="message">Messages</option><option value="note">Internal notes</option><option value="tracking">Tracked field changes</option></select></label>
      <div class="fi-chatter-muted">Search and filters apply to this reader. Older messages not loaded by Odoo are excluded. Unclassified messages remain visible in type filters.</div>
      <div class="fi-chatter-actions"><button type="button" data-action="refresh">Refresh</button><span data-count class="fi-chatter-muted" role="status"></span></div>
    </div><div class="fi-chatter-results" data-results></div><div class="fi-chatter-muted fi-chatter-status" data-status role="status"></div>`;
    ui.shadowRoot.appendChild(panel);
    panel.querySelector('[data-search]').addEventListener('input', event => { query = event.target.value; render(); });
    panel.querySelector('[data-filter]').addEventListener('change', event => { filter = event.target.value; render(); });
    panel.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;
      const action = button.dataset.action;
      if (action === 'close') { close(true); return; }
      const previous = context;
      if (!syncContext()) return;
      if (!sameContext(previous, context)) { refresh(); return; }
      panel.querySelector('[data-status]').textContent = '';
      if (action === 'hide') {
        if (collapsed) restoreLayout();
        else { collapsed = context.wrapper; collapsed.classList.add(COLLAPSED); }
        render();
      } else if (action === 'expand') { expanded = !expanded; render(); }
      else if (action === 'reset') { resetState(); refresh(); }
      else if (action === 'refresh') refresh();
      else if (action === 'latest') { refresh(); latest(); }
      else if (action === 'copy') {
        const entry = matches[Number(button.dataset.index)];
        if (!entry?.el.isConnected) { refresh(); return; }
        const token = revision;
        const ok = await utils.copyToClipboard([entry.author, entry.date, entry.body].filter(Boolean).join('\n'));
        if (token === revision && enabled && isOpen()) panel.querySelector('[data-status]').textContent = ok ? 'Message copied.' : 'Copy failed. Select the message text and copy it manually.';
      }
    });
  }

  function open() {
    if (!enabled || !syncContext()) return;
    ensurePanel();
    ui.closeOptions(); ui.closeFinder();
    window.__FI__.domainBuilder?.close();
    panel.hidden = false;
    refresh();
    panel.querySelector('[data-search]').focus();
  }

  function start() {
    stop(); enabled = true;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true,
      attributeFilter:['class','style','hidden','data-res-id','data-record-id','data-thread-id'] });
    let route = location.href;
    routeTimer = setInterval(() => {
      if (location.href !== route) { route = location.href; refresh(); }
    }, 400);
    refresh();
  }

  function stop() {
    enabled = false;
    observer?.disconnect(); observer = null;
    clearTimeout(timer); clearInterval(routeTimer);
    resetState(); context = null;
    close();
    if (panel) panel.querySelector('[data-results]').replaceChildren();
  }

  window.__FI__.chatter = { start, stop, open, close, isOpen, available: () => !!syncContext() };
})();
