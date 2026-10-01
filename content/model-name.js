/* Persistent model badges in Odoo control panels, independent of field selection. */
(function () {
  if (window.__FI__?.modelName) return;
  const { odoo, utils } = window.__FI__;
  const MARKER = 'data-fi-model-name';
  const DIALOG = '.modal, [role="dialog"]';
  const badges = new Map();
  let running = false, observer, timer, poll, busy = false;
  let epoch = 0, revision = 0, lastRun = 0, lastUrl = '';

  function containers() {
    const result = [...document.querySelectorAll('.o_control_panel')]
      .filter(panel => utils.isVisible(panel) && !panel.parentElement?.closest('.o_control_panel'));
    // Odoo wizards can have only a modal header instead of a control panel.
    for (const dialog of document.querySelectorAll(DIALOG)) {
      if (!utils.isVisible(dialog) || !dialog.querySelector('.o_form_view, .o_list_view, .o_kanban_view')) continue;
      if (result.some(panel => panel.closest(DIALOG) === dialog)) continue;
      const header = dialog.querySelector('.modal-header');
      if (header && !result.includes(header)) result.push(header);
    }
    return result;
  }

  function anchorFor(panel) {
    for (const selector of ['.o_cp_action_menus', '.o_control_panel_actions', '.o_cp_sidebar',
      '.o_control_panel_main_buttons', '.o_cp_buttons', '.o_control_panel_breadcrumbs',
      '.o_cp_top_right', '.o_control_panel_navigation', '.modal-title']) {
      const anchor = panel.querySelector(selector);
      if (anchor && utils.isVisible(anchor)) return anchor;
    }
    return null;
  }

  function createBadge(panel) {
    const host = document.createElement('span');
    host.setAttribute(MARKER, '');
    host.style.cssText = 'display:inline-flex;align-items:center;vertical-align:middle;margin-inline:8px;max-width:100%;flex:0 1 auto;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{color-scheme:inherit}button{display:inline-flex;align-items:center;max-width:100%;gap:5px;padding:3px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:var(--body-color,var(--bs-body-color,#714b67));font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;cursor:pointer;text-align:start}
      button:hover{background:var(--fi-accent-wash,rgba(113,75,103,.1))}button:focus-visible{outline:2px solid currentColor;outline-offset:2px}button:disabled{cursor:default;opacity:.65}span{overflow-wrap:anywhere}
      @media(prefers-color-scheme:dark){button{color:var(--body-color,var(--bs-body-color,#c8afd1))}}
    </style><button type="button"><span></span></button>`;
    const button = shadow.querySelector('button');
    const label = shadow.querySelector('span');
    const badge = { host, button, label, model: null, feedback: 0 };
    button.addEventListener('click', async event => {
      event.preventDefault(); event.stopPropagation();
      const model = badge.model;
      if (!model) return;
      const copied = await utils.copyToClipboard(model);
      if (!running || !host.isConnected || badge.model !== model) return;
      label.textContent = copied ? `${model} · Copied!` : `${model} · Copy failed`;
      clearTimeout(badge.feedback);
      badge.feedback = setTimeout(() => { if (badge.model === model) label.textContent = model; }, 1200);
    });
    badges.set(panel, badge);
    return badge;
  }

  function removeBadge(panel) {
    const badge = badges.get(panel);
    if (!badge) return;
    clearTimeout(badge.feedback);
    badge.host.remove();
    badges.delete(panel);
  }

  function position(panel, badge) {
    const anchor = anchorFor(panel);
    if (anchor) {
      if (anchor.nextElementSibling !== badge.host) anchor.insertAdjacentElement('afterend', badge.host);
    } else if (badge.host.parentElement !== panel) panel.append(badge.host);
  }

  async function refresh() {
    timer = null;
    if (!running || busy || document.hidden) return;
    busy = true;
    lastRun = Date.now();
    const token = epoch, version = revision, url = location.href;
    if (url !== lastUrl) {
      for (const panel of [...badges.keys()]) removeBadge(panel);
      lastUrl = url;
    }
    const panels = containers();
    for (const panel of [...badges.keys()]) if (!panels.includes(panel)) removeBadge(panel);
    try {
      await Promise.all(panels.map(async panel => {
        // Headers sit outside the wizard's record component: probe its view instead.
        const target = panel.matches('.modal-header')
          ? panel.closest(DIALOG)?.querySelector('.o_form_view, .o_list_view, .o_kanban_view') || panel
          : panel;
        const info = await odoo.resolveRecordInfo(target);
        if (!running || token !== epoch || version !== revision || location.href !== url || !panel.isConnected) return;
        const badge = badges.get(panel) || createBadge(panel);
        const model = info?.source !== 'Network heuristic (unverified)' && /^[a-z_][\w.]*$/.test(info?.model || '') ? info.model : null;
        if (badge.model !== model || !badge.label.textContent) {
          clearTimeout(badge.feedback);
          badge.model = model;
          badge.label.textContent = model || 'Model unavailable';
          badge.button.disabled = !model;
          badge.button.title = model ? `Copy model name: ${model}` : 'Odoo model context is unavailable. Try Odoo Debug Mode.';
          badge.button.setAttribute('aria-label', badge.button.title);
        }
        position(panel, badge);
      }));
    } finally {
      busy = false;
      if (running && (revision !== version || location.href !== url)) schedule();
    }
  }

  function schedule() {
    if (!running || timer) return;
    timer = setTimeout(() => { refresh().catch(() => {}); }, Math.max(100, 700 - (Date.now() - lastRun)));
  }

  function ours(node) {
    return node.nodeType === 1 && (node.hasAttribute(MARKER) || node.id === '__fi_inspector_host__');
  }

  window.__FI__.modelName = {
    start() {
      if (running) return;
      running = true; epoch++; lastRun = 0; lastUrl = location.href;
      observer = new MutationObserver(records => {
        const changed = records.some(record => record.type === 'attributes'
          ? !ours(record.target)
          : [...record.addedNodes, ...record.removedNodes].some(node => !ours(node)));
        if (changed) { revision++; schedule(); }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'hidden', 'data-model', 'data-res-id', 'data-record-id'] });
      // Covers pushState navigation and controller switches that don't replace DOM.
      poll = setInterval(schedule, 1500);
      schedule();
    },
    stop() {
      running = false; epoch++;
      observer?.disconnect(); observer = null;
      clearTimeout(timer); timer = null;
      clearInterval(poll);
      for (const panel of [...badges.keys()]) removeBadge(panel);
    },
    ownsEvent(event) {
      return event.composedPath?.().some(node => node.nodeType === 1 && node.hasAttribute(MARKER)) || false;
    },
  };
})();
