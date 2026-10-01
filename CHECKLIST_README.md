# Chrome Extension Checklist: From Scratch to Publication

A practical development and release checklist, with examples from **Odoo Field Inspector**.

Work through the stages in order. Check an item only after completing and verifying it; mark irrelevant items as `N/A` with a reason. Unchecked boxes are a reusable checklist, not a claim that this project has no completed work.

## 0. Working rule: features and docs ship together

A feature is not finished when the code works — it is finished when the
documentation describes it. After implementing any feature, update every
affected file in the same change, before it is called done:

- `README.md` — feature bullet, any behavior/safety section it
  contradicts, project structure, test files, and the testing checklist.
- `PRIVACY_POLICY.md` **and** `docs/privacy.html` together, if the
  feature changes what is read, stored, or transmitted.
- `STORE_LISTING.md` — listing description, disclosures, permission
  justifications, and the Package section.
- `docs/index.html` — the public landing page's feature cards.
- The in-product copy users read at runtime: the popup's About &
  Privacy text, and any in-panel hints the feature adds or retires.
- `CHECKLIST_README.md` — this file, plus a release record row when
  a version is cut.
- `manifest.json` version, then rebuild and re-verify the release ZIP
  (Chrome Web Store rejects an upload at a version it already has).
- Tests — a feature that can be observed in a fixture gets one.

Two rules that make this less error-prone: never leave a user-facing
claim ("never modifies your data", "nothing leaves your browser") standing
after a feature makes it false — qualify the claim in the same change
that breaks it; and keep `PRIVACY_POLICY.md` and `docs/privacy.html` in
sync, because the policy commits to publishing both.

## 1. Define the extension

- [ ] Identify the target users and the problem to solve.
- [ ] Write one narrow, understandable purpose.
- [ ] Describe the main workflow from activation to completion.
- [ ] List the minimum features for the first release.
- [ ] Separate future ideas from the initial scope.
- [ ] Identify supported websites, page types, and browser versions.
- [ ] List the data each feature needs to read, store, or transmit.
- [ ] Define observable acceptance criteria for each feature.

**Example purpose:** Odoo Field Inspector helps users inspect form fields and table columns by displaying technical details, available Odoo metadata, HTML attributes, CSS selectors, and XPath expressions in a read-only panel.

## 2. Set up the project

- [ ] Create a project folder and version-control repository.
- [ ] Add a README, ignore rules, and an appropriate license.
- [ ] Keep credentials, private records, and local browser profiles out of version control.
- [ ] Choose plain JavaScript or a build tool according to the project’s needs.
- [ ] Create the manifest, popup, icons, and any required content scripts or service worker.
- [ ] Keep store images and development utilities separate from runtime files.
- [ ] Record how to load, test, and package the extension.

### This project’s layout

```text
manifest.json       Extension metadata, permissions, options_ui
background.js       Service worker, toolbar badge state, per-site auto-enable
shared.js           Injection file list, origin helpers, shared defaults,
                    panel stylesheet + palettes (popup + worker + content + options)
popup/              Popup HTML, CSS, and quick-settings controller
options/            Full settings page: declarative spec, live panel preview,
                    remembered-sites manager (opened in a tab via options_ui)
content/            Detection, Odoo requests, inspection UI, and utilities
content.css         Page highlighting styles
icons/              Extension icons
tests/              Unit + headless-browser fixtures; exclude from the ZIP
store-assets/       Store images; exclude from the runtime ZIP
README.md           This checklist; exclude from the runtime ZIP
```

## 3. Configure the manifest and permissions

- [ ] Use Manifest V3 for a new Chrome extension.
- [ ] Set an accurate name, short description, and version.
- [ ] Declare only files that exist in the release package.
- [ ] Configure popup, service worker, and icons as needed.
- [ ] Choose the minimum Chrome version based on APIs actually used.
- [ ] Explain why every requested permission is needed.
- [ ] Prefer temporary or optional access where it meets the feature’s needs.
- [ ] Avoid broad host access unless essential to the stated purpose.
- [ ] Remove permissions left over from experiments or future features.

### Current permission inventory

| Permission | Purpose in Odoo Field Inspector |
| --- | --- |
| `activeTab` | Access the current tab after user activation. |
| `scripting` | Inject the inspector’s scripts and styles on demand. |
| `storage` | Save inspection preferences locally, plus the origin list for per-site auto-enable. |
| `optional_host_permissions`: `http://*/*`, `https://*/*` | Declared but **grants nothing by default**. Chrome requests one exact origin only when the user ticks “Auto-enable on this site”, and the extension uses it solely to re-inject the inspector on page loads there. Revoked via the popup’s Remove button or from `chrome://extensions`; the worker re-checks the grant on every load. |

