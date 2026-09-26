const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// shared.js guards itself behind `self`; give the sandbox the same global
// shape a service worker sees so the IIFE binds FI_SHARED the same way.
// URL is a host API, not an ECMAScript intrinsic, so a bare vm context has
// to be handed one explicitly.
const context = { URL, chrome: { permissions: { contains: () => Promise.resolve(false) } } };
context.self = context;
vm.runInNewContext(fs.readFileSync('shared.js', 'utf8'), context);
const shared = context.FI_SHARED;

test('every file listed for injection actually exists', () => {
  // Chrome resolves both lists relative to the extension root, so a bad
  // entry only surfaces at injection time in a real browser.
  for (const file of shared.CONTENT_FILES) {
    assert.ok(fs.existsSync(file), `shared.js lists a missing file: ${file}`);
  }
  for (const file of shared.CONTENT_CSS) {
    assert.ok(fs.existsSync(file), `shared.js lists a missing stylesheet: ${file}`);
  }
});

test('the injection list covers every content script in the repo', () => {
  // A content file that exists but is never injected is dead weight at
  // best and a silently missing feature at worst; a stale entry throws at
  // injection time. Both directions are checked.
  // shared.js itself is injected too (it is this list's source of truth), so
  // it is part of "what must be injected" alongside the content/ scripts.
  const onDisk = fs
    .readdirSync('content')
    .filter((name) => name.endsWith('.js'))
    .map((name) => `content/${name}`)
    .concat('shared.js')
    .sort();
  assert.deepEqual([...shared.CONTENT_FILES].sort(), onDisk);
  assert.equal(shared.CONTENT_FILES[0], 'shared.js', 'shared.js must load before the scripts that read FI_SHARED');
  assert.equal(shared.CONTENT_FILES[shared.CONTENT_FILES.length - 1], 'content/content.js', 'the entry point stays last');
});

test('every local resource referenced by popup.html actually resolves', () => {
  // The browser fixtures all load content scripts themselves, so none of them
  // ever opened popup.html — a wrong relative path there (shared.js lives at
  // the extension root, not in popup/) shipped a popup that threw on
  // `self.FI_SHARED` before a single test noticed. Resolve every reference
  // the way Chrome would, relative to the file that declares it.
  const html = fs.readFileSync('popup/popup.html', 'utf8');
  const refs = [
    ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1]),
  ];
  assert.ok(refs.length >= 3, 'expected popup.html to reference its scripts and stylesheet');
  for (const ref of refs) {
    assert.ok(!ref.startsWith('/') && !/^https?:/.test(ref), `unexpected non-local reference: ${ref}`);
    const resolved = path.posix.normalize(path.posix.join('popup', ref));
    assert.ok(fs.existsSync(resolved), `popup.html references ${ref}, which resolves to missing ${resolved}`);
  }
});

test('the popup loads shared.js before the code that destructures it', () => {
  const html = fs.readFileSync('popup/popup.html', 'utf8');
  const sharedAt = html.indexOf('src="../shared.js"');
  const popupAt = html.indexOf('src="popup.js"');
  assert.ok(sharedAt > -1, 'popup.html must load shared.js');
  assert.ok(sharedAt < popupAt, 'shared.js must be loaded before popup.js reads self.FI_SHARED');
});

