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

## Record and model debugging tools

Enable the inspector and its **Odoo Developer Mode**, then inspect a field.
The **Record Info** tab has **Record Data**, **View XML**, **Access Rights**, and
**Technical Shortcuts** buttons. The floating Options menu also offers
**Record & Model Tools** and **Odoo Debug Mode**.

- **Record context:** a read-only MAIN-world probe reads the containing OWL
  record/controller when available. Scoped DOM and URL fallbacks are labelled;
  a network-only model guess cannot authorize a record-data read. New/unsaved
  records have no saved data to load. Late responses cannot replace a newer
  inspection. No additional Chrome permission is required.
- **Record Data:** searchable table/JSON of server-saved values, with JSON copy.
  Unsaved edits are not included. Binary contents are omitted. Secret-named
  fields are excluded by default and nested JSON credentials are redacted.
  Closing tools, disabling the inspector, or changing settings clears the viewer.
- **Advanced fields:** dependencies, modules, indexing, copy/translation flags,
  inverse field, deletion policy, groups, domain and size, when the server exposes
  those metadata fields.
- **View XML:** merged XML using the detected view ID and record context, source
  XML on demand, inherited-view names/XML IDs, search, and copy. If the active view
  ID cannot be read, the default-view fallback is explicitly labelled. Descendants
  include inactive views and are not proof of which views contributed to rendering.
  The browser lists at most 200 source views and traverses at most 12 levels.
- **Access Rights:** model ACLs, record rules, group names and domains. These are
  readable configuration records, not an effective-permissions calculation. Server
  permission errors are displayed; a unified `ir.access` fallback is attempted
  when both older access models are unavailable.
- **Finder:** Required, Readonly, Relational and Buttons filters based on rendered
  state; Arrow Up/Down navigation and Enter selection. Result counts disclose the
  200-result display limit.
- **Technical shortcuts:** matching Fields, Views, Access Rights, Record Rules,
  Server Actions and the Current Action, with links to open records in a new tab.
  Server actions are never executed by these tools.
