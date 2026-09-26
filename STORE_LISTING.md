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

**Summary** (132 char max, shown under the name in search results — the
single most search-weighted field after the extension name, so it leads
with "Odoo" and the exact terms Odoo developers search for):
```
Inspect Odoo (and any) form fields & table columns: CSS selector, XPath, technical field name, live ir.model.fields data.
```
121/132 characters.

**Category:** Developer Tools

**Language:** English

**Description** (main listing body):
```
Odoo Field Inspector is a developer tool for Odoo functional consultants,
implementation partners, and developers who need a field's technical
name, XPath, or CSS selector without digging through Odoo's Technical
Settings or opening Chrome DevTools. It works off the Odoo web client's
standard markup (`.o_field_widget[name]`, list-view `data-name` columns)
rather than a hardcoded version check, so it isn't tied to one specific
Odoo release. Click a form field's label or a table's column header on
any page — Odoo or not — and a developer-tool style panel slides in with
everything about it: element type, id/name, classes, current and default
value, required/read-only/disabled state, validation and ARIA attributes,
a working CSS selector, an XPath, its parent element, and the owning
<form>.

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

KNOWS YOUR ODOO VERSION
The panel reads your server's Odoo version once per tab and shows it, then
builds the "Open in Odoo" link in the URL style that version actually
supports: the old /web#model=...&id=... link on Odoo 16 and earlier, the
/odoo/action-... route on 17 and later. The same link shape is used in
Copy All, so pasted notes keep working. If the version can't be read, you
get both link styles and an explanation instead of a broken link.

KNOWS WHICH VIEW XML ID YOU'RE LOOKING AT
The rendered page is a merge of a whole stack of views, so it can't tell you
which file it came from. The panel resolves that: the active view's XML ID
(e.g. base.view_partner_form), the chain it inherits from (e.g. your own
my_addon.view_partner_form_inherit on top of it), and a direct link into
Settings > Technical > Views for each one. List columns report the list
view's own XML ID, not the form view's. It reads view metadata only, never
the view's source XML.

MAKE IT YOURS
A gear in the panel header opens a Settings page: pick Light, Dark, or follow
your system (which now repaints live when your OS flips); choose one of six
accent colors that recolor links, tabs, the primary button and the outlines the
extension draws around detected fields; and switch between Comfortable and
Compact density. Every other setting — Highlight, Intercept clicks, Odoo
Developer Mode, Show Sensitive Values, Copy format — lives in the same place.
Your choice is remembered, and the popup matches it. Nothing about your theme
is ever sent anywhere.

A FULL SETTINGS PAGE, IN ITS OWN TAB
Prefer room to breathe? The popup stays a quick on/off panel, and "All
settings" underneath Enable Inspector opens the complete settings in a real
browser tab: every setting, grouped as Appearance, Detection, Behavior and
Debug, with a live preview of the actual inspector panel — the same
stylesheet, icons and colors it uses on the page — that repaints as you
change anything. It also shows the sites you chose to auto-enable the
inspector on, so you can add or remove one (and hand that access back to
Chrome) in one place, and a plain-language summary of what the extension does
and does not send anywhere. Change a setting in the popup and the open tab
follows, and the other way round: they are the same settings, not two.

DEBUG WHEN YOU NEED IT
Add ?debug=1 to a page's URL (or flip Debug logging in Settings) for verbose
console diagnostics and a live readout of the effective settings. ?debug=0
forces it off; the URL always wins over the saved switch, it is never stored,
and it can never turn the inspector on by itself.

ODOO BUTTONS
A dedicated Button tab tells you what a button will actually do: the
Python method it calls, the action it opens, the special= built-in, the
confirmation it asks for first, and the record (data-model/data-id) it
would act on. Buttons are never hijacked by a normal click — in the
default mode, clicking Save is just clicking Save — so you inspect them
either with "Intercept clicks" off or by picking one in the search
below, which opens a button's panel without pressing it. Attributes
like groups=, invisible= and readonly= come from the button's own
declaration in the view, because the rendered page does not keep them.

FIELD FINDER
A floating search button opens a page-wide search: filter every field,
list column, and Odoo button on the page by label or technical name, live
as you type, then click a result to jump straight to its full inspector
panel.
If an Odoo wizard (dialog) is open, the search automatically scopes to
just that wizard's fields.

NEVER TOUCHES YOUR DATA (BY DEFAULT)
While inspecting, clicks on fields are intercepted before the page sees
them — labels never toggle checkboxes, <select> never opens, and no
value or focus state ever changes. Turn the inspector off and the page
behaves exactly as it did before.

CLICK-THROUGH WHEN YOU NEED IT
Prefer to keep filling the form while you inspect it? Turn "Intercept
clicks" off and the panel still opens on your click, but the click
reaches the page normally, exactly as it would without the extension.
It is a toggle, never the default, and the inspector still never writes
to a field or submits anything itself.

SENSITIVE VALUES REDACTED
Values of password inputs, hidden token/CSRF fields, and other
secret-named fields never appear in the panel, in Copy All, or in JSON
output — they are replaced with a redaction marker before anything can
be displayed or copied. Turn on "Show sensitive values" only when you
actually need them.

START AUTOMATICALLY ON YOUR OWN ODOO
By default the inspector starts only when you turn it on, and a page
reload switches it off again. Tick "Auto-enable on this site" in the
popup and it starts by itself every time you load a page on that one
site. Chrome asks for access to that origin only, the sites you
remembered are listed in the popup and in the Settings page with a
Remove button, and turning it off hands the access straight back to
Chrome. Remembering one site never grants access to any other.

PRIVACY
Everything runs locally in your browser. The full Settings page is a page of
this extension that only reads and writes your own local settings — it has no
access to any page you are viewing. Theme, accent, density and the debug switch
are local preferences, stored on your machine and never transmitted; a
?debug= parameter in a page URL is read only in that page's own tab, is never
stored, and cannot enable the inspector by itself. The one exception: the Odoo
field lookup above, which — only for fields recognized as Odoo fields —
asks the SAME Odoo server you're already logged into for that field's
definition, using your existing session, plus — when you inspect a button
— that button's model and method/action name so its declaration can be
read from the view (buttons are never intercepted on a normal click, and
no record data, label, or target record is sent), plus one fixed hard-coded
config key (web.base.build.description, at most once per tab) to read
your server's version, and that model's view metadata (which view XML ID
you're looking at and what it inherits from — ids and names, never the
view's source XML). No field values, browsing history, or personal
data are ever sent, and there is no server or analytics of ours in the
loop at all. No host permissions are requested unless you opt in to
per-site auto-enable, which grants access to the single site you pick
and nothing else. Full privacy policy:
https://mehedimk.github.io/Odoo-Field-Inspector/privacy.html

No host permissions are requested up front, so Chrome never shows the
broad "read and change all your data on all websites" warning: content
scripts only run on a tab after you explicitly enable the inspector for
it. The one exception is opt-in and per site: if you tick "Auto-enable on
this site" in the popup, Chrome asks you to allow the extension on that
one origin so the inspector can start automatically when you load pages
there. It is used for nothing else, it is listed with a Remove button in
the popup, and unticking it revokes the permission in Chrome too.

WHO IT'S FOR
Odoo developers debugging a view, functional consultants who need a
field's technical name for a customization request without asking a
developer, QA/testers writing CSS selectors for automated tests, and
anyone who wants a field or table column's CSS selector and XPath on
any website — not just Odoo. If you've ever opened Odoo's Technical
Settings, turned on developer mode just to find one field's technical
name, or hand-written a CSS selector by guessing at DOM structure in
Chrome DevTools, this replaces that whole detour with one click.
```

