'use strict';
const fs = require('fs');
class CredentialVault {
  constructor(file, encryption) { this.file = file; this.encryption = encryption; this.key = ''; this.status = ''; this.migrationPending = false; this.legacySource = ''; }
  available() { return this.encryption.isEncryptionAvailable() && (!this.encryption.getSelectedStorageBackend || this.encryption.getSelectedStorageBackend() !== 'basic_text'); }
  load(legacy) {
    if (legacy) {
      this.key = legacy; this.legacySource = legacy; this.migrationPending = true;
      try { this.set(legacy); } catch { this.migrationPending = true; this.legacySource = legacy; this.status = '凭据迁移失败：旧本机配置保留，任务可继续使用；请重试保存 Key'; }
    } else if (fs.existsSync(this.file)) {
      try {
        if (!this.available()) throw new Error('unavailable');
        this.key = this.encryption.decryptString(fs.readFileSync(this.file));
        this.status = '系统加密存储';
      } catch { this.status = '凭据暂不可解密，请重新输入；原加密文件保留'; }
    }
    return this.key;
  }
  set(value) {
    if (typeof value !== 'string' || value.length > 4096) throw new Error('Key 格式无效');
    if (!value) { if (fs.existsSync(this.file)) fs.unlinkSync(this.file); this.key = ''; this.migrationPending = false; this.legacySource = ''; this.status = '未配置'; return; }
    if (!this.available()) throw new Error('系统加密不可用，未保存新 Key；原配置保留，请稍后重试');
    const encrypted = this.encryption.encryptString(value);
    fs.writeFileSync(this.file + '.tmp', encrypted, { mode: 0o600 });
    fs.renameSync(this.file + '.tmp', this.file);
    this.key = value; this.migrationPending = false; this.legacySource = ''; this.status = '系统加密存储';
  }
}
module.exports = { CredentialVault };
