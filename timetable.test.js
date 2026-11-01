const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
test('generated synthetic timetable renders all declared periods and supports week navigation', () => {
  const html = fs.readFileSync(path.join(__dirname, 'app/timetable.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = new Map(); let click; let ready = 0;
  const node = id => { if (!nodes.has(id)) nodes.set(id, { style: {}, classList: { toggle() {} }, addEventListener() {}, innerHTML: '', textContent: '' }); return nodes.get(id); };
  const context = { document: { getElementById: node, documentElement: { setAttribute() {} }, addEventListener: (event, fn) => { if(event === 'click') click = fn; } }, window: { addEventListener() {}, desktopAPI: { smokeReady: () => ready++ } }, localStorage: { getItem: () => null, setItem() {} }, console, Date };
  vm.runInNewContext(script, context);
  assert.equal(ready, 1); assert.match(node('body').innerHTML, /阅读与笔记/);
  assert.equal((node('body').innerHTML.match(/class="pcol"/g) || []).length, 5);
  click({ target: { closest: () => ({ getAttribute: () => 'next' }) } });
  assert.equal(node('weekLabel').textContent, '第 2 周');
});
