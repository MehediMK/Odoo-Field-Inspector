# Field Inspector

A Manifest V3 Chrome extension that lets you click any form field label or
table/list column header on a webpage and instantly see a developer-tool
style panel with its full HTML details — element type, attributes, CSS
selector, XPath, validation rules, and more. Everything runs locally in
your browser; nothing is ever read from your page and sent anywhere —
**except** the one opt-in case described under [Odoo Developer
Mode](#odoo-developer-mode) below, where the field you clicked is
recognized as belonging to an Odoo form/wizard and the extension calls
back into that same Odoo server (using your already-logged-in session) to
show the field's real, authoritative definition.

## Features

- **Form View** — click a `<label>`, `<input>`, `<select>`, `<textarea>`,
  checkbox/radio, `contenteditable` field, or an ARIA-labelled custom
  control to see its label, element/input type, id/name, classes,
  placeholder, current/default value, required/read-only/disabled state,
  data-/aria-/validation attributes, CSS selector, XPath, parent element,
  and owning `<form>`.
- **List View** — click a `<th>` or `[role="columnheader"]` to see the
  column name, element type, column index, id/name/classes, data
  attributes, CSS selector, XPath, the parent table/grid's size, and a
  sample of the input control used in that column (if any).
- **Hover highlighting** — detected fields get a subtle dashed outline;
  the field under your cursor gets a solid highlight.
- **Copy to clipboard** — copy any individual value (CSS selector, XPath,
  etc.) or use **Copy All Information** to copy everything as plain text
  or JSON.
- **Dynamic content aware** — a debounced `MutationObserver` keeps
  highlighting in sync as SPA routes change or content loads via AJAX;
  clicks are handled via event delegation so newly-added fields work
  immediately without any re-scan.
- **Never touches your data** — while inspecting, clicks on fields are
  intercepted before the page sees them, so labels never toggle
  checkboxes, `<select>` never opens, and no value or focus state is ever
  changed. Turning the inspector off restores completely normal page
  behavior.
- **Shadow DOM UI** — the inspector panel renders inside an isolated
  Shadow DOM tree, so host-page CSS can't distort it and the panel's CSS
  can never leak onto the page.
- **Odoo Developer Mode** — when the clicked field belongs to an Odoo form
  or wizard, the panel leads with a live **Odoo Field Definition** section:
  the model, the field's real ORM type/relation/required/readonly/stored/
  related/computed/help text straight from `ir.model.fields`, decoded
  selection options, and a ready-to-paste `<field name="..."/>` view XML
  snippet. See [Odoo Developer Mode](#odoo-developer-mode) below.

## Project Structure

```text
chrome-field-inspector/
├── manifest.json          # MV3 manifest (popup, service worker, permissions)
├── background.js          # Service worker: per-tab badge bookkeeping only
├── content/
│   ├── utils.js             # CSS selector / XPath generators, attribute helpers
│   ├── odoo.js              # Odoo model detection + live ir.model.fields RPC lookup
│   ├── detector.js         # Field/column detection, classification, MutationObserver
│   ├── ui.js                # Shadow DOM inspector panel (render + copy logic)
│   └── content.js          # Orchestrator: event delegation, message handling
├── content.css             # Page-level highlight styles (scoped, !important, outline-only)
├── popup/
│   ├── popup.html
│   ├── popup.js            # Settings + enable/disable + on-demand injection
│   └── popup.css
├── icons/
│   ├── icon16.png / icon32.png / icon48.png / icon128.png
└── README.md
```

## Architecture

### Injection model (why permissions are minimal)

The extension only requests `storage`, `activeTab`, and `scripting` — **no
host permissions**, so Chrome never shows the broad "read and change all
your data on all websites" warning. The content scripts are **not**
statically registered in the manifest; instead, `popup/popup.js` injects
them into the current tab on demand (`chrome.scripting.executeScript`),
the first time you flip "Enable Inspector" in the popup for that tab. If
they're already present (checked via a lightweight `PING` message) they
are not re-injected. Every content script file is wrapped in a
"already-loaded" guard so re-injection is always safe.

### Content script split

All four `content/*.js` files load into the **same isolated world** (per
Chrome's content-script execution model), in the order declared in
`popup.js`'s injection call, so top-level `const`/functions declared in
one file are visible to files loaded after it — no bundler or ES module
loader needed:

1. `utils.js` — pure functions: CSS selector generation, XPath generation,
   attribute extraction, clipboard helpers. No DOM mutation, no state.
2. `detector.js` — field/column **detection and classification**, plus the
   `MutationObserver` that keeps the "detected field" highlight class in
   sync with a changing DOM.
3. `ui.js` — the Shadow DOM inspector panel: rendering, the Copy/Copy All
   buttons, open/close state.
4. `content.js` — the orchestrator. Owns the enabled/settings state for
   the page, attaches the capture-phase event listeners, resolves clicks
   to a detected field via `detector.resolveInspectable`, and handles
   `chrome.runtime.onMessage` traffic from the popup.

### Form View vs. List View classification

On every click, `content.js` asks `detector.resolveInspectable(target,
settings)` to walk up from the click target with `Element.closest()`
against three selector groups, in priority order:

1. **List View check** (if enabled): `closest('th, [role="columnheader"]')`.
   A match is unambiguous — table/grid headers are always classified as a
   list column.
2. **Form View check** (if enabled): `closest('label')` first (covers a
   label wrapping or pointing at a control), then the form-control
   selector (`input, select, textarea, [contenteditable], [role="textbox"
   | "checkbox" | "radio" | "combobox" | "listbox" | "switch" |
   "spinbutton"]`), then any element carrying `aria-label`/`aria-labelledby`.
3. No match → not an inspectable field. If the click also isn't inside the
   inspector panel, any currently open panel is closed ("click outside to
   close").

This selector-based approach is intentionally narrow: it never matches
plain `<div>`s, buttons, or links, so the rest of the page's click
handlers, navigation, and JS frameworks keep working normally while the
inspector is on.

### Field → label resolution (Form View)

Given a resolved element, `detector.buildFormFieldInfo` finds the
control/label pair using, in order: the browser's native `HTMLInputElement
.labels` collection (handles both `label[for]` and label-wraps-input),
`aria-labelledby` (resolved to referenced text), `aria-label`, a wrapping
`<label>`, and finally a heuristic fallback to the nearest preceding
sibling's text. If no label can be found at all, it falls back to
`placeholder` → `name`/`id` → `"(unlabeled field)"`.

### Inspector UI ↔ content script communication

The popup and the panel never talk to each other directly — everything
flows through the tab's content script, which owns state:

```
popup.js  --chrome.tabs.sendMessage-->  content.js  --calls-->  detector.js / ui.js
popup.js  <--response-------------------content.js
```

Message types: `PING` (liveness probe), `FI_ENABLE` / `FI_DISABLE`
(with a settings payload), `FI_UPDATE_SETTINGS` (live preference push
while enabled), `GET_STATE` (popup re-open sync). `background.js` only
listens for a one-way `FI_STATE_CHANGED` notification to keep the toolbar
badge (`ON`) in sync, and resets that state when a tab navigates or
closes (the content script — and its state — is destroyed on navigation).

### Selector / XPath generation

Both generators build the **shortest selector that's still unique**,
rather than always walking all the way to `<html>`:

- **CSS selector**: a unique `#id` short-circuits immediately. Otherwise it
  walks up one level at a time, preferring a stable attribute
  (`name`, `data-name`, `data-field`, `data-testid`, `aria-label` — in that
  order — this is what lets it key straight off Odoo's
  `.o_field_widget[name="..."]`) over a positional
  `tag:nth-of-type(n)` segment, and **stops climbing as soon as the
  accumulated path already resolves to exactly one element** instead of
  always continuing to the nearest id'd ancestor or `<html>`.
- **XPath**: same idea — prefers a document-wide unique `//*[@id="..."]` or
  `//tag[@name="..."]` shortcut, otherwise climbs with `[@name="..."]`
  predicates in place of a plain `tag[index]` where available, stopping
  early once unique. A path anchored partway up by an `@id` (not
  necessarily a direct child of the document root) gets a `//` prefix; a
  path built all the way from `documentElement` gets a single `/` — mixing
  these up produces an XPath that silently never matches anything, which
  is why this distinction matters.

### Data-safety mechanism

While enabled, `content.js` attaches **capture-phase** listeners for
`mousedown` and `click` on `document`. For *any* resolved field,
`mousedown` is `preventDefault()`-ed — this stops the native focus/
dropdown-open/pre-toggle behavior mousedown triggers by default, which
matters beyond `<select>`/checkbox/radio: some widgets (e.g. an Odoo
many2one or date field) open their own autocomplete/picker on focus alone,
before a `click` handler would ever get a chance to intervene. On `click`,
once a field is resolved, both `preventDefault()` and `stopPropagation()`
are called before the panel is shown — the page's own click handler for
that element never runs. Clicks that don't resolve to a field are passed
through untouched.

## Odoo Developer Mode

When the clicked field lives inside an Odoo form, list, or **wizard**
(dialog), the panel adds a live **Odoo Field Definition** section sourced
straight from the Odoo server, instead of guessing from CSS classes alone:

- **Model detection** (`content/odoo.js`): a content script's isolated
  world can't read the page's own JS state, and the URL doesn't help
  either — opening a wizard never changes it. Instead, every Odoo RPC call
  (on any version since Odoo 8) POSTs to `/web/dataset/call_kw/<model>/
  <method>`, which the browser's own Resource Timing API can see with no
  extra permission. The model behind the most recent `get_views`/
  `onchange`/`web_read`/`web_save`/`web_search_read` call is used —
  incidental relational lookups like a many2one's `name_search` are
  ignored so they can't hijack the detected model.
- **Field lookup**: an `ir.model.fields.search_read` call
  (`{model, name} → field_description, ttype, relation, required,
  readonly, store, related, compute, help, selection, states`) resolved
  against that model + the field's technical name (read off Odoo's own
  `.o_field_widget[name="..."]` wrapper). Results are cached per
  (model, field) for the life of the page.
- **Non-blocking**: the panel opens instantly with everything derivable
  from the DOM; the Odoo section shows a "Looking up…" state and is filled
  in when the network response lands. Clicking a different field while a
  lookup is still in flight invalidates it (`ui.beginOdooLookup`/
  `applyOdooFieldMeta` token check) so a slow, stale response can never
  overwrite whatever field you're looking at by the time it arrives.
- **Selection fields**: `ir.model.fields.selection` comes back from Odoo as
  a Python-literal string (e.g. `"[('draft','Draft'),('done','Done')]"`);
  it's parsed into a readable key/label list.
- The panel also offers a ready-to-paste `<field name="..."/>` view XML
  snippet for the field.
- This is the one path in the extension that talks to a server — see
  [Security & Privacy](#security--privacy).

## Installation

1. Download or clone this folder (`chrome-field-inspector/`).
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `chrome-field-inspector/`
   folder.
5. Pin the extension (puzzle-piece icon → pin) so its toolbar icon is
   always visible.

## Usage

1. Navigate to any page with a form or a table.
2. Click the Field Inspector toolbar icon to open the popup.
3. Toggle **Enable Inspector** on. The page's detected fields/columns get
   a subtle dashed outline (if "Highlight detected fields" is on).
4. Click any field label, input, or table column header. The inspector
   panel slides in on the right with full details.
5. Click any 📋 button to copy that one value, or **Copy All Information**
   at the bottom to copy everything (as plain text or JSON, per your
   Copy Behavior setting in the popup).
6. Click the panel's **×**, press **Esc**, or click anywhere outside the
   panel (that isn't itself a detected field) to close it.
7. Toggle **Enable Inspector** off in the popup to fully restore normal
   page behavior.

Your Form View / List View / Highlight / Copy Format preferences persist
across sessions via `chrome.storage.local` and apply live if you change
them while the inspector is already enabled on a tab.

## Security & Privacy

- All field/column analysis happens **entirely client-side**, inside the
  content script running in your tab. Nothing about the page — its HTML,
  field values, or your interactions — is ever sent anywhere, **except**
  the Odoo Developer Mode field-definition lookup described above: when
  (and only when) a clicked field is recognized as an Odoo field, its
  model and technical field name are sent, via an `ir.model.fields`
  RPC call, to the **same Odoo server the page is already on** — using
  your existing logged-in session (same-origin `fetch`, no separate
  credentials, no third-party endpoint). No field *values*, page content,
  or browsing activity are ever included in that call.
- The extension does **not** track browsing activity, does **not** collect
  analytics, and does **not** store page content anywhere (not even
  locally) — `chrome.storage.local` is used only for your four UI
  preferences (Form View / List View / Highlight / Copy Format). The Odoo
  field-metadata cache lives only in memory for the life of the tab.
- No host permissions are requested. The content scripts only run on a
  tab after you explicitly enable the inspector for it via the popup
  (`activeTab` + `scripting`), and they stop running the moment you
  navigate away or disable the inspector.
- The extension never submits forms and never programmatically changes a
  field's value, checked state, or focus.

## Known Limitations

- **Cross-origin iframes**: the content script only runs in the page's
  top frame (by design, to keep the permission footprint minimal), so
  fields inside a cross-origin `<iframe>` can't be inspected. Same-origin
  iframes on the same page are also not currently traversed.
- **Closed shadow roots**: if a site renders its form controls inside a
  shadow root created with `{mode: "closed"}`, the DOM inside it is
  invisible to any content script (including this one) — this is a
  browser-level restriction, not specific to this extension.
- **Chrome-internal pages**: the inspector cannot run on `chrome://`,
  the Chrome Web Store, or other pages Chrome blocks extensions from
  (the popup will show "Not available on this page").
- Column detection targets `<table>`/`<th>` markup and ARIA grid patterns
  (`role="grid"`/`"columnheader"`/`"row"`); a framework's fully custom
  `<div>`-based "table" with no ARIA roles at all won't be recognized as a
  list — add `role="table"`/`role="columnheader"` to such components if
  you need it detected.

## Testing Checklist

After loading the extension via **Load unpacked**:

1. **Basic enable/disable**
   - Open any page with a form (e.g. a login or contact form).
   - Open the popup, toggle **Enable Inspector** on.
   - Expected: badge shows "ON" on the toolbar icon; hovering over a
     labeled input shows a dashed outline that turns solid on hover.

2. **Form View — standard `label[for]` + input**
   - On a page like `https://www.w3schools.com/html/html_forms.asp`
     (the "Try it Yourself" example form), click the "First name:" label.
   - Expected: panel opens showing Field Label "First name:", Element
     `INPUT`, Field Type `input`, Input Type `text`, matching `id`/`name`,
     a CSS selector and XPath that both resolve back to that input.

3. **Form View — label wraps input, no `for`**
   - Test on a form where `<label>Remember me <input type="checkbox"></label>`
     pattern is used (common on many login pages).
   - Click the label text.
   - Expected: panel shows Field Type `input`, Input Type `checkbox`,
     Current Value `Unchecked` (or `Checked`), and **the checkbox itself
     is not toggled** by the click.

4. **Form View — no visible label**
   - Click directly on a search `<input>` that only has a `placeholder`
     (e.g. a site search box with no `<label>`).
   - Expected: panel still opens; Field Label falls back to the
     placeholder text; typing does not occur in the field (click is
     intercepted).

5. **Form View — `<select>` element**
   - Click a `<select>` dropdown's associated label or the select itself.
   - Expected: panel opens with Field Type `select`, Current Value =
     the selected option's text, and **the dropdown does not open**.

6. **List View — HTML table**
   - Visit a page with a `<table>`, e.g.
     `https://en.wikipedia.org/wiki/Comparison_of_web_browsers` (any
     comparison table) or `https://www.w3schools.com/html/html_tables.asp`.
   - Click a `<th>` column header.
   - Expected: panel badge shows "List / Column"; Column Name matches the
     header text; Column Index is correct (0-based); Parent Table/Grid
     shows row/column counts; CSS Selector/XPath resolve back to that
     `<th>`.

7. **Dynamic content**
   - On a page with an AJAX-loaded or client-rendered table/form (e.g. a
     GitHub repository's file list, or any React/Vue admin demo), enable
     the inspector *before* the dynamic content loads (or trigger a
     filter/pagination action after enabling).
   - Expected: newly rendered fields/columns are clickable and get the
     dashed highlight without needing to re-toggle the inspector.

8. **Copy functionality**
   - With the panel open, click the 📋 next to CSS Selector.
   - Expected: button briefly shows "Copied!"; pasting elsewhere yields
     the selector text.
   - Click **Copy All Information**.
   - Expected: button briefly shows "Copied to clipboard!"; pasting
     yields either a readable multi-line summary (Plain Text setting) or
     a JSON object (JSON setting) — check both via the popup's Copy
     Behavior setting.

9. **Close behavior**
   - With the panel open, click elsewhere on the page (not on another
     field). Expected: panel closes.
   - Reopen it, press **Esc**. Expected: panel closes.
   - Reopen it, click the **×**. Expected: panel closes.
   - Reopen it, click a copy button *inside* the panel. Expected: panel
     stays open (only copies the value).

10. **Settings persistence**
    - Turn off "List View" detection in the popup, close and reopen the
      popup.
    - Expected: "List View" is still unchecked; clicking a table header
      on the page no longer opens the panel (form fields still work).

11. **No side effects on real usage**
    - With the inspector **disabled**, use the page normally (submit a
      search, check a checkbox, type into a field).
    - Expected: completely normal behavior — the extension has zero
      effect when off.

12. **Restricted pages**
    - Open the popup on `chrome://extensions/`.
    - Expected: "Enable Inspector" is disabled with the message "Not
      available on this page."

## Extending

- **New field pattern**: add a selector to `FORM_CONTROL_SELECTOR` (or a
  new branch in `describeFieldType`) in `content/detector.js`.
- **New info field**: add it to the object returned by
  `buildFormFieldInfo`/`buildColumnInfo` in `content/detector.js`, then
  render it via the `row(...)`/`section(...)` helpers in
  `content/ui.js`'s `renderFormInfo`/`renderListInfo`.
- **New popup setting**: add the control to `popup/popup.html`, read/write
  it in `popup/popup.js`'s `applySettingsToUI`/`onSettingChange`, and
  consume it from `state.settings` in `content/content.js` /
  `content/detector.js`.
- **New Odoo field metadata**: add the ORM field to `FIELD_META_FIELDS` in
  `content/odoo.js`, then render it in `renderOdooSection` in
  `content/ui.js`. Any new content script file must also be added to
  `CONTENT_FILES` in `popup/popup.js` (in load order) or it will never be
  injected.
