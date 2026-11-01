const { test } = require('node:test');
const assert = require('node:assert/strict');
const { portableData, importedData, validateImport } = require('./data-policy');
const fixture = () => ({ schema_version: 1, settings: { apiKey: 'synthetic-secret' }, tasks: [{ id: 'task-1' }], points: [], cues: [], sessions: [], evidence: [], journals: [], dailyReviews: [] });
test('exports exclude credentials without mutating live settings', () => {
  const live = fixture();
  assert.equal(portableData(live).settings.apiKey, undefined);
  assert.equal(live.settings.apiKey, 'synthetic-secret');
  assert.deepEqual(portableData(live).tasks, live.tasks);
});
test('imports preserve local credentials and reject malformed collections', () => {
  const incoming = fixture(); incoming.settings.apiKey = 'foreign-secret';
  assert.equal(importedData(incoming, fixture()).settings.apiKey, 'synthetic-secret');
  for (const bad of [null, [], {}, { ...fixture(), schema_version: 99 }, { ...fixture(), tasks: {} }, { ...fixture(), tasks: [null] }])
    assert.throws(() => validateImport(bad));
});
