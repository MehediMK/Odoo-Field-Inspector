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

  const viewArchCache = new Map(); // "model:type" -> Promise<viewDict|null|{error}>
  let versionPromise = null; // Promise<{raw, major, minor}|null>

  /**
   * Fetches (and caches per model+type) the arch of the model's default view
   * of that type via get_views — the same RPC the Odoo web client itself uses
   * to render the page. The whole view dict is kept, not just the arch: it
   * carries the view record's id, which is the entry point for the XML ID and
   * inheritance chain below.
   *
   * `viewType` is "form" or "list". Odoo renamed the list view type from
   * "tree" to "list" in 17, so an unknown/failed type is retried under both
   * names rather than reported as "no such view" on half the versions.
   */
  function fetchViewArch(model, viewType = "form") {
    const key = `${model}:${viewType}`;
    if (viewArchCache.has(key)) return viewArchCache.get(key);

    const order = viewType === "list" ? ["list", "tree"] : viewType === "tree" ? ["tree", "list"] : [viewType];

    const promise = (async () => {
      let lastError = null;
      for (const type of order) {
        try {
          const res = await odoo.call(model, "get_views", [], { views: [[false, type]], options: {} });
          const view = res && res.views && res.views[type];
          if (view) return { ...view, requestedType: type };
        } catch (err) {
          lastError = err;
        }
      }
      if (lastError) throw lastError;
      return null;
    })().catch((err) => {
      console.error("[Field Inspector] Odoo view arch lookup failed:", err);
      return { error: (err && err.message) || String(err) };
    });

    viewArchCache.set(key, promise);
    return promise;
  }

  const MAX_INHERIT_DEPTH = 12;
  const viewStackCache = new Map(); // "model:type" -> Promise<stack|null|{error}>

  /**
   * Which view is this page actually rendered from, and what does it inherit
   * from?
   *
   * The rendered arch is a *merge* of a whole inheritance chain, so "which
   * XML ID defines this field" has no single answer from the DOM alone. This
   * resolves the chain instead:
   *
   *   1. the active view's record id comes from the get_views response;
   *   2. `ir.ui.view.inherit_id` is walked upward (depth-capped, cycle-guarded,
   *      and tolerant of an AccessError on any single step — a chain can stop
   *      early rather than fail the whole lookup);
   *   3. every collected id is resolved to its external ID in ONE
   *      `ir.model.data` search, which is the only reliable way to get an XML
   *      ID for a record.
   *
   * Note what this does NOT do: it never fetches each ancestor's `arch_db`.
   * A view arch can be hundreds of KB, and the merged arch Odoo already sent
   * is what the field's effective definition comes from — so the panel reports
   * the stack that contributed, not a per-field attribution between them.
   */
  odoo.fetchViewStack = async function (model, viewType = "form") {
    if (!model) return null;
    const key = `${model}:${viewType}`;
    if (viewStackCache.has(key)) return viewStackCache.get(key);

    const promise = (async () => {
      const active = await fetchViewArch(model, viewType);
      if (!active || active.error) return active;
      if (active.id == null) return null;

      const chain = [{ id: active.id, name: active.name || "", model: model, xmlId: active.xml_id || "" }];
      const seen = new Set([active.id]);
      let cursor = active.inherit_id && active.inherit_id[0];

      while (cursor != null && chain.length < MAX_INHERIT_DEPTH) {
        if (seen.has(cursor)) break; // defensive: a cycle would otherwise loop forever
        seen.add(cursor);
        let parent;
        try {
          [parent] = await odoo.call("ir.ui.view", "read", [[cursor]], { fields: ["name", "model", "type", "inherit_id"] });
        } catch (err) {
          // An ir.ui.view row can be unreadable for this user (record rules
          // on the view model). Keep what we have and mark the chain partial.
          chain.partial = (err && err.message) || String(err);
          break;
        }
        if (!parent) break;
        chain.push({ id: parent.id, name: parent.name || "", model: parent.model || "", type: parent.type || "", xmlId: "" });
        cursor = parent.inherit_id && parent.inherit_id[0];
      }

      const missing = chain.filter((v) => !v.xmlId).map((v) => v.id);
      if (missing.length) {
        try {
          const rows = await odoo.call("ir.model.data", "search_read", [], {
            domain: [
              ["model", "=", "ir.ui.view"],
              ["res_id", "in", missing],
            ],
            fields: ["module", "name", "res_id"],
          });
          const byId = new Map((rows || []).map((r) => [r.res_id, `${r.module}.${r.name}`]));
          for (const view of chain) {
            if (!view.xmlId && byId.has(view.id)) view.xmlId = byId.get(view.id);
          }
        } catch (err) {
          // No XML IDs is a degraded answer, not a failed one: the ids and
          // names below are still worth showing.
          chain.partial = (err && err.message) || String(err);
        }
      }

      chain.activeId = active.id;
      chain.requestedType = active.requestedType;
      return chain;
    })();

    viewStackCache.set(key, promise);
    return promise;
  };

  /**
   * Which Odoo version is this server?
   *
   * Read from `ir.config_parameter`, which every Odoo since 8 has shipped:
   * `web.base.build.description` is the human-facing build string, with
   * `web.base.build.version` as a fallback. Odoo Online/SaaS reports
   * "saas~17.2"-style values, so the major version is parsed out of the
   * prefix rather than assumed to be a bare number.
   *
   * Deliberately NOT using the newer `/web/webclient/version_info` endpoint:
   * one documented parameter keeps the extension's RPC surface to a single
   * method on a single model. The result is cached for the life of the page
   * (it can't change while the tab is open) and resolves to `null` on any
   * failure, which the UI reports as "unknown" rather than hiding.
   */
  odoo.fetchServerVersion = function () {
    if (versionPromise) return versionPromise;

    const readParam = (key) =>
      odoo
        .call("ir.config_parameter", "get_param", [[key]])
        .then((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
        .catch(() => null);

    versionPromise = readParam("web.base.build.description")
      .then((description) => description || readParam("web.base.build.version"))
      .then((raw) => (raw ? parseServerVersion(raw) : null))
      .catch((err) => {
        console.error("[Field Inspector] Odoo version lookup failed:", err);
        return null;
      });

    return versionPromise;
  };

  function parseServerVersion(raw) {
    const saas = /^saas~(\d+)(?:\.(\d+))?/i.exec(raw);
    if (saas) return { raw, major: Number(saas[1]), minor: saas[2] ? Number(saas[2]) : null, saas: true };
    const plain = /^(\d+)(?:\.(\d+))?/.exec(raw);
    if (plain) return { raw, major: Number(plain[1]), minor: plain[2] ? Number(plain[2]) : null, saas: false };
    // Unrecognized shape (a nightly build, a fork's custom string): keep the
    // raw text for display but treat the major version as unknown so link
    // selection falls back to the conservative choice.
    return { raw, major: null, minor: null, saas: false };
  }

  const FIELD_ACTION_XMLID = "base.action_ir_model_fields";
  const VIEW_ACTION_XMLID = "base.action_ui_view";

  /**
   * Deep link to any one technical record, in the URL style the detected
   * server actually understands.
   *
   * Odoo 17 replaced the `/web#model=…&id=…` hash URLs with `/odoo/action-<xmlid>`
   * routes, so the legacy shape is no longer safe to hardcode: on a 17+ server
   * it lands on a dead page, and on a 16-or-earlier server an `/odoo/…` link
   * 404s. Detection therefore decides the shape.
   *
   * `form` is "legacy" (≤16), "action" (≥17), or "legacy-unknown" when the
   * version couldn't be read — in which case the caller also offers the
   * other style via odoo.fieldListLink(), rather than guessing silently.
   */
  function recordLink(model, actionXmlId, recordId, version) {
    const major = version ? version.major : null;
    if (major != null && major >= 17) {
      return {
        form: "action",
        url: `${location.origin}/odoo/action-${actionXmlId}?active_id=${encodeURIComponent(recordId)}`,
      };
    }
    return {
      form: major == null ? "legacy-unknown" : "legacy",
      url: `${location.origin}/web#model=${model}&id=${encodeURIComponent(recordId)}&view_type=form`,
    };
  }

  /** Deep link to one `ir.model.fields` record (Settings → Technical → Fields). */
  odoo.fieldRecordLink = function (fieldId, version) {
    return recordLink("ir.model.fields", FIELD_ACTION_XMLID, fieldId, version);
  };

  /** Deep link to one `ir.ui.view` record (Settings → Technical → Views). */
  odoo.viewRecordLink = function (viewId, version) {
    return recordLink("ir.ui.view", VIEW_ACTION_XMLID, viewId, version);
  };

  /** The field list itself, in the 17+ action-URL style. */
  odoo.fieldListLink = function () {
    return `${location.origin}/odoo/action-${FIELD_ACTION_XMLID}`;
  };

  /** Count ancestor elements of the same tag — used to prefer the least-nested match. */
  function nodeAncestorDepth(node, tagName) {
    let n = node.parentElement;
    let depth = 0;
    while (n) {
      if (n.tagName === tagName) depth++;
      n = n.parentElement;
    }
    return depth;
  }

  /**
   * Finds how a node is actually declared in `model`'s view arch for
   * `viewType`: its widget=, domain=, context=, invisible=, required=,
   * readonly=, options=, groups=, string= (and, for a button, name=, type=,
   * special=, confirm=, classname=, icon=) — the view-level overrides that
   * `ir.model.fields` alone can't show, since that's the model-level
   * definition only. When a node appears more than once (e.g. a field that's
   * also a column in an embedded one2many sub-view, or the Save button
   * declared in both a form and its sub-view), the least-nested match is
   * preferred, since a deeply-nested one is more likely to belong to an
   * embedded sub-view rather than the node the user actually clicked.
   *
   * `viewType` matters: a list column is declared in the list view, not the
   * form view, so looking up a list cell in the form arch can either miss the
   * column entirely or report a same-named form field that isn't what the
   * user clicked.
   *
   * Resolves to `{ attrs, occurrences }`, `null` (node not found in the
   * arch — it may only exist in a different view), or `{ error }`.
   */
  odoo.fetchViewNodeAttrs = async function (model, tagName, nodeName, viewType = "form") {
    if (!model || !nodeName || !tagName) return null;
    try {
      const view = await fetchViewArch(model, viewType);
      if (!view) return null;
      if (view.error) return view;

      const arch = view.arch;
      if (typeof arch !== "string") return null;

      const doc = new DOMParser().parseFromString(arch, "application/xml");
      if (doc.querySelector("parsererror")) return null;

      const matches = Array.from(doc.getElementsByTagName(tagName)).filter((el) => el.getAttribute("name") === nodeName);
      if (!matches.length) return null;

      let best = matches[0];
      let bestDepth = nodeAncestorDepth(best, tagName);
      for (const m of matches.slice(1)) {
        const d = nodeAncestorDepth(m, tagName);
        if (d < bestDepth) {
          best = m;
          bestDepth = d;
        }
      }

      const attrs = {};
      for (const a of Array.from(best.attributes)) {
        if (a.name === "name") continue; // redundant, already known
        attrs[a.name] = a.value;
      }
      return { attrs, occurrences: matches.length };
    } catch (err) {
      console.error("[Field Inspector] Odoo view field attrs parse failed:", err);
      return { error: (err && err.message) || String(err) };
    }
  };

  window.__FI__.odoo = odoo;
})();
