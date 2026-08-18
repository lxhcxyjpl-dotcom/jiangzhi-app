// 页面渲染验证：file:// 页面 -> PNG 截图
// 用法：electron render-page.cjs <file路径或URL> <输出png> [宽] [高]
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const [target, outPath, wStr, hStr] = process.argv.slice(2);
const w = parseInt(wStr || '900', 10), h = parseInt(hStr || '900', 10);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, width: w, height: h, useContentSize: true,
      webPreferences: { offscreen: true } });
    await win.loadFile(target);
    await new Promise(r => setTimeout(r, 500));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
    fs.writeFileSync(outPath, img.toPNG());
    const stats = await win.webContents.executeJavaScript(`(function(){
      var r = { cells: document.querySelectorAll('.cell').length,
        week: document.getElementById('weekLabel').textContent,
        mini: document.getElementById('mini').textContent,
        collapsed: document.getElementById('wrap').classList.contains('collapsed') };
      document.querySelector('[data-act=collapse]').click();
      r.collapsedAfterClick = document.getElementById('wrap').classList.contains('collapsed');
      r.miniAfter = document.getElementById('mini').textContent;
      return r;
    })()`);
    console.log('STATS ' + JSON.stringify(stats));
    console.log('OK ' + outPath);
  } catch (e) {
    console.error('FAIL', e && e.message || e);
    process.exitCode = 1;
  }
  app.exit(process.exitCode || 0);
});
