# Privacy Policy — Field Inspector (Odoo Field Inspector)

**Effective date:** 2026-09-25

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
- The same mode also reads **one fixed configuration key**
  (`web.base.build.description`, falling back to `web.base.build.version`)
  from that same server, at most once per tab, to learn your Odoo version.
  The key name is hard-coded in the extension and carries no information
  about you; the value (e.g. `17.0`) is only used to choose a link style and
  is shown in the panel. It is never stored and never sent anywhere else.
- That same mode also reads **view metadata** for the field's model — the
  active view's record id, the `inherit_id` chain above it, and one batched
  `ir.model.data` lookup that turns those ids into XML IDs — so the panel can
  show which view file you're looking at and what it extends. These are view
  *identities and names only*: the extension never downloads a view's source
  XML (`arch_db`), and it reads no record data through them.
- In **Domain Builder**, clicking **Load Fields** while Odoo Developer Mode
  is on sends the chosen model name to that same Odoo server to fetch field
  definitions. Domain conditions and values stay in tab memory and are only
  copied to your clipboard when you choose Copy; they are not sent to Odoo.
- Your only stored data is your own preference settings (see below),
  kept locally in your browser via `chrome.storage.local`. We never see
  them; they never leave your machine.
- Values of **password inputs, hidden token/CSRF fields, and other
  secret-named fields** are replaced with a redaction marker before they
  can be displayed or copied. They are redacted from the panel, from Copy
  All, from JSON output, and from the Recent Fields history unless you
  turn on **Show sensitive values**.
- By default the extension also stops clicks on detected fields before
  they reach the page, so inspecting a form cannot change it. If you turn
  off **Intercept clicks** (click-through mode), your clicks reach the
  page normally and can change form data — the extension itself still
  never writes to a field, and still never submits anything.

## What the extension does

Field Inspector lets you click a form field or a table/list column on
any web page to see a read-only developer panel with its HTML details:
element type, attributes, a CSS selector, an XPath, and — on pages
served by an Odoo instance — the field's real definition from that
Odoo server's own database. It's a developer/inspection tool; it never
submits forms or changes record values. Chatter Manager can temporarily hide
chatter and show a read-only local message reader; disabling inspection
restores the layout.

## Data we collect

**None.** We (the developer) do not operate a backend, collect
analytics, or receive any data from installs of this extension. There
is no telemetry, no crash reporting, no usage tracking, and no
advertising in this extension.

## Data the extension reads, and where it goes

| Data | When | Sent to | Purpose |
|---|---|---|---|
| The clicked field's/column's HTML (tag, attributes, classes, id, current value, etc.) | Whenever you click a detected field while the inspector is enabled | **Nowhere** — rendered entirely inside the extension's own on-page panel, in your browser | Show you the field's structure. Password/secret values are redacted unless **Show sensitive values** is on |
| A field's technical model + field name (e.g. `res.partner.email`) | Only when **Odoo Developer Mode** is on *and* the clicked field is recognized as an Odoo field | The **same Odoo server** the current page is already loaded from, over that page's existing logged-in session | Fetch the field's real `ir.model.fields` definition and how it's declared in the current view, so you don't have to guess it from CSS classes |
| An inspected button's model + its method/action name (e.g. `res.partner` + `action_send`) | Only when **Odoo Developer Mode** is on *and* the button is inspected (click-through mode, or selected in the Field Finder) | The **same Odoo server**, using your existing session | Look up that button's declaration in the view arch — its `type`, `special`, `confirm` and `groups`, which the rendered page does not keep. No record values are involved, and no `ir.model.fields` lookup is made for a button |
| A fixed configuration key name (`web.base.build.description`) | Only when **Odoo Developer Mode** is on *and* the clicked field is recognized as an Odoo field — at most once per tab | The **same Odoo server**, using your existing session | Read your server's Odoo version, so the panel can deep-link to a field record in the URL style that version actually supports. The *value* returned (e.g. `17.0`) is used to pick a link shape and is shown in the panel; it is never stored or sent anywhere else |
| A model's view record id and its `inherit_id` ancestors (ids and internal names only) | Only when **Odoo Developer Mode** is on *and* the clicked field is recognized as an Odoo field | The **same Odoo server**, using your existing session | Show which XML ID the page is rendered from and what it inherits from. The extension reads view *metadata* only — it never downloads a view's full source XML (`arch_db`) |
| The ids of those view records, looked up in `ir.model.data` | Same as above, in one batched request | The **same Odoo server**, using your existing session | Resolve view record ids to their external IDs (e.g. `base.view_partner_form`). The returned values are XML ID strings — which custom modules extend a view — shown in the panel; never stored or sent anywhere else |
| Loaded chatter messages (author, displayed date, message body) | When you open Chatter Manager | **Nowhere** — shown and searched locally; clipboard only when you choose Copy Message | Read, search, and filter already-loaded messages |
| Domain Builder model name | When you click **Load Fields** with Odoo Developer Mode on | The **same Odoo server**, using your existing session | Read field definitions using `fields_get` |
| Domain Builder conditions and values | When you use the builder | **Nowhere** — tab memory; clipboard only when you choose Copy | Generate a domain locally without applying it to records |
| Your extension preferences (Form View / List View / Highlight / Copy Format / Odoo Developer Mode / Show Sensitive Values / Intercept Clicks / Theme / Accent / Density / Debug on-off) | Whenever you change a setting in the popup, the Options menu, or the extension's Settings page | **Nowhere** — saved only to `chrome.storage.local`, a storage area local to your browser profile | Remember your preferences between sessions |
| A site you choose to auto-enable on (e.g. `https://erp.example.com`) — the origin string only | When you tick **Auto-enable on this site**, or add the origin on the Settings page | **Nowhere** — saved only to `chrome.storage.local`; the matching host permission is visible to you in `chrome://extensions` | Start the inspector automatically when you load a page on that site, instead of after each navigation |