## Privacy practices tab

**Privacy policy URL:**
```
https://mehedimk.github.io/Odoo-Field-Inspector/privacy.html
```
This is a real, styled HTML page (`docs/privacy.html` in this repo,
mirroring `PRIVACY_POLICY.md`), served by GitHub Pages once you enable
it — it is **not live until you do**:

1. GitHub → this repo → **Settings → Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**,
   **Branch: main**, folder **`/docs`**. Save.
3. Wait a minute or two, then confirm
   `https://mehedimk.github.io/Odoo-Field-Inspector/` and the `/privacy.html`
   URL above both load before pasting the URL into the dashboard.

The landing page at that root URL (`docs/index.html`) is also a plain
SEO landing page for the extension — feature summary, screenshots, and
install steps — separate from this file and from `PRIVACY_POLICY.md`
(the source-of-truth text both are built from).

If you ever change what data the extension sends (e.g. adding a new
Odoo RPC lookup), update `PRIVACY_POLICY.md` **and** `docs/privacy.html`
together — the "Changes to this policy" section commits to that, and the
two are meant to stay in sync (`docs/privacy.html` is the rendered,
publicly hosted copy).

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
| `storage` | Needed to save the user's inspector preferences (Form View / List View / Highlight / Copy Format / Odoo Developer Mode / Show Sensitive Values / Intercept Clicks) locally via `chrome.storage.local`, so they persist between sessions. It also stores the list of origins the user chose for per-site auto-enable (origin strings only). |
| Optional host permission (`http://*/*`, `https://*/*`) — requested only for a site the user picks | Declared as an *optional* host permission, so it grants nothing by default. The extension asks Chrome for one specific origin only when the user ticks "Auto-enable on this site", and uses it solely to re-inject the inspector when a page on that origin loads. It is never requested for any other site, is revocable from the popup (which calls `chrome.permissions.remove`), and the extension re-checks the grant on every load and stops injecting if it was revoked. No page content is read or stored as a result of holding this permission. |

