// Run with: node tests/run-browser-tests.cjs
// Set CHROME_BIN when Chrome is not available as google-chrome.
//
// Each entry is [fixture, query]. The query is appended to the fixture's file:
// URL, which is how the settings fixture is loaded three times to prove the
// `?debug=` URL override in both directions — the same page, with and without
// the parameter, must behave differently.
const { spawnSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { pathToFileURL } = require('node:url');

const FIXTURES = [
  ['domain-builder.html', ''],
  ['chatter.html', ''],
  ['click-through.html', ''],
  ['auto-enable.html', ''],
  ['odoo-version.html', ''],
  ['view-stack.html', ''],
  ['button-info.html', ''],
  ['settings-theme.html', ''],
  ['settings-theme.html', '?debug=1'],
  ['settings-theme.html', '?debug=0'],
  ['options-page.html', ''],
];

for (const [fixture, query] of FIXTURES) {
  const label = query ? `${fixture}${query}` : fixture;
  let last = null;
  // One retry: headless Chrome occasionally comes back with no DOM at all
  // (an empty stdout, with unrelated GCM/registration noise on stderr) on a
  // cold profile. That is a launch flake, not a test result, and retrying once
  // keeps a green suite trustworthy without hiding a real failure — a real
  // failure returns a FAIL: line every time.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const profile = mkdtempSync(join(tmpdir(), 'fi-browser-test-'));
    try {
      last = spawnSync(process.env.CHROME_BIN || 'google-chrome', [
        '--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
        '--allow-file-access-from-files', '--user-data-dir=' + profile,
        '--virtual-time-budget=6000', '--dump-dom', pathToFileURL(resolve('tests', fixture)).href + query,
      ], { encoding: 'utf8', timeout: 30000 });
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
    const output = last.stdout?.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    if (output) {
      if (!output.startsWith('PASS:')) throw new Error(label + '\n' + output);
      console.log(label + ": " + output);
      break;
    }
    if (attempt === 1) {
      throw new Error(label + '\nChrome returned no result twice: ' + (last.error?.message || last.stderr || 'no output'));
    }
  }
}
