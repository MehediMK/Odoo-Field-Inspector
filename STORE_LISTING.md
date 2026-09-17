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
https://mehedimk.github.io/Odoo-Field-Inspector/privacy.html

No host permissions are requested, so Chrome never shows the broad
"read and change all your data on all websites" warning: content scripts
only run on a tab after you explicitly enable the inspector for it.

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