The manifest requests no persistent host permissions and no blanket `host_permissions`. Optional host access is the one way the extension can run without a fresh popup click, so it is opt-in per origin, visible to the user, and revocable. Review this table whenever the manifest changes.

## 4. Implement the core workflow

- [ ] Make the activation state clear to the user.
- [ ] Implement the primary feature before adding optional controls.
- [ ] Keep page inspection, interface rendering, and background responsibilities understandable.
- [ ] Handle missing elements, unsupported pages, and unavailable APIs.
- [ ] Validate messages and inputs before acting on them.
- [ ] Avoid injecting duplicate scripts, panels, styles, or listeners.
- [ ] Handle dynamic content and single-page application navigation.
- [ ] Clean up observers, highlights, and listeners when disabled.
- [ ] Make the popup reflect the current tab’s actual state.
- [ ] Restore saved preferences consistently.
- [ ] Handle service worker restarts without relying on permanent in-memory state.
- [ ] Keep the interface usable with a keyboard and at different window sizes.

### Odoo Field Inspector acceptance checks

- [ ] Clicking a supported field displays the correct inspection details.
- [ ] Clicking a supported column displays its name, position, and selectors.
- [ ] Inspecting a field does not edit its value or submit its form.
- [ ] CSS selector and XPath results identify the intended element.
- [ ] Plain-text and JSON copying produce usable results.
- [ ] Clipboard failures provide a usable fallback.
- [ ] Esc and the close button dismiss the panel.
- [ ] Disabling inspection removes its interactive behavior and highlighting.
- [ ] Repeated enable/disable cycles do not create duplicate handlers.
- [ ] Metadata requests use the detected model and field name.
- [ ] Metadata failures leave standard HTML inspection usable.
- [ ] Model detection is checked on forms, lists, dialogs, and relational fields.
- [ ] Stale asynchronous responses cannot overwrite a newer field’s panel.

## 5. Review security and privacy

- [ ] Inventory every data source, storage location, and network destination.
- [x] Decide whether reading current and default field values is necessary.
- [x] Exclude or minimize sensitive values wherever they are unnecessary.
- [x] Review password fields, hidden inputs, HTML previews, and clipboard output for sensitive data exposure.
- [ ] Escape untrusted strings before rendering them as HTML.
- [ ] Avoid executing page-provided strings as code.
- [ ] Review bundled dependencies and remove unused code.
- [ ] Keep passwords, tokens, and API secrets out of the package and logs.
- [ ] Review secure transport for network requests.
- [ ] Document what persists after closing the panel, navigating, and uninstalling.
- [ ] Ensure popup privacy text, the published policy, and store disclosures agree.
- [ ] Publish a privacy policy at a publicly accessible URL.
- [ ] Include a real support contact and an updated date.

**Current project consideration:** Sensitive values (password inputs, hidden token/CSRF fields, and secret-named attributes) are redacted at info-build time, so they never reach the panel, Copy All, JSON output, or the Recent Fields cache unless the user turns on "Show sensitive values". Ordinary field values are still read and displayed. Click interception is on by default and keeps the extension from changing form data; with "Intercept clicks" turned off the user's clicks reach the page normally, which is documented in the popup, README, and privacy policy. Live metadata requests go to the current Odoo server using the existing session; do not claim the extension never contacts a server.

Google requires disclosure of user-data handling even when processing or storage stays on the device. See the [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).

## 6. Load and test locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
4. Open a supported page and activate the extension.
5. After changing runtime files, reload the extension and refresh the test page as needed.

- [ ] Confirm installation succeeds without manifest errors.
- [ ] Check popup, service worker, and page consoles for errors.
- [ ] Exercise every feature and setting.
- [ ] Test multiple tabs with different activation states.
- [ ] Test full reloads, navigation, and tab closure.
- [ ] Test supported browser versions before claiming compatibility.
- [ ] Check long labels, empty fields, special characters, and large tables.
- [ ] Check narrow windows, zoom, keyboard access, and contrast.
- [ ] Test a fresh browser profile and saved-preference behavior.
- [ ] Test network failures, expired sessions, and restricted Odoo accounts.
- [ ] Check performance on pages with many dynamically changing elements.
- [ ] Add focused automated tests for fragile logic where they provide useful coverage.
- [ ] Record test results, known limitations, and unresolved release blockers.

## 7. Prepare the store listing

