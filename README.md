# 主动降智 · 专注 WebApp

> 「在执行前完成决策交接、执行中限制元审议、执行后收集真实证据」的轻量专注工具。
> 方法论来源：《主动降智：从"骗自己"到行为自动化》（配套文档见项目外的 outputs/ 目录）。

## 快速开始（桌面版）

```powershell
cd jiangzhi-app
npm ci           # 依赖缓存可通过 npm --cache D:\Programs\npm-cache ci 指定到 D 盘
npm start        # 启动：主窗口 + 桌面组件 + 托盘
```

首次启动：主窗口是完整 App；桌面组件（无边框置顶小窗）默认显示，可在主窗右上角或托盘切换显隐。

## 单 HTML 版（浏览器 / 手机）

`app/index.html` 是一个完全自包含的单文件，双击即可在浏览器中运行（数据存 localStorage）。
注意：浏览器版调 DeepSeek 接口受跨域限制，若失败请改用桌面版；桌面版由应用本体直连 API，无此问题。

## DeepSeek 接入

「设置」页粘贴你的 DeepSeek API Key（桌面版通过 Electron safeStorage 加密存于用户数据目录 credentials.bin；浏览器版为 localStorage 明文）。
模型：deepseek-chat，JSON 输出模式。功能边界：只做「想法 → 执行清单」，提示语与鼓励语一律不生成。

## 图标

- 源设计：`assets/icon.svg`（降智拨盘·满弧表盘），备选方案 `assets/icon-v3.svg`（半亮+虚环）/ `assets/icon-steps.svg` / `assets/icon-wave.svg`；
- 重画后重新渲染：`electron tools/render-icon.cjs assets/icon.svg assets/icon-512.png 512`；
- 重新打包 ICO：`powershell -ExecutionPolicy Bypass -File tools/build-ico.ps1`。

## 桌面课表

- 虚构示例周课表组件：`app/timetable.html`（单文件自包含，双击可在浏览器直接运行）；
- 数据源：`assets/timetable-data.json`（虚构示例，不对应真实班级）；
- 重新生成数据：`python tools/parse-timetable.py <xlsx路径>`；重新打包单文件：`python tools/build-timetable.py`；
- 桌面版随应用启动自动钉在左上角，可折叠、可拖角缩放；托盘菜单 / 主窗顶栏「▦ 课表」/ 设置页可显隐。

## 数据

- 桌面版：`%APPDATA%/主动降智/jiangzhi-data.json`（设置页可一键导出/导入）
- 浏览器版：localStorage
- `schema_version` 字段预留升级。

## 开发说明

- 前端零框架，纯 HTML/CSS/JS，单文件 `app/index.html`；
- `main.js` 负责三窗口（主窗 + 组件窗 + 课表窗）、托盘、IPC、JSON 文件存储、DeepSeek 代理；
- 组件窗与主窗共享同一份数据与专注会话状态，通过 IPC 广播同步；
- `$env:SMOKE='1'; npx electron .` 可启动窗口进行冒烟测试（启动成功后自动退出并打印 SMOKE_OK）。

## 展示版与数据边界（2026-11-01）

这是个人专注与执行清单原型，方法有效性未经临床或行为实验验证。AI 功能可选，需要自行配置 DeepSeek Key；未配置时仍可使用清单、计时和复盘。

展示课表全部为虚构示例。桌面与浏览器导出不包含 API Key，新生成的桌面备份也不包含 Key；导入及恢复保留当前本机 Key。历史导出和旧备份可能包含明文 Key，请自行妥善处理。桌面凭据使用系统加密，renderer 仅获得配置状态；加密不可用时拒绝保存新 Key，保留原配置并提示重试。旧 Key 迁移写入失败时保留旧本机配置并提示重试，不影响任务。浏览器版仍为 localStorage 明文。

开发验证：`npm test` 运行无 Electron 依赖的导入/导出策略回归；CI 执行相同检查。SMOKE 是实际启动 Electron 后自动退出的检查，会创建窗口，不是无界面测试。界面体验和 Windows 安装包尚未验收。
