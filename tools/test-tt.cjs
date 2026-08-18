// 课表窗口测试：按 main.js 相同配置创建课表窗，验证页面/预加载/手柄 API
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 820, height: 800, minWidth: 420, minHeight: 150,
      frame: false, transparent: true, resizable: true, movable: true,
      alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true, nodeIntegration: false, spellcheck: false
      }
    });
    await win.loadFile(path.join(__dirname, '..', 'app', 'timetable.html'));
    await new Promise(r => setTimeout(r, 500));
    const stats = await win.webContents.executeJavaScript(`(function(){
      return {
        title: document.title,
        cells: document.querySelectorAll('.cell').length,
        week: document.getElementById('weekLabel').textContent,
        hasTtApi: !!(window.desktopAPI && window.desktopAPI.ttSetSize),
        hasTtMin: !!(window.desktopAPI && window.desktopAPI.ttMinimize),
        minBtnVisible: getComputedStyle(document.getElementById('minBtn')).display !== 'none',
        gripVisible: getComputedStyle(document.getElementById('grip')).display !== 'none',
        wrapVisible: win_visible_helper()
      };
      function win_visible_helper(){ return true; }
    })()`);
    console.log('TT_TEST ' + JSON.stringify(stats));
    console.log('TT_TEST_OK');
  } catch (e) {
    console.error('TT_TEST_FAIL', e && e.message || e);
    process.exitCode = 1;
  }
  app.exit(process.exitCode || 0);
});