- [ ] Write a clear title and concise short description.
- [ ] Write the full description using verified functionality.
- [ ] Avoid unsupported compatibility, privacy, or performance claims.
- [ ] Supply the single-purpose statement.
- [ ] Provide a justification for every requested permission.
- [ ] Complete data-use disclosures based on the release’s actual behavior.
- [ ] Review and truthfully certify the three limited-use declarations.
- [ ] Add the public privacy policy URL and support information.
- [ ] Choose the appropriate category, language, and distribution settings.
- [ ] Provide reviewer steps and any required test access.
- [ ] Use a dedicated test account with fictional data when login is necessary.
- [ ] Explain required permissions within the target application, such as Odoo metadata access.

## 8. Prepare listing images

| Asset | Dimensions | Format / quantity |
| --- | --- | --- |
| Store icon | 128 × 128 | Follow the store icon guidance. |
| Screenshots | 1280 × 800 or 640 × 400 | JPEG or 24-bit PNG without alpha; 1–5 images. |
| Small promo tile | 440 × 280 | JPEG or 24-bit PNG without alpha. |
| Marquee promo tile | 1400 × 560 | JPEG or 24-bit PNG without alpha; optional. |

- [ ] Verify pixel dimensions and file format, including alpha-channel removal where required.
- [ ] Use legible text and avoid crowded layouts.
- [ ] Show actual functionality in screenshots.
- [ ] Clearly identify sample pages or fictional data.
- [ ] Remove private records, account information, and credentials from captures.
- [ ] Make promotional images accurately represent the extension.
- [ ] Preview images at their actual display size.

Check the current [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images) before uploading.

### Existing project assets

- [Small promotional tile](store-assets/small-promo-440x280.png)
- [Marquee promotional tile](store-assets/marquee-promo-1400x560.png)
- [Screenshot: form inspection](store-assets/screenshots/01-form-inspection.jpg)
- [Screenshot: selectors and attributes](store-assets/screenshots/02-selectors-and-attributes.jpg)
- [Screenshot: table-column inspection](store-assets/screenshots/03-column-inspection.jpg)

These screenshots show the actual inspection panel rendered on a labeled sample page with fictional data. They are not evidence of compatibility testing against a live Odoo instance.

## 9. Package the release

- [ ] Set the intended release version in `manifest.json`.
- [ ] Use a higher version for an update to an existing release.
- [ ] Create a clean staging folder containing only runtime files.
- [ ] Include `manifest.json`, `background.js`, `shared.js`, `runtime.js`, `content.css`, `content/`, `popup/`, `options/`, and `icons/` for this project. (`shared.js` is runtime code — omitting it breaks the popup and the service worker; `options/` is runtime code — the manifest's `options_ui` points at `options/options.html`, so omitting it breaks the settings tab and the popup's All settings button.)
- [ ] Exclude `store-assets/`, documentation, tests, local profiles, secrets, and temporary files.
- [ ] Verify all paths referenced by the manifest and code exist in staging.
- [ ] Load and test the staged extension in Chrome.
- [ ] Create a ZIP with `manifest.json` at its root, not inside an enclosing project folder.
- [ ] Inspect the ZIP contents and test an extracted copy.
- [ ] Record the release version, source revision, and final ZIP filename.

See [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare).

## 10. Set up the developer account

- [ ] Register a Chrome Web Store developer account.
- [ ] Complete the registration payment and account setup shown in the dashboard.
- [ ] Complete required verification and account-security steps.
- [ ] Confirm the correct publisher owns the listing.
- [ ] Ensure the support and publisher contact details are accurate.

