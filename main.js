// 主动降智 · Electron 主进程
// 职责：双窗口（主窗 + 桌面组件窗）、托盘、IPC、JSON 文件存储、DeepSeek API 代理
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog, Notification, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const SMOKE = !!process.env.SMOKE;
const WIDGET_W = 356;          // 组件窗基础宽度（含阴影留白）
const WIN_TITLE = '主动降智';

let mainWin = null;
let widgetWin = null;
let ttWin = null;
let tray = null;
let quitting = false;
let trayIconReady = false;

// ---------- 存储 ----------
let storeCache = null;
const storePath = () => path.join(app.getPath('userData'), 'jiangzhi-data.json');

function defaultStore() {
  return {
    schema_version: 1,
    settings: { apiKey: '', defaultMinutes: 25, sound: true, cueVisible: true, widgetOpacity: 0.97, theme: 'light', fontScale: 1, onboarded: false, dailyRemind: { enabled: false, time: '21:30', lastFired: '' } },
    tasks: [], points: [], cues: [], sessions: [], evidence: [], journals: [], dailyReviews: [],
    currentSession: null, aiWeekly: null,
    aiPrefs: { lastTemplate: null, lastAnswers: {} }
  };
}
function normalizeStore(s) {
  const d = defaultStore();
  if (!s || typeof s !== 'object') return d;
  for (const k of Object.keys(d)) if (!(k in s)) s[k] = d[k];
  s.settings = Object.assign({}, d.settings, s.settings || {});
  s.settings.dailyRemind = Object.assign({}, d.settings.dailyRemind, s.settings.dailyRemind || {});
  return s;
}
function newestBackupRaw() {
  try {
    const dir = backupDir();
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
    for (const f of files) {
      try { const raw = fs.readFileSync(path.join(dir, f), 'utf8'); JSON.parse(raw); return raw; } catch (e) {}
    }
  } catch (e) {}
  return null;
}
function loadStore() {
  if (storeCache) return storeCache;
  try {
    const raw = fs.readFileSync(storePath(), 'utf8');
    storeCache = normalizeStore(JSON.parse(raw));
  } catch (e) {
    console.error('[store] 主数据文件无法解析:', e.message);
    const rec = newestBackupRaw();
    if (rec) {
      try {
        storeCache = normalizeStore(JSON.parse(rec));
        console.log('[store] 已自动从最近备份恢复数据');
      } catch (e2) { storeCache = defaultStore(); }
    } else {
      storeCache = defaultStore();
      if (e.code !== 'ENOENT') console.error('[store] 无可用备份，使用默认');
    }
  }
  return storeCache;
}
function saveStore(data) {
  storeCache = normalizeStore(data);
  try {
    maybeBackup();
    const tmp = storePath() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(storeCache, null, 2), 'utf8');
    fs.renameSync(tmp, storePath());
  }
  catch (e) { console.error('[store] 写入失败:', e.message); }
  broadcast('state-changed', storeCache);
  applyWidgetOpacity();
}

// ---------- 自动备份（滚动保留最近 10 份，约每分钟一份） ----------
let lastBackupAt = 0;
function backupDir() { return path.join(app.getPath('userData'), 'backups'); }
function maybeBackup() {
  const now = Date.now();
  if (now - lastBackupAt < 60000) return;
  try {
    const src = storePath();
    if (!fs.existsSync(src)) return;
    const raw = fs.readFileSync(src, 'utf8');
    JSON.parse(raw);
    lastBackupAt = now;
    fs.mkdirSync(backupDir(), { recursive: true });
    const name = 'backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    fs.writeFileSync(path.join(backupDir(), name), raw, 'utf8');
    const files = fs.readdirSync(backupDir()).filter(f => f.endsWith('.json')).sort().reverse();
    for (const f of files.slice(10)) fs.unlinkSync(path.join(backupDir(), f));
  } catch (e) { console.error('[backup]', e.message); }
}
function applyWidgetOpacity() {
  const op = Number((storeCache && storeCache.settings && storeCache.settings.widgetOpacity)) || 1;
  if (widgetWin && !widgetWin.isDestroyed()) widgetWin.setOpacity(Math.min(1, Math.max(0.35, op)));
}

