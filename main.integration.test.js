const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
function harness(t, initial, start = false, options = {}) {
  const dir = options.dir || fs.mkdtempSync(path.join(__dirname, '.integration-'));
  let userData = dir;
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'jiangzhi-data.json'); if (!options.dir) fs.writeFileSync(file, JSON.stringify(initial));
  if (options.cipher) fs.writeFileSync(path.join(dir, 'credentials.bin'), options.cipher);
  const handlers = {}, events = {}, exits = [], timers = [], aiKeys = [], windows = [];
  class Window { constructor() { windows.push(this); this.webContents = { isDestroyed: () => false, send() {} }; } loadFile() {} on() {} isDestroyed() { return false; } setOpacity() {} setAlwaysOnTop() {} setPosition() {} }
  const electron = { BrowserWindow: Window, app: { getPath: () => userData, setPath: (name, value) => { userData = value; }, on() {}, requestSingleInstanceLock: () => start, quit() {}, exit: code => exits.push(code), on() {}, setAppUserModelId() {}, whenReady: () => ({ then: fn => fn() }) }, ipcMain: { handle: (k, fn) => handlers[k] = fn, on: (k, fn) => events[k] = fn }, safeStorage: { isEncryptionAvailable: () => !options.unavailable, encryptString: s => Buffer.from('cipher:' + s), decryptString: b => { if(options.decryptFail) throw new Error('locked'); return b.toString().slice(7); } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8'), { require: name => name === 'electron' ? electron : (name === 'fs' && options.failMigration ? new Proxy(fs, { get(target, key) { if(key === 'writeFileSync') return (file, ...args) => { if(String(file).endsWith('.migration.tmp')) throw new Error('read-only'); return target.writeFileSync(file, ...args); }; return target[key]; } }) : (name === 'os' ? { tmpdir: () => dir } : require(name))), __dirname, process: { env: start ? { SMOKE: '1' } : {} }, console: { log() {}, error() {} }, Buffer, fetch: async (url, request) => { aiKeys.push(request.headers.Authorization); return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: '{}' } }] }) }; }, setTimeout: (fn, ms) => timers.push({ fn, ms }), clearTimeout() {}, setInterval() {} });
  return { dir, file, handlers, events, exits, timers, aiKeys, windows, get userData() { return userData; } };
}
const fixture = () => ({ schema_version: 1, settings: { apiKey: 'synthetic-key' }, tasks: [{ id: 'task1' }], points: [], cues: [], sessions: [], evidence: [], journals: [], dailyReviews: [] });
test('main migrates legacy key, never returns it, restores backups while preserving credential', t => {
  const h = harness(t, fixture()); const state = h.handlers['store:load']();
  assert.equal(state.settings.apiKey, undefined); assert.equal(state.settings.apiKeyConfigured, true);
  assert.equal(JSON.parse(fs.readFileSync(h.file)).settings.apiKey, undefined);
  assert.equal(fs.readFileSync(path.join(h.dir, 'credentials.bin'), 'utf8'), 'cipher:synthetic-key');
  fs.mkdirSync(path.join(h.dir, 'backups')); const backup = fixture(); backup.tasks = [{ id: 'restored' }]; backup.settings.apiKey = 'foreign-key';
  fs.writeFileSync(path.join(h.dir, 'backups', 'backup-test.json'), JSON.stringify(backup));
  assert.equal(h.handlers['backup:restore'](null, 'backup-test.json').ok, true);
  const restored = h.handlers['store:load'](); assert.equal(restored.tasks[0].id, 'restored'); assert.equal(restored.settings.apiKeyConfigured, true);
  assert.equal(fs.readFileSync(path.join(h.dir, 'credentials.bin'), 'utf8'), 'cipher:synthetic-key');
});
test('smoke error exits with nonzero status', t => {
  const h = harness(t, fixture()); h.events['smoke:error'](null, 'synthetic failure'); assert.deepEqual(h.exits, [1]);
});
test('smoke readiness timeout exits with nonzero status', t => {
  const h = harness(t, fixture(), true);
  const timer = h.timers.find(x => x.ms === 20000); assert.ok(timer); timer.fn(); assert.deepEqual(h.exits, [1]);
  assert.notEqual(h.userData, h.dir);
  assert.equal(JSON.parse(fs.readFileSync(h.file)).settings.apiKey, 'synthetic-key');
  assert.equal(fs.existsSync(path.join(h.dir, 'credentials.bin')), false);
});
test('legacy survives unavailable encryption even with unreadable old ciphertext, including restart', t => {
  const h = harness(t, fixture(), false, { unavailable: true, decryptFail: true, cipher: 'old-cipher' });
  const state = h.handlers['store:load'](); assert.equal(state.tasks[0].id, 'task1');
  assert.equal(JSON.parse(fs.readFileSync(h.file)).settings.apiKey, 'synthetic-key');
  h.handlers['store:save'](null, state);
  assert.equal(JSON.parse(fs.readFileSync(h.file)).settings.apiKey, 'synthetic-key');
  const restart = harness(t, null, false, { dir: h.dir, unavailable: true });
  assert.equal(restart.handlers['store:load']().settings.apiKeyConfigured, true);
  assert.equal(fs.readFileSync(path.join(h.dir, 'credentials.bin'), 'utf8'), 'old-cipher');
});
test('unavailable encryption rejects replacement without changing persisted or active credential', async t => {
  const initial = fixture(); delete initial.settings.apiKey;
  const h = harness(t, initial, false, { unavailable: true, cipher: 'cipher:old-key' });
  h.handlers['store:load']();
  assert.throws(() => h.handlers['credentials:set'](null, 'new-key'), /系统加密不可用/);
  assert.equal(fs.readFileSync(path.join(h.dir, 'credentials.bin'), 'utf8'), 'cipher:old-key');
  const restart = harness(t, null, false, { dir: h.dir });
  assert.equal(restart.handlers['store:load']().settings.apiKeyConfigured, true);
  await restart.handlers['ai:generate'](null, { messages: [] });
  assert.deepEqual(restart.aiKeys, ['Bearer old-key']);
  assert.equal(restart.aiKeys.includes('Bearer new-key'), false);
});
test('no-legacy reads never rewrite store and migration cleanup failure does not block tasks', t => {
  const initial = fixture(); delete initial.settings.apiKey;
  const h = harness(t, initial, false, { failMigration: true });
  assert.equal(h.handlers['store:load']().tasks[0].id, 'task1');
  const legacy = harness(t, fixture(), false, { failMigration: true });
  assert.equal(legacy.handlers['store:load']().tasks[0].id, 'task1');
  assert.equal(JSON.parse(fs.readFileSync(legacy.file)).settings.apiKey, 'synthetic-key');
  assert.equal(fs.readFileSync(path.join(legacy.dir, 'credentials.bin'), 'utf8'), 'cipher:synthetic-key');
});

test('smoke succeeds only when all three distinct windows report readiness', t => {
 const h = harness(t, fixture(), true);
 const ready = h.events['smoke:ready'];
 ready({ sender: h.windows[0].webContents }); ready({ sender: h.windows[0].webContents }); ready({ sender: h.windows[1].webContents });
 assert.equal(h.timers.some(x => x.ms === 800), false);
 ready({ sender: h.windows[2].webContents });
 assert.equal(h.timers.filter(x => x.ms === 800).length, 1);
});