test('every element popup.js looks up by id exists in popup.html', () => {
  // The popup has no browser fixture, so a control renamed in the HTML without
  // renaming the lookup in the JS would only surface when a user opened it.
  // popup.js also looks up ids that depend on runtime state (the copy-format
  // radio), so this checks membership, not equality.
  const html = fs.readFileSync('popup/popup.html', 'utf8');
  const js = fs.readFileSync('popup/popup.js', 'utf8');
  const ids = new Set([...js.matchAll(/getElementById\(\s*["']([^"']+)["']/g)].map((m) => m[1]));
  assert.ok(ids.size >= 12, `expected popup.js to look up its controls by id, found ${ids.size}`);
  for (const id of [...ids].sort()) {
    assert.ok(new RegExp(`id=["']${id}["']`).test(html), `popup.js looks up #${id}, which popup.html does not define`);
  }
  // The appearance controls are queried by data attribute rather than id, so
  // they need their own check — a typo there would leave the popup with dead
  // buttons and no error anywhere.
  for (const attr of ['data-theme-choice', 'data-accent-choice']) {
    const inJs = js.includes(`[${attr}]`);
    const inHtml = html.includes(attr);
    assert.ok(inJs, `popup.js never queries [${attr}]`);
    assert.ok(inHtml, `popup.html defines no element carrying ${attr}`);
  }
  const swatches = [...html.matchAll(/data-accent-choice="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(swatches, Object.keys(shared.ACCENTS), 'the popup offers exactly the accents in shared.js, in order');
  const themes = [...html.matchAll(/data-theme-choice="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(themes, ['system', 'light', 'dark'], 'the popup offers System, Light and Dark');
});

test('normalizeOrigin turns what a user pastes into the exact origin we store', () => {
  // The site box accepts what people actually paste — a full URL with a deep
  // link, a bare host, a scheme-relative host — and stores one canonical
  // origin, because that string is what optional_host_permissions and
  // isRememberedOrigin() both compare against.
  const same = [
    ['https://erp.example.com/web/webclient#home', 'https://erp.example.com'],
    ['https://erp.example.com/', 'https://erp.example.com'],
    ['https://erp.example.com:443', 'https://erp.example.com'],
    ['HTTPS://ERP.EXAMPLE.COM', 'https://erp.example.com'],
    ['erp.example.com', 'https://erp.example.com'],
    ['//erp.example.com', 'https://erp.example.com'],
    ['  erp.example.com  ', 'https://erp.example.com'],
    ['http://localhost:8069', 'http://localhost:8069'],
    ['//localhost:8069', 'https://localhost:8069'],
  ];
  for (const [input, want] of same) {
    assert.equal(shared.normalizeOrigin(input), want, input);
  }

  // Everything a host permission cannot be requested for, or that would ask
  // Chrome for more than the one site the user typed.
  for (const input of [
    '*',
    'https://*.example.com',
    'https://admin:secret@erp.example.com',
    'https://erp.example.com:0',
    'https://er p.com',
    'ftp://erp.example.com',
    'file:///tmp/x.html',
    'chrome://settings',
    'javascript:alert(1)',
    'https://',
    '',
    null,
    undefined,
    42,
  ]) {
    assert.equal(shared.normalizeOrigin(input), '', `expected ${String(input)} to be refused`);
  }

  // Malformed hostnames: each of these reaches a host permission pattern, so
  // storing one would either ask Chrome for something meaningless or normalise
  // to a *different* host than the one the user can see.
  for (const input of ['.erp.example.com', 'https://.erp.example.com', 'erp.example.com.', 'https://a..b.com']) {
    assert.equal(shared.normalizeOrigin(input), '', `expected ${input} to be refused as a malformed hostname`);
  }

  // A non-default port is part of the origin and must survive, not be dropped.
  assert.equal(shared.normalizeOrigin('https://erp.example.com:8080'), 'https://erp.example.com:8080');
  assert.equal(shared.normalizeOrigin('HTTP://ERP.EXAMPLE.COM:8069/x'), 'http://erp.example.com:8069');
});

test('a normalized origin is the same string isRememberedOrigin() matches on', () => {
  // The two functions have to agree: the options page stores
  // normalizeOrigin()'s output, and the background script decides auto-enable
  // from isRememberedOrigin(). If either normalised differently, a site a user
  // added would silently never auto-enable.
  for (const input of ['https://erp.example.com/web', 'http://localhost:8069/odoo', '//intranet:8069']) {
    const origin = shared.normalizeOrigin(input);
    assert.ok(origin, `expected ${input} to normalize`);
    assert.ok(shared.isRememberedOrigin(`${origin}/web/webclient`, [origin]), origin);
  }
});

test('the manifest declares the full-page options in a real tab', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert.ok(manifest.options_ui, 'the manifest must declare an options page');
  assert.equal(manifest.options_ui.page, 'options/options.html');
  assert.equal(manifest.options_ui.open_in_tab, true, 'settings must open in a tab, not a cramped popup');
  assert.ok(fs.existsSync(manifest.options_ui.page), 'the declared options page must exist');
});

test('the popup opens the options page from a button below Enable Inspector', () => {
  // The button is the only route to the full settings from the popup, and the
  // user asked for it under the enable switch rather than in a settings corner.
  const html = fs.readFileSync('popup/popup.html', 'utf8');
  const js = fs.readFileSync('popup/popup.js', 'utf8');
  const button = html.indexOf('id="fp-all-settings"');
  const enable = html.indexOf('id="fp-enable-toggle"');
  assert.ok(button > -1, 'popup.html must define the All settings button');
  assert.ok(enable > -1, 'popup.html must define the Enable Inspector toggle');
  assert.ok(enable < button, 'the All settings button must sit below the Enable Inspector control');
  assert.ok(js.includes('chrome.runtime.openOptionsPage()'), 'popup.js must open the options page');
  assert.ok(
    js.includes('getElementById("fp-all-settings")'),
    'popup.js must wire the All settings button it declares',
  );
});

test('every local resource referenced by options.html actually resolves', () => {
  // The options page has no browser fixture of its own in the store, so a
  // wrong relative path here shipped a settings tab that threw before it
  // rendered. Resolve every local reference the way Chrome would.
  const html = fs.readFileSync('options/options.html', 'utf8');
  const refs = [
    ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1]),
  ];
  assert.ok(refs.length >= 3, 'expected options.html to reference its script, shared.js and stylesheet');
  for (const ref of refs) {
    assert.ok(!ref.startsWith('/') && !/^https?:/.test(ref), `unexpected non-local reference: ${ref}`);
    const resolved = path.posix.normalize(path.posix.join('options', ref));
    assert.ok(fs.existsSync(resolved), `options.html references ${ref}, which resolves to missing ${resolved}`);
  }
});

test('the options page loads shared.js before the code that destructures it', () => {
  const html = fs.readFileSync('options/options.html', 'utf8');
  const sharedAt = html.indexOf('src="../shared.js"');
  const optionsAt = html.indexOf('src="options.js"');
  assert.ok(sharedAt > -1, 'options.html must load shared.js');
  assert.ok(sharedAt < optionsAt, 'shared.js must be loaded before options.js reads self.FI_SHARED');
});

test('every element options.js looks up by id exists in options.html', () => {
  const html = fs.readFileSync('options/options.html', 'utf8');
  const js = fs.readFileSync('options/options.js', 'utf8');
  const ids = new Set([...js.matchAll(/getElementById\(\s*["']([^"']+)["']/g)].map((m) => m[1]));
  assert.ok(ids.size >= 8, `expected options.js to look up its sections by id, found ${ids.size}`);
  for (const id of [...ids].sort()) {
    assert.ok(new RegExp(`id=["']${id}["']`).test(html), `options.js looks up #${id}, which options.html does not define`);
  }
});

test('the options page gives every setting in DEFAULT_SETTINGS exactly one control', () => {
  // A setting added to shared.js with no row here is invisible on the full
  // page, and a row left behind for a removed setting throws on every load.
  const js = fs.readFileSync('options/options.js', 'utf8');
  const keys = [...js.matchAll(/^\s*key:\s*"([^"]+)",/gm)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(keys)].sort(),
    Object.keys(shared.DEFAULT_SETTINGS).sort(),
    'the options spec must cover DEFAULT_SETTINGS exactly, with no row for a removed key',
  );
  assert.equal(keys.length, Object.keys(shared.DEFAULT_SETTINGS).length, 'no setting may be rendered twice');
});

test('the options page takes its defaults from shared.js, not a second copy', () => {
  // Two literal copies of the defaults would drift silently: a new key would
  // show up in storage but be unresettable on the settings page. Individual
  // control *values* ("text", "blue", …) are of course spelled out in the spec,
  // so what is forbidden is a second settings-shaped object.
  const js = fs.readFileSync('options/options.js', 'utf8');
  assert.ok(js.includes('DEFAULT_SETTINGS'), 'options.js must read the shared defaults');
  assert.ok(
    !/const\s+DEFAULT_SETTINGS\s*=/.test(js),
    'options.js must not define its own DEFAULT_SETTINGS',
  );
  const keys = Object.keys(shared.DEFAULT_SETTINGS);
  const property = `(?:${keys.join('|')})\\s*:`;
  const secondCopy = new RegExp(`\\{[^}]*${property}[^}]*${property}[^}]*\\}`, 's');
  assert.ok(
    !secondCopy.test(js),
    'options.js contains an object literal that assigns settings keys; they must come from shared.DEFAULT_SETTINGS',
  );
});

test('the panel stylesheet and the options page paint from one palette', () => {
  // PANEL_CSS is generated from PALETTE, so a new palette variable reaches both
  // the panel and the settings page without a second edit.
  const light = Object.keys(shared.PALETTE.light);
  const dark = Object.keys(shared.PALETTE.dark);
  assert.deepEqual(dark, light, 'both palettes must declare the same variables');
  assert.equal(light.length, 58, 'the palette grew or shrank — check the options page still paints');
  for (const selector of [
    (theme) => `:host([data-theme="${theme}"])`,
    (theme) => `:root[data-theme="${theme}"]`,
  ]) {
    const css = shared.paletteCss(selector);
    for (const variable of light) {
      assert.ok(css.includes(`${variable}:`), `${selector('light')} is missing ${variable}`);
    }
    assert.ok(!css.includes(':root('), 'the invalid :root([attr]) form drops the whole block');
  }
  for (const variable of light) {
    assert.ok(shared.PANEL_CSS.includes(`${variable}:`), `PANEL_CSS is missing ${variable}`);
  }
});

test('manifest optional host permissions match what we request per site', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*']);
  assert.ok(!manifest.host_permissions, 'no blanket host_permissions may be requested');
  // The popup asks for "<origin>/*", which must be covered by the optional
  // patterns or permissions.request() would always be denied.
  assert.equal(manifest.optional_host_permissions.length, 2);
});

test('auto-enable only ever targets exact http(s) origins', () => {
  assert.equal(shared.autoEnableOriginForUrl('https://erp.example.com/web/login'), 'https://erp.example.com');
  assert.equal(shared.autoEnableOriginForUrl('http://localhost:8069/odoo'), 'http://localhost:8069');
  assert.equal(shared.autoEnableOriginForUrl('http://localhost:8069'), 'http://localhost:8069');

  // Not eligible: no host permission can be requested for these.
  assert.equal(shared.autoEnableOriginForUrl('file:///home/me/form.html'), '');
  assert.equal(shared.autoEnableOriginForUrl('about:blank'), '');
  assert.equal(shared.autoEnableOriginForUrl('chrome://extensions'), '');
  assert.equal(shared.autoEnableOriginForUrl('https://chromewebstore.google.com/'), '');
  assert.equal(shared.autoEnableOriginForUrl(''), '');
  assert.equal(shared.autoEnableOriginForUrl(null), '');
  assert.equal(shared.autoEnableOriginForUrl('not a url'), '');
});

test('injection is possible on file and http(s) but never on privileged pages', () => {
  assert.ok(shared.isInjectableUrl('file:///home/me/form.html'));
  assert.ok(shared.isInjectableUrl('https://erp.example.com'));
  assert.ok(!shared.isInjectableUrl('chrome://settings'));
  assert.ok(!shared.isInjectableUrl('chrome-extension://abcdef/popup.html'));
  assert.ok(!shared.isInjectableUrl('https://chrome.google.com/webstore/category/extensions'));
  assert.ok(!shared.isInjectableUrl(undefined));
});

test('remembered-origin matching never widens to a sibling host or scheme', () => {
  const remembered = ['https://erp.example.com'];
  assert.ok(shared.isRememberedOrigin('https://erp.example.com/odoo/action', remembered));
  assert.ok(shared.isRememberedOrigin('https://erp.example.com:443/odoo', remembered));

  assert.ok(!shared.isRememberedOrigin('https://intranet.example.com/odoo', remembered));
  assert.ok(!shared.isRememberedOrigin('http://erp.example.com/odoo', remembered));
  assert.ok(!shared.isRememberedOrigin('https://erp.example.com.evil.test/', remembered));
  assert.ok(!shared.isRememberedOrigin('https://evil.test/?x=https://erp.example.com', remembered));
  assert.ok(!shared.isRememberedOrigin('https://erp.example.com/', []));
  assert.ok(!shared.isRememberedOrigin('https://erp.example.com/', undefined));
  assert.ok(!shared.isRememberedOrigin('https://erp.example.com/', 'https://erp.example.com'));
});

test('debug URL parameter is read strictly, and only ever as true/false/null', () => {
  // `null` means "the URL says nothing" — that is the value the content
  // script falls back to the saved setting on, so a typo can never be read
  // as "off" (which would silently mute a user's explicit choice).
  for (const on of ['1', 'true', 'TRUE', 'on', 'yes', '']) {
    assert.equal(shared.debugFlagForUrl(`https://erp.example.com/odoo?debug=${on}`), true, on);
    assert.equal(shared.debugFlagForUrl(`https://erp.example.com/odoo?debug=${on}&id=7`), true, on);
  }
  for (const off of ['0', 'false', 'off', 'no']) {
    assert.equal(shared.debugFlagForUrl(`https://erp.example.com/odoo?debug=${off}`), false, off);
  }
  // Unrecognised values defer to the setting rather than guessing a side.
  assert.equal(shared.debugFlagForUrl('https://erp.example.com/odoo?debug=maybe'), null);
  assert.equal(shared.debugFlagForUrl('https://erp.example.com/odoo?debug=2'), null);
  assert.equal(shared.debugFlagForUrl('https://erp.example.com/odoo'), null);
  assert.equal(shared.debugFlagForUrl('https://erp.example.com/odoo?debugged=1'), null);
  // A parameter that merely mentions debug elsewhere in the URL is not one.
  assert.equal(shared.debugFlagForUrl('https://erp.example.com/odoo?next=debug%3D1'), null);
  assert.equal(shared.debugFlagForUrl('https://erp.example.com/odoo#debug=1'), null);
  // Hash routes (Odoo <= 16) put their "parameters" after the #.
  assert.equal(shared.debugFlagForUrl('https://erp.example.com/web#debug=1'), null);
});

test('debug URL parameter parsing never throws on junk input', () => {
  assert.equal(shared.debugFlagForUrl(undefined), null);
  assert.equal(shared.debugFlagForUrl(null), null);
  assert.equal(shared.debugFlagForUrl(''), null);
  assert.equal(shared.debugFlagForUrl(42), null);
  assert.equal(shared.debugFlagForUrl('not a url'), null);
  assert.equal(shared.debugFlagForUrl('https://'), null);
});

test('every accent carries a light and dark palette with the same variable set', () => {
  // The panel paints from these, and so does the popup. A missing key in one
  // theme would silently leave half the UI on the previous theme's colour, and
  // `strong` specifically is the one that has to stay dark enough to carry
  // white text on a badge or the primary button.
  const required = ['accent', 'strong', 'soft', 'border', 'fg', 'outline', 'wash'];
  const names = Object.keys(shared.ACCENTS);
  assert.ok(names.length >= 4, 'expected several accent choices');
  assert.ok(shared.ACCENTS[shared.DEFAULT_ACCENT], 'the default accent must exist in the palette');
  for (const name of names) {
    const entry = shared.ACCENTS[name];
    assert.ok(entry.label, `${name} needs a label for the picker`);
    for (const theme of ['light', 'dark']) {
      for (const key of required) {
        assert.equal(typeof entry[theme]?.[key], 'string', `${name}.${theme}.${key} missing`);
      }
    }
    const channel = (hex) => {
      const value = parseInt(hex.replace('#', ''), 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    };
    const luminance = (hex) => {
      const [r, g, b] = channel(hex);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    assert.ok(luminance(entry.light.strong) <= 0.45, `${name} light "strong" is too light for white text`);
    assert.ok(luminance(entry.light.strong) <= luminance(entry.light.accent) + 0.2, `${name} light strong/accent mismatch`);
    // In dark mode the accent is the lighter, readable-on-dark colour.
    assert.ok(luminance(entry.dark.accent) >= 0.45, `${name} dark accent is too dark to read`);
  }
});