// ---------- 每日复盘提醒（桌面版后台调度） ----------
function checkRemind() {
  try {
    const r = storeCache && storeCache.settings && storeCache.settings.dailyRemind;
    if (!r || !r.enabled || !r.time) return;
    const d = new Date();
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (hm === r.time && r.lastFired !== today) {
      r.lastFired = today;
      try { fs.writeFileSync(storePath(), JSON.stringify(storeCache, null, 2), 'utf8'); } catch (e) {}
      if (Notification.isSupported()) {
        new Notification({ title: '该复盘了', body: '今天有什么证据说明我向前走了一点？还有哪个阻力没有解决？' }).show();
      }
    }
  } catch (e) {}
}

// ---------- 窗口 ----------
function broadcast(channel, payload) {
  for (const w of [mainWin, widgetWin]) {
    if (w && !w.isDestroyed() && !w.webContents.isDestroyed()) {
      try { w.webContents.send(channel, payload); } catch (e) {}
    }
  }
}

function createMain() {
  mainWin = new BrowserWindow({
    width: 1020, height: 760, minWidth: 880, minHeight: 600,
    title: WIN_TITLE,
    backgroundColor: '#F7F1E6',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, spellcheck: false
    }
  });
  mainWin.loadFile(path.join(__dirname, 'app', 'index.html'));
  mainWin.on('close', (e) => {
    if (!quitting) { e.preventDefault(); mainWin.hide(); }
  });
  mainWin.on('closed', () => { mainWin = null; });
}

function createWidget() {
  widgetWin = new BrowserWindow({
    width: WIDGET_W, height: 300,
    frame: false, transparent: true, resizable: false, movable: true,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, spellcheck: false
    }
  });
  widgetWin.setAlwaysOnTop(true, 'floating');
  applyWidgetOpacity();
  try {
    const wa = screen.getPrimaryDisplay().workArea;
    widgetWin.setPosition(wa.x + wa.width - WIDGET_W - 24, wa.y + 24);
  } catch (e) {}
  widgetWin.loadFile(path.join(__dirname, 'app', 'index.html'), { query: { window: 'widget' } });
  widgetWin.on('close', (e) => {
    if (!quitting) { e.preventDefault(); widgetWin.hide(); }
  });
  widgetWin.on('closed', () => { widgetWin = null; });
}

function createTimetable() {
  ttWin = new BrowserWindow({
    width: 820, height: 800, minWidth: 420, minHeight: 150,
    frame: false, transparent: true, resizable: true, movable: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, spellcheck: false
    }
  });
  try {
    const wa = screen.getPrimaryDisplay().workArea;
    ttWin.setPosition(wa.x + 40, wa.y + 40);
  } catch (e) {}
  ttWin.loadFile(path.join(__dirname, 'app', 'timetable.html'));
  ttWin.on('closed', () => { ttWin = null; });
}

function toggleTimetable(show) {
  const visible = ttWin && !ttWin.isDestroyed() && ttWin.isVisible();
  const want = (typeof show === 'boolean') ? show : !visible;
  if (want) {
    if (!ttWin || ttWin.isDestroyed()) createTimetable();
    else ttWin.showInactive();
  } else if (ttWin) ttWin.hide();
  return want;
}

function showMain() {
  if (!mainWin) createMain(); else { mainWin.show(); mainWin.focus(); }
  return true;
}
function toggleWidget(show) {
  const visible = widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible();
  const want = (typeof show === 'boolean') ? show : !visible;
  if (want) {
    if (!widgetWin || widgetWin.isDestroyed()) createWidget();
    else widgetWin.showInactive();
  } else if (widgetWin) widgetWin.hide();
  return want;
}