Follow the current [developer registration instructions](https://developer.chrome.com/docs/webstore/register); fees and dashboard requirements should be checked at submission time.

## 11. Submit and publish

- [ ] Create a new item in the developer dashboard, or open the existing item for an update.
- [ ] Upload the tested ZIP.
- [ ] Resolve upload and manifest validation errors.
- [ ] Complete the listing, images, privacy practices, and distribution fields.
- [ ] Confirm the privacy policy URL works without login.
- [ ] Verify reviewer credentials and instructions, if applicable.
- [ ] Preview the listing and compare it with the packaged behavior.
- [ ] Select the desired publication timing where the dashboard offers it.
- [ ] Submit the item for review.
- [ ] Monitor developer email and dashboard feedback.
- [ ] Address review findings and retest changes before resubmitting.
- [ ] Publish the approved item if a separate publication action is required.
- [ ] Install the store version and verify its core workflow.

Follow the current [publication workflow](https://developer.chrome.com/docs/webstore/publish/). Submission does not guarantee approval or a particular review duration.

## 12. Maintain the extension

- [ ] Monitor user reports and reproduce bugs with non-sensitive test data.
- [ ] Keep a changelog and release history.
- [ ] Recheck browser and target-website compatibility as they change.
- [ ] Review permissions and dependencies before each update.
- [ ] Update the policy and store disclosures when data practices change.
- [ ] Refresh screenshots when the interface changes materially.
- [ ] Test upgrades, preference migration, and existing-user behavior.
- [ ] Retest the final package and increase its version before uploading updates.

## Release sign-off

- [ ] Core functionality passes the recorded acceptance checks.
- [ ] No known release-blocking defects remain.
- [ ] Permissions, data handling, and disclosures match.
- [ ] Store copy and images describe the shipped functionality accurately.
- [ ] Reviewer access works, where required.
- [ ] The exact release ZIP has been tested.
- [ ] Support and maintenance arrangements are ready.

| Release record | Value |
| --- | --- |
| Version | 1.3.0 (built, not yet submitted) |
| Source revision | working tree at packaging time — commit before submitting |
| Tested Chrome versions | current stable `google-chrome` (headless fixtures: `node tests/run-browser-tests.cjs`); no live Chrome UI pass recorded yet |
| Tested Odoo versions / environments | none — no live Odoo instance has been used for this build. The 17+ deep-link shape (`/odoo/action-…?active_id=…`) and the `base.action_ui_view` view-record link are asserted against a stubbed backend only and have **not** been opened in a real Odoo 17+ admin; likewise the `ir.model.data` XML-ID resolution and the `ir.ui.view` inherit walk |
| Test date and reviewer | 2026-09-26 — automated fixtures only (9 browser fixtures, 11 fixture runs, 485 assertions, plus 26 Node tests). The settings fixture is loaded three times (plain, `?debug=1`, `?debug=0`) to prove the URL override in both directions, and the new options-page fixture is run once per pass. Five real defects were found by those fixtures during development rather than in review: the options page never received the accent variables, the accent swatches lagged one change behind the theme, an OS theme flip did not re-tint them, the page ignored `fiRememberedOrigins` changes (so an already-remembered site asked for permission a second time), and `state.resolved` was a hand-written second copy of the appearance defaults. Fifteen mutations were each confirmed to fail the suite — dropping the options page's root `applyThemeVars`, ignoring remembered-site storage changes, making swatch fills static, removing `syncControls()` from the system-theme handler, emitting the invalid `:root([attr])` palette selector, removing each of the `normalizeOrigin` guards in turn (the two scheme guards are belt-and-braces: each survives alone, both removed fails), removing the manifest `open_in_tab`, dropping the popup's All settings button, dropping a row from the options spec, and stopping `options.html` from loading `shared.js` — so the new assertions are not vacuous. The headless runner retries once on a launch that returns no DOM at all, which is a known cold-profile Chrome flake and not a test result |
| Known limitations | the panel's default Theme is **System**, so it can look dark on a dark OS and light on a light OS — that is the point of System, and Light/Dark override it; the six accents recolor the extension's own UI and the outlines it draws, not the host page; `?debug=1`/`?debug=0` are read from the **query string** only, so `/web#debug=1` is ignored, and the URL override is intentionally not persisted; a button is inspectable only in click-through mode or via the Field Finder, never by a normal click (by design — Save/Delete are not hijacked); the button's `type`/`special`/`confirm`/`groups` come from the view declaration, so they are reported as unknown when Odoo Developer Mode is off or that declaration cannot be read, and a button renamed by translation is matched by its technical name, not its visible text; nested domain groups unsupported; a field's definition is attributed to the whole view stack, not to one ancestor XML file, because ancestor `arch_db` is never downloaded; the inspector is re-enabled after each navigation **unless** the user opts into per-site auto-enable; click-through mode may leave "Jump to element" pointing at a node Odoo re-rendered; per-site auto-enable cannot be granted for `file://` pages; an auto-enabled tab stays off until the tab is closed or moved to another origin after a manual disable; an unreadable Odoo version yields both deep-link styles rather than a verified single one; the full Settings tab is exercised only through a headless fixture with stubbed `chrome.storage`/`chrome.permissions`, never opened in a real browser tab, and the permission prompt it triggers has only been observed as a recorded call |
| ZIP filename | `field-inspector-v1.3.0.zip` (verified: 22 files, all `CONTENT_FILES`/`CONTENT_CSS` present and byte-identical to source, every manifest path — including `options/options.html` — resolves, `manifest.json` at the root, no docs/tests leaked) |
| Privacy policy URL | https://mehedimk.github.io/Odoo-Field-Inspector/privacy.html |
| Submission date | |
| Store listing URL | |
