# 首期 QA 验收矩阵

**测试数据与边界**：全部使用虚构的地产推广事项，例如“秋季新盘样板间开放推广”。测试进程的 IPC 内存数据目录固定为 `C:/qa-isolated`，不会读取、写入或恢复任何真实用户数据。

| 编号 | 验收场景 | 关键检查 | 自动化层级 | 当前状态 |
| --- | --- | --- | --- | --- |
| Q01 | 新建事项 | 标题必填；首次点击创建保存；创建后可继续编辑 | Edge Playwright UI/IPC 模拟 | 通过 |
| Q02 | 编辑自动保存 | 普通字段更新后提示保存；失败时显示中文错误且不伪成功 | Edge Playwright UI/IPC 模拟 | 通过 |
| Q03 | 进度与跟进 | 进度单独提交、历史保留且最新在前；勾选跟进不改变状态 | Edge Playwright UI/IPC 模拟 | 通过 |
| Q04 | 组合筛选 | 分类、状态、关键词与“下周/下月”可组合；日期边界遵循契约 | Edge Playwright UI/IPC 模拟 + 筛选单测 | 通过 |
| Q05 | 分类管理 | 新建、改名、全量排序、删除；删分类后关联事项变未分类 | Edge Playwright UI/IPC 模拟 | 通过 |
| Q06 | 回收站 | 仅软删除、回收站可恢复；列表与回收站分离 | Edge Playwright UI/IPC 模拟 | 通过 |
| Q07 | 备份恢复 | 导出、检查、确认恢复、报告安全备份位置；恢复失败无伪成功 | Edge Playwright UI/IPC 模拟 + IPC 故障注入 | 通过 |
| Q08 | 固定 IPC 契约 | 前端命令名与参数、正常与故障返回可连通 | Vitest + `@tauri-apps/api/mocks` | 通过 |
| Q09 | 真实本地数据 | SQLite 持久化、事务恢复、`WORK_MEMO_DATA_DIR` 隔离 | Rust `cargo test` | 通过（3 项 Rust 测试） |

## 运行方式

本轮被测集成提交：`6dbe0adc6cc018dc2ff0d565f2f5620143084e1c`（`fix: harden local saves and responsive filtering`）。

在 QA 分支合入 PM 指定的**确定集成提交**后执行：

```powershell
npm ci
npm run test
$env:QA_UI_READY = '1'
npm run test:e2e
Remove-Item Env:QA_UI_READY
```

`npm run test` 只验证浏览器中的 Tauri IPC 契约；它通过 `@tauri-apps/api/mocks` 注入内存双替身。`npm run test:e2e` 的浏览器页使用同一 IPC 契约的注入实现，检查可见界面、交互与故障文案。两者都**不是** SQLite、文件系统、真实对话框或 Tauri 桌面运行时测试，不能替代 Q09。

Playwright 配置使用本机 Microsoft Edge 通道，避免下载独立浏览器；只有设置 `QA_UI_READY=1` 才启用 UI 用例。QA 使用页面注入的 IPC 和对话框双替身，因此该结果不代表真实 SQLite、文件系统、桌面对话框或 Tauri 桌面运行时。

## 本轮实测结果

被测版本为 `6dbe0adc6cc018dc2ff0d565f2f5620143084e1c`，在 `qa/v1` 合入后执行。

- `npm run build`：通过。
- `npm test`：通过，4 个测试文件、16 项测试。
- `cargo test`：通过，SQLite 持久化/进度历史、无效备份不改数据、恢复前安全备份共 3 项 Rust 测试。
- `QA_UI_READY=1 npm run test:e2e`：通过，Edge 6 项 UI/IPC 模拟测试。测试服务使用隔离端口 4173，且不监听 Rust 构建目录，以免 Windows 锁定调试符号影响前端测试。

本轮没有发现需退回业务开发员的缺陷。未覆盖项不是失败：真实 Windows 桌面窗口、文件选择/确认对话框、关闭后重开，以及真实 `WORK_MEMO_DATA_DIR` 的端到端操作仍须由 PM 在隔离数据目录中人工验收；不得用浏览器 IPC 模拟结果替代它们。

## 集成后的人工桌面核验

1. 设置一个空的 `WORK_MEMO_DATA_DIR` 测试目录，启动 Tauri 应用；核对重启后数据保留，且默认用户数据未被触碰。
2. 用真实文件选择窗口分别导出、检查和恢复备份；恢复前检查当前数据的安全备份已生成。（本轮由 PM 在隔离环境执行。）
3. 用损坏 JSON 和无法写入的位置各执行一次恢复/保存，核对中文错误、数据无变动。
4. 在 1060px 宽窗口，以键盘完成新建、编辑、切换事项和危险操作确认；核对离开编辑区时不会丢失草稿或未提交进度。
