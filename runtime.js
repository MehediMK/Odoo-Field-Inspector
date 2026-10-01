/* Read-only MAIN-world probe. No listeners, mutations, RPCs or arbitrary code. */
(function (scope) {
  scope.FI_READ_CONTEXT = function (selector) {
    const odoo = window.odoo;
    if (!odoo) return null;
    const root = odoo.__WOWL_DEBUG__?.root;
    let target;
    try { target = selector ? document.querySelector(selector) : null; } catch (_) {}
    const dialog = target?.closest('.modal, [role="dialog"]');
    const candidates = [];
    const seen = new Set();
    const queue = [root?.__owl__];
    for (let i = 0; i < queue.length && i < 2000; i++) {
      const node = queue[i];
      if (!node || seen.has(node)) continue;
      seen.add(node);
      const component = node.component || node;
      const el = node.bdom?.el || component.el;
      if (target && el?.contains?.(target)) candidates.push({ component, el });
      if (node.children) queue.push(...Object.values(node.children));
    }
    // Smallest containing component wins, particularly inside relational fields/dialogs.
    candidates.sort((a, b) => a.el === b.el ? 0 : a.el.contains(b.el) ? 1 : -1);
    const controller = root?.actionService?.currentController || root?.env?.services?.action?.currentController;
    if (!dialog) { candidates.push({ component: controller }); candidates.push({ component: controller?.component }); }
    let result = null;
    for (const { component: c } of candidates) {
      if (!c) continue;
      const p = c.props || {};
      const record = p.record || p.list || c.model?.root;
      const model = record?.resModel || p.resModel;
      if (typeof model !== 'string' || !/^[\w.]+$/.test(model)) continue;
      const rawId = record?.resId ?? p.resId;
      const id = Number(rawId);
      const rawViewId = c.env?.config?.viewId || p.viewId;
      const viewId = Number(rawViewId);
      const context = record?.context || p.context || {};
      // Only JSON-compatible request context; never return the record's data.
      let safeContext = {};
      try { const json = JSON.stringify(context); if (json.length < 50000) safeContext = JSON.parse(json); } catch (_) {}
      result = {
        model, recordId: Number.isSafeInteger(id) && id > 0 ? id : null,
        viewId: Number.isSafeInteger(viewId) && viewId > 0 ? viewId : null,
        viewType: c.archInfo?.type || p.type || (p.list || Array.isArray(record?.records) ? 'list' : record ? 'form' : null),
        context: safeContext, source: 'Odoo runtime', verified: true,
      };
      break;
    }
    if (!result) return null;
    if (!result.viewId) {
      for (const { component: c } of candidates) {
        const p = c?.props || {};
        if (p.resModel && p.resModel !== result.model) continue;
        const id = Number(c?.env?.config?.viewId || p.viewId);
        if (Number.isSafeInteger(id) && id > 0) { result.viewId = id; break; }
      }
    }
    const action = controller?.action;
    if (!dialog && action?.res_model === result.model) {
      result.actionId = action.id || null;
      result.actionName = action.name || null;
      result.actionType = action.type || null;
      result.actionXmlId = action.xml_id || null;
      result.actionContext = typeof action.context === 'string' ? action.context : JSON.stringify(action.context || {});
      result.actionDomain = typeof action.domain === 'string' ? action.domain : JSON.stringify(action.domain || []);
      const view = action.views?.find(v => v[1] === result.viewType || (v[1] === 'tree' && result.viewType === 'list'));
      if (!result.viewId && Number.isSafeInteger(view?.[0])) result.viewId = view[0];
    }
    const version = odoo.__session_info__?.server_version || odoo.session_info?.server_version;
    if (typeof version === 'string') result.serverVersion = version;
    return result;
  };
})(self);