**Data usage disclosure** (checkboxes in the "Data collected" section):
- Check **Website content** — because the Odoo lookup reads/sends a
  field's technical name and model name, or — when a button is inspected
  in click-through mode or via the Field Finder — that button's model and
  its method/action name (see Privacy policy above), and
  because the inspector reads the clicked field's HTML and its value to
  display them on screen. It also reads one fixed configuration key name
  (`web.base.build.description`) from that same Odoo server to detect the
  server version, at most once per tab, and reads that model's view metadata
  (view record ids and their `inherit_id` chain, resolved to XML IDs through
  one batched `ir.model.data` request) to report which view file a field or
  button is declared in. A button lookup sends no label, no target record,
  and makes no `ir.model.fields` request at all; it searches the already
  fetched view arch for the button's `<button name="...">` declaration. Sensitive values (passwords,
  hidden tokens) are redacted before display and before any copy, unless
  the user turns on "Show sensitive values"; nothing read from the page is
  transmitted.
- Theme, accent color, density and debug settings are **not** transmitted and
  are not website content: they are your own preferences, stored locally. The
  extension does write a highlight outline onto inspected page elements, in
  the accent color you chose, and removes it again when inspection is
  disabled.
- Also check **User activity** only if the dashboard requires it for the
  optional-host-permission prompt. Nothing about the user's activity is
  transmitted anywhere: the extension has no server. The per-site
  auto-enable feature stores one origin string locally and uses it solely
  to decide whether to inject on a page load. If the form does not force a
  category for optional permissions, leave it unchecked and rely on the
  justification text above.
- Leave every other category unchecked (no personal info, location,
  health, financial, auth info, personal communications, web history,
  or user activity is collected).
- Check all three certification boxes: not sold to third parties, not
  used for purposes unrelated to the extension's single purpose, not
  used to determine creditworthiness or for lending.

## Chrome Web Store discoverability (SEO)

The dashboard has no separate "keywords" field — search relevance comes
from the **extension name**, **summary**, and **description** text
above (roughly in that priority order), plus category and install/
rating signals over time. What we optimized for and why:

- **Name** ("Odoo Field Inspector") already leads with the two terms
  most likely to be typed together: the product ("Odoo") and the
  category ("Field Inspector"). Don't rename this without checking
  search impact — a generic name like "Field Inspector" alone would
  lose the Odoo-specific searches entirely.
