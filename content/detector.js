/**
 * Field Inspector - field/column detection & classification
 *
 * Depends on window.__FI__.utils (utils.js, loaded first).
 * Exposes window.__FI__.detector with:
 *   - resolveInspectable(target, settings) -> { kind: 'form'|'list', el } | null
 *   - buildFormFieldInfo(el) -> plain object describing a form field
 *   - buildColumnInfo(el)    -> plain object describing a table/list column
 *   - applyHighlights(settings) / clearHighlights()
 *   - startObserving(settings) / stopObserving()
 */
(function () {
  if (window.__FI__ && window.__FI__.detector) return; // already loaded
  window.__FI__ = window.__FI__ || {};

  const utils = window.__FI__.utils;

  const HIGHLIGHT_CLASS = "fi-detected-field";
  const HOVER_CLASS = "fi-hover-field";

  const LABEL_SELECTOR = "label";
  const FORM_CONTROL_SELECTOR = [
    "input",
    "select",
    "textarea",
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="switch"]',
    '[role="spinbutton"]',
  ].join(", ");
  // Elements that legitimately carry aria-label/aria-labelledby but are NOT
  // form fields (dialog close buttons, links, menu items, tabs, the dialog
  // itself). Without these exclusions a Bootstrap/Odoo modal's
  // `<button aria-label="Close">` gets misclassified as an inspectable
  // field, and clicking it gets intercepted instead of closing the dialog.
  const ARIA_NONFIELD_EXCLUSIONS = [
    "button",
    "a",
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="tab"]',
    '[role="dialog"]',
    '[role="alertdialog"]',
  ]
    .map((s) => `:not(${s})`)
    .join("");
  const ARIA_LABELLED_SELECTOR = `[aria-label]${ARIA_NONFIELD_EXCLUSIONS}, [aria-labelledby]${ARIA_NONFIELD_EXCLUSIONS}`;
  const LIST_HEADER_SELECTOR = 'th, [role="columnheader"]';
  const DATA_CELL_SELECTOR = 'td, [role="gridcell"]';
  // Odoo web client: the technical model field name lives on the field's
  // wrapper div (Form/Kanban view), not on the <input> itself.
  const ODOO_FIELD_WIDGET_SELECTOR = ".o_field_widget[name]";

  const ALL_DETECTABLE_SELECTOR = [
    LABEL_SELECTOR,
    FORM_CONTROL_SELECTOR,
    ARIA_LABELLED_SELECTOR,
    LIST_HEADER_SELECTOR,
    ODOO_FIELD_WIDGET_SELECTOR,
  ].join(", ");

  // Odoo's standard form-view row (web/static/src/views/form/form_group/
  // form_group.xml) renders label and field widget as sibling `.o_cell`s
  // inside a shared `.o_wrap_field` (or `.o_wrap_field_boolean`) row, e.g.:
  //   <div class="o_wrap_field">
  //     <div class="o_cell o_wrap_label"><label class="o_form_label" for="...">...</label></div>
  //     <div class="o_cell o_wrap_input"><div name="x" class="o_field_widget ...">...</div></div>
  //   </div>
  // So the label is NOT an ancestor of the widget (or vice versa) — a plain
  // closest() can't bridge them. Walk up to the shared row, then back down.
  function findOdooRowSibling(fromEl, targetSelector) {
    try {
      if (!fromEl || !fromEl.closest) return null;
      const row = fromEl.closest(".o_wrap_field, .o_wrap_field_boolean");
      return row ? row.querySelector(targetSelector) : null;
    } catch (err) {
      return null;
    }
  }

  const detector = {};
  let highlightedEls = new Set();
  let observer = null;

  // ---------------------------------------------------------------------
  // Classification: what did the user click?
  // ---------------------------------------------------------------------

  detector.resolveInspectable = function (target, settings) {
    try {
      let el = target instanceof Element ? target : target && target.parentElement;
      if (!el) return null;

      if (settings.listView) {
        const header = el.closest(LIST_HEADER_SELECTOR);
        if (header) return { kind: "list", el: header };
      }

      if (settings.formView) {
        const label = el.closest(LABEL_SELECTOR);
        if (label) return { kind: "form", el: label };

        const control = el.closest(FORM_CONTROL_SELECTOR);
        if (control) return { kind: "form", el: control };

        const ariaLabelled = el.closest(ARIA_LABELLED_SELECTOR);
        if (ariaLabelled) return { kind: "form", el: ariaLabelled };

        // Odoo readonly-mode fields (many2one/selection/char/etc. shown as
        // static text) render with no <label for=...>, no <input>, and no
        // aria-label at all — just `.o_field_widget[name]` wrapping plain
        // text. Without this, clicking directly on that text finds nothing.
        const odooField = el.closest(ODOO_FIELD_WIDGET_SELECTOR);
        if (odooField) return { kind: "form", el: odooField };
      }

      // List View data cell fallback: only once nothing more specific inside
      // it matched above (e.g. an editable cell's actual <input> still wins,
      // same as any other form control) — a plain readonly `<td>` gets its
      // own structural (row/column) info instead of nothing at all.
      if (settings.listView) {
        const cell = el.closest(DATA_CELL_SELECTOR);
        if (cell) return { kind: "listCell", el: cell };
      }

      return null;
    } catch (err) {
      console.error("[Field Inspector] resolveInspectable failed:", err);
      return null;
    }
  };

  // ---------------------------------------------------------------------
  // Form View
  // ---------------------------------------------------------------------

  function findLabelForControl(controlEl) {
    try {
      if (controlEl.labels && controlEl.labels.length > 0) {
        return { el: controlEl.labels[0], text: controlEl.labels[0].textContent.trim() };
      }
      if (controlEl.hasAttribute("aria-labelledby")) {
        const text = utils.resolveAriaLabelledBy(controlEl);
        if (text) return { el: null, text };
      }
      if (controlEl.hasAttribute("aria-label")) {
        return { el: null, text: controlEl.getAttribute("aria-label") };
      }
      const wrappingLabel = controlEl.closest("label");
      if (wrappingLabel) return { el: wrappingLabel, text: wrappingLabel.textContent.trim() };

      // Heuristic fallback: a preceding sibling that looks like static label text.
      let sib = controlEl.previousElementSibling;
      if (sib && !sib.matches(FORM_CONTROL_SELECTOR) && sib.textContent.trim()) {
        return { el: sib, text: sib.textContent.trim() };
      }
      return { el: null, text: "" };
    } catch (err) {
      console.error("[Field Inspector] findLabelForControl failed:", err);
      return { el: null, text: "" };
    }
  }

  // Odoo's own widget class (e.g. "o_field_many2one", "o_field_selection",
  // "o_field_monetary") names the field's actual widget type. Readonly-mode
  // fields render as a plain <span>/<div> with no <input> at all, so this is
  // the only place that type information is still available.
  const ODOO_WIDGET_CLASS_SKIP = new Set([
    "o_field_widget",
    "o_field_empty",
    "o_field_invalid",
    "o_field_translate",
    "o_field_readonly",
    "o_required_modifier",
    "o_readonly_modifier",
    "o_invisible_modifier",
  ]);

  function getOdooWidgetType(widgetEl) {
    if (!widgetEl || !widgetEl.className || typeof widgetEl.className !== "string") return "";
    const match = widgetEl.className
      .trim()
      .split(/\s+/)
      .find((c) => c.startsWith("o_field_") && !ODOO_WIDGET_CLASS_SKIP.has(c));
    return match ? match.replace(/^o_field_/, "") : "";
  }

  function describeFieldType(controlEl) {
    if (!controlEl) return "unknown";
    const tag = controlEl.tagName;
    if (tag === "INPUT") return "input";
    if (tag === "SELECT") return "select";
    if (tag === "TEXTAREA") return "textarea";
    if (controlEl.isContentEditable || controlEl.getAttribute("contenteditable") === "true" || controlEl.getAttribute("contenteditable") === "") {
      return "contenteditable";
    }
    const role = controlEl.getAttribute("role");
    if (role) return `custom (role="${role}")`;
    return "unknown";
  }

  function describeCurrentValue(controlEl) {
    if (!controlEl) return "";
    const tag = controlEl.tagName;
    try {
      if (tag === "INPUT") {
        const type = (controlEl.type || "text").toLowerCase();
        if (type === "checkbox" || type === "radio") {
          return `${controlEl.checked ? "Checked" : "Unchecked"}${controlEl.value ? ` (value: ${controlEl.value})` : ""}`;
        }
        return controlEl.value;
      }
      if (tag === "TEXTAREA") return controlEl.value;
      if (tag === "SELECT") {
        const selected = Array.from(controlEl.selectedOptions || []).map((o) => o.textContent.trim());
        return selected.join(", ");
      }
      if (controlEl.isContentEditable) return controlEl.textContent.trim();
      const role = controlEl.getAttribute("role");
      if (role === "checkbox" || role === "switch" || role === "radio") {
        return controlEl.getAttribute("aria-checked") || "";
      }
      return controlEl.getAttribute("aria-valuenow") || controlEl.textContent.trim();
    } catch (err) {
      return "";
    }
  }

  function describeDefaultValue(controlEl) {
    if (!controlEl) return "";
    try {
      const tag = controlEl.tagName;
      if (tag === "INPUT") {
        const type = (controlEl.type || "text").toLowerCase();
        if (type === "checkbox" || type === "radio") return controlEl.defaultChecked ? "Checked" : "Unchecked";
        return controlEl.defaultValue;
      }
      if (tag === "TEXTAREA") return controlEl.defaultValue;
      if (tag === "SELECT") {
        const def = Array.from(controlEl.options || []).find((o) => o.defaultSelected);
        return def ? def.textContent.trim() : "";
      }
      return "";
    } catch (err) {
      return "";
    }
  }

  detector.buildFormFieldInfo = function (el) {
    let labelEl = null;
    let labelText = "";
    let controlEl = null;
    let directOdooWidget = null;

    if (el.tagName === "LABEL") {
      labelEl = el;
      labelText = el.textContent.trim();
      const forId = el.getAttribute("for");
      if (forId) controlEl = document.getElementById(forId);
      if (!controlEl) controlEl = el.querySelector(FORM_CONTROL_SELECTOR);
    } else if (el.matches && el.matches(ODOO_FIELD_WIDGET_SELECTOR) && !el.matches(FORM_CONTROL_SELECTOR)) {
      // Clicked an Odoo field wrapper directly (e.g. its readonly display
      // text), not a <label> and not the real control inside it (if any).
      directOdooWidget = el;
      controlEl = el.querySelector(FORM_CONTROL_SELECTOR);
      const found = findLabelForControl(controlEl || el);
      labelEl = found.el;
      labelText = found.text;
    } else {
      controlEl = el;
      const found = findLabelForControl(el);
      labelEl = found.el;
      labelText = found.text;
    }

    let primary = controlEl || labelEl || el;
    // closest() only finds an ANCESTOR widget — that works when primary is
    // the real <input> (nested inside `.o_field_widget`), but a clicked
    // <label> is a SIBLING of the widget in Odoo's markup, so also try the
    // shared-row lookup before giving up.
    let odooWidget =
      directOdooWidget ||
      (primary.closest ? primary.closest(ODOO_FIELD_WIDGET_SELECTOR) : null) ||
      (labelEl ? findOdooRowSibling(labelEl, ODOO_FIELD_WIDGET_SELECTOR) : null);

    if (!labelText) {
      const rowLabel = odooWidget ? findOdooRowSibling(odooWidget, LABEL_SELECTOR) : null;
      labelText =
        (controlEl && (controlEl.getAttribute("aria-label") || utils.resolveAriaLabelledBy(controlEl))) ||
        (controlEl && controlEl.getAttribute("placeholder")) ||
        (controlEl && (controlEl.getAttribute("name") || controlEl.id)) ||
        (rowLabel && rowLabel.textContent.trim()) ||
        (odooWidget && odooWidget.getAttribute("name")) ||
        "(unlabeled field)";
    }

    // Odoo renders many fields in READONLY mode as a plain <span>/<div> with
    // no <input>/<select> inside at all (e.g. a many2one, selection, or char
    // field shown as static text). When that happens controlEl stays null
    // and every input-derived detail (Field Type, Input Type, Current Value)
    // would otherwise show as "unknown"/blank. Fall back to the Odoo field
    // widget wrapper (`.o_field_widget[name]`) itself as the inspected
    // element so those details still resolve.
    const isOdooReadonlyField = !controlEl && !!odooWidget;
    if (isOdooReadonlyField) {
      primary = odooWidget;
    }

    const odooWidgetType = odooWidget ? getOdooWidgetType(odooWidget) : "";

    return {
      kind: "form",
      fieldLabel: labelText,
      element: primary.tagName,
      fieldType: controlEl
        ? describeFieldType(controlEl)
        : isOdooReadonlyField
        ? `readonly (Odoo ${odooWidgetType || "field"} widget)`
        : "unknown",
      inputType: controlEl
        ? controlEl.tagName === "INPUT"
          ? controlEl.type || "text"
          : controlEl.getAttribute("role") || ""
        : odooWidgetType,
      id: primary.id || "",
      nameAttr: controlEl ? controlEl.getAttribute("name") || "" : "",
      odooFieldName: odooWidget ? odooWidget.getAttribute("name") || "" : "",
      classes: primary.className && typeof primary.className === "string" ? primary.className.trim() : "",
      placeholder: controlEl ? controlEl.getAttribute("placeholder") || "" : "",
      currentValue: controlEl ? describeCurrentValue(controlEl) : isOdooReadonlyField ? odooWidget.textContent.trim() : "",
      defaultValue: describeDefaultValue(controlEl),
      required: !!(controlEl && (controlEl.required || controlEl.getAttribute("aria-required") === "true")),
      readOnly:
        isOdooReadonlyField || !!(controlEl && (controlEl.readOnly || controlEl.getAttribute("aria-readonly") === "true")),
      disabled: !!(controlEl && (controlEl.disabled || controlEl.getAttribute("aria-disabled") === "true")),
      dataAttributes: utils.getDataAttributes(primary),
      ariaAttributes: utils.getAriaAttributes(primary),
      validationAttributes: controlEl ? utils.getValidationAttributes(controlEl) : {},
      otherAttributes: utils.getOtherAttributes(primary),
      cssSelector: utils.generateCssSelector(primary),
      xpath: utils.generateXPath(primary),
      parentElement: utils.describeParent(primary),
      owningForm: utils.describeOwningForm(primary),
      htmlPreview: utils.truncate(primary.outerHTML || "", 320),
      labelElementPresent: !!labelEl,
    };
  };

  // ---------------------------------------------------------------------
  // List View (tables / ARIA grids)
  // ---------------------------------------------------------------------

  detector.buildColumnInfo = function (headerEl) {
    const row = headerEl.closest('tr, [role="row"]');
    const table = headerEl.closest('table, [role="grid"], [role="table"]');

    let columnIndex = -1;
    if (row) columnIndex = Array.from(row.children).indexOf(headerEl);

    let relatedInput = null;
    if (table && columnIndex >= 0) {
      try {
        const bodyRows = table.matches("table")
          ? Array.from(table.tBodies[0] ? table.tBodies[0].rows : []).filter((r) => r !== row)
          : Array.from(table.querySelectorAll('[role="row"]')).filter((r) => r !== row);
        const sampleRow = bodyRows[0];
        const sampleCell = sampleRow ? sampleRow.children[columnIndex] : null;
        if (sampleCell) {
          const input = sampleCell.matches(FORM_CONTROL_SELECTOR)
            ? sampleCell
            : sampleCell.querySelector(FORM_CONTROL_SELECTOR);
          if (input) {
            relatedInput = {
              tag: input.tagName,
              type: input.tagName === "INPUT" ? input.type || "text" : input.getAttribute("role") || "",
              cssSelector: utils.generateCssSelector(input),
            };
          }
        }
      } catch (err) {
        console.error("[Field Inspector] related input lookup failed:", err);
      }
    }

    const columnName =
      headerEl.textContent.trim() ||
      headerEl.getAttribute("aria-label") ||
      headerEl.getAttribute("title") ||
      "(unnamed column)";

    let rowCount = null;
    let columnCount = row ? row.children.length : null;
    try {
      if (table && table.matches("table")) rowCount = table.rows.length;
      else if (table) rowCount = table.querySelectorAll('[role="row"]').length;
    } catch (err) {
      rowCount = null;
    }

    return {
      kind: "list",
      columnName,
      element: headerEl.tagName,
      columnIndex,
      id: headerEl.id || "",
      // Odoo's list view renders `<th data-name="partner_id">` — the technical
      // field name doesn't live in `name` or `data-field` there.
      nameAttr:
        headerEl.getAttribute("name") ||
        headerEl.getAttribute("data-name") ||
        headerEl.getAttribute("data-field") ||
        "",
      classes: headerEl.className && typeof headerEl.className === "string" ? headerEl.className.trim() : "",
      dataAttributes: utils.getDataAttributes(headerEl),
      ariaAttributes: utils.getAriaAttributes(headerEl),
      otherAttributes: utils.getOtherAttributes(headerEl),
      cssSelector: utils.generateCssSelector(headerEl),
      xpath: utils.generateXPath(headerEl),
      htmlPreview: utils.truncate(headerEl.outerHTML || "", 320),
      relatedInput,
      table: table
        ? {
            tag: table.tagName,
            id: table.id || "",
            classes: table.className && typeof table.className === "string" ? table.className.trim() : "",
            rowCount,
            columnCount,
          }
        : null,
    };
  };

  /**
   * A specific data cell in a table/grid row — as opposed to buildColumnInfo,
   * which describes the *column* (header). Only reached when the cell has no
   * more specific recognizable control inside it (an editable cell's actual
   * <input> is still resolved as a regular form field, same priority as
   * everywhere else — see resolveInspectable).
   */
  detector.buildDataCellInfo = function (cellEl) {
    const row = cellEl.closest('tr, [role="row"]');
    const table = cellEl.closest('table, [role="grid"], [role="table"]');

    let columnIndex = -1;
    if (row) columnIndex = Array.from(row.children).indexOf(cellEl);

    let rowIndex = -1;
    let headerEl = null;
    if (table) {
      try {
        const bodyRows = table.matches("table")
          ? Array.from(table.tBodies[0] ? table.tBodies[0].rows : [])
          : Array.from(table.querySelectorAll('[role="row"]')).filter((r) => !r.closest("thead") && !r.querySelector(LIST_HEADER_SELECTOR));
        rowIndex = row ? bodyRows.indexOf(row) : -1;

        const headerRow = table.matches("table")
          ? table.tHead && table.tHead.rows[0]
          : table.querySelector('[role="row"]');
        if (headerRow && columnIndex >= 0) headerEl = headerRow.children[columnIndex] || null;
      } catch (err) {
        console.error("[Field Inspector] data cell row/column lookup failed:", err);
      }
    }

    const columnName = headerEl
      ? headerEl.textContent.trim() || headerEl.getAttribute("aria-label") || headerEl.getAttribute("title") || ""
      : "";

    // Odoo's list view renders `<td name="partner_id" class="o_data_cell">`
    // directly (same pattern as the `<th data-name="...">` header and the
    // form view's `.o_field_widget[name]`) — check the cell itself first,
    // then fall back to a nested field widget for older/custom markups.
    const odooWidget = cellEl.matches(ODOO_FIELD_WIDGET_SELECTOR) ? cellEl : cellEl.querySelector(ODOO_FIELD_WIDGET_SELECTOR);
    const odooFieldName = cellEl.getAttribute("name") || (odooWidget ? odooWidget.getAttribute("name") || "" : "");

    return {
      kind: "listCell",
      columnName,
      columnIndex,
      rowIndex,
      element: cellEl.tagName,
      cellText: cellEl.textContent.trim(),
      id: cellEl.id || "",
      odooFieldName,
      classes: cellEl.className && typeof cellEl.className === "string" ? cellEl.className.trim() : "",
      dataAttributes: utils.getDataAttributes(cellEl),
      ariaAttributes: utils.getAriaAttributes(cellEl),
      otherAttributes: utils.getOtherAttributes(cellEl),
      cssSelector: utils.generateCssSelector(cellEl),
      xpath: utils.generateXPath(cellEl),
      htmlPreview: utils.truncate(cellEl.outerHTML || "", 320),
    };
  };

  // ---------------------------------------------------------------------
  // Field Finder: a flat, searchable index of every field/column on the
  // current page — technical name + label — for the search/filter panel.
  // Independent of resolveInspectable (which classifies a single click
  // target); this instead enumerates everything at once.
  // ---------------------------------------------------------------------

  detector.listAllFields = function (settings) {
    const results = [];
    const seen = new Set();
    try {
      if (settings.formView) {
        document.querySelectorAll(ODOO_FIELD_WIDGET_SELECTOR).forEach((widget) => {
          if (seen.has(widget) || !utils.isVisible(widget)) return;
          const technicalName = widget.getAttribute("name") || "";
          if (!technicalName) return;
          seen.add(widget);
          const labelEl = findOdooRowSibling(widget, LABEL_SELECTOR);
          const label = (labelEl && labelEl.textContent.trim()) || technicalName;
          results.push({ kind: "form", technicalName, label, el: widget });
        });

        // Plain (non-Odoo) form controls with a name/id but no .o_field_widget wrapper.
        document.querySelectorAll(FORM_CONTROL_SELECTOR).forEach((ctrl) => {
          if (seen.has(ctrl) || !utils.isVisible(ctrl) || ctrl.closest(ODOO_FIELD_WIDGET_SELECTOR)) return;
          const technicalName = ctrl.getAttribute("name") || ctrl.id || "";
          if (!technicalName) return;
          seen.add(ctrl);
          const found = findLabelForControl(ctrl);
          results.push({ kind: "form", technicalName, label: found.text || technicalName, el: ctrl });
        });
      }

      if (settings.listView) {
        document.querySelectorAll(LIST_HEADER_SELECTOR).forEach((th) => {
          if (seen.has(th) || !utils.isVisible(th)) return;
          const technicalName = th.getAttribute("data-name") || th.getAttribute("name") || th.getAttribute("data-field") || "";
          const label = th.textContent.trim() || th.getAttribute("aria-label") || th.getAttribute("title") || "";
          if (!technicalName && !label) return;
          seen.add(th);
          results.push({ kind: "list", technicalName, label, el: th });
        });
      }
    } catch (err) {
      console.error("[Field Inspector] listAllFields failed:", err);
    }
    return results;
  };

  // ---------------------------------------------------------------------
  // Persistent highlighting (kept fresh via MutationObserver)
  // ---------------------------------------------------------------------

  detector.applyHighlights = function (settings) {
    detector.clearHighlights();
    if (!settings.highlight) return;

    try {
      const selectorParts = [];
      if (settings.formView) selectorParts.push(LABEL_SELECTOR, FORM_CONTROL_SELECTOR, ARIA_LABELLED_SELECTOR, ODOO_FIELD_WIDGET_SELECTOR);
      if (settings.listView) selectorParts.push(LIST_HEADER_SELECTOR);
      if (selectorParts.length === 0) return;

      const selector = selectorParts.join(", ");
      const hostEl = window.__FI__.ui && window.__FI__.ui.hostEl;

      document.querySelectorAll(selector).forEach((el) => {
        if (hostEl && hostEl.contains(el)) return;
        if (!utils.isVisible(el)) return;
        el.classList.add(HIGHLIGHT_CLASS);
        highlightedEls.add(el);
      });
    } catch (err) {
      console.error("[Field Inspector] applyHighlights failed:", err);
    }
  };

  detector.clearHighlights = function () {
    highlightedEls.forEach((el) => {
      try {
        el.classList.remove(HIGHLIGHT_CLASS);
      } catch (err) {
        /* element may have been removed from the DOM already */
      }
    });
    highlightedEls = new Set();
  };

  detector.setHover = function (el, on) {
    if (!el) return;
    el.classList.toggle(HOVER_CLASS, !!on);
  };

  detector.ALL_DETECTABLE_SELECTOR = ALL_DETECTABLE_SELECTOR;

  // ---------------------------------------------------------------------
  // MutationObserver: keep highlights fresh as the page changes
  // ---------------------------------------------------------------------

  detector.startObserving = function (settings) {
    detector.stopObserving();
    const rerun = utils.debounce(() => detector.applyHighlights(settings), 300);
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length || m.removedNodes.length) {
          rerun();
          break;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  detector.stopObserving = function () {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  window.__FI__.detector = detector;
})();
