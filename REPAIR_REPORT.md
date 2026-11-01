# 修复与验收报告

Windows桌面优先，保留网页。工作目录为隔离副本；原项目和真实用户数据未修改。基线main.js Git blob SHA1为540ba874e8d0d033b4ac4c07755601b8a0c6f0b1，与主线程实时核对的远端一致。未推送、部署或改变仓库公开性。

## 当前成果

桌面Key接入Electron safeStorage，renderer仅获取配置状态，AI由主进程读取凭据。旧Key确认加密持久化后才清理；失败保留迁移源，任务继续可用。加密不可用时拒绝保存新Key并保留原配置。桌面/网页导出及新桌面备份移除Key；导入/恢复校验版本和集合、保留本机凭据。展示课表为虚构数据。新增回归测试和Windows CI配置。

复审已修复迁移源提前清理、加密不可用时旧Key意外恢复、无迁移时多余写盘和写入失败阻断启动等风险。课表按实际节数渲染，避免示例数据越界；SMOKE强制临时userData并要求三个不同窗口均ready。

## 验收结果

15项自动测试通过，覆盖迁移/失败恢复、导入拒绝、备份恢复保留凭据、跨重启凭据行为、SMOKE退出与三窗口去重、示例课表渲染和周导航。加密后端及Electron IPC对象使用模拟。语法与diff检查通过。

主线程在获批环境完成真实Windows Electron三窗口启动验收：spawnSync退出码0；stdout依次为SMOKE_READY timetable、SMOKE_READY widget、SMOKE_READY main、SMOKE_OK；stderr为空。此前安装及运行阻碍已排除。

## 限制与交付边界

主线程另以真实Electron运行verification/vault-smoke.cjs：当前CredentialVault将全新合成值写入Windows safeStorage密文，确认文件不含原文、新vault重读一致，临时目录已清理；退出码0、VAULT_SMOKE_OK、stderr为空。真实Windows加密/解密合成值检查通过。真实用户旧配置迁移仍未触碰、未实测；完整renderer脱敏端到端流程亦未实测，不能以局部检查替代。未进行完整手工UI验收、真实AI API调用或医学/行为方法效果验证。CI配置尚未远端运行。

浏览器Key仍为localStorage明文。旧导出和旧备份可能含明文Key，不自动删除或改写。导入只校验版本及集合，不是逐业务字段完整schema。隔离Git基线含原课表历史，不可直接公开该Git历史；交付使用当前工作树白名单，排除.git、node_modules、.npm-cache、运行日志与历史课表。