- **Summary** front-loads "Odoo" and packs in the exact phrases an Odoo
  developer searches for: "form fields", "table columns", "CSS
  selector", "XPath", "technical field name", "ir.model.fields". These
  are deliberate — "technical field name" and "ir.model.fields" are
  Odoo-specific jargon that a generic screen-inspector extension
  wouldn't rank for, which is exactly the differentiation we want.
- **Description** opens with who it's for (functional consultants,
  implementation partners, developers) before what it does, since CWS
  search snippets often truncate to the first couple of sentences — the
  keyword-dense part needs to survive truncation. The closing "WHO IT'S
  FOR" section exists mainly for human skimmers deciding whether to
  install, but its phrasing ("developer mode", "Technical Settings",
  "CSS selector", "automated tests") covers a few more real search
  queries too.
- **Category**: Developer Tools is the correct/only sensible fit — don't
  pick a broader category hoping for more traffic, CWS demotes listings
  whose category doesn't match their actual function.
- If you add a genuinely new capability later, update the description's
  relevant section (FORM VIEW / LIST VIEW / BUILT FOR ODOO DEVELOPERS /
  FIELD FINDER) rather than just appending — search relevance rewards
  the feature being described where a reader/crawler expects it, not
  buried in a changelog-style addendum.

## Google / off-store discoverability

The CWS listing page itself gets indexed by Google (so everything in
the section above already helps Google search too), but there's also a
dedicated landing page for people searching Google directly, e.g.
"Odoo field inspector chrome extension" or "Odoo technical field name
tool" — most of that traffic never opens the Chrome Web Store first.

- **`docs/index.html`** — a static landing page (served by GitHub Pages,
  see **Privacy practices tab** above for enabling it) with: a real
  `<title>`/`<meta description>` matching the keyword strategy above, Open
  Graph + Twitter Card tags (so links shared on Slack/X/LinkedIn render a
  proper preview card, not a bare URL), and `SoftwareApplication`
  JSON-LD structured data so Google can understand it's a piece of
  software, not an article. Actual crawlable text content (feature
  descriptions, alt text on every screenshot) — meta tags alone don't
  rank; the page has to have real content Google can read.
- **`docs/privacy.html`** — the same privacy policy as `PRIVACY_POLICY.md`,
  rendered as a real page (not a link to a `.md` file) with its own
  title/description and a `canonical` link, so it can independently
  rank for "[extension name] privacy policy" searches too.
- **`docs/sitemap.xml`** / **`docs/robots.txt`** — tell crawlers both
  pages exist and are indexable; `robots.txt` points at the sitemap.
- **GitHub repo "About" panel** (top-right of the repo page, next to
  the star button) — this is NOT the same as this file and can't be set
  by editing a file in the repo; set it manually once Pages is live:
  - **Description**: `Chrome extension: click any Odoo form field or table column to see its technical field name, CSS selector, XPath, and live ir.model.fields definition.`
  - **Website**: `https://mehedimk.github.io/Odoo-Field-Inspector/`
  - **Topics** (type each, press enter): `odoo` `odoo-development` `chrome-extension` `browser-extension` `developer-tools` `css-selector` `xpath` `field-inspector`
  
  Topics in particular are both a GitHub-search ranking factor and show
  up as clickable tags on the repo page and in Google's indexed
  snippet — this is the single highest-leverage five-minute change for
  Google discoverability that a file edit can't do for you.

## Graphic assets

| Asset | Requirement | Status |
|---|---|---|
| Store icon | 128×128 PNG | ✅ `icons/icon128.png` (bundled in the package; also upload separately if the dashboard asks) |
| Screenshot(s) | 1280×800 or 640×400, at least 1, up to 5 | ✅ 5 screenshots at 1280×800 (the CWS max), all generated from the real extension (not hand-drawn mockups) |
| Small promo tile | 440×280 PNG, optional | ✅ `promo/promo_tile_440x280.png` |
| Marquee | 1400×560 PNG, optional | Not created — optional, only needed if Google features the extension |

