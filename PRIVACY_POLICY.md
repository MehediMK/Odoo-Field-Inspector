# Privacy Policy — Field Inspector (Odoo Field Inspector)

**Effective date:** 2026-09-17

This policy covers the "Odoo Field Inspector" Chrome extension ("the
extension", "Field Inspector"). It's written to be read on its own — you
don't need to read the source code to know what this extension does with
your data, though the code is open for inspection in this repository.

## Summary

- The extension does **not** collect, store, or transmit your browsing
  activity, page content, field values, or any personal data, to us or
  to anyone else. We do not operate any server that the extension talks
  to, and we have no analytics, telemetry, or crash-reporting of any
  kind.
- The **one exception** is **Odoo Developer Mode**, an opt-in setting
  (on by default, toggle it off any time in the popup). When it's on and
  you click a field the extension recognizes as belonging to an Odoo
  form, list, or wizard, the extension sends that field's **technical
  name and model name only** (e.g. `res.partner` / `email` — never the
  field's *value*) to the **same Odoo server the page is already open
  on**, using your existing logged-in session, to fetch that field's
  real definition. This request never goes to us or to any third party
  — it goes directly from your browser to the Odoo server you're already
  using.
- In **Domain Builder**, clicking **Load Fields** while Odoo Developer Mode
  is on sends the chosen model name to that same Odoo server to fetch field
  definitions. Domain conditions and values stay in tab memory and are only
  copied to your clipboard when you choose Copy; they are not sent to Odoo.
- Your only stored data is your own preference settings (see below),
  kept locally in your browser via `chrome.storage.local`. We never see
  them; they never leave your machine.

## What the extension does

Field Inspector lets you click a form field or a table/list column on
any web page to see a read-only developer panel with its HTML details:
element type, attributes, a CSS selector, an XPath, and — on pages
served by an Odoo instance — the field's real definition from that
Odoo server's own database. It's a developer/inspection tool; it never
submits forms, never edits page content, and never changes a field's
value, checked state, or focus.

## Data we collect

**None.** We (the developer) do not operate a backend, collect
analytics, or receive any data from installs of this extension. There
is no telemetry, no crash reporting, no usage tracking, and no
advertising in this extension.

## Data the extension reads, and where it goes

| Data | When | Sent to | Purpose |
|---|---|---|---|
| The clicked field's/column's HTML (tag, attributes, classes, id, current value, etc.) | Whenever you click a detected field while the inspector is enabled | **Nowhere** — rendered entirely inside the extension's own on-page panel, in your browser | Show you the field's structure |
| A field's technical model + field name (e.g. `res.partner.email`) | Only when **Odoo Developer Mode** is on *and* the clicked field is recognized as an Odoo field | The **same Odoo server** the current page is already loaded from, over that page's existing logged-in session | Fetch the field's real `ir.model.fields` definition and how it's declared in the current view, so you don't have to guess it from CSS classes |
| Domain Builder model name | When you click **Load Fields** with Odoo Developer Mode on | The **same Odoo server**, using your existing session | Read field definitions using `fields_get` |
| Domain Builder conditions and values | When you use the builder | **Nowhere** — tab memory; clipboard only when you choose Copy | Generate a domain locally without applying it to records |
| Your extension preferences (Form View / List View / Highlight / Copy Format / Odoo Developer Mode on-off) | Whenever you change a setting in the popup or Options menu | **Nowhere** — saved only to `chrome.storage.local`, a storage area local to your browser profile | Remember your preferences between sessions |

No field *values* are ever included in the Odoo lookup — only the
technical field name and the model name. No page content, browsing
history, or personal information is ever transmitted by this extension,
to us or to anyone else, under any setting.

## Permissions and why we need them

| Permission | Why |
|---|---|
| `activeTab` | Lets the extension act on the current tab only after you explicitly click the toolbar icon and turn the inspector on — not automatically on every site. |
| `scripting` | Lets the extension inject its inspector code into the tab you've enabled it on, on demand. |
| `storage` | Lets the extension save your preference settings locally via `chrome.storage.local`, so they persist between browser sessions. |

The extension requests **no host permissions** — Chrome does not show
the broad "read and change all your data on all websites" warning for
this extension, because it cannot run on any site until you explicitly
enable it there.

## Data retention

- Your preference settings persist in `chrome.storage.local` until you
  change them again or remove the extension (removing the extension
  clears this storage, per Chrome's standard behavior).
- Odoo field-definition lookups are cached only in memory, only for the
  life of the current browser tab — closing or navigating the tab away
  clears that cache. Nothing is written to disk beyond your preference
  settings above.

Domain Builder drafts and loaded field definitions also stay in tab memory.
Reloading, navigating away, or closing the tab clears them.

## Third parties

We do not share, sell, or transfer any data to third parties, because
we do not collect any data in the first place. The outbound
network requests are the Odoo metadata lookups described above, including
Domain Builder field definitions, and these go directly from your browser
to the Odoo server the current page is already on — never to us, and
never to any third-party analytics, advertising, or data-broker
service.

## Children's privacy

This extension is a developer tool and is not directed at children. It
does not knowingly collect any information from anyone, including
children under 13.

## Changes to this policy

If this policy changes, the updated version will be published at the
same URL, with an updated effective date above. Material changes (e.g.
a new feature that sends data somewhere new) will also be called out in
the extension's `README.md` and in the Chrome Web Store listing's
description at the time of that update.

## Open source

This extension's full source code is included in this repository — the
description above is not a claim you have to take on faith; you can
read exactly what each content script does in `content/*.js`.

## Contact

Questions about this policy or the extension's data practices can be
opened as an issue in this repository.
