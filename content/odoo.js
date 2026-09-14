/**
 * Field Inspector - Odoo backend integration
 *
 * Adds live, authoritative field metadata (ORM type, relation, required,
 * help text, selection options...) straight from the Odoo server the page
 * is already talking to, instead of guessing from the widget's CSS class.
 *
 * Model detection: a content script's isolated world can't read the page's
 * own JS state (OWL's component tree), and the URL doesn't help either —
 * clicking into a wizard/dialog never changes the URL, so the model can't
 * be parsed from it. Instead this observes the page's own network traffic:
 * every Odoo RPC call, on every version since Odoo 8, POSTs to
 * `/web/dataset/call_kw/<model>/<method>`, which the standard (no extra
 * permission needed) Resource Timing API can see. A wizard fires its own
 * get_views/onchange/web_read the moment it opens, so "the model behind the
 * most recent such call" reliably tracks whatever the user is looking at,
 * wizard included.
 *
 * The RPC calls this file makes reuse the page's own session (same-origin
 * fetch, page's cookies) — this is the one part of the extension that talks
 * to a server, and only fires for a field whose Odoo model was detected.
 */
(function () {
  if (window.__FI__ && window.__FI__.odoo) return; // already loaded
  window.__FI__ = window.__FI__ || {};

  const odoo = {};

  const CALL_KW_RE = /\/web\/dataset\/call_kw\/([^/]+)\/([^/?]+)/;

  // Calls that reliably mean "this establishes/refreshes the CURRENT view's
  // own record(s)", as opposed to an incidental relational lookup (e.g. a
  // many2one field's name_search hitting a completely different model).
  const STRONG_SIGNAL_METHODS = new Set([
    "web_read",
    "read",
    "onchange",
    "get_views",
    "web_save",
    "web_search_read",
  ]);

  function parseCallKw(url) {
    const m = url.match(CALL_KW_RE);
    if (!m) return null;
    try {
      return { model: decodeURIComponent(m[1]), method: decodeURIComponent(m[2]) };
    } catch (err) {
      return null;
    }
  }

  /**
   * Best-effort: which Odoo model is the user currently looking at? Scans
   * the Resource Timing buffer (covers requests made before this content
   * script was even injected) for the most recent strong-signal call_kw
   * call and returns its model, or null if none was ever observed (e.g.
   * not an Odoo page, or the buffer has since evicted it on a very
   * long-lived tab).
   */
  odoo.detectCurrentModel = function () {
    try {
      const entries = performance.getEntriesByType("resource");
      let best = null;
      for (const e of entries) {
        const parsed = parseCallKw(e.name);
        if (!parsed || !STRONG_SIGNAL_METHODS.has(parsed.method)) continue;
        if (!best || e.startTime > best.startTime) best = { model: parsed.model, startTime: e.startTime };
      }
      return best ? best.model : null;
    } catch (err) {
      return null;
    }
  };

  /** Low-level Odoo JSON-RPC call, reusing the page's own session. */
  odoo.call = async function (model, method, args = [], kwargs = {}) {
    const res = await fetch(`/web/dataset/call_kw/${encodeURIComponent(model)}/${encodeURIComponent(method)}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        id: Math.floor(Math.random() * 1e9),
        params: { model, method, args, kwargs },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) {
      const data = json.error.data || {};
      throw new Error(data.message || data.name || json.error.message || "Odoo RPC error");
    }
    return json.result;
  };

  const FIELD_META_FIELDS = [
    "field_description",
    "ttype",
    "relation",
    "required",
    "readonly",
    "store",
    "related",
    "compute",
    "help",
    "selection",
  ];

  const fieldMetaCache = new Map(); // "model:field" -> Promise<meta>

  /**
   * Fetches the live ir.model.fields definition for `model`/`fieldName`.
   * Resolves to { ...fieldRow } on success, `null` if the model/field
   * combination doesn't exist, or { error: "..." } if the RPC itself
   * failed (network, permissions, not actually an Odoo server, etc).
   * Cached per (model, field) for the life of the page.
   */
  odoo.fetchFieldMeta = function (model, fieldName) {
    if (!model || !fieldName) return Promise.resolve(null);
    const key = `${model}:${fieldName}`;
    if (fieldMetaCache.has(key)) return fieldMetaCache.get(key);

    const promise = odoo
      .call("ir.model.fields", "search_read", [], {
        domain: [
          ["model", "=", model],
          ["name", "=", fieldName],
        ],
        fields: FIELD_META_FIELDS,
        limit: 1,
      })
      .then((rows) => (rows && rows[0]) || null)
      .catch((err) => {
        console.error("[Field Inspector] Odoo field metadata lookup failed:", err);
        return { error: (err && err.message) || String(err) };
      });

    fieldMetaCache.set(key, promise);
    return promise;
  };

  window.__FI__.odoo = odoo;
})();
