# 首期任务看板

共同基线：e069b8e。PM 主任务：01a07297-1fd3-7043-b38f-6a4f4f645e02。

| 卡号 | 独立任务 | 分支 | 窗口 ID |
|---|---|---|---|
| T01 | 开发员 A｜本地数据与备份 | feat/local-data | 01a072b0-e747-7d60-8558-f9a1bf7f7819 |
| T02 | 开发员 B｜事项录入与跟进 | feat/item-editor | 01a072b1-b7ca-7c20-af09-de333305b586 |
| T03 | 开发员 C｜工作台与分类筛选 | feat/workbench | 01a072b1-c20d-7623-b157-04e0a3cb4564 |
| T04 | 独立测试员｜首期验收 | qa/v1 | 01a072b1-d642-7971-bf85-1a0993ef5113 |

各卡的修改范围和验收条件见 CONTRACT.md。最终测试结果及被测版本写入 QA.md，交付结论由 PM 单独记录。

流程：公共基线 → A/B/C 并行开发与自测 → PM 集成 → QA 固定版本测试 → 原开发员修复 → QA 复测 → PM 最终验收 → main 与 Windows 安装包。

## V2 任务看板

| 卡号 | 任务 | 分支 | 状态 |
| --- | --- | --- | --- |
| T10 | PM｜V2 公共接口与协作基线 | integration/v2 | 进行中 |
| T11 | 开发员 A｜一键备份与 TXT 导出 | feat/quick-backup-export | 待分发 |
| T12 | 开发员 B｜事项卡展示与内联编辑 | feat/inline-item-card | 待分发 |
| T13 | 开发员 C｜单维筛选与导出界面 | feat/workbench-v2 | 待分发 |
| T14 | 独立测试员｜V2 验收 | qa/v2 | 待分发 |
| T15 | PM｜集成与开发版验收 | integration/v2 | 待开始 |

V2 开发完成后只启动开发/调试版本供用户测试；用户明确说“确认通过，可以打包”前不生成新版安装包。

## V2.1 界面优化任务看板

| 卡号 | 任务 | 分支 | 状态 |
| --- | --- | --- | --- |
| T21 | 开发员 A｜窗口底部与三栏滚动 | feat/window-scroll-fix | 已完成（5fa0413） |
| T22 | 开发员 B｜紧凑事项卡与状态灯 | feat/compact-item-card | 已完成（c0eb31c） |
| T23 | 开发员 C｜多维筛选与折叠导航 | feat/multidim-sidebar | 已完成（fdc0655） |
| T24 | 独立测试员｜V2.1 界面验收 | qa/v2.1 | 已通过（2a68e25） |
| T25 | PM｜集成并启动隔离调试版 | integration/v2 | 已完成（调试版运行中） |

## V2.2 调整任务看板

| 卡号 | 任务 | 分支 | 状态 |
| --- | --- | --- | --- |
| T30 | PM｜冻结 V2.2 公共接口与任务边界 | integration/v2 | 已完成 |
| T31 | 开发员 A／替补｜跟进清单模板数据与备份 | fix/follow-up-templates-data | 已完成并集成 |
| T32 | 开发员 B｜默认收起事项卡与完整进度 | feat/collapsible-item-card | 已完成并集成 |
| T33 | 开发员 C｜右侧统一保存与模板界面 | feat/explicit-editor-pane | 已完成并集成 |
| T34 | 独立测试员｜V2.2 验收 | qa/v2.2 | 已通过（33+11+9） |
| T35 | PM｜集成并启动隔离调试版 | integration/v2 | 桌面验收中 |
