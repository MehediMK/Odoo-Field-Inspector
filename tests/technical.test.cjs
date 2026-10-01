const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function api(overrides = {}) {
  const context = { window: {}, URL, URLSearchParams, console, performance: { now: () => 1 }, setTimeout, clearTimeout, ...overrides };
  vm.runInNewContext(fs.readFileSync('content/utils.js', 'utf8'), context);
  vm.runInNewContext(fs.readFileSync('content/odoo.js', 'utf8'), context);
  return context.window.__FI__.odoo;
}

test('debug switches preserve routes, filters and company parameters', () => {
  const odoo = api();
  const original = 'https://erp.test/web?cids=1&debug=1#model=res.partner&id=3&debug=assets';
  const url = new URL(odoo.debugUrl(original, 'assets'));
  assert.equal(url.searchParams.get('cids'), '1');
  assert.equal(url.searchParams.get('debug'), 'assets');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('id'), '3');
  assert.equal(new URLSearchParams(url.hash.slice(1)).has('debug'), false);
  assert.equal(new URL(odoo.debugUrl(url.href, 'off')).searchParams.has('debug'), false);
  assert.throws(() => odoo.debugUrl(original, 'bad'), /Invalid/);
});

test('saved data excludes binary and secret fields and recursively redacts JSON', async () => {
  const odoo = api();
  const calls = [];
  odoo.call = async (model, method, args, kwargs) => {
    calls.push({ model, method, args, kwargs });
    if (method === 'fields_get') return { name: { type: 'char' }, password: { type: 'char' }, image: { type: 'binary' }, settings: { type: 'json' } };
    return [{ id: 3, name: 'Alice', settings: { api_key: 'secret', safe: true, nested: [{ token: 'hidden' }] } }];
  };
  const data = await odoo.fetchRecordData({ model: 'res.partner', recordId: 3, verified: true, context: { lang: 'bn_BD' } });
  assert.deepEqual(Array.from(calls[1].kwargs.fields), ['name', 'settings']);
  assert.equal(calls[1].kwargs.context.lang, 'bn_BD');
  assert.equal(calls[1].kwargs.context.bin_size, true);
  assert.match(data.password, /redacted/);
  assert.match(data.image, /omitted/);
  assert.equal(JSON.stringify(data).includes('secret'), false);
  assert.equal(JSON.stringify(data).includes('hidden'), false);
  await assert.rejects(odoo.fetchRecordData({ model: 'res.partner', recordId: 3 }), /verified/);
  await assert.rejects(odoo.fetchRecordData({ model: 'res.partner', recordId: 'new', verified: true }), /verified/);
  await odoo.fetchRecordData({ model: 'res.partner', recordId: 3, verified: true }, true);
  assert.ok(calls.at(-1).kwargs.fields.includes('password'));
});

test('view cache distinguishes active view IDs and request contexts', async () => {
  const odoo = api();
  const calls = [];
  odoo.call = async (model, method, args, kwargs) => {
    calls.push(kwargs);
    return { views: { form: { id: kwargs.views[0][0], arch: '<form/>' } } };
  };
  assert.equal((await odoo.fetchViewArch('res.partner', 'form', 12, { lang: 'en_US' })).id, 12);
  await odoo.fetchViewArch('res.partner', 'form', 12, { lang: 'en_US' });
  await odoo.fetchViewArch('res.partner', 'form', 13, { lang: 'en_US' });
  await odoo.fetchViewArch('res.partner', 'form', 12, { lang: 'bn_BD' });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].context.lang, 'bn_BD');
});

test('runtime probes use containing record components and do not expose record data', () => {
  const target = { closest: () => null };
  const outer = { contains: x => x === target || x === inner };
  const inner = { contains: x => x === target };
  const child = { bdom: { el: inner }, component: { props: { record: { resModel: 'sale.order.line', resId: false, data: { password: 'never return' } } } } };
  const context = { window: { odoo: { __WOWL_DEBUG__: { root: {
    __owl__: { bdom: { el: outer }, component: { props: { resModel: 'sale.order', resId: 42 } }, children: { child } },
    actionService: { currentController: { props: { resModel: 'sale.order', resId: 42 }, action: { id: 8, res_model: 'sale.order' } } },
  } } } }, document: { querySelector: () => target } };
  context.self = context;
  vm.runInNewContext(fs.readFileSync('runtime.js', 'utf8'), context);
  const result = context.FI_READ_CONTEXT('#field');
  assert.equal(result.model, 'sale.order.line');
  assert.equal(result.recordId, null);
  assert.equal(result.actionId, undefined);
  assert.equal(JSON.stringify(result).includes('never return'), false);
  // Controller props remain usable even if .component is a component constructor.
  context.window.odoo.__WOWL_DEBUG__.root.__owl__ = null;
  context.window.odoo.__WOWL_DEBUG__.root.actionService.currentController.component = function Controller() {};
  assert.equal(context.FI_READ_CONTEXT('').recordId, 42);
  target.closest = () => ({});
  assert.equal(context.FI_READ_CONTEXT('#wizard-field'), null);
});

test('overlapping context probes remove only their own temporary markers', async () => {
  const pending = [];
  const attributes = new Map();
  const element = {
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
  };
  const odoo = api({ chrome: { runtime: { sendMessage: message => new Promise(resolve => pending.push({ message, resolve })) } } });
  odoo.detectRecordInfo = () => ({ model: 'fallback' });
  const first = odoo.resolveRecordInfo(element);
  const second = odoo.resolveRecordInfo(element);
  assert.equal(attributes.size, 2);
  assert.notEqual(pending[0].message.selector, pending[1].message.selector);
  pending[0].resolve({ model: 'res.partner' });
  assert.equal((await first).model, 'res.partner');
  assert.equal(attributes.size, 1);
  pending[1].resolve(null);
  assert.equal((await second).model, 'fallback');
  assert.equal(attributes.size, 0);
});

test('worker context requests execute only the bundled probe in the sender frame', async () => {
  let listener;
  const scripts = [];
  const event = { addListener() {} };
  const context = {
    console, importScripts() {}, FI_SHARED: {}, FI_READ_CONTEXT() {},
    chrome: {
      runtime: { id: 'our-extension', onInstalled: event, onMessage: { addListener(fn) { listener = fn; } } },
      tabs: { onRemoved: event, onUpdated: event },
      scripting: { async executeScript(options) { scripts.push(options); return [{ result: { model: 'res.partner' } }]; } },
    },
  };
  context.self = context;
  vm.runInNewContext(fs.readFileSync('background.js', 'utf8'), context);
  const message = { type: 'FI_READ_CONTEXT', selector: '[data-fi-context-test]' };
  listener(message, { id: 'other-extension', tab: { id: 9 } }, () => {});
  assert.equal(scripts.length, 0);
  let response;
  assert.equal(listener(message, { id: 'our-extension', tab: { id: 9 }, frameId: 2 }, value => { response = value; }), true);
  await Promise.resolve();
  assert.equal(scripts[0].target.tabId, 9);
  assert.equal(scripts[0].target.frameIds[0], 2);
  assert.equal(scripts[0].world, 'MAIN');
  assert.equal(scripts[0].func, context.FI_READ_CONTEXT);
  assert.equal(response.model, 'res.partner');
});
