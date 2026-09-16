# Chrome Web Store listing — copy-paste reference

Everything below is drafted text for the [Chrome Web Store Developer
Dashboard](https://chrome.google.com/webstore/devconsole/) submission form.
Nothing here is uploaded automatically — paste each field into the matching
box when you submit.

## Store listing tab

**Extension name** (verify availability — CWS names must be unique):
```
Odoo Field Inspector
```

**Summary** (132 char max, shown under the name in search results):
```
Click any form field or table column to inspect its HTML, CSS selector, XPath, and (on Odoo pages) live field definitions.
```
132/132 characters — trim if the dashboard counts differently.

**Category:** Developer Tools

**Language:** English

**Description** (main listing body):
```
Odoo Field Inspector turns any web page into a live HTML reference. Click a
form field's label or a table's column header and a developer-tool style
panel slides in with everything about it: element type, id/name, classes,
current and default value, required/read-only/disabled state, validation
and ARIA attributes, a working CSS selector, an XPath, its parent element,
and the owning <form>.

FORM VIEW
Click a <label>, <input>, <select>, <textarea>, checkbox/radio,
contenteditable field, or an ARIA-labelled custom control.

LIST VIEW
Click a <th> or [role="columnheader"] to see the column name, index,
attributes, selector, and a sample of the input control used in that
column. Click a plain data cell instead of the header to see its row/
column position and (on Odoo pages) the same live field lookup below.

BUILT FOR ODOO DEVELOPERS
When a clicked field belongs to an Odoo form, list, or wizard, the panel
leads with a live Odoo Field Definition pulled straight from that Odoo
server: the model, the field's real ORM type, relation, required/
readonly/stored state, help text, decoded selection options, how the
field is actually declared in the current view (widget=, domain=,
context=, invisible=, required=, ...), a direct link to the field's own
admin record, and a ready-to-paste <field name="..."/> view XML snippet.
No more guessing a field's technical name from CSS classes. This has its
own on/off toggle in the popup, separate from the general inspector
switch, and follows your system's light/dark theme.

FIELD FINDER
A floating search button opens a page-wide search: filter every field
and list column on the page by label or technical name, live as you
type, then click a result to jump straight to its full inspector panel.
If an Odoo wizard (dialog) is open, the search automatically scopes to
just that wizard's fields.

NEVER TOUCHES YOUR DATA
While inspecting, clicks on fields are intercepted before the page sees
them — labels never toggle checkboxes, <select> never opens, and no
value or focus state ever changes. Turn the inspector off and the page
behaves exactly as it did before.

PRIVACY
Everything runs locally in your browser. The one exception: the Odoo
field lookup above, which — only for fields recognized as Odoo fields —
asks the SAME Odoo server you're already logged into for that field's
definition, using your existing session. No field values, browsing
history, or personal data are ever sent, and there is no server or
analytics of ours in the loop at all. Full privacy policy:
<PRIVACY POLICY URL — see below>

No host permissions are requested, so Chrome never shows the broad
"read and change all your data on all websites" warning: content scripts
only run on a tab after you explicitly enable the inspector for it.
```

## Privacy practices tab

**Privacy policy URL:**
```
<PUBLISH PRIVACY_POLICY.md AND PASTE ITS URL HERE>
```
The full policy now lives in this repo as [`PRIVACY_POLICY.md`](../PRIVACY_POLICY.md)
— CWS requires a stable, publicly reachable URL, not a repo file path, so
publish it before submitting. Two easy options:
- **GitHub Pages**: enable Pages for this repo (Settings → Pages), then
  use `https://<you>.github.io/<repo>/PRIVACY_POLICY.md` (or render it
  through a Jekyll/plain-HTML page if you want it styled).
- **Raw GitHub URL**: `https://raw.githubusercontent.com/<you>/<repo>/main/PRIVACY_POLICY.md`
  works too — plain text, but always reachable as long as the repo is
  public.

If you ever change what data the extension sends (e.g. adding a new
Odoo RPC lookup), update `PRIVACY_POLICY.md` first — the "Changes to
this policy" section commits to that.

**Single purpose description** (CWS requires this in plain language):
```
Odoo Field Inspector's single purpose is to let a developer click a form
field or table column on any web page and see its HTML structure,
attributes, CSS selector, and XPath in an on-page panel. On Odoo pages
it additionally fetches that field's real definition from the same Odoo
server, for the same inspection purpose.
```

**Permission justifications** (one text box per permission in the dashboard):

| Permission | Justification text |
|---|---|
| `activeTab` | Needed so the inspector can be injected into the current tab only after the user explicitly clicks the toolbar icon and enables it — not on every site automatically. |
| `scripting` | Needed to inject the inspector's content scripts into the active tab on demand, when the user turns "Enable Inspector" on in the popup. |
| `storage` | Needed to save the user's inspector preferences (Form View / List View / Highlight / Copy Format / Odoo Developer Mode) locally via `chrome.storage.local`, so they persist between sessions. |

**Data usage disclosure** (checkboxes in the "Data collected" section):
- Check **Website content** — because the Odoo lookup reads/sends a
  field's technical name and model name (see Privacy policy above).
- Leave every other category unchecked (no personal info, location,
  health, financial, auth info, personal communications, web history,
  or user activity is collected).
- Check all three certification boxes: not sold to third parties, not
  used for purposes unrelated to the extension's single purpose, not
  used to determine creditworthiness or for lending.

## Graphic assets

| Asset | Requirement | Status |
|---|---|---|
| Store icon | 128×128 PNG | ✅ `icons/icon128.png` (bundled in the package; also upload separately if the dashboard asks) |
| Screenshot(s) | 1280×800 or 640×400, at least 1, up to 5 | ✅ 3 screenshots at 1280×800, all generated from the real extension (not hand-drawn mockups) |
| Small promo tile | 440×280 PNG, optional | Not created — optional, skip unless you want one |
| Marquee | 1400×560 PNG, optional | Not created — optional, only needed if Google features the extension |

Current screenshots (`promo/`):
1. `screenshot_1_panel.png` — the tabbed panel's Odoo Field tab on a many2one
   field: model/type/relation, the `many2one` type chip, "Declared In
   Current View", and the "Open in Odoo" link.
2. `screenshot_2_finder.png` — the Field Finder open and unfiltered,
   showing every form field and list column it detected with their
   technical names.
3. `screenshot_3_popup.png` — the popup (Enable Inspector, Detection
   Modes, Odoo Developer Mode) composited into a browser-chrome mockup;
   the popup itself is the real rendered extension UI, only the
   surrounding browser frame/page behind it is illustrative.

All three use a self-contained demo HTML page (fabricated Odoo-style
markup + fabricated field metadata), not a real Odoo instance or real
data — safe to regenerate any time after a UI change. Consider swapping
in 1–2 screenshots from your own live Odoo instance before submitting,
since only you can log into it.

## Package

Upload `field-inspector-v1.3.0.zip` (rebuilt after the tabbed panel,
colored type chips, table-styled rows, draggable panel, inspection
history, jump-to-element, per-tab copy, and the Field Finder — including
wizard-scoped search — were added, plus the new icon set). It contains
only the files `manifest.json` references: `manifest.json`,
`background.js`, `content/`, `content.css`, `popup/`, `icons/*.png`.
`README.md`, `PRIVACY_POLICY.md`, `STORE_LISTING.md`, `icons/icon.svg`,
and `promo/` are dev-only and intentionally excluded from the package.

## Before you submit

1. One-time $5 Chrome Web Store developer registration fee (if you
   haven't already registered a developer account).
2. Confirm the "Odoo Field Inspector" name isn't already taken — if it is,
   pick a variant (e.g. "Field Inspector for Odoo") and update
   `manifest.json`'s `name` to match before rebuilding the zip.
3. Load-unpacked test the exact zipped contents one more time (not just
   your working directory) to make sure nothing needed got excluded.
4. The three `promo/` screenshots are current as of the tabbed-panel,
   colored type chips, and Field Finder UI. Regenerate them (or add
   real-Odoo ones) if the panel's look changes again before submitting.
5. Publish `PRIVACY_POLICY.md` somewhere publicly reachable (see
   **Privacy practices tab** above) and paste that URL into both the
   dashboard's privacy policy field and the description's placeholder —
   the submission will be rejected without a working privacy policy URL.
6. Submissions that request no host permissions and have a clear single
   purpose (this one) typically review faster, but first-time developer
   accounts can still take several business days.
