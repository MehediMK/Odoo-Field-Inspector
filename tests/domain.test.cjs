const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('content/domain.js', 'utf8'), context);
const { build } = context.window.__FI__.domain;
const rule = (field, value, type = 'text', operator = '=') => ({ field, value, type, operator });

test('prefix operators correctly combine three AND/OR conditions', () => {
  const rules = [rule('name', 'Alice'), rule('active', 'true', 'boolean'), rule('id', '10', 'integer', '>')];
  for (const [match, op] of [['all', '&'], ['any', '|']]) {
    assert.deepEqual(JSON.parse(build(rules, match).json), [op, op, ['name', '=', 'Alice'], ['active', '=', true], ['id', '>', 10]]);
  }
  assert.match(build(rules).python, /True/);
});

test('unset and membership values retain Odoo types', () => {
  assert.deepEqual(JSON.parse(build([rule('partner_id', '', 'integer', 'is not set')]).json), [['partner_id', '=', false]]);
  assert.deepEqual(JSON.parse(build([rule('id', '[1, 2]', 'integer', 'in')]).json), [['id', 'in', [1, 2]]]);
  assert.throws(() => build([rule('id', '["1"]', 'integer', 'in')]), /List items/);
  assert.throws(() => build([rule('id', '1,2', 'integer', 'in')]), /JSON list/);
});

test('strings are quoted safely and dotted field paths are supported', () => {
  const text = `O'Reilly "quoted"\\line\nNext`;
  assert.deepEqual(JSON.parse(build([rule('partner_id.name', text)]).json), [['partner_id.name', '=', text]]);
  assert.ok(build([rule('name', text)]).python.includes(JSON.stringify(text)));
  assert.throws(() => build([rule('name);evil()', 'x')]), /technical field/);
});

test('reject invalid numbers, dates, times and operators', () => {
  assert.throws(() => build([rule('id', '', 'integer')]), /valid number/);
  assert.throws(() => build([rule('id', '1.2', 'integer')]), /whole number/);
  assert.throws(() => build([rule('date', '2026-02-30', 'date')]), /valid date/);
  assert.throws(() => build([rule('date', '0000-01-01', 'date')]), /valid date/);
  assert.throws(() => build([rule('date', '2026-09-17 25:00:00', 'datetime')]), /valid UTC time/);
  assert.throws(() => build([rule('active', 'true', 'boolean', 'ilike')]), /Text matching/);
  assert.equal(build([]).python, '[]');
  assert.deepEqual(JSON.parse(build([rule('date', '2024-02-29', 'date')]).json), [['date', '=', '2024-02-29']]);
});
