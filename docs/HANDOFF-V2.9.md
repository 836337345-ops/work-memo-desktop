# V2.9 开发与交付记录

生成日期：2026年9月8日；分支状态更新：2026年9月9日。

## 一、交付锚点

| 内容 | 提交或标签 |
| --- | --- |
| 最终业务集成 | `0b58fec8942ec8239908ce58df5921d7481b59ca` |
| 独立测试与 QA 集成 | `110d936e1cc4cd4e15eb1127ce93da53f2fcd09e` |
| 用户验收记录 | `18033353fb8891bdbee169a9fcbcfa0ad329f550` |
| 打包授权与构建基线 | `37f7ffc970c3531d05c65cffb0167015d4ad84c9` |
| 工作树基础设施修复 | `f230242d0a9527e9855f5c1478f41d022af8c0fd` |
| 首轮 QA 与缺陷复测报告 | `091c0290f57e8f24a13a46672b0408efa25341d2`、`34ee59b49e681956ae82d88c9b321f3bdcc04f8a` |
| 本地交付标签 | `v2.9-delivered-20260908` |

原始交付时 `main` 位于 `5b99465`，未合并、上传或发布。2026年9月9日，用户在另一窗口将 `main` 与 `integration/v2` 同步到基线 `906eb78`；后续文档维护继续保持两条分支对齐，当前提交以 Git 为准。

## 二、交付范围

- T101：修复导出分类异步载入时的默认全选和用户选择保护。
- T102：增加本机工作台名称设置，默认“工作台”，最多 30 个字符。
- T104：同步 Windows 标题，移动名称设置入口，并调整工作日历和显示全部的常态样式。

完整产品行为以 `docs/PROJECT-HANDOFF.md` 为准。

## 三、正式任务

| 任务 | 正式任务 ID | 工作树 | 分支 | 基线 | 交付 |
| --- | --- | --- | --- | --- | --- |
| T101 开发 | `01a07fe3-689f-74b3-a323-9766ca37d210` | `C:/Users/Administrator/.codex/worktrees/c0f9/工作备忘录` | `codex/v29-export-category-selection` | `5ef5379` | `4cb0a22` |
| T102 开发 | `01a07fe3-2513-76f0-a0c1-d5b872e127a5` | `C:/Users/Administrator/.codex/worktrees/5306/工作备忘录` | `codex/v29-workbench-name` | `5ef5379` | `67f5cd9`、`a74499b` |
| T103 QA | `01a07ff9-e528-7740-b63e-39ae2d9a99ff` | `C:/Users/Administrator/.codex/worktrees/9e8e/工作备忘录` | `codex/v29-independent-qa-retest` | `bc784c0` | `17e32f9`、`2c769b8` |
| T104 开发 | `01a08020-2a02-7d70-9329-ec1e16d51ae9` | `C:/Users/Administrator/.codex/worktrees/7574/工作备忘录` | `codex/v29-workbench-name-layout` | `117de28` | `44c1e3a`、`b79fb74` |
| T105 QA | `01a08059-8c24-7320-a53b-c557b2c118f0` | `C:/Users/Administrator/.codex/worktrees/fcf7/工作备忘录` | `codex/v29-workbench-layout-qa` | `f8f1094` | `71f5d1d` |
| T106 打包 | `01a07f1f-98be-72c2-ac6b-cdcf4e2dda50` | `D:/CODEX项目/工作备忘录` | `integration/v2` | `1803335` | `37f7ffc` 构建产物 |

以上任务的 ID、工作树、分支、基线、依赖和进度均已核对；V2.9 开发与测试工作树在交付时均为干净状态。

## 四、验收与安装包

- 独立测试：前端 14 个文件、90/90 项通过；TypeScript 检查和 Vite 构建通过。
- V2.9 未改动 Rust 或数据层，沿用既有 Rust 与 SQLite 14/14 通过结果。
- Windows release 构建及隔离数据、WebView 目录启动验证通过，默认标题为“工作台”。
- 安装包：`src-tauri/target/release/bundle/nsis/工作备忘录_0.1.0_x64-setup.exe`，大小 `2847748` 字节，SHA-256 `5467DD4B5198A910A17E0B177320A8811C68BBB4363B501960476E3783C04F45`，未签名。
- 未静默安装，未上传或发布；完整证据见 `docs/QA-V2.9.md`。

## 五、保留事项

- 旧工作树 `C:/Users/Administrator/.codex/worktrees/f042/工作备忘录` 有未提交修改，必须保留；其有效修复已由 T101 重新实现并集成。
- 其他 V2.9 工作树虽已完成且干净，本记录未授权删除。
- 临时依赖备份位于 `C:/Users/Administrator/.codex/dependency-backups-v29`，不参与 Git，也不含用户数据。
- 当前状态看 `docs/ACTIVE-VERSION.md`，当前产品事实看 `docs/PROJECT-HANDOFF.md`。
