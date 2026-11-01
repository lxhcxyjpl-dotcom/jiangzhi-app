const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CredentialVault } = require('./credential-vault');
const encrypted = { isEncryptionAvailable: () => true, encryptString: s => Buffer.from('cipher:' + s), decryptString: b => b.toString().slice(7) };
function temp(t) { const dir = fs.mkdtempSync(path.join(__dirname, '.vault-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return path.join(dir, 'credentials.bin'); }
test('legacy key migrates through encrypted backend and reloads', t => {
  const file = temp(t); const vault = new CredentialVault(file, encrypted);
  assert.equal(vault.load('synthetic-old-key'), 'synthetic-old-key');
  assert.equal(fs.readFileSync(file, 'utf8'), 'cipher:synthetic-old-key');
  assert.equal(new CredentialVault(file, encrypted).load(''), 'synthetic-old-key');
  vault.set(''); assert.equal(fs.existsSync(file), false);
});
test('unavailable backend preserves legacy migration source and rejects new key', t => {
  const file = temp(t); const vault = new CredentialVault(file, { isEncryptionAvailable: () => false });
  vault.load('synthetic-legacy'); assert.equal(vault.key, 'synthetic-legacy');
  assert.equal(fs.existsSync(file), false); assert.equal(vault.migrationPending, true); assert.throws(() => vault.set('new-key'), /系统加密不可用/); assert.equal(vault.key, 'synthetic-legacy');
});
test('decryption failure preserves encrypted file and permits retry', t => {
  const file = temp(t); fs.writeFileSync(file, 'unreadable-cipher');
  const vault = new CredentialVault(file, { ...encrypted, decryptString() { throw new Error('locked'); } });
  assert.equal(vault.load(''), ''); assert.equal(fs.readFileSync(file, 'utf8'), 'unreadable-cipher');
});
test('encryption failure preserves prior file and reports failure', t => {
  const file = temp(t); fs.writeFileSync(file, 'old-cipher');
  const vault = new CredentialVault(file, { ...encrypted, encryptString() { throw new Error('failed'); } });
  assert.throws(() => vault.set('new-key')); assert.equal(fs.readFileSync(file, 'utf8'), 'old-cipher');
});
test('failed legacy encryption remains available in memory with retry status', t => {
  const file = temp(t);
  const vault = new CredentialVault(file, { ...encrypted, encryptString() { throw new Error('locked'); } });
  assert.equal(vault.load('legacy-key'), 'legacy-key');
  assert.equal(vault.migrationPending, true); assert.match(vault.status, /旧本机配置保留/);
  assert.equal(fs.existsSync(file), false);
});

