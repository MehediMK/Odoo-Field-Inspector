/**
 * Field Inspector - shared utilities
 *
 * Loaded first among the content scripts. Exposes a single namespace,
 * `window.__FI__`, so later-loaded content script files can use it without
 * ES module imports (Manifest V3 content scripts execute as plain classic
 * scripts sharing one isolated-world global scope).
 *
 * Guarded against double-injection: if the popup re-injects the scripts
 * while they are already present, re-running this file is a harmless no-op.
 */
(function () {
  if (window.__FI__ && window.__FI__.utils) {
    return; // already loaded
  }

  window.__FI__ = window.__FI__ || {};

  const utils = {};

  /** True if the value looks like a syntactically valid CSS identifier fragment for #id use. */
  function isSafeCssId(id) {
    return typeof id === "string" && id.length > 0 && !/^\d/.test(id);
  }

  /** Escapes a value for safe use inside a CSS attribute-selector string, e.g. [name="..."]. */
  function escapeCssAttrValue(v) {
    return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  /** Escapes a value for safe use inside an XPath string literal, e.g. [@name="..."]. */
  function escapeXPathLiteral(v) {
    // XPath 1.0 has no string-literal escape character, so a value containing
    // a double quote can't go in a "..." literal — fall back to concat().
    const s = String(v);
    if (!s.includes('"')) return `"${s}"`;
    if (!s.includes("'")) return `'${s}'`;
    return "concat(" + s.split('"').map((part) => `"${part}"`).join(`,'"',`) + ")";
  }

  /**
   * A stable, human-meaningful attribute to key a selector segment off of,
   * in preference order, before falling back to a positional index. `name`
   * is deliberately first: it's how Odoo marks the technical field name on
   * a field's wrapper div (`.o_field_widget[name="partner_id"]`) and it's
   * far more stable across re-renders than a DOM position.
   */
  const STABLE_ATTRS = ["name", "data-name", "data-field", "data-testid", "aria-label"];

  function findStableAttr(node) {
    for (const attr of STABLE_ATTRS) {
      const val = node.getAttribute(attr);
      if (val) return { attr, val };
    }
    return null;
  }

  /** 1-based position of node among same-tag siblings, and whether that's needed to disambiguate. */
  function siblingTypeInfo(node) {
    let index = 1;
    let sibling = node.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === node.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    let count = 0;
    let s2 = node.parentElement ? node.parentElement.firstElementChild : null;
    while (s2) {
      if (s2.tagName === node.tagName) count++;
      s2 = s2.nextElementSibling;
    }
    return { index, needsIndex: count > 1 };
  }

  /**
   * Build a short, stable CSS selector that resolves back to `el`. Prefers a
   * unique #id; otherwise walks up the tree one level at a time, preferring
   * a stable attribute (name/data-name/...) over :nth-of-type() for each
   * segment, and stops as soon as the accumulated selector is already
   * unique in the document instead of always climbing to <html>.
   */
  utils.generateCssSelector = function (el) {
    try {
      if (!(el instanceof Element)) return "";

      if (el.id && isSafeCssId(el.id)) {
        const escaped = CSS.escape(el.id);
        if (document.querySelectorAll(`#${escaped}`).length === 1) {
          return `#${escaped}`;
        }
      }

      const parts = [];
      let node = el;
      let depth = 0;

      while (node && node.nodeType === Node.ELEMENT_NODE && depth < 40) {
        if (node.id && isSafeCssId(node.id)) {
          parts.unshift(`#${CSS.escape(node.id)}`);
          break;
        }

        const tag = node.tagName.toLowerCase();
        const stable = findStableAttr(node);
        let selector = stable ? `${tag}[${stable.attr}="${escapeCssAttrValue(stable.val)}"]` : tag;

        if (!stable) {
          const { index, needsIndex } = siblingTypeInfo(node);
          if (needsIndex) selector += `:nth-of-type(${index})`;
        }

        parts.unshift(selector);

        // Stop climbing as soon as this partial path already pins down a
        // single element — shorter, less brittle selectors than always
        // walking all the way to <html> or the nearest id'd ancestor.
        try {
          if (document.querySelectorAll(parts.join(" > ")).length === 1) break;
        } catch (err) {
          /* malformed intermediate selector (unlikely); keep climbing */
        }

        if (node === document.documentElement) break;
        node = node.parentElement;
        depth++;
      }

      return parts.join(" > ");
    } catch (err) {
      console.error("[Field Inspector] generateCssSelector failed:", err);
      return "";
    }
  };

  // Odoo inheritance targets the XML view architecture, not rendered HTML.
  // Technical field names are identifiers; unknown names retain the DOM XPath.
  utils.generateFieldXPath = function (el, fieldName) {
    if (typeof fieldName === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(fieldName)) {
      return `//field[@name='${fieldName}']`;
    }
    return utils.generateXPath(el);
  };

  function countXPathMatches(xpath) {
    try {
      return document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
    } catch (err) {
      return -1; // invalid/ambiguous; caller treats as "not unique"
    }
  }

  /**
   * Build an XPath expression for `el`. Prefers a unique @id anywhere in the
   * document (`//*[@id="..."]`), then a unique stable attribute, then walks
   * up one level at a time using [@name="..."] where available in place of
   * a positional index, stopping as soon as the accumulated path is unique
   * rather than always building the full absolute path from <html>.
   */
  utils.generateXPath = function (el) {
    try {
      if (!(el instanceof Element)) return "";
      if (el.id && isSafeCssId(el.id) && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
        return `//*[@id="${el.id}"]`;
      }

      const elStable = findStableAttr(el);
      if (elStable) {
        const candidate = `//${el.tagName.toLowerCase()}[@${elStable.attr}=${escapeXPathLiteral(elStable.val)}]`;
        if (countXPathMatches(candidate) === 1) return candidate;
      }

      const segments = [];
      let node = el;
      let depth = 0;
      let anchoredById = false;

      while (node && node.nodeType === Node.ELEMENT_NODE && depth < 40) {
        if (node.id && isSafeCssId(node.id)) {
          segments.unshift(`*[@id="${node.id}"]`);
          anchoredById = true;
          break;
        }

        const stable = findStableAttr(node);
        if (stable) {
          segments.unshift(`${node.tagName.toLowerCase()}[@${stable.attr}=${escapeXPathLiteral(stable.val)}]`);
        } else {
          const { index } = siblingTypeInfo(node);
          segments.unshift(`${node.tagName.toLowerCase()}[${index}]`);
        }

        // Stop climbing as soon as the accumulated path already resolves to
        // exactly one node — an id/[@id=] anchor makes this a document-wide
        // search (leading "//"), so test it that way too.
        const trial = "//" + segments.join("/");
        if (countXPathMatches(trial) === 1) {
          return trial;
        }

        if (node === document.documentElement) break;
        node = node.parentElement;
        depth++;
      }

      // A leading "//" means "anywhere in the document". That's required
      // only when the walk stopped early on an @id anchor partway up the
      // tree (anchoredById) — that ancestor is not necessarily a direct
      // child of the document root, so a single leading "/" (strict
      // absolute path from <html>) would never match it. A path built all
      // the way up to documentElement is a genuine absolute chain — any
      // [@name=...] predicates along the way don't change that — so it
      // only needs the single "/".
      const prefix = anchoredById ? "/" : "";
      return prefix + "/" + segments.join("/");
    } catch (err) {
      console.error("[Field Inspector] generateXPath failed:", err);
      return "";
    }
  };

  /** Returns { "data-foo": "bar", ... } for all data-* attributes on el. */
  utils.getDataAttributes = function (el) {
    const result = {};
    if (!(el instanceof Element)) return result;
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("data-")) result[attr.name] = attr.value;
    }
    return result;
  };

  /** Returns { name: value } for all ARIA-related attributes on el. */
  utils.getAriaAttributes = function (el) {
    const result = {};
    if (!(el instanceof Element)) return result;
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === "role" || attr.name.startsWith("aria-")) result[attr.name] = attr.value;
    }
    return result;
  };

  const VALIDATION_ATTRS = [
    "required",
    "pattern",
    "min",
    "max",
    "minlength",
    "maxlength",
    "step",
    "accept",
    "multiple",
    "novalidate",
  ];

  /** Returns validation-related attributes present on el. */
  utils.getValidationAttributes = function (el) {
    const result = {};
    if (!(el instanceof Element)) return result;
    for (const name of VALIDATION_ATTRS) {
      if (el.hasAttribute(name)) result[name] = el.getAttribute(name) === "" ? true : el.getAttribute(name);
    }
    return result;
  };

  const KNOWN_ATTR_NAMES = new Set([
    "id",
    "name",
    "class",
    "type",
    "placeholder",
    "value",
    "required",
    "readonly",
    "disabled",
    "for",
    ...VALIDATION_ATTRS,
  ]);

  /** Returns { name: value } for attributes not already surfaced as dedicated fields. */
  utils.getOtherAttributes = function (el) {
    const result = {};
    if (!(el instanceof Element)) return result;
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("data-") || attr.name.startsWith("aria-") || attr.name === "role") continue;
      if (KNOWN_ATTR_NAMES.has(attr.name)) continue;
      result[attr.name] = attr.value;
    }
    return result;
  };

  /** True if el has non-zero layout box and isn't hidden via CSS/attribute. */
  utils.isVisible = function (el) {
    try {
      if (!(el instanceof Element)) return false;
      if (el.hidden) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    } catch (err) {
      return true; // fail open: better to over-detect than silently skip fields
    }
  };

  /** Resolves the text content referenced by an aria-labelledby id list. */
  utils.resolveAriaLabelledBy = function (el) {
    const ids = (el.getAttribute("aria-labelledby") || "").trim().split(/\s+/).filter(Boolean);
    if (ids.length === 0) return "";
    const texts = ids
      .map((id) => {
        const ref = document.getElementById(id);
        return ref ? ref.textContent.trim() : "";
      })
      .filter(Boolean);
    return texts.join(" ");
  };

  /** Short, readable description of an element's parent for the "Parent element" field. */
  utils.describeParent = function (el) {
    if (!(el instanceof Element) || !el.parentElement) return "";
    const parent = el.parentElement;
    let desc = parent.tagName.toLowerCase();
    if (parent.id) desc += `#${parent.id}`;
    else if (parent.className && typeof parent.className === "string") {
      const firstClass = parent.className.trim().split(/\s+/)[0];
      if (firstClass) desc += `.${firstClass}`;
    }
    return desc;
  };

  /** Finds the nearest ancestor <form>, or an ARIA form landmark, and describes it. */
  utils.describeOwningForm = function (el) {
    const form = el instanceof Element ? el.closest("form") : null;
    if (!form) return null;
    return {
      tag: "FORM",
      id: form.id || "",
      name: form.getAttribute("name") || "",
      action: form.getAttribute("action") || "",
      method: form.getAttribute("method") || "",
    };
  };

  /** Truncates long strings for compact display, e.g. outerHTML previews. */
  utils.truncate = function (str, max = 240) {
    if (typeof str !== "string") return "";
    return str.length > max ? str.slice(0, max) + "…" : str;
  };

  /** Small debounce helper used by the MutationObserver-driven re-highlight pass. */
  utils.debounce = function (fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  };

  /** Robust clipboard write with a manual-copy fallback for locked-down pages. */
  utils.copyToClipboard = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        return ok;
      } catch (fallbackErr) {
        console.error("[Field Inspector] copy fallback failed:", fallbackErr);
        return false;
      }
    }
  };

  window.__FI__.utils = utils;
})();
