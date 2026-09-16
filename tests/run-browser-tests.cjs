// Run with: node tests/run-browser-tests.cjs
// Set CHROME_BIN when Chrome is not available as google-chrome.
const { spawnSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { pathToFileURL } = require('node:url');
const profile = mkdtempSync(join(tmpdir(), 'fi-browser-test-'));
try {
  const result = spawnSync(process.env.CHROME_BIN || 'google-chrome', [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
    '--allow-file-access-from-files', '--user-data-dir=' + profile,
    '--virtual-time-budget=2000', '--dump-dom', pathToFileURL(resolve('tests/domain-builder.html')).href,
  ], { encoding: 'utf8', timeout: 30000 });
  const output = result.stdout?.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
  if (!output?.startsWith('PASS:')) throw new Error(output || result.error?.message || result.stderr || 'Chrome did not return a result.');
  console.log(output);
} finally {
  rmSync(profile, { recursive: true, force: true });
}