function smokeOk() {
  console.log('SMOKE_OK');
  setTimeout(() => { quitting = true; app.quit(); }, 800);
}
ipcMain.on('smoke:ready', () => { if (SMOKE) smokeOk(); });
ipcMain.on('smoke:error', (e, msg) => {
  console.error('SMOKE_ERROR: ' + msg);
  quitting = true; app.exit(1);
});

// ---------- 托盘 ----------
function createTray(iconBase64) {
  if (tray || trayIconReady) return;
  const img = nativeImage.createFromDataURL(iconBase64);
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip(WIN_TITLE);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主窗口', click: () => showMain() },
    { label: '显示 / 隐藏桌面组件', click: () => toggleWidget() },
    { label: '显示 / 隐藏课表', click: () => toggleTimetable() },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', () => toggleWidget());
  tray.on('double-click', () => showMain());
  trayIconReady = true;
}

// ---------- IPC ----------
ipcMain.handle('store:load', () => loadStore());
ipcMain.handle('store:save', (e, data) => { saveStore(data); return true; });
ipcMain.handle('widget:toggle', (e, show) => toggleWidget(show));
ipcMain.handle('widget:set-size', (e, w, h) => {
  if (widgetWin && !widgetWin.isDestroyed()) widgetWin.setContentSize(Math.round(w), Math.round(h));
  return true;
});
ipcMain.handle('widget:get-visible', () => !!(widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible()));
ipcMain.handle('timetable:toggle', (e, show) => toggleTimetable(show));
ipcMain.handle('timetable:set-size', (e, w, h) => {
  if (ttWin && !ttWin.isDestroyed()) ttWin.setContentSize(Math.round(w), Math.round(h));
  return true;
});
ipcMain.handle('timetable:minimize', () => {
  if (ttWin && !ttWin.isDestroyed()) ttWin.minimize();
  return true;
});
ipcMain.handle('main:open', () => { showMain(); return true; });
ipcMain.handle('main:hide', () => { if (mainWin) mainWin.hide(); return true; });
ipcMain.handle('tray:icon', (e, b64) => { createTray(b64); return true; });
ipcMain.handle('export:data', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出数据', defaultPath: 'jiangzhi-export-' + new Date().toISOString().slice(0, 10) + '.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, JSON.stringify(loadStore(), null, 2), 'utf8');
  return { ok: true, filePath };
});
ipcMain.handle('import:data', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '导入数据', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePaths || !filePaths.length) return { ok: false };
  const raw = fs.readFileSync(filePaths[0], 'utf8');
  const data = normalizeStore(JSON.parse(raw));
  saveStore(data);
  return { ok: true, data };
});
ipcMain.handle('backup:list', () => {
  try {
    const dir = backupDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse().map(f => {
      const st = fs.statSync(path.join(dir, f));
      return { name: f, mtime: st.mtimeMs, size: st.size };
    });
  } catch (e) { return []; }
});
ipcMain.handle('backup:restore', (e, name) => {
  try {
    const file = path.join(backupDir(), path.basename(String(name || '')));
    const data = normalizeStore(JSON.parse(fs.readFileSync(file, 'utf8')));
    saveStore(data);
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});

// ---------- DeepSeek ----------
async function callDeepSeek({ apiKey, messages }) {
  if (!apiKey) throw new Error('未配置 API Key，请到设置页填写');
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.4,
      max_tokens: 2200,
      response_format: { type: 'json_object' }
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error('DeepSeek API ' + res.status + ': ' + text.slice(0, 300));
  const data = JSON.parse(text);
  return data.choices && data.choices[0] && data.choices[0].message.content;
}
ipcMain.handle('ai:generate', async (e, payload) => {
  try { return { ok: true, text: await callDeepSeek(payload) }; }
  catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});

// ---------- 生命周期 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
  app.setAppUserModelId('com.jiangzhi.app');
  app.whenReady().then(() => {
    loadStore();
    createMain();
    createWidget();
    createTimetable();
    setInterval(checkRemind, 30000);
    if (SMOKE) setTimeout(() => { console.error('SMOKE_TIMEOUT'); quitting = true; app.quit(); }, 20000);
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { if (quitting) app.quit(); });
}