Current screenshots (`promo/`), at the CWS's 5-screenshot cap:
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
4. `screenshot_4_domain_builder.png` — the Domain Builder with a model's
   fields loaded and two conditions being combined with AND.
5. `screenshot_5_chatter_manager.png` — the Chatter Manager reader with
   loaded messages, an internal note, and the search/filter controls.

All five use a self-contained demo HTML page (fabricated Odoo-style
markup + fabricated field/model metadata), not a real Odoo instance or
real data — safe to regenerate any time after a UI change. Since the
cap is already reached, swapping one of these for a real-Odoo screenshot
(rather than adding a 6th) is the only way to add one later.

## Package

Upload `field-inspector-v1.3.0.zip`. It was rebuilt after the full-page
Settings tab was added, and it was verified against the working tree: every
file listed in `shared.js`'s `CONTENT_FILES`/`CONTENT_CSS` is present in the
ZIP, `options/options.html` is present (the manifest points at it and a
missing file would break the settings tab on first open), and every packaged
file is byte-identical to its source. It contains only the runtime files:
`manifest.json`, `background.js`, `shared.js`, `content.css`, `content/`,
`popup/`, `options/`, and `icons/*.png`. `README.md`, `PRIVACY_POLICY.md`,
`STORE_LISTING.md`, `CHECKLIST_README.md`, `tests/`, `docs/`,
`icons/icon.svg`, and `promo/` are dev-only and intentionally excluded.

> `shared.js` is **required at runtime** — the popup, the service worker, the
> content scripts and the settings tab all load it for the injection list,
> origin helpers, shared defaults and panel stylesheet. Omitting it breaks the
> extension outright, so keep it in the file list.
> `options/` is **required** too: the manifest's `options_ui` points at
> `options/options.html`, so leaving the directory out makes both the popup's
> "All settings" button and the extensions-menu entry dead on arrival.

Rebuild it from the repo root with an explicit file list (never a broad
`zip -r` of the project directory, which would ship the docs and tests):

```sh
rm -f field-inspector-v1.3.0.zip
zip -r field-inspector-v1.3.0.zip \
  manifest.json background.js shared.js content.css content popup options \
  icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png
unzip -l field-inspector-v1.3.0.zip   # confirm manifest.json is at the root
```

> **Note:** There is only ever one ZIP in this repository. Older archives
> built during development — each superseded as the Domain Builder, Chatter
> Manager, `shared.js`, the version probe, the view stack, button
> information, the theming and the full-page Settings tab landed — were
> deleted rather than kept, and any surviving local copy of one must **not**
> be uploaded: it would fail review against this listing. Rebuild with the
> command above whenever any runtime file changes.

## Before you submit

1. One-time $5 Chrome Web Store developer registration fee (if you
   haven't already registered a developer account).
2. Confirm the "Odoo Field Inspector" name isn't already taken — if it is,
   pick a variant (e.g. "Field Inspector for Odoo") and update
   `manifest.json`'s `name` to match before rebuilding the zip.
3. Load-unpacked test the exact zipped contents one more time (not just
   your working directory) to make sure nothing needed got excluded.
4. The five `promo/` screenshots are current as of the tabbed-panel,
   colored type chips, Field Finder, Domain Builder, and Chatter Manager
   UI. Regenerate them (or swap in real-Odoo ones) if the panel's look
   changes again before submitting — five is the CWS cap, so a new one
   means replacing an existing slot, not adding a sixth.
5. Enable GitHub Pages for `/docs` (see **Privacy practices tab** above)
   and confirm `https://mehedimk.github.io/Odoo-Field-Inspector/privacy.html`
   actually loads before submitting — the submission will be rejected
   without a working privacy policy URL, and the description above
   already has this URL hardcoded.
6. Submissions that request no host permissions and have a clear single
   purpose (this one) typically review faster, but first-time developer
   accounts can still take several business days.
