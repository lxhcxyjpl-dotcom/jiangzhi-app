// 图标渲染脚本：SVG -> PNG（透明背景，尺寸精确可控）
// 用法：electron render-icon.cjs <svg路径> <输出png路径> [尺寸=512]
// 原理：离屏窗口加载 <img>，在渲染进程内用 canvas 按目标尺寸绘制后导出 dataURL。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');

const [svgPath, outPath, sizeStr] = process.argv.slice(2);
const size = parseInt(sizeStr || '512', 10);

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  try {
    let svg = fs.readFileSync(svgPath, 'utf8');
    // 让 SVG 根元素与目标尺寸一致，避免缩放歧义
    svg = svg.replace(/width="\d+"\s+height="\d+"/, `width="${size}" height="${size}"`);
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<!doctype html><html><body style="margin:0"><img id="i"></body></html>'));
    const dataUrl = await win.webContents.executeJavaScript(`new Promise(function(res, rej){
      var img = document.getElementById('i');
      img.onload = function(){
        var c = document.createElement('canvas');
        c.width = ${size}; c.height = ${size};
        var g = c.getContext('2d');
        g.drawImage(img, 0, 0, ${size}, ${size});
        res(c.toDataURL('image/png'));
      };
      img.onerror = function(){ rej('img load failed'); };
      img.src = ${JSON.stringify(svgUrl)};
    })`);
    fs.writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('OK ' + outPath);
  } catch (e) {
    console.error('FAIL', (e && e.message) || e);
    process.exitCode = 1;
  }
  app.exit(process.exitCode || 0);
});
