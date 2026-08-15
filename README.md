# 主动降智 · 专注 WebApp

> 「在执行前完成决策交接、执行中限制元审议、执行后收集真实证据」的轻量专注工具。
> 方法论来源：《主动降智：从"骗自己"到行为自动化》（配套文档见项目外的 outputs/ 目录）。

## 快速开始（桌面版）

```powershell
cd jiangzhi-app
npm install      # 已配好国内 electron 镜像（.npmrc）
npm start        # 启动：主窗口 + 桌面组件 + 托盘
```

首次启动：主窗口是完整 App；桌面组件（无边框置顶小窗）默认显示，可在主窗右上角或托盘切换显隐。

## 单 HTML 版（浏览器 / 手机）

`app/index.html` 是一个完全自包含的单文件，双击即可在浏览器中运行（数据存 localStorage）。
注意：浏览器版调 DeepSeek 接口受跨域限制，若失败请改用桌面版；桌面版由应用本体直连 API，无此问题。

## DeepSeek 接入

「设置」页粘贴你的 DeepSeek API Key（只存本机：桌面版存用户数据目录的 jiangzhi-data.json，浏览器版存 localStorage）。
模型：deepseek-chat，JSON 输出模式。功能边界：只做「想法 → 执行清单」，提示语与鼓励语一律不生成。

## 图标

- 源设计：`assets/icon.svg`（降智拨盘·满弧表盘），备选方案 `assets/icon-v3.svg`（半亮+虚环）/ `assets/icon-steps.svg` / `assets/icon-wave.svg`；
- 重画后重新渲染：`electron tools/render-icon.cjs assets/icon.svg assets/icon-512.png 512`；
- 重新打包 ICO：`powershell -ExecutionPolicy Bypass -File tools/build-ico.ps1`。

## 数据

- 桌面版：`%APPDATA%/主动降智/jiangzhi-data.json`（设置页可一键导出/导入）
- 浏览器版：localStorage
- `schema_version` 字段预留升级。

## 开发说明

- 前端零框架，纯 HTML/CSS/JS，单文件 `app/index.html`；
- `main.js` 负责双窗口（主窗 + 组件窗）、托盘、IPC、JSON 文件存储、DeepSeek 代理；
- 组件窗与主窗共享同一份数据与专注会话状态，通过 IPC 广播同步；
- `$env:SMOKE='1'; npx electron .` 可无界面冒烟测试（启动成功后自动退出并打印 SMOKE_OK）。