No field *values* are ever included in the Odoo lookup — only the
technical field name and the model name. Inspecting a button sends the same
kind of identifier (a model plus a method or action name), never the button's
label, the record it is aimed at, or any record data. No page content, browsing
history, or personal information is ever transmitted by this extension,
to us or to anyone else, under any setting.

## Permissions and why we need them

| Permission | Why |
|---|---|
| `activeTab` | Lets the extension act on the current tab only after you explicitly click the toolbar icon and turn the inspector on — not automatically on every site. |
| `scripting` | Lets the extension inject its inspector code into the tab you've enabled it on, on demand. |
| `storage` | Lets the extension save your preference settings locally via `chrome.storage.local`, so they persist between browser sessions. |
| Optional host access to a site **you choose** | Only if you tick **Auto-enable on this site**. Chrome then asks you to allow this extension on that one origin, and the extension uses it for one thing: re-injecting the inspector when you load a page there. It is not requested for any other site, and not requested at all if you never use the option. |

The extension requests **no host permissions up front** — Chrome does not
show the broad "read and change all your data on all websites" warning for
this extension, and by default it cannot run on any site until you
explicitly enable it there.

If you do use **Auto-enable on this site**, a few specifics worth knowing:

- Access is per **exact origin**. Remembering `https://erp.example.com` does
  not give access to `https://intranet.example.com`, to
  `http://erp.example.com`, or to any other site. Nothing is ever added
  silently.
- The remembered sites are listed in the extension's popup and on its full
  Settings page, each with a **Remove** button. Removing one (or unticking the
  box) revokes the permission in Chrome as well as clearing the stored entry,
  so the grant disappears from `chrome://extensions` too.
- If you revoke access yourself from `chrome://extensions`, the extension
  stops injecting there on the next page load and drops the now-meaningless
  remembered entry the next time you open the popup or the Settings page.
- The stored entry is the origin text only. No page content, URL path, field
  name, or browsing history is saved. The extension does not record which
  pages you visit on that site.
- Adding a site by hand is equivalent to ticking the box on that site: the
  Settings page normalizes what you paste to a single origin
  (`https://erp.example.com/web/webclient#home` is remembered as
  `https://erp.example.com`) and then asks Chrome for that **one** origin
  only. A wildcard such as `*`, or an address pasted with a password in it,
  is refused before Chrome is asked for anything.
- Turning the inspector off on a remembered site keeps it off for that tab
  until you close the tab or navigate it elsewhere.
- Sites served over `file://` cannot be remembered (browsers do not allow
  this kind of access to local files), so the option is unavailable there.

## Data retention

- Your preference settings persist in `chrome.storage.local` until you
  change them again or remove the extension (removing the extension
  clears this storage, per Chrome's standard behavior). The same applies
  to the list of origins you chose for auto-enable.
- Odoo field-definition lookups are cached only in memory, only for the
  life of the current browser tab — closing or navigating the tab away
  clears that cache. Nothing is written to disk beyond your preference
  settings above.

## Appearance and debug settings

- Theme (System / Light / Dark), accent color, density and the debug switch are
  ordinary local preferences, stored in `chrome.storage.local` like every other
  setting. They are never transmitted anywhere, and they contain no page data.
- The popup shows the quick settings; the extension's **Settings** page (opened
  from **All settings** in the popup, in its own browser tab) shows the same
  preferences in full, together with the live preview of the panel and the list
  of sites you chose to auto-enable on. It is a page of this extension, running
  entirely in your browser: it reads the same local settings and writes the
  same local settings, and it has no access to any page you are viewing.
- A `?debug=1` or `?debug=0` parameter in a page's URL is read **only** in that
  page's own tab, to turn console diagnostics on or off for that page load. It
  is not stored, it is not sent anywhere, it cannot change a saved preference on
  any other page, and it cannot enable the inspector by itself — the inspector
  still has to be turned on, from the popup or by per-site auto-enable.
- The accent color is also applied to the outlines the extension draws around
  detected fields. That is a style the extension writes onto the page while
  inspection is enabled, and it is removed again when you disable the
  inspector — no page content is read to choose it.

Chatter Manager message data stays in tab memory and is cleared when inspection
is disabled or the detected record changes. It does not read composer drafts.

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
