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
column.

BUILT FOR ODOO DEVELOPERS
When a clicked field belongs to an Odoo form, list, or wizard, the panel
leads with a live Odoo Field Definition pulled straight from that Odoo
server: the model, the field's real ORM type, relation, required/
readonly/stored state, help text, decoded selection options, and a
ready-to-paste <field name="..."/> view XML snippet. No more guessing a
field's technical name from CSS classes.

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
https://claude.ai/code/artifact/0e2a1716-6fc9-48a5-bb64-c0632073351a
```
This is a Claude Artifact page generated for this submission. If you'd
rather host it yourself (e.g. on GitHub Pages, so it isn't tied to a
Claude account), copy its content into your own repo/site and use that
URL instead — either is fine for CWS review as long as the URL stays
reachable indefinitely.

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
| `storage` | Needed to save the user's four inspector preferences (Form View / List View / Highlight / Copy Format) locally via `chrome.storage.local`, so they persist between sessions. |

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
| Screenshot(s) | 1280×800 or 640×400, at least 1, up to 5 | ✅ `promo/screenshot_1_panel.png` (1280×800) — generated from the real extension, not a mockup |
| Small promo tile | 440×280 PNG, optional | Not created — optional, skip unless you want one |
| Marquee | 1400×560 PNG, optional | Not created — optional, only needed if Google features the extension |

Consider adding 1–2 more real screenshots before submitting — e.g. the
List View panel on a `<th>`, and the Odoo Field Definition section on an
actual Odoo record (recommended: a screenshot from your own Odoo
instance, since only you can log into it).

## Package

Upload `field-inspector-v<version>.zip` (built alongside this file — see
the packaging step in the conversation that produced it). It contains
only the files `manifest.json` references: `manifest.json`, `background.js`,
`content/`, `content.css`, `popup/`, `icons/`. `README.md` and this file
are dev-only and intentionally excluded from the package.

## Before you submit

1. One-time $5 Chrome Web Store developer registration fee (if you
   haven't already registered a developer account).
2. Confirm the "Odoo Field Inspector" name isn't already taken — if it is,
   pick a variant (e.g. "Odoo Field Inspector for Odoo") and update
   `manifest.json`'s `name` to match before rebuilding the zip.
3. Load-unpacked test the exact zipped contents one more time (not just
   your working directory) to make sure nothing needed got excluded.
4. Submissions that request no host permissions and have a clear single
   purpose (this one) typically review faster, but first-time developer
   accounts can still take several business days.