- **Odoo Debug Mode:** Off, Developer, or Assets, applied explicitly with a page
  reload. Other URL parameters and navigation state are preserved. This controls
  Odoo's URL debug mode, separately from the inspector's metadata setting.
  See [Odoo's developer-mode documentation](https://www.odoo.com/documentation/16.0/applications/general/developer_mode.html).

Use **Refresh** inside the tools to resolve the current context again and clear
cached view XML. The tools use your existing Odoo account permissions and make
read-only RPC calls to the current origin. Custom OWL runtimes and installations
that hide runtime state may need Odoo debug mode; fallback status remains visible.

Additional implementation files: `runtime.js` (service-worker MAIN-world probe)
and `content/technical.js` (on-demand tools UI). Include both when packaging.

Validation:

```sh
node --test tests/domain.test.cjs tests/shared.test.cjs tests/technical.test.cjs
node tests/run-browser-tests.cjs
```

The browser tests use mocked Odoo responses; they do not certify a live server or
all Odoo versions.

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
- **Never touches your data (by default)** — while **Intercept clicks** is on
  (the default), clicks on fields are intercepted before the page sees them,
  so labels never toggle checkboxes, `<select>` never opens, and no value or
  focus state is ever changed. Turning the inspector off restores completely
  normal page behavior.
- **Click-through mode (opt-in)** — turn **Intercept clicks** off and the
  panel still opens on a click, but the click reaches the page normally, so
  you can keep editing the form while inspecting it. Because the page's own
  handlers run again, this mode can change form data — it's your choice, not
  a new default. See [Data-safety mechanism](#data-safety-mechanism).
- **Your colors, your call** — a gear button in the panel header opens the
  in-panel **Settings** page: **Theme** (System / Light / Dark), an **Accent
  color** (6 tested palettes that recolor links, tabs, the primary button *and*
  the field highlights on the page), and **Density** (Comfortable / Compact).
  Previously the panel followed your OS theme with no way to override it, which
  is why it could look dark on a light system. System still follows the OS and
  now repaints live when the OS flips. Everything else — Highlight, Intercept
  clicks, Odoo Developer Mode, Show Sensitive Values, Copy format — is in the
  same page, and the popup mirrors the theme and accent so the two never
  disagree.
- **A full Settings page in its own tab** — the popup keeps the quick toggles
  it has always had, and an **All settings** button directly under **Enable
  Inspector** opens the complete settings in a real tab
  (`chrome.runtime.openOptionsPage`, so it works from a keyboard shortcut or
  the extensions list too). That page is the one place everything lives:
  Appearance, Detection, Behavior and Debug, plus **manage the sites the
  inspector auto-enables on** and a privacy summary. The **preview panel is
  the real thing** — the same stylesheet, icons and palette the actual panel
  uses, painted in an open shadow root, so what you see is what you get. It
  repaints as you change anything, and changes made in the popup show up here
  live (and the other way round), because both read the same storage.
- **Debug mode, on demand** — add **`?debug=1`** to a page's URL (or flip
  **Debug logging** in Settings) for verbose console diagnostics, plus a live
  readout in Settings of the effective theme/accent/density, the URL override
  and what was inspected. `?debug=0` forces it off, the URL always wins over
  the saved switch, and it is **never persisted** — it cannot change a
  preference on any other page, and it never enables the inspector by itself.
- **Odoo button information** — a dedicated **Button** tab tells you what a
  button will actually do: the Python method it calls (`action_send`), the
  action it opens, the `special=` built-in, whether it confirms first, and
  which record (`data-model` / `data-id`) it would act on. Buttons are
  deliberately **not** hijacked by a normal click — in the default mode a
  Save/Delete button click stays a real button click — so buttons are
  inspectable in exactly two ways: with **Intercept clicks** off, or from the
  **Field Finder**, which selects a button without pressing it.
  See [Odoo Developer Mode](#odoo-developer-mode).
- **Sensitive values redacted by default** — values belonging to password,
  hidden-token, and other secret-named fields never appear in the panel, in
  Copy All, or in JSON output unless you turn on **Show sensitive values**.
  See [Security & Privacy](#security--privacy).
- **Per-site auto-enable (opt-in)** — turn on **Auto-enable on this site** in
  the popup and the inspector starts by itself on every page you load at that
  one origin, instead of resetting to off on each navigation. Chrome asks for
  access to that origin only, the remembered sites are listed (and removable)
  in the popup, and turning it off gives the access back. Matching is exact:
  remembering `https://erp.example.com` does not imply
  `https://intranet.example.com` or `http://erp.example.com`. With it off, the
  extension requests no host access at all. See
  [Injection model](#injection-model-why-permissions-are-minimal).
- **Shadow DOM UI** — the inspector panel renders inside an isolated
  Shadow DOM tree, so host-page CSS can't distort it and the panel's CSS
  can never leak onto the page.
- **List view data cells** — click a plain table cell, not just its column
  header, to see its row/column position, text, and (on Odoo pages) the
  same live field lookup as a form field.
- **Odoo Developer Mode** (its own toggle in the popup) — when the clicked
  field belongs to an Odoo form, list, or wizard, the panel leads with a
  live **Odoo Field Definition** section: the model, the field's real ORM
  type/relation/required/readonly/stored/related/computed/help text
  straight from `ir.model.fields`, how it's actually declared in the
  current view (`widget=`, `domain=`, `context=`, `invisible=`, etc.),
  decoded selection options, a direct link to the field's own admin
  record, and a ready-to-paste `<field name="..."/>` view XML snippet.
   See [Odoo Developer Mode](#odoo-developer-mode) below.
- **Odoo version detection + version-correct deep links** — the Odoo Field tab
  shows your server's version (read once per tab), and the "Open in Odoo" link
  is built in the URL style that version actually understands: the legacy
  `/web#model=…&id=…` hash on 16 and earlier, the `/odoo/action-…` route on 17
  and later. Odoo Online/SaaS build strings are handled, and an unreadable
  version produces both links plus an explanation rather than a silent guess.
   See [Odoo Developer Mode](#odoo-developer-mode).
- **View XML IDs + inheritance chain** — a **View Stack** block tells you which
  XML ID the page is actually rendered from and what it inherits from (e.g.
  `my_addon.view_partner_form_inherit` → `base.view_partner_form`), with a
  version-correct "Open in Odoo" link for each. A rendered page can't answer
  this by itself: what you see is the merge of the whole stack.
  See [Odoo Developer Mode](#odoo-developer-mode).
- **Tabbed panel, Odoo-notebook style** — each info category (Odoo Field,
  Field Info, State, Selectors, Structure, Validation/Data/ARIA/Other
  Attributes, …) is its own tab, styled after Odoo's own form-view
  notebook (flat underlined tabs, horizontally scrollable), instead of
  one long scrolling page.
- **Color-coded type chips** — ORM type, HTML field type, and input type
  values render as color-coded pills (relational = purple, boolean =
  green, numeric = orange, date/time = teal, selection = pink,
  text-like = blue) so a field's shape is recognizable at a glance.
- **Field Finder** — indexes every field/column on the page (label +
  technical name) and filters live as you type; click a result to jump
  straight to its full inspector panel. If an Odoo wizard (dialog) is
  open, the search is automatically scoped to just that wizard's
  fields. See [Field Finder](#field-finder) below.
- **Visual Domain Builder** — compose an Odoo search domain from a
  model's real fields (labels, types, selection choices, via
  `fields_get`), combine conditions with AND/OR, and copy the result as
  a Python domain or JSON. Never applied to records — it only generates
  the filter text. See [Domain Builder](#domain-builder) below.
- **Chatter Manager** — hide a form's chatter to reclaim screen space,
  or expand it into a searchable, filterable local reader for
  already-loaded messages, internal notes, and tracked field changes.
  No network requests. See [Chatter Manager](#chatter-manager) below.
- **Floating Options menu** — a single gear-icon button (bottom-right,
  while the inspector is enabled) opens Search Fields, Domain Builder,
  Chatter Manager, Recent Fields, Highlight/Odoo Developer
  Mode/Show Sensitive Values/Intercept Clicks toggles, Copy Current Field,
  and Disable Inspector — all without opening the popup.
- **Inspection history, jump-to-element, per-tab copy** — "Recent
  Fields" in the Options menu lets you reopen any of your last few
  inspected fields; a header button scrolls the real page element into
  view and flashes it; each tab has its own "Copy Tab" button alongside
  the existing Copy All.
- **Draggable, theme-aware panel** — drag the panel by its header to
  reposition it anywhere on screen; it follows your system's light/dark
  theme automatically.

## Project Structure

```text
chrome-field-inspector/
├── manifest.json          # MV3 manifest (popup, service worker, permissions)
├── background.js          # Service worker: badge bookkeeping + per-site auto-enable
├── shared.js              # Injected first: injection list, URL/origin helpers, DEFAULT_SETTINGS,
│                         #   the panel stylesheet + icons, the light/dark palettes (popup + worker +
│                         #   content scripts + options page all read this one copy)
├── content/
│   ├── utils.js             # CSS selector / XPath generators, attribute helpers
│   ├── odoo.js              # Odoo model detection + live ir.model.fields RPC lookup
│   ├── detector.js         # Field/column detection, classification, MutationObserver
│   ├── ui.js                # Shadow DOM inspector panel (tabs, Options menu, Field Finder)
│   ├── domain.js            # Odoo domain serialization/validation (no eval, no RPC)
│   ├── domain-builder.js   # Domain Builder UI, built on domain.js + ui.js's Shadow DOM
│   ├── chatter.js           # Chatter Manager: local reader, no RPC calls
│   └── content.js          # Orchestrator: event delegation, message handling
├── content.css             # Page-level highlight styles (scoped, !important, outline-only)
├── popup/
│   ├── popup.html
│   ├── popup.js            # Quick settings + enable/disable + on-demand injection
│   └── popup.css
├── options/               # The full settings page (manifest options_ui, open_in_tab)
│   ├── options.html        # Shell: groups, live panel preview, site manager, privacy card
│   ├── options.js          # Renders the declarative GROUPS spec, previews with the real PANEL_CSS
│   └── options.css         # Page chrome, painted from the same palette as the panel
├── icons/
│   ├── icon16.png / icon32.png / icon48.png / icon128.png
│   └── icon.svg            # Vector source for the icons above (dev-only)
├── tests/                  # Dev-only: not packaged, not referenced by manifest.json
│   ├── domain.test.cjs       # node --test unit tests for content/domain.js
│   ├── shared.test.cjs       # node --test unit tests for shared.js (URLs, injection list)
│   ├── run-browser-tests.cjs # Drives the fixtures below via headless Chrome --dump-dom (the settings
│   │                         #   fixture is loaded 3x: plain, ?debug=1, ?debug=0)
│   ├── domain-builder.html   # Domain Builder integration fixture + assertions
│   ├── chatter.html          # Chatter Manager integration fixture + assertions
│   ├── click-through.html    # Click interception / click-through + value redaction fixture
│   ├── auto-enable.html      # Per-site auto-enable: enable/disable reporting contract fixture
│   ├── odoo-version.html     # Server-version probe + version-gated deep links fixture
│   ├── view-stack.html       # View XML ID + inherit chain, list-vs-form arch, fallback cases
│   ├── button-info.html      # Odoo buttons: click-safety, view-derived type/special/confirm, Finder
│   ├── settings-theme.html   # Gear → Settings page, theme/accent/density, debug URL override
│   └── options-page.html     # The tab settings: every setting, the live real-panel preview,
│                             #   storage sync, and the remembered-sites permission flow
├── docs/                   # GitHub Pages site: landing page + hosted privacy policy
│   ├── index.html            # SEO landing page (Open Graph, JSON-LD, screenshots)
│   ├── privacy.html          # Rendered copy of PRIVACY_POLICY.md, for a stable public URL
│   ├── sitemap.xml / robots.txt
│   └── assets/                # Images used only by the pages above
├── README.md
├── PRIVACY_POLICY.md       # Full privacy policy (dev-only, see below)
├── STORE_LISTING.md        # Chrome Web Store submission copy (dev-only)
└── CHECKLIST_README.md     # Internal pre-publication checklist (dev-only)
```

`README.md`, `PRIVACY_POLICY.md`, `STORE_LISTING.md`, `CHECKLIST_README.md`,
`icons/icon.svg`, `tests/`, `docs/`, and `promo/` (screenshot sources) are
documentation/dev assets — none of them are referenced by `manifest.json`,
so none of them are included in the packaged `.zip` uploaded to the
Chrome Web Store. `docs/` is served separately, as a GitHub Pages site
(see [`STORE_LISTING.md`](STORE_LISTING.md) for the exact steps to enable
it) — it's the extension's public landing page and the hosted URL for its
privacy policy, not something a Chrome user ever loads as part of the
extension itself.

Run the test suite with:

```sh
node --test tests/domain.test.cjs   # pure-logic unit tests
node --test tests/shared.test.cjs   # origin/URL logic, accent palette, ?debug= parsing, injection-list
                                    #   integrity, options-page wiring (manifest options_ui, resource paths,
                                    #   every setting having exactly one control, one shared default set)
node tests/run-browser-tests.cjs    # headless-Chrome integration checks (needs google-chrome or $CHROME_BIN)
```

## Architecture

### Injection model (why permissions are minimal)

The extension requests `storage`, `activeTab`, and `scripting` up front — **no
host permissions** — so Chrome never shows the broad "read and change all
your data on all websites" warning. The content scripts are **not** statically
registered in the manifest; instead, `popup/popup.js` injects them into the
current tab on demand (`chrome.scripting.executeScript`), the first time you
flip "Enable Inspector" in the popup for that tab. If they're already present
(checked via a lightweight `PING` message) they are not re-injected. Every
content script file is wrapped in a "already-loaded" guard so re-injection is
always safe.

`shared.js` holds the single list of files to inject, loaded by both the popup
and the service worker. That list is deliberately not duplicated: a release ZIP
once shipped without the Domain Builder and Chatter Manager because the popup's
copy of the list had fallen behind the repo, and `tests/shared.test.cjs` now
fails if the list and the `content/` directory disagree in either direction.

#### Per-site auto-enable (the one optional permission)

`activeTab` only covers the tab you clicked in, so a normal navigation drops
the inspector. To make it survive reloads, the popup offers **Auto-enable on
this site**, which is the only path that asks for access to a site:

- `manifest.json` declares `optional_host_permissions: ["http://*/*", "https://*/*"]`.
  These grant nothing until the user accepts the request.
- Checking the box calls `chrome.permissions.request()` for that **one exact
  origin** (`https://erp.example.com/*`) and stores it in
  `fiRememberedOrigins`. The request must happen directly inside the click's
  user gesture, which is why the popup requests before any `await`.
- `background.js` then watches `chrome.tabs.onUpdated` for `status ===
  "complete"`. If the tab's origin is in that list **and** Chrome still
  reports the permission as granted, it injects the shared file list and sends
  `FI_ENABLE` with your saved settings.
- Unchecking the box, or pressing **Remove** next to a remembered site, calls
  `chrome.permissions.remove()` as well as clearing storage, so the access goes
  back to Chrome and disappears from `chrome://extensions` too.

Properties worth knowing:

- **Exact-origin matching.** `https://erp.example.com` does not match
  `http://erp.example.com`, a subdomain, or a different port, because the
  granted permission is equally narrow. All of this logic lives in
  `shared.js` and is unit-tested.
- **Permission is re-checked on every load.** Revoking an optional permission
  from `chrome://extensions` doesn't touch extension storage, so the worker
  asks `chrome.permissions.contains()` before injecting. The popup also drops
  remembered entries whose permission is gone, so you never see a checkbox
  that silently does nothing.
- **Only `http`/`https` can be remembered.** A `file://` page can still be
  inspected manually (if you've allowed file access), but no host permission
  can be requested for it, so the option is disabled there rather than
  offering a setting that would never fire.
- **Opting out for one tab.** If you turn the inspector off on a remembered
  site, the worker remembers that for the current tab + origin and stays quiet
  on reloads. The inspector distinguishes a *user* disable from its own
  `pagehide` teardown via a `userInitiated` flag, so unloading a page never
  looks like "the user turned this off". Navigating that tab elsewhere, or
  closing it, clears the opt-out.
- **Default is off.** Nothing is injected anywhere until you either enable a
  tab from the popup or remember a site.

### Content script split

All `content/*.js` files load into the **same isolated world** (per
Chrome's content-script execution model), in the order declared in
`shared.js`'s `CONTENT_FILES`, so top-level `const`/functions declared in
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

Both `preventDefault()` calls are gated on the **Intercept clicks**
setting (`interceptClicks`, default `true`). With it off, the inspector
still resolves the click and opens the panel, but the event continues to
the page, so the form stays usable while you inspect it. The setting is
available in the popup ("Click Behavior") and in the on-page options
menu.

One click-through caveat: Odoo often re-renders a form after a change
fires an `onchange`. The panel is built from the element as it was when
the click resolved, so **Jump to element** can do nothing if that node
was replaced a moment later (`ui.jumpToElement` silently skips detached
nodes rather than jumping somewhere wrong).

## Odoo Developer Mode

When the clicked field lives inside an Odoo form, list, **wizard**
(dialog), or table cell, the panel adds a live **Odoo Field Definition**
section sourced straight from the Odoo server, instead of guessing from CSS
classes alone. It has its own toggle in the popup ("Odoo Developer Mode"),
separate from the general Enable Inspector switch — turn it off and every
Odoo-specific lookup below is skipped entirely, with no network activity.

- **Model detection** (`content/odoo.js`, `runtime.js`): a service-worker-mediated
  MAIN-world probe reads the containing OWL record/controller without changing it.
  Scoped DOM and URL fallbacks remain available. Resource Timing is a labelled
  heuristic only, with inspector-generated requests excluded. A wizard with no
  readable context does not inherit its background page's record identity.
- **Field lookup**: an `ir.model.fields.search_read` call
  (`{model, name} → field_description, ttype, relation, required,
  readonly, store, related, compute, help, selection`) resolved against
  that model + the field's technical name (read off Odoo's own
  `.o_field_widget[name="..."]` wrapper, or a list view's `<td name="...">`
  / `<th data-name="...">`). Results are cached per (model, field, context) for the
  life of the page. A direct **"Open in Odoo"** link to the field's own
  `ir.model.fields` record (Settings → Technical → Fields) is included.
- **Server version, and version-correct deep links**: one
  `ir.config_parameter.get_param` read of `web.base.build.description`
  (falling back to `web.base.build.version`) — a parameter every Odoo since
  8 has shipped, at most once per tab — yields the server's version, shown
  as a **Server Version** row in the Odoo Field tab. It matters because Odoo
  **17 replaced** the `/web#model=…&id=…` hash URLs with
  `/odoo/action-<xmlid>` routes, so a hardcoded legacy link is a dead page on
  a modern server and an `/odoo/…` link 404s on an older one:
  - version **≥ 17** → `/odoo/action-base.action_ir_model_fields?active_id=<id>`
  - version **≤ 16** → `/web#model=ir.model.fields&id=<id>&view_type=form`
  - version **unknown** (non-Odoo page, RPC blocked, unusual build string) →
    the conservative legacy link, *plus* the 17+ field-list link and a note
    explaining why both are offered. It never silently guesses.
  - Odoo Online/SaaS build strings (`saas~17.2`) are parsed for their major
    version, so they're classified like any other.
  - Copy All and Copy Tab use the same version-gated link as the panel, so
    pasted text doesn't rot on a newer server.
- **Declared-in-this-view attributes**: a second, independent lookup
  (`get_views` on the model, using the detected view ID and context, or an explicitly labelled default
  **form** or **list** view fallback) finds how the field is actually declared in that view
  — `widget=`, `domain=`, `context=`, `invisible=`, `required=`, `readonly=`,
  `options=`, `groups=` — the overrides `ir.model.fields` alone can't show,
  since that's only the model-level definition. When a field appears more than
  once in the arch (e.g. it's also a column in an embedded one2many
  sub-view), the least-nested match is preferred, since a deeply-nested one is
  more likely to belong to the sub-view than the field actually clicked.
  The list view type is retried as both `list` and `tree` for version compatibility.
- **View XML IDs and the inheritance chain**: the **View Stack** block answers
  "which XML ID am I actually looking at, and what does it inherit from?" — the
  question a rendered page cannot answer on its own, because what you see is
  the *merge* of a whole view stack:
  - the selected view's record ID comes from the same `get_views` response;
    when runtime view ID is unavailable, the panel labels this as the default view;
  - `ir.ui.view.inherit_id` is walked upward, so every ancestor is listed by
    its own external ID — e.g. your `my_addon.view_partner_form_inherit` on
    top of `base.view_partner_form`, which is exactly what you need when a
    custom view is overriding a standard one;
  - all those IDs are resolved to XML IDs in **one** `ir.model.data` request,
    because that is the only reliable way to get an external ID for a record;
  - each view in the stack gets its own version-correct **Open in Odoo** link
    (Settings → Technical → Views), so you can jump straight to the one you
    suspect;
  - the chain is depth-capped and cycle-guarded, and if a view is unreadable
    for your user (record rules on `ir.ui.view`) the chain is reported as
    *incomplete* rather than failing the whole lookup;
  - a view created in the UI rather than in a data file has no external ID at
    all — that's shown as "no external ID" instead of being hidden.
  - It deliberately does **not** download every ancestor's `arch_db`: a view
    arch can be hundreds of KB. The panel lists the selected view and its ancestors, which is not a complete
    list of contributing extension views. It does not attribute one field
    node to one XML file.
- **Button information** (Odoo Developer Mode on, button inspected): a button
  has no `ir.model.fields` row, so no field lookup is made at all. Instead the
  same `get_views` arch is searched for the `<button name="…">` declaration,
  which is where the interesting attributes actually live:
  - the rendered DOM does **not** keep Odoo's `type=`, `special=` or
    `confirm=` — Odoo's web client consumes them and renders a plain
    `type="button"`. So the panel takes `type`/`special`/`confirm` from the view
    and labels the DOM's `type` for what it is (the HTML type). A button whose
    view declaration can't be read says so instead of guessing;
  - `type="object"` vs `type="action"` is explained in words, and a
    `%(xml_id)` value is recognised as an action reference rather than reported
    as a method name you could go looking for in Python;
  - `groups=`, `invisible=`, `readonly=` and friends come from the arch, which
    is the only place they exist — the DOM only ever shows their *result*;
  - `data-model` / `data-id` come from the DOM, because they only exist while a
    record is open — that's the record the action would run against;
  - the same least-nested rule as fields applies: a Save button declared both in
    the form and in an embedded sub-view reports the form's declaration, with
    the duplicate count shown.
- **Non-blocking**: the panel opens instantly with everything derivable
  from the DOM; each Odoo sub-section shows its own "Looking up…" state
  and fills in independently as its network response lands. Clicking a
  different field while a lookup is still in flight invalidates it
  (`ui.beginOdooLookup`/`applyOdooFieldMeta`/`applyOdooViewAttrs` token
  check) so a slow, stale response can never overwrite whatever field
  you're looking at by the time it arrives.
- **Selection fields**: `ir.model.fields.selection` comes back from Odoo as
  a Python-literal string (e.g. `"[('draft','Draft'),('done','Done')]"`);
  it's parsed into a readable key/label list.
- The panel also offers a ready-to-paste `<field name="..."/>` view XML
  snippet for the field.
- **List view data cells**: clicking a plain (non-editable) table cell —
  not just its column header — now opens a "List / Cell" panel with the
  column name, row/column index, and the same live Odoo lookup above when
  the cell carries a field name (Odoo's list view renders
  `<td name="...">` directly, same pattern as everywhere else).
- This is the one path in the extension that talks to a server — see
  [Security & Privacy](#security--privacy) — and it's the one covered by
  its own popup toggle, off switches this whole section off.

## Field Finder

A floating search button (bottom-right, while the inspector is enabled)
opens a page-wide search panel for every field/column the extension can
see — useful for a form with more fields than you can scan by eye, or
for finding a field by its technical name without knowing where it is
on the page.

- **Indexing** (`detector.listAllFields`): scans for every
  `.o_field_widget[name]` (Odoo form fields), `<th data-name="...">`
  (Odoo list columns), and, as a fallback for non-Odoo pages, any plain
  form control with a `name`/`id`. Each entry records its label and
  technical name; invisible elements (`utils.isVisible`) are skipped.
- **Live filtering**: matches the query as a case-insensitive substring
  of *either* the label or the technical name — search "email" or
  search `email` (the field name) and both find the same field.
- **Wizard-scoped search** (`detector.findOpenWizard`): if an Odoo
  dialog/wizard is currently open (`.o_dialog:not(.o_inactive_modal)` or
  a plain `.modal.show`, whichever the page uses), opening the finder
  automatically scopes the index to just that wizard's fields instead of
  the whole page — shown via a badge with the wizard's own title, and a
  matching search placeholder. Closing the wizard and reopening the
  finder falls back to the whole page automatically.
- **Selecting a result** re-uses the exact same code path as clicking
  the field directly on the page (`inspectElement` in `content.js`) —
  same info panel, same live Odoo lookups — so the finder is a shortcut
  to a field, not a separate/lesser inspection mode. The finder itself
  stays open afterwards so you can keep searching.
- **Esc** closes the finder first if it's open, then the inspector panel
  on a second press, so they don't fight over the same key.

## Chatter Manager

With the inspector enabled, open **Options → Chatter Manager** on an Odoo form
with supported chatter. The action is omitted on other pages and when the
active dialog has no chatter.

- **Hide / Show Chatter** collapses the form's chatter container locally.
- **Expand Chatter** enlarges the manager's read-only message reader.
- Search loaded messages by author or body; filter messages, internal notes,
  and tracked changes. Unclassified messages remain visible in type filters.
- **Jump to Latest** clears filters, reveals the native chatter, and scrolls to
  the newest loaded message. Timestamps or message IDs are used when available;
  otherwise the reader follows Odoo chatter's newest-first order.
- **Copy Message** copies author, displayed date, and message text as plain text.
- **Reset Layout** restores chatter visibility, reader size, search, and filters.

The reader works with messages already rendered by Odoo, including email text
in accessible open Shadow DOM roots. It does not fetch older messages, send,
edit, or delete messages, or alter followers/activities. **Refresh** rescans
loaded content. Closing the manager preserves its layout choices for the
current record; disabling the inspector or changing records restores them.
Draft composer text is excluded from the reader and copied messages.

`content/chatter.js` contains detection, the reader, and lifecycle cleanup;
`content.css` supplies removable visibility/highlight classes. Detection uses
modern `.o-mail-Chatter` / `.o-mail-Message` and legacy `.o_Chatter` /
`.o_Message` markup. Reference templates: [Odoo 18 chatter](https://github.com/odoo/odoo/blob/18.0/addons/mail/static/src/chatter/web/chatter.xml)
and [Odoo 16 messages](https://github.com/odoo/odoo/blob/16.0/addons/mail/static/src/components/message/message.xml).
Custom markup or translated message-type labels may remain unclassified.
Browser checks cover representative modern/legacy forms, dialogs, record
changes, and cleanup; compatibility with a live Odoo instance still needs verification.

## Domain Builder

Enable the inspector, open the floating Options button, and choose **Domain Builder**.
Add conditions, select **Match all (AND)** or **Match any (OR)**, then copy the
Python domain or JSON representation. The preview follows [Odoo search-domain
syntax](https://www.odoo.com/documentation/19.0/developer/reference/backend/orm.html#search-domains).
This version supports one all/any group; nested groups are not yet supported.

The model name is prefilled when detected and can be edited. **Load Fields**
fetches field labels, technical names, types, and selection choices using
`fields_get` on the same Odoo server, with the existing session. This requires
Odoo Developer Mode. Loading a different model resets the conditions. Without
metadata access, technical names (including dotted relational paths) and value
types can be entered manually.

Boolean values, numeric values, record IDs, dates, UTC datetimes, selection
keys, and JSON lists for `in`/`not in` are supported. Invalid values prevent
copying. **Is set / is not set** generates comparisons against `False`.
Domains are generated locally; they are not executed or applied to records.
Drafts remain in tab memory until navigation/reload, and closing the builder
preserves the draft. Disabling the inspector closes the builder.

The implementation lives in `content/domain.js` (serialization/validation) and
`content/domain-builder.js` (UI), loaded after `ui.js` and before `content.js`.
Run validation with:

```sh
node --test tests/domain.test.cjs
node tests/run-browser-tests.cjs
```

The browser checks use headless Chrome with mocked extension APIs and Odoo
metadata. Set `CHROME_BIN` if the executable is not named `google-chrome`.

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

Your Form View / List View / Highlight / Copy Format / Odoo Developer
Mode / Show Sensitive Values / Intercept Clicks preferences persist across
sessions via `chrome.storage.local` and apply live if you change them
while the inspector is already enabled on a tab. Theme, Accent and Density
live there too.

The popup is deliberately small: the quick toggles, and an **All settings**
button under **Enable Inspector** that opens the full settings in its own
tab (Appearance, Detection, Behavior, Debug, the auto-enable sites, and a
privacy summary, with a live preview of the real panel). Both surfaces read
and write the same storage, so a change made in one appears in the other
immediately — you never have to think about which one is "the" settings.

The list of origins you chose for auto-enable is stored separately in
`fiRememberedOrigins` in the same local storage, and is shown with a
**Remove** button both in the popup and in the full settings tab. Adding a
site there asks Chrome for that **one** origin's permission and nothing
else.

To work the form while inspecting it, turn **Intercept clicks** off
(click-through mode). The default is on, so clicking fields can't change
anything until you opt out.

## Security & Privacy

See [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) for the full policy (what's
collected — nothing, by default — and exactly what the Odoo Developer
Mode exception sends and to whom). Summary:

- All field/column analysis happens **entirely client-side**, inside the
  content script running in your tab. Nothing about the page — its HTML,
  field values, or your interactions — is ever sent anywhere, **except**
  the Odoo Developer Mode lookups described above: when (and only when) a
  clicked field is recognized as an Odoo field, its model and technical
  field name are sent, via an `ir.model.fields` RPC call, to the **same
  Odoo server the page is already on** — using your existing logged-in
  session (same-origin `fetch`, no separate credentials, no third-party
  endpoint) — along with one hard-coded configuration key name
  (`web.base.build.description`) to read your server's version. No field
  *values*, page content, or browsing activity are ever included in those
  calls.
- The extension does **not** track browsing activity, does **not** collect
  analytics, and does **not** store page content anywhere (not even
  locally) — `chrome.storage.local` is used only for your UI
  preferences (Form View / List View / Highlight / Copy Format / Odoo
  Developer Mode / Show Sensitive Values / Intercept Clicks) and, if you opt
  in, the list of origins you chose to auto-enable on. The Odoo
  field-metadata cache lives only in memory for the life of the tab.
- **No host permissions are requested up front.** The content scripts only run
  in a tab after you explicitly enable the inspector for it via the popup
  (`activeTab` + `scripting`), and they stop running the moment you navigate
  away or disable the inspector.
- The one exception is the permission **you** can grant per site: turning on
  **Auto-enable on this site** makes Chrome ask for access to that single
  origin, after which the inspector is injected automatically on page loads
  there. It's used for nothing else, it's optional, it's listed with a
  **Remove** button in the popup, and turning it off removes the permission
  from Chrome entirely. Nothing about the page is stored or transmitted by
  remembering a site — the entry is just the origin string. See
  [Injection model](#injection-model-why-permissions-are-minimal).
- The extension never submits forms and never programmatically changes a
  field's value, checked state, or focus. With **Intercept clicks** on
  (the default) the page's own handlers don't see field clicks either. With
  it off — click-through mode — clicks reach the page normally, so the
  form can change exactly as it would without the extension. That is the
  point of the mode, and the reason it isn't the default.
- Values of **password, hidden-token and other secret-named fields** are
  redacted before they reach the panel, Copy All, JSON output, or the
  Recent Fields cache, unless **Show sensitive values** is explicitly
  turned on. Redaction happens while the field's info object is built, so
  there is no rendering path that could show a secret the detector marked.

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

13. **Field Finder**
    - With the inspector enabled, click the floating search button
      (bottom-right).
    - Type part of a field's label, then clear it and type part of a
      technical name instead.
    - Expected: results filter live either way; clicking a result opens
      that field's full inspector panel (same as clicking it directly).

14. **Tabs, chips, and panel controls**
    - Open the panel on an Odoo field with a relational (many2one) type.
    - Expected: an "Odoo Field" tab with a purple `many2one` type chip;
      switching tabs swaps content without closing the panel; the header
      button scrolls to and flashes the real element; dragging the
      header repositions the panel.

15. **Click-through mode**
    - With the inspector enabled, click a checkbox that has a real page
      click handler (e.g. a "remember me" box).
    - Expected: the checkbox does **not** toggle (Intercept clicks is on
      by default) and the panel opens.
    - Turn **Intercept clicks** off in the popup (or in the on-page options
      menu), then click the same checkbox again.
    - Expected: the checkbox toggles normally *and* the panel opens —
      the form stays usable while inspecting.
    - Turn Intercept clicks back on; the checkbox stops toggling again.

16. **Sensitive value redaction**
    - Open a page with a login form and click the password input.
    - Expected: Current Value and Default Value both read
      `(redacted — sensitive field)`, the HTML preview shows no real
      value, and a note explains why. **Copy All** in both plain text and
      JSON contains no part of the password.
    - Repeat on a hidden input whose name contains `csrf`/`token`, and on
      an ordinary field (e.g. an email input): ordinary values still show.
    - Turn **Show sensitive values** on. Expected: the password is now
      displayed; turn it back off and the Recent Fields entry is
      re-redacted too.

17. **Per-site auto-enable**
    - Open the popup on an Odoo (or any) site and turn on **Auto-enable on
      this site**.
    - Expected: Chrome shows its permission prompt for that origin only;
      after accepting, the checkbox is checked and the origin appears in the
      list below it.
    - Reload the page (F5). Expected: the badge shows "ON" on its own, with
      no need to open the popup, and the highlighted fields are back.
    - Use **Disable Inspector** (popup or on-page menu) and reload again.
      Expected: it stays off for that tab. Navigate that tab to a different
      site and back, or close the tab. Expected: auto-enable applies again.
    - Open the popup and press **Remove** next to the remembered origin.
      Expected: the entry disappears, and `chrome://extensions` no longer
      lists site access for Field Inspector.
    - Open the popup on a different origin (e.g. a subdomain) and confirm
      **Auto-enable on this site** is unchecked there.

18. **Odoo version + deep links**
    - On an Odoo 17+ instance, enable the inspector and click an Odoo field.
    - Expected: the Odoo Field tab shows a **Server Version** row, and
      "Open in Odoo" points at `/odoo/action-base.action_ir_model_fields`
      (not `/web#model=…`). Click it: the field's record opens in a new tab.
    - Repeat on Odoo 16 or earlier. Expected: the link is the legacy
      `/web#model=ir.model.fields&id=…` shape and still opens the record.
    - Copy All with the panel open and check the pasted **Field Record** line
      uses the same URL style as the link.
    - Turn **Odoo Developer Mode** off, click a field. Expected: no version
      row, no link, and no request to the server (check the Network tab).

19. **Theme, accent and debug**
    - Click the **gear** in the panel header. Expected: a Settings page opens
      with Appearance (Theme / Accent color / Density), Behavior (every existing
      toggle) and Debug.
    - Pick **Dark**, then **Light**. Expected: the panel repaints immediately,
      and the choice is remembered after a disable/enable round trip.
    - Pick **Teal**. Expected: links, the active tab, the primary button *and*
      the dashed outline the extension draws around detected fields all change
      together — hover a field to see the solid hover outline and tint follow.
    - Choose **System**, then flip your OS light/dark. Expected: the panel
      repaints live, with no reload.
    - Open a page with `?debug=1`. Expected: console diagnostics appear and the
      Settings → Debug switch shows "on" but is **disabled**, explaining that the
      URL forced it. Now try `?debug=0`. Expected: the opposite, and the saved
      switch is ignored in both directions.
    - Disable the inspector. Expected: the accent is removed from the page
      (`<html>` carries no leftover `data-fi-accent`), so the host page is left
      exactly as it was found.
20. **Odoo button information**
    - On a form, click **Save** with the default settings. Expected: the button
      acts normally and **no** panel opens — a normal click is never hijacked.
    - Turn **Intercept clicks** off and click it again. Expected: the panel
      opens on a **Button** tab showing `Calls Method: action_save`, the
      `object` type, and `data-model`/`data-id` for the record.
    - With Odoo Developer Mode on, open its **Odoo View** tab. Expected:
      `groups=`, `invisible=` and `classname=` appear even though the rendered
      button has none of them, plus the view's XML ID.
    - Try a button with a `confirm=` dialog and one with `special="discard"`.
      Expected: a warning line naming the confirmation text, and an explanation
      that a `special=` button is framework behaviour.
    - Open the Field Finder (floating button → search). Expected: Odoo buttons
      are listed with a `Button` tag, and selecting one opens its panel
      **without the button being pressed**.
21. **View XML IDs + inherit chain**
    - On a form, click any field. Expected: a **View Stack** block shows the
      active view's XML ID (e.g. `base.view_partner_form`) and, if a custom
      module extends it, the chain beneath it (e.g. `my_addon.
      view_partner_form_inherit`). Each has an **Open** link that lands on
      Settings → Technical → Views.
    - Click a **list column** or a list data cell. Expected: the View Stack
      names the list view's own XML ID (not the form view's), and
      "Declared In Current View" says **(list)**, not (form).
    - Check the Network tab. Expected: one `get_views`, one `ir.ui.view.read`
      per ancestor, and exactly **one** `ir.model.data.search_read` for the
      whole chain — no `arch_db` downloads.
    - If your user can't read an ancestor view, Expected: the chain is marked
      "incomplete" and the active view is still shown.
22. **The full settings tab**
    - Open the popup and click **All settings** (directly under **Enable
      Inspector**). Expected: a real browser tab opens — not a small popup —
      showing Appearance, Detection, Behavior and Debug, a live panel preview,
      a sites section and a privacy card.
    - Change **Theme** to Dark, then pick **Pink**. Expected: the previewed
      panel repaints as you click, the page's own controls re-tint to the same
      accent, and the state line names the resolved theme and accent.
    - Reopen the popup and change the theme there while the settings tab is
      still open. Expected: the tab updates itself, controls included.
    - Pick **System** and flip your OS light/dark. Expected: the preview *and*
      the accent swatches both follow, with no reload.
    - Paste a site such as `https://erp.example.com/web/webclient#home` under
      the auto-enable sites and add it. Expected: Chrome asks for that **one**
      site, it appears in the list, and the input clears. Paste `*` or an
      address with a password in it: Expected: refused, with nothing requested.
      Add the same site again: Expected: **no** second permission prompt.
    - Remove a site. Expected: the permission is handed back and the row
      disappears.

## Extending

- **New accent color**: add one entry to `ACCENTS` in `shared.js` with a
  `light` and a `dark` object (same keys — `tests/shared.test.cjs` enforces
  that, and checks `strong` is dark enough for white text). The settings
  picker, the popup swatches, the panel and the page highlights all read from
  that one table, so nothing else needs touching.
- **New setting**: add the key to `DEFAULT_SETTINGS` in
  `content/content.js` *and* `popup/popup.js`, render a control in
  `ui.settingsBodyHtml` (every control carries `data-setting`, and the click
  handler in `ensureHost` routes it through `ui.onOptionSetting`, so
  persistence and tab-to-content syncing come for free).
- **New field pattern**: add a selector to `FORM_CONTROL_SELECTOR` (or a
  new branch in `describeFieldType`) in `content/detector.js`.
- **New button pattern**: add a selector to `ODOO_BUTTON_SELECTOR`; the
  button branch of `resolveInspectable` only runs when **Intercept clicks**
  is off, and `listAllFields` indexes the same selector for the Field
  Finder. Buttons read their `type`/`special`/`confirm`/`groups` from the
  view via `odoo.fetchViewNodeAttrs(model, "button", nameAttr, viewType)`.
- **New element kind**: add the kind in `detector.js`, dispatch it in
  `content.js`'s `inspectElement`, and add a `render<Kind>Info` tab in
  `ui.js` (`shortLabelFor`, `updateBadge`, `buildCopyAllText` and
  `finderKindLabel`/`finderKindPill` all have per-kind branches).
- **New info field**: add it to the object returned by
  `buildFormFieldInfo`/`buildColumnInfo`/`buildDataCellInfo`/
  `buildButtonInfo` in `content/detector.js`, then render it via the
  `row(...)` helper inside the relevant tab in `content/ui.js`'s
  `renderFormInfo`/`renderListInfo`/`renderDataCellInfo`/`renderButtonInfo`
  — each of those returns an array of `{ title,
  icon, html }` tab objects; `row(...)` output gets wrapped in `table(...)`
  for the bordered/striped look, and `kvTable(...)`/`attrList(...)` do the
  same for key/value lists (attributes, selection options). Add a new tab
  by pushing another entry onto that array; `renderBody`/`renderPanelBody`
  and `renderTabsBar` handle rendering whichever tab is active without
  further changes.
- **New popup setting**: add the control to `popup/popup.html`, read/write
  it in `popup/popup.js`'s `applySettingsToUI`/`onSettingChange`, and
  consume it from `state.settings` in `content/content.js` /
  `content/detector.js`.
- **New setting (the full page)**: add the key and its default to
  `DEFAULT_SETTINGS` in `shared.js` (that one object is the only source of
  truth — the popup, the panel and the settings tab all read it), then add
  one entry to the `GROUPS` spec in `options/options.js`. That spec is
  declarative: `segmented`, `choice` (swatches), `switch` and `select` all
  read and write the key verbatim, so a control needs no other wiring.
  `tests/shared.test.cjs` fails if a key in `DEFAULT_SETTINGS` has no row
  (or two), which is the failure mode worth catching at review time rather
  than in a shipped settings tab.
- **New palette colour**: both palettes live in `PALETTE` in `shared.js` and
  both surfaces are generated from it, so a new `--fi-*` variable reaches the
  panel *and* the settings page with no second edit. Accent-specific
  variables are the exception — `applyThemeVars` paints those as inline
  custom properties on the panel host and on `:root`.
- **New Odoo view metadata**: `odoo.fetchViewStack(model, viewType)` in
  `content/odoo.js` resolves the active view + its `inherit_id` chain and
  their external IDs; render it with `renderViewStackBlock(info)` in
  `content/ui.js`. Both are cached per `model:viewType`, and the same
  `fetchViewArch` result backs `fetchViewFieldAttrs`, so adding a new
  view-level lookup costs no extra request.
- **New Odoo field metadata**: add the ORM field to `FIELD_META_FIELDS` in
  `content/odoo.js`, then render it in `renderOdooTabContent` in
  `content/ui.js`. Any new content script file must also be added to
  `CONTENT_FILES` in `shared.js` (in load order) or it will never be
  injected; `tests/shared.test.cjs` fails until you do.
- **New Field Finder source**: add another `scope.querySelectorAll(...)`
  branch to `detector.listAllFields` in `content/detector.js` — it already
  accepts an optional root element, so a scoped (e.g. wizard-only) search
  works automatically as long as your new selector is queried against
  the `scope` parameter, not `document` directly.
